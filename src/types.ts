export type ServerModel = 
  | 'Dell PowerEdge R750'
  | 'Dell PowerEdge R650'
  | 'HPE ProLiant DL380 Gen10'
  | 'HPE ProLiant DL360 Gen10'
  | 'Supermicro Hyper SuperServer'
  | 'Lenovo ThinkSystem SR650 V2'
  | 'Cisco UCS C240 M6';

export type ComponentType = 'BIOS' | 'BMC' | 'NIC' | 'RAID' | 'NVMe';

export type ServerStatus = 
  | 'online'
  | 'maintenance'
  | 'upgrading'
  | 'rebooting'
  | 'needs_reboot'
  | 'degraded'
  | 'offline';

export type UpgradeStage = 
  | 'pending'
  | 'preflight'
  | 'bmc_staging'
  | 'flashing'
  | 'rebooting'
  | 'postcheck'
  | 'completed'
  | 'failed'
  | 'rolled_back';

export interface ComponentFirmware {
  type: ComponentType;
  name: string;
  vendor: string;
  currentVersion: string;
  latestVersion: string;
  status: 'up_to_date' | 'update_available' | 'critical_update';
  cveAlerts?: string[];
  rebootRequired: boolean;
}

export interface Server {
  id: string;
  hostname: string;
  cluster: string;
  datacenter: string;
  rack: string;
  unit: string;
  ip: string;
  bmcIp: string;
  bmcAffectedType: 'iDRAC9' | 'iLO 5' | 'Supermicro IPMI' | 'Lenovo XClarity' | 'Cisco IMC';
  model: ServerModel;
  architecture: 'x86_64' | 'aarch64';
  status: ServerStatus;
  powerState: 'on' | 'off' | 'rebooting';
  powerSupplyRedundancy: boolean;
  components: Record<ComponentType, ComponentFirmware>;
  lastUpgradeDate?: string;
  tags: string[];
  notes?: string;
}

export type SeverityLevel = 'critical' | 'security' | 'recommended' | 'optional';

export interface FirmwarePackage {
  id: string;
  name: string;
  component: ComponentType;
  version: string;
  releaseDate: string;
  severity: SeverityLevel;
  supportedModels: ServerModel[];
  minPrerequisiteVersion?: string;
  fileSizeMb: number;
  sha256: string;
  cves: string[];
  releaseNotes: string;
  rebootRequired: boolean;
  vendor: string;
  fileName: string;
}

export interface UpgradeJobServerProgress {
  serverId: string;
  hostname: string;
  component: ComponentType;
  fromVersion: string;
  toVersion: string;
  stage: UpgradeStage;
  progressPercent: number;
  currentStepMessage: string;
  startedAt?: string;
  completedAt?: string;
  error?: string;
  logs: Array<{ timestamp: string; level: 'info' | 'warn' | 'error' | 'success'; message: string }>;
}

export interface UpgradeCampaign {
  id: string;
  title: string;
  createdAt: string;
  targetComponent: ComponentType | 'FULL_BASELINE';
  targetFirmwareId?: string;
  status: 'running' | 'paused' | 'completed' | 'failed' | 'aborted';
  concurrencyLimit: number; // e.g., 2 servers at a time
  autoReboot: boolean;
  stopOnFirstFailure: boolean;
  preflightChecksRequired: boolean;
  servers: UpgradeJobServerProgress[];
}

export interface AuditRecord {
  id: string;
  timestamp: string;
  serverHostname: string;
  serverId: string;
  component: ComponentType;
  fromVersion: string;
  toVersion: string;
  status: 'success' | 'failed' | 'rolled_back';
  operator: string;
  durationSeconds: number;
  firmwarePackageName: string;
}

export interface BaselineConfig {
  id: string;
  name: string;
  description: string;
  rules: {
    [key in ComponentType]?: string; // version required
  };
  enforceSecurityPatches: boolean;
}
