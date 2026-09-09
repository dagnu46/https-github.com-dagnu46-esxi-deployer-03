import { Server, FirmwarePackage, AuditRecord, BaselineConfig, UpgradeCampaign } from '../types';
import { 
  loadServers, 
  saveServers, 
  loadFirmwarePackages, 
  saveFirmwarePackages, 
  loadAuditLogs, 
  saveAuditLogs, 
  loadBaseline, 
  saveBaseline, 
  loadActiveCampaign, 
  saveActiveCampaign 
} from '../utils/storage';

export interface DatabaseStatus {
  connected: boolean;
  latencyMs?: number;
  tableCounts?: Record<string, number>;
  databaseName?: string;
  serverVersion?: string;
  connectionStringSanitized?: string;
  error?: string;
}

export async function getDbStatus(): Promise<DatabaseStatus> {
  try {
    const res = await fetch('/api/db/status');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err: any) {
    return {
      connected: false,
      error: err.message || 'API endpoint unreachable',
    };
  }
}

export async function testDbConnection(): Promise<DatabaseStatus> {
  try {
    const res = await fetch('/api/db/test', { method: 'POST' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err: any) {
    return {
      connected: false,
      error: err.message || 'Connection test failed',
    };
  }
}

export async function reseedDb(): Promise<{ success: boolean; message?: string; error?: string }> {
  try {
    const res = await fetch('/api/db/seed', { method: 'POST' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function flushDb(): Promise<{ success: boolean; message?: string; error?: string }> {
  try {
    const res = await fetch('/api/db/flush', { method: 'POST' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

// -------------------------------------------------------------
// Data synchronization with PostgreSQL + local fallback
// -------------------------------------------------------------

export async function syncLoadServers(): Promise<{ servers: Server[]; source: 'postgres' | 'local' }> {
  try {
    const res = await fetch('/api/servers');
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        saveServers(data); // Cache in local storage
        return { servers: data, source: 'postgres' };
      }
    }
  } catch (e) {
    // API not reachable, use local storage
  }
  return { servers: loadServers(), source: 'local' };
}

export async function syncSaveServer(server: Server): Promise<void> {
  // Update local storage first
  const local = loadServers();
  const index = local.findIndex(s => s.id === server.id);
  if (index >= 0) {
    local[index] = server;
  } else {
    local.push(server);
  }
  saveServers(local);

  // Sync to PostgreSQL backend
  try {
    await fetch('/api/servers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(server),
    });
  } catch (e) {
    // Will be kept in local storage and re-synced
  }
}

export async function syncDeleteServer(id: string): Promise<void> {
  const local = loadServers().filter(s => s.id !== id);
  saveServers(local);

  try {
    await fetch(`/api/servers/${id}`, { method: 'DELETE' });
  } catch (e) {
    // Local delete handled
  }
}

export async function syncLoadPackages(): Promise<{ packages: FirmwarePackage[]; source: 'postgres' | 'local' }> {
  try {
    const res = await fetch('/api/packages');
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        saveFirmwarePackages(data);
        return { packages: data, source: 'postgres' };
      }
    }
  } catch (e) {}
  return { packages: loadFirmwarePackages(), source: 'local' };
}

export async function syncSavePackage(pkg: FirmwarePackage): Promise<void> {
  const local = loadFirmwarePackages();
  const index = local.findIndex(p => p.id === pkg.id);
  if (index >= 0) {
    local[index] = pkg;
  } else {
    local.push(pkg);
  }
  saveFirmwarePackages(local);

  try {
    await fetch('/api/packages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(pkg),
    });
  } catch (e) {}
}

export async function syncDeletePackage(id: string): Promise<void> {
  const local = loadFirmwarePackages().filter(p => p.id !== id);
  saveFirmwarePackages(local);

  try {
    await fetch(`/api/packages/${id}`, { method: 'DELETE' });
  } catch (e) {}
}

export async function syncLoadAuditLogs(): Promise<{ logs: AuditRecord[]; source: 'postgres' | 'local' }> {
  try {
    const res = await fetch('/api/audit-logs');
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data)) {
        saveAuditLogs(data);
        return { logs: data, source: 'postgres' };
      }
    }
  } catch (e) {}
  return { logs: loadAuditLogs(), source: 'local' };
}

export async function syncSaveAuditLog(log: AuditRecord): Promise<void> {
  const local = [log, ...loadAuditLogs()];
  saveAuditLogs(local);

  try {
    await fetch('/api/audit-logs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(log),
    });
  } catch (e) {}
}

export async function syncLoadBaseline(): Promise<{ baseline: BaselineConfig; source: 'postgres' | 'local' }> {
  try {
    const res = await fetch('/api/baseline');
    if (res.ok) {
      const data = await res.json();
      if (data && data.id) {
        saveBaseline(data);
        return { baseline: data, source: 'postgres' };
      }
    }
  } catch (e) {}
  return { baseline: loadBaseline(), source: 'local' };
}

export async function syncSaveBaseline(baseline: BaselineConfig): Promise<void> {
  saveBaseline(baseline);
  try {
    await fetch('/api/baseline', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(baseline),
    });
  } catch (e) {}
}

export async function syncLoadCampaign(): Promise<{ campaign: UpgradeCampaign | null; source: 'postgres' | 'local' }> {
  try {
    const res = await fetch('/api/campaigns');
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        const active = data.find(c => c.status === 'running') || data[0];
        saveActiveCampaign(active);
        return { campaign: active, source: 'postgres' };
      }
    }
  } catch (e) {}
  return { campaign: loadActiveCampaign(), source: 'local' };
}

export async function syncSaveCampaign(campaign: UpgradeCampaign | null): Promise<void> {
  saveActiveCampaign(campaign);
  if (!campaign) return;

  try {
    await fetch('/api/campaigns', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(campaign),
    });
  } catch (e) {}
}
