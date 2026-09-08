export type ServerVendor = 'HP' | 'DELL' | 'LENOVO';

export type HypervisorType = 'VMware ESXi' | 'VMware ESXi on Nutanix' | 'Xen Server';

export type ServerModel = 
  // HP / HPE
  | 'HPE ProLiant DL380 Gen10'
  | 'HPE ProLiant DL380 Gen11'
  | 'HPE ProLiant DL360 Gen10'
  | 'HPE Synergy 480 Gen10'
  // DELL
  | 'Dell PowerEdge R750'
  | 'Dell PowerEdge R650'
  | 'Dell PowerEdge R740xd'
  | 'Dell PowerEdge MX750c'
  // LENOVO
  | 'Lenovo ThinkSystem SR650 V2'
  | 'Lenovo ThinkSystem SR630 V2'
  | 'Lenovo ThinkSystem SR650 V3'
  | 'Lenovo ThinkSystem SR670 V2'
  | string;

export type BmcAffectedType = 
  | 'iDRAC9' 
  | 'iDRAC8' 
  | 'iLO 5' 
  | 'iLO 6' 
  | 'Lenovo XClarity' 
  | 'Lenovo XCC2' 
  | 'Supermicro IPMI' 
  | 'Cisco IMC';

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

export type BmcProtocol = 'redfish' | 'ipmi' | 'https';

export interface ServerCredentials {
  bmcUsername: string;
  bmcPassword?: string;
  bmcProtocol: BmcProtocol;
  bmcPort: number;
  ignoreSslErrors: boolean;
  enableSsh?: boolean;
  sshPort?: number;
  sshUsername?: string;
  sshAuthType?: 'password' | 'key';
  sshPassword?: string;
  sshKey?: string;
}

export interface AccessTestStep {
  id: string;
  name: string;
  status: 'pending' | 'running' | 'success' | 'failed' | 'skipped';
  message: string;
  latencyMs?: number;
  details?: string;
}

export interface AccessTestResult {
  status: 'untested' | 'testing' | 'success' | 'failed' | 'partial';
  testedAt?: string;
  testedBy?: string;
  summary: string;
  latencyMs?: number;
  steps: AccessTestStep[];
  discoveredHardware?: {
    model?: string;
    serialNumber?: string;
    powerState?: 'on' | 'off';
    bmcVersionDetected?: string;
    biosVersionDetected?: string;
    chassisHealth?: 'OK' | 'Warning' | 'Critical';
    macAddress?: string;
    redfishVersion?: string;
  };
  errorDetails?: string;
}

export interface Server {
  id: string;
  hostname: string;
  vendor: ServerVendor;
  hypervisor: HypervisorType;
  hypervisorVersion?: string;
  hypervisorMaintenanceMode?: boolean;
  activeVmsCount?: number;
  cluster: string;
  datacenter: string;
  rack: string;
  unit: string;
  ip: string;
  bmcIp: string;
  bmcAffectedType: BmcAffectedType;
  model: ServerModel;
  architecture: 'x86_64' | 'aarch64';
  status: ServerStatus;
  powerState: 'on' | 'off' | 'rebooting';
  powerSupplyRedundancy: boolean;
  components: Record<ComponentType, ComponentFirmware>;
  credentials?: ServerCredentials;
  accessStatus?: AccessTestResult;
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
