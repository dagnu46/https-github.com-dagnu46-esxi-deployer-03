import { 
  Server, 
  FirmwarePackage, 
  AuditRecord, 
  BaselineConfig, 
  UpgradeCampaign, 
  VmwareVcenterConfig, 
  VmwareIsoMountRequest, 
  VmwareIsoMountResult, 
  VmwareVmInfo,
  VmwareDatastoreInfo,
  VmwareFileUploadResult,
  VmwarePowerStateResult
} from '../types';
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

// -------------------------------------------------------------
// VMware vCenter & Virtual Machine ISO Testing
// -------------------------------------------------------------

export async function testVcenterConnection(config: VmwareVcenterConfig): Promise<{
  success: boolean;
  authenticated: boolean;
  isSimulation?: boolean;
  vcenterHost?: string;
  datacenter?: string;
  latencyMs?: number;
  vms?: VmwareVmInfo[];
  datastores?: string[];
  error?: string;
  details?: string;
}> {
  try {
    const res = await fetch('/api/vmware/vcenter/test-connection', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config),
    });
    return await res.json();
  } catch (e: any) {
    return { success: false, authenticated: false, error: e.message || 'Failed to reach vCenter Server' };
  }
}

export async function mountIsoOnVmwareVm(mountReq: VmwareIsoMountRequest): Promise<VmwareIsoMountResult> {
  try {
    const res = await fetch('/api/vmware/vms/mount-iso', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(mountReq),
    });
    return await res.json();
  } catch (e: any) {
    return {
      success: false,
      mountedAt: new Date().toISOString(),
      vmName: mountReq.vmName || 'Target VM',
      vmId: mountReq.vmId,
      isoPathMounted: mountReq.isoDatastorePath,
      cdromDeviceLabel: 'CD/DVD Drive 1',
      connected: false,
      powerState: 'poweredOff',
      steps: [],
      error: e.message || 'ISO Mount API request failed'
    };
  }
}

export async function unmountIsoFromVmwareVm(params: { vmId: string; vmName?: string }): Promise<{
  success: boolean;
  unmountedAt?: string;
  message?: string;
  error?: string;
}> {
  try {
    const res = await fetch('/api/vmware/vms/unmount-iso', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    return await res.json();
  } catch (e: any) {
    return { success: false, error: e.message || 'ISO Unmount request failed' };
  }
}

export async function fetchVmwareDatastores(params: {
  config: VmwareVcenterConfig;
  vmId?: string;
  vmName?: string;
}): Promise<{
  success: boolean;
  isSimulation?: boolean;
  datastores: VmwareDatastoreInfo[];
  total?: number;
  retrievedAt?: string;
  latencyMs?: number;
  targetVmId?: string;
  targetVmName?: string;
  message?: string;
  error?: string;
}> {
  try {
    const res = await fetch('/api/vmware/datastores', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        vcenter: params.config,
        vmId: params.vmId,
        vmName: params.vmName
      }),
    });
    return await res.json();
  } catch (e: any) {
    return {
      success: false,
      datastores: [],
      error: e.message || 'Failed to retrieve datastores from vCenter',
    };
  }
}

export async function uploadFileToDatastore(params: {
  fileName: string;
  fileContentBase64?: string;
  fileSize?: number;
  datastore: string;
}): Promise<VmwareFileUploadResult> {
  try {
    const res = await fetch('/api/vmware/datastores/upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    return await res.json();
  } catch (e: any) {
    return {
      success: false,
      fileName: params.fileName,
      fileSize: params.fileSize || 0,
      datastore: params.datastore,
      datastorePath: `[${params.datastore}] iso/${params.fileName}`,
      storedPathOnServer: '',
      verifiedOnServer: false,
      uploadedAt: new Date().toISOString(),
      error: e.message || 'Failed to upload and verify file on datastore',
    };
  }
}

export async function verifyDatastoreFile(params: {
  fileName: string;
  datastore: string;
}): Promise<VmwareFileUploadResult> {
  try {
    const res = await fetch('/api/vmware/datastores/verify-file', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    return await res.json();
  } catch (e: any) {
    return {
      success: false,
      fileName: params.fileName,
      fileSize: 0,
      datastore: params.datastore,
      datastorePath: `[${params.datastore}] iso/${params.fileName}`,
      storedPathOnServer: '',
      verifiedOnServer: false,
      uploadedAt: new Date().toISOString(),
      error: e.message || 'Verification check failed',
    };
  }
}

export async function manageVmPowerState(params: {
  vmId: string;
  vmName?: string;
  action: 'powerOn' | 'powerOff' | 'reset' | 'status';
  vcenter?: VmwareVcenterConfig;
}): Promise<VmwarePowerStateResult> {
  try {
    const res = await fetch('/api/vmware/vms/power-state', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    return await res.json();
  } catch (e: any) {
    return {
      success: false,
      vmId: params.vmId,
      vmName: params.vmName || 'Target VM',
      powerState: 'poweredOff',
      lastChecked: new Date().toISOString(),
      error: e.message || 'Power state command failed',
    };
  }
}


