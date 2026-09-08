import { Server, FirmwarePackage, AuditRecord, BaselineConfig, UpgradeCampaign } from '../types';
import { INITIAL_SERVERS, INITIAL_FIRMWARE_PACKAGES, INITIAL_AUDIT_LOGS, DEFAULT_BASELINE } from '../data/mockFleet';

const STORAGE_KEYS = {
  SERVERS: 'sfm_servers_v1',
  FIRMWARE_PACKAGES: 'sfm_firmware_v1',
  AUDIT_LOGS: 'sfm_audit_v1',
  BASELINE: 'sfm_baseline_v1',
  CAMPAIGN: 'sfm_campaign_v1',
};

export function loadServers(): Server[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.SERVERS);
    if (!raw) {
      saveServers(INITIAL_SERVERS);
      return INITIAL_SERVERS;
    }
    return JSON.parse(raw);
  } catch (e) {
    console.error('Failed to parse stored servers', e);
    return INITIAL_SERVERS;
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
    if (!raw) {
      saveFirmwarePackages(INITIAL_FIRMWARE_PACKAGES);
      return INITIAL_FIRMWARE_PACKAGES;
    }
    return JSON.parse(raw);
  } catch (e) {
    console.error('Failed to parse firmware packages', e);
    return INITIAL_FIRMWARE_PACKAGES;
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
    if (!raw) {
      saveAuditLogs(INITIAL_AUDIT_LOGS);
      return INITIAL_AUDIT_LOGS;
    }
    return JSON.parse(raw);
  } catch (e) {
    console.error('Failed to parse audit logs', e);
    return INITIAL_AUDIT_LOGS;
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
  saveServers(INITIAL_SERVERS);
  saveFirmwarePackages(INITIAL_FIRMWARE_PACKAGES);
  saveAuditLogs(INITIAL_AUDIT_LOGS);
  saveBaseline(DEFAULT_BASELINE);
  saveActiveCampaign(null);
  return {
    servers: INITIAL_SERVERS,
    packages: INITIAL_FIRMWARE_PACKAGES,
    auditLogs: INITIAL_AUDIT_LOGS,
    baseline: DEFAULT_BASELINE,
  };
}
