import { Server, FirmwarePackage, AuditRecord, BaselineConfig, UpgradeCampaign } from '../types';
import { DEFAULT_BASELINE } from '../data/mockFleet';

const STORAGE_KEYS = {
  SERVERS: 'sfm_servers_v1',
  FIRMWARE_PACKAGES: 'sfm_firmware_v1',
  AUDIT_LOGS: 'sfm_audit_v1',
  BASELINE: 'sfm_baseline_v1',
  CAMPAIGN: 'sfm_campaign_v1',
  CAMPAIGNS: 'sfm_campaigns_v2',
  FLUSHED: 'sfm_flushed_v1',
};

// Known legacy mock IDs to scrub so user never sees residual mock data
const LEGACY_MOCK_SERVER_IDS = new Set([
  'srv-01', 'srv-02', 'srv-03', 'srv-04', 'srv-05', 'srv-06',
  'srv-07', 'srv-08', 'srv-09', 'srv-10', 'srv-11', 'srv-12'
]);

const LEGACY_MOCK_PACKAGE_IDS = new Set([
  'fw-iso-hpe-spp-2026.08', 'fw-iso-dell-suu-26.08', 'fw-bios-dell-2.20.0',
  'fw-bmc-dell-7.00.00.00', 'fw-nic-mellanox-22.39', 'fw-raid-broadcom-52.16',
  'fw-nvme-kioxia-1.3.0', 'fw-bios-hpe-2.92', 'fw-bmc-hpe-ilo5-2.98',
  'fw-bios-lenovo-3.40', 'fw-bmc-lenovo-xcc-4.80'
]);

const LEGACY_MOCK_AUDIT_IDS = new Set(['aud-101', 'aud-102', 'aud-103', 'aud-104']);

export function isStorageFlushed(): boolean {
  try {
    const val = localStorage.getItem(STORAGE_KEYS.FLUSHED);
    return val === 'true';
  } catch {
    return false;
  }
}

export function flushAllStorage(): void {
  try {
    localStorage.setItem(STORAGE_KEYS.FLUSHED, 'true');
    localStorage.setItem(STORAGE_KEYS.SERVERS, JSON.stringify([]));
    localStorage.setItem(STORAGE_KEYS.FIRMWARE_PACKAGES, JSON.stringify([]));
    localStorage.setItem(STORAGE_KEYS.AUDIT_LOGS, JSON.stringify([]));
    localStorage.removeItem(STORAGE_KEYS.CAMPAIGN);
    localStorage.removeItem(STORAGE_KEYS.CAMPAIGNS);
  } catch (e) {
    console.error('Failed to flush storage', e);
  }
}

export function loadServers(): Server[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.SERVERS);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    // Scrub any legacy mock servers that might be cached in local storage
    const realOnly = parsed.filter(s => 
      !LEGACY_MOCK_SERVER_IDS.has(s.id) &&
      !s.hostname?.includes('mgmt.prod') &&
      !s.hostname?.includes('citrix.prod') &&
      !s.hostname?.includes('compute.lab')
    );

    if (realOnly.length !== parsed.length) {
      saveServers(realOnly);
    }
    return realOnly;
  } catch (e) {
    console.error('Failed to parse stored servers', e);
    return [];
  }
}

export function saveServers(servers: Server[]): void {
  try {
    localStorage.setItem(STORAGE_KEYS.SERVERS, JSON.stringify(servers));
  } catch (e) {
    console.error('Failed to save servers', e);
  }
}

export function loadFirmwarePackages(): FirmwarePackage[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.FIRMWARE_PACKAGES);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    const realOnly = parsed.filter(p => !LEGACY_MOCK_PACKAGE_IDS.has(p.id));
    if (realOnly.length !== parsed.length) {
      saveFirmwarePackages(realOnly);
    }
    return realOnly;
  } catch (e) {
    console.error('Failed to parse firmware packages', e);
    return [];
  }
}

export function saveFirmwarePackages(packages: FirmwarePackage[]): void {
  try {
    localStorage.setItem(STORAGE_KEYS.FIRMWARE_PACKAGES, JSON.stringify(packages));
  } catch (e) {
    console.error('Failed to save firmware packages', e);
  }
}

export function loadAuditLogs(): AuditRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.AUDIT_LOGS);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    const realOnly = parsed.filter(a => !LEGACY_MOCK_AUDIT_IDS.has(a.id));
    if (realOnly.length !== parsed.length) {
      saveAuditLogs(realOnly);
    }
    return realOnly;
  } catch (e) {
    console.error('Failed to parse audit logs', e);
    return [];
  }
}

export function saveAuditLogs(logs: AuditRecord[]): void {
  try {
    localStorage.setItem(STORAGE_KEYS.AUDIT_LOGS, JSON.stringify(logs));
  } catch (e) {
    console.error('Failed to save audit logs', e);
  }
}

export function loadBaseline(): BaselineConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.BASELINE);
    if (!raw) {
      saveBaseline(DEFAULT_BASELINE);
      return DEFAULT_BASELINE;
    }
    return JSON.parse(raw);
  } catch (e) {
    console.error('Failed to parse baseline config', e);
    return DEFAULT_BASELINE;
  }
}

export function saveBaseline(baseline: BaselineConfig): void {
  try {
    localStorage.setItem(STORAGE_KEYS.BASELINE, JSON.stringify(baseline));
  } catch (e) {
    console.error('Failed to save baseline', e);
  }
}

export function loadCampaigns(): UpgradeCampaign[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.CAMPAIGNS);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
    // Fallback to single campaign if stored in legacy key
    const single = loadActiveCampaign();
    return single ? [single] : [];
  } catch (e) {
    console.error('Failed to load campaigns', e);
    return [];
  }
}

export function saveCampaigns(campaigns: UpgradeCampaign[]): void {
  try {
    localStorage.setItem(STORAGE_KEYS.CAMPAIGNS, JSON.stringify(campaigns));
    // Keep active campaign in sync
    const active = campaigns.find(c => c.status === 'running') || campaigns[0] || null;
    saveActiveCampaign(active);
  } catch (e) {
    console.error('Failed to save campaigns', e);
  }
}

export function saveCampaign(campaign: UpgradeCampaign): void {
  const all = loadCampaigns();
  const idx = all.findIndex(c => c.id === campaign.id);
  if (idx >= 0) {
    all[idx] = campaign;
  } else {
    all.unshift(campaign);
  }
  saveCampaigns(all);
}

export function deleteCampaign(id: string): void {
  const all = loadCampaigns().filter(c => c.id !== id);
  saveCampaigns(all);
}

export function loadActiveCampaign(): UpgradeCampaign | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.CAMPAIGN);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (e) {
    return null;
  }
}

export function saveActiveCampaign(campaign: UpgradeCampaign | null): void {
  try {
    if (campaign) {
      localStorage.setItem(STORAGE_KEYS.CAMPAIGN, JSON.stringify(campaign));
    } else {
      localStorage.removeItem(STORAGE_KEYS.CAMPAIGN);
    }
  } catch (e) {
    console.error('Failed to save active campaign', e);
  }
}

export function resetToDemoFleet(): {
  servers: Server[];
  packages: FirmwarePackage[];
  auditLogs: AuditRecord[];
  baseline: BaselineConfig;
} {
  flushAllStorage();
  return {
    servers: [],
    packages: [],
    auditLogs: [],
    baseline: DEFAULT_BASELINE,
  };
}
