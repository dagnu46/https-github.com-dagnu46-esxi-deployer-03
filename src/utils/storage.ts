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
    const parsed: Server[] = JSON.parse(raw);

    // If existing cached data was from an older template lacking HP or LENOVO or Xen Server, refresh to the rich fleet
    const hasHp = parsed.some(s => s.vendor === 'HP' || s.model?.includes('HPE') || s.model?.includes('HP'));
    const hasLenovo = parsed.some(s => s.vendor === 'LENOVO' || s.model?.includes('Lenovo'));
    const hasXen = parsed.some(s => s.hypervisor === 'Xen Server');
    if (!hasHp || !hasLenovo || !hasXen) {
      saveServers(INITIAL_SERVERS);
      return INITIAL_SERVERS;
    }

    const migrated = parsed.map((s, idx) => {
      if (!s.vendor) {
        if (s.model?.includes('HPE') || s.model?.includes('HP')) {
          s.vendor = 'HP';
        } else if (s.model?.includes('Lenovo')) {
          s.vendor = 'LENOVO';
        } else {
          s.vendor = 'DELL';
        }
      }
      if (!s.hypervisor) {
        if (s.cluster?.toLowerCase().includes('nutanix') || s.notes?.toLowerCase().includes('nutanix')) {
          s.hypervisor = 'VMware ESXi on Nutanix';
          s.hypervisorVersion = 'ESXi 7.0u3 / Nutanix AOS 6.5.4';
        } else if (s.cluster?.toLowerCase().includes('xen') || s.hostname?.includes('xen')) {
          s.hypervisor = 'Xen Server';
          s.hypervisorVersion = 'XenServer 8.2 CU1 (Citrix Hypervisor)';
        } else {
          s.hypervisor = 'VMware ESXi';
          s.hypervisorVersion = 'ESXi 8.0 Update 2 (Build 22380479)';
        }
      }
      if (s.hypervisorMaintenanceMode === undefined) {
        s.hypervisorMaintenanceMode = false;
      }
      if (s.activeVmsCount === undefined) {
        s.activeVmsCount = 12 + (idx * 3) % 15;
      }
      if (!s.credentials) {
        s.credentials = {
          bmcUsername: 'root',
          bmcPassword: '••••••••',
          bmcProtocol: s.bmcAffectedType === 'Supermicro IPMI' ? 'ipmi' : 'redfish',
          bmcPort: s.bmcAffectedType === 'Supermicro IPMI' ? 623 : 443,
          ignoreSslErrors: true,
          enableSsh: true,
          sshPort: 22,
          sshUsername: 'sysadmin',
          sshAuthType: 'key',
        };
      }
      if (!s.accessStatus) {
        s.accessStatus = {
          status: 'success',
          testedAt: '2026-09-07T18:30:00Z',
          testedBy: 'Automated Fleet Scanner',
          summary: `Verified ${s.credentials.bmcProtocol.toUpperCase()} access (18ms response)`,
          latencyMs: 18,
          steps: [
            { id: '1', name: 'Network Route & ICMP', status: 'success', message: 'Host & BMC IP reachable (1.4ms)' },
            { id: '2', name: 'Port & TLS Handshake', status: 'success', message: `TCP port ${s.credentials.bmcPort} open` },
            { id: '3', name: 'BMC Authentication', status: 'success', message: `Auth token granted for user '${s.credentials.bmcUsername}'` },
            { id: '4', name: 'Telemetry Discovery', status: 'success', message: `Power: ${s.powerState.toUpperCase()} • Chassis Health: OK` },
          ],
          discoveredHardware: {
            model: s.model,
            serialNumber: `SN-${s.hostname.slice(-6).toUpperCase()}`,
            powerState: s.powerState === 'rebooting' ? 'on' : s.powerState,
            bmcVersionDetected: s.components.BMC?.currentVersion,
            biosVersionDetected: s.components.BIOS?.currentVersion,
            chassisHealth: 'OK',
            redfishVersion: 'v1.15',
          },
        };
      }
      return s;
    });
    return migrated;
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
