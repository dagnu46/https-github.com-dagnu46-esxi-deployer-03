export type ServerVendor = 'HP' | 'DELL' | 'LENOVO';

export type HypervisorType = 'VMware ESXi' | 'VMware ESXi on Nutanix' | 'Xen Server' | 'Baremetal (No OS)';

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

export interface ComponentDependency {
  targetComponent: ComponentType | 'Hypervisor';
  minVersion: string;
  maxVersion?: string;
  criticality: 'blocking' | 'required' | 'recommended';
  description: string;
}

export interface ComponentDependencyRule {
  id: string;
  vendor: ServerVendor | 'ALL';
  sourceComponent: ComponentType;
  sourceVersionMin: string;
  targetComponent: ComponentType | 'Hypervisor';
  targetMinVersion: string;
  targetRecommendedVersion?: string;
  criticality: 'blocking' | 'required' | 'recommended';
  reason: string;
  incompatibleConsequence: string;
  resolutionGuidance: string;
}

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
  packageFormat?: 'ISO' | 'BIN' | 'FWPKG' | 'ZIP' | 'EXE';
  dependencies?: ComponentDependency[];
  storedPathOnServer?: string;
  relativeServerPath?: string;
  verifiedOnDisk?: boolean;
  fileSizeBytes?: number;
  verifiedAt?: string;
  diskPermissions?: string;
  diskMd5?: string;
}

export interface DiskVerificationResult {
  success: boolean;
  exists: boolean;
  fileName: string;
  storedPathOnServer?: string;
  relativeServerPath?: string;
  fileSizeBytes?: number;
  fileSizeMb?: number;
  sha256?: string;
  md5?: string;
  permissions?: string;
  createdAt?: string;
  modifiedAt?: string;
  message?: string;
  error?: string;
  searchedPaths?: string[];
}

export interface ServerStorageFile {
  fileName: string;
  storedPathOnServer: string;
  relativeServerPath: string;
  fileSizeBytes: number;
  fileSizeMb: number;
  sha256: string;
  md5?: string;
  permissions?: string;
  modifiedAt: string;
  folder: 'firmware' | 'datastores';
}

export interface CampaignFirmwareTask {
  id: string;
  order: number; // 1, 2, 3...
  component: ComponentType;
  packageId?: string;
  targetFirmwareId?: string;
  packageName?: string;
  targetVersion: string;
  rebootRequired?: boolean;
  notes?: string;
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
  currentTaskIndex?: number;
  completedTasksCount?: number;
  totalTasksCount?: number;
  startedAt?: string;
  completedAt?: string;
  error?: string;
  networkStatus?: 'reachable' | 'unreachable' | 'untested';
  ipmiStatus?: 'verified' | 'failed' | 'untested';
  credentialsStatus?: 'valid' | 'invalid' | 'untested';
  lastTelemetry?: {
    powerState?: string;
    psuRedundant?: boolean;
    bmcVersion?: string;
    latencyMs?: number;
    checkedAt?: string;
  };
  logs: Array<{ timestamp: string; level: 'info' | 'warn' | 'error' | 'success'; message: string }>;
}

export interface UpgradeCampaign {
  id: string;
  title: string;
  description?: string;
  createdAt: string;
  updatedAt?: string;
  targetComponent: ComponentType | 'FULL_BASELINE';
  targetFirmwareId?: string;
  tasks?: CampaignFirmwareTask[]; // Ranked ordered firmware tasks
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
  updatedAt?: string;
}

export interface VmwareVcenterConfig {
  host: string;
  port: number;
  username: string;
  password?: string;
  datacenter?: string;
  datastore?: string;
  ignoreSsl: boolean;
  sessionToken?: string;
}

export interface VmwareVmInfo {
  id: string;
  name: string;
  powerState: 'poweredOn' | 'poweredOff' | 'suspended';
  guestOs: string;
  cpus: number;
  memoryMb: number;
  ipAddress?: string;
  cdromBacking?: {
    connected: boolean;
    startConnected: boolean;
    isoPath?: string;
    deviceLabel?: string;
  };
}

export interface VmwareDatastoreInfo {
  name: string;
  type: string; // VMFS-6, vSAN, NFS-4.1, etc.
  capacityBytes: number;
  freeBytes: number;
  accessible: boolean;
  status: 'normal' | 'warning' | 'alert';
  url?: string;
  vmAccessible?: boolean;
  mountedDisksCount?: number;
  source?: string;
  isUserDefined?: boolean;
}

export interface VmwareFileUploadResult {
  success: boolean;
  fileName: string;
  fileSize: number;
  datastore: string;
  datastorePath: string; // e.g. [datastore1] iso/P89201_SPP.iso
  storedPathOnServer: string; // real filesystem path on server
  verifiedOnServer: boolean;
  sha256?: string;
  md5?: string;
  permissions?: string;
  uploadedAt: string;
  error?: string;
}

export interface VmwarePowerStateResult {
  success: boolean;
  vmId: string;
  vmName: string;
  powerState: 'poweredOn' | 'poweredOff' | 'suspended';
  uptimeSeconds?: number;
  guestHeartbeat?: 'green' | 'yellow' | 'red' | 'gray';
  toolsStatus?: 'toolsOk' | 'toolsNotRunning' | 'toolsNotInstalled';
  bootDevice?: string;
  cdromConnected?: boolean;
  cdromIsoPath?: string | null;
  cpus?: number;
  memoryMb?: number;
  guestOs?: string;
  ipAddress?: string;
  lastChecked: string;
  message?: string;
  error?: string;
}

export interface VmwareLogEntry {
  id: string;
  timestamp: string;
  level: 'info' | 'success' | 'warn' | 'error';
  category: 'VCENTER' | 'DATASTORE' | 'UPLOAD' | 'VERIFY' | 'CONNECT' | 'POWER' | 'SYSTEM';
  message: string;
  details?: string;
}

export interface VmwareIsoMountRequest {
  vcenter: VmwareVcenterConfig;
  vmId: string;
  vmName: string;
  packageId?: string;
  packageName?: string;
  isoDatastorePath: string; // e.g., [datastore1] iso/firmware-update-v2.92.iso
  autoPowerOn?: boolean;
  cdromDeviceLabel?: string;
}

export interface VmwareMountStep {
  id: string;
  name: string;
  status: 'pending' | 'running' | 'success' | 'failed' | 'skipped';
  message: string;
  latencyMs?: number;
  details?: string;
}

export interface VmwareIsoMountResult {
  success: boolean;
  realDispatched?: boolean;
  liveVcenterUpdated?: boolean;
  vcenterTaskId?: string;
  vcenterTaskNotice?: string;
  whyNoTaskDiagnostic?: {
    networkBoundary: string;
    datastoreRequirement: string;
    taskGenerationRule: string;
    realTaskStatus?: string;
    reason?: string;
    explanation?: string;
    resolution?: string;
  };
  mountedAt: string;
  vmName: string;
  vmId: string;
  isoPathMounted: string;
  cdromDeviceLabel: string;
  connected: boolean;
  powerState: 'poweredOn' | 'poweredOff' | 'suspended';
  steps: VmwareMountStep[];
  error?: string;
}

export interface VmwareLiveVerificationResult {
  success: boolean;
  testedAt: string;
  vmId: string;
  vmName: string;
  vcenterReachable: boolean;
  vmExistsInVcenter: boolean;
  cdromBackingType?: string;
  isoFileInVcenter?: string;
  isConnectedInVcenter?: boolean;
  startConnectedInVcenter?: boolean;
  matchesCurrentAppMount: boolean;
  vcenterHost?: string;
  rawCdromDevices?: any[];
  diagnosticMessage: string;
  recommendedAction: string;
  error?: string;
}

// -------------------------------------------------------------
// Bare-Metal VMware ESXi Deployment Orchestrator Types
// (Dell OpenManage & Lenovo LXCA Workflows)
// -------------------------------------------------------------

export type BaremetalVendor = 'DELL' | 'LENOVO';

export interface BaremetalNetworkProfile {
  hostname: string;
  useDhcp: boolean;
  staticIp?: string;
  subnetMask?: string;
  gateway?: string;
  dnsServers?: string;
  ntpServers?: string;
  managementVlan?: number;
  rootPassword?: string;
  enableSsh: boolean;
  enableEsxiShell: boolean;
  vmk0UplinkNics: string[];
}

export interface DellOpenManageWorkflowConfig {
  omeHost: string;
  omePort: number;
  omeUsername: string;
  omePassword?: string;
  deviceGroupId: string;
  deviceGroupName: string;
  templateId: string;
  templateName: string; // e.g. "PowerEdge ESXi 8.0 Deployment Template"
  targetBootDevice: 'BOSS-S1_RAID1' | 'BOSS-S2_RAID1' | 'PERC_H755_RAID1' | 'PERC_H740P_RAID1' | 'FIRST_DISK';
  dellCustomizedIso: string; // e.g. "VMware-VMvisor-Installer-8.0U2-Dell-Customized-A01.iso"
  installIsmAgent: boolean; // Dell iDRAC Service Module (iSM)
  installOmsaVib: boolean; // OpenManage Server Administrator VIB
  enableSecureBoot: boolean;
  virtualizationVT: boolean;
  sriovEnabled: boolean;
  powerProfile: 'Performance' | 'DAPC' | 'PerformancePerWatt';
  autoRegisterOmeInventory: boolean;
  networkProfile: BaremetalNetworkProfile;
}

export interface LenovoLxcaWorkflowConfig {
  lxcaHost: string;
  lxcaPort: number;
  lxcaUsername: string;
  lxcaPassword?: string;
  configPatternId: string;
  configPatternName: string; // e.g. "ThinkSystem SR650 ESXi UEFI+RAID Pattern"
  targetBootDevice: 'M2_RAID1' | 'RAID_930_8i_VD0' | 'RAID_530_8i_VD0' | 'FIRST_DRIVE';
  lenovoCustomizedIso: string; // e.g. "VMware-VMvisor-Installer-8.0U2-Lenovo-ThinkSystem-v1.4.iso"
  enableXccAgentProvider: boolean; // Lenovo XCC Agent & CIM Provider
  enableSecureBoot: boolean;
  uefiBootMode: 'UEFI_Only' | 'Legacy';
  autoManageInLxca: boolean;
  networkProfile: BaremetalNetworkProfile;
}

export type BaremetalDeployStage = 
  | 'discovery'
  | 'template_profile_apply'
  | 'storage_raid_provision'
  | 'media_mount'
  | 'kickstart_injection'
  | 'installer_boot'
  | 'esxi_installing'
  | 'installer_reboot'
  | 'post_check_running'
  | 'post_check_passed'
  | 'post_check_failed';

export interface BaremetalDeploymentLog {
  timestamp: string;
  level: 'info' | 'success' | 'warn' | 'error';
  source: 'OME' | 'LXCA' | 'iDRAC' | 'XCC' | 'KICKSTART' | 'ESXi' | 'vCenter';
  message: string;
  details?: string;
}

export interface PostInstallEsxiValidation {
  validatedAt: string;
  hostPingable: boolean;
  httpsResponding: boolean; // port 443 Host Client
  sshResponding: boolean; // port 22
  vSphereAgentResponding: boolean; // port 902
  esxiVersionDetected: string;
  esxiBuildDetected: string;
  oemCustomImageVerified: boolean;
  oemAddonName: string; // "Dell Technologies Custom Add-on" or "Lenovo ThinkSystem Custom Image"
  managementAgentStatus: {
    agentName: string; // "Dell iDRAC Service Module (iSM)" or "Lenovo XCC Agent Provider"
    running: boolean;
    version: string;
    details: string;
  };
  vendorConsoleManagedState: 'Managed & Synchronized' | 'Inventory Refreshed' | 'Pending Agent Sync' | 'Failed';
  vcenterStatus: {
    registered: boolean;
    vcenterHost?: string;
    cluster?: string;
    datacenter?: string;
    inMaintenanceMode: boolean;
    taskMessage?: string;
  };
  networkConfig: {
    vmk0Ip: string;
    vmk0Mask: string;
    vmk0Vlan?: number;
    uplinkNics: string[];
    vSwitch: string;
  };
  storageConfig: {
    bootDisk: string;
    datastoreName: string;
    datastoreSizeGb: number;
    vmfsVersion: string;
  };
  healthCheckScore: number; // 0-100%
}

export interface BaremetalEsxiDeploymentJob {
  id: string;
  serverId: string;
  serverHostname: string;
  vendor: BaremetalVendor;
  model: string;
  bmcIp: string;
  esxiVersion: string; // "8.0U2" or "7.0U3"
  status: 'pending' | 'in_progress' | 'installed' | 'failed' | 'cancelled';
  stage: BaremetalDeployStage;
  currentStepMessage: string;
  progressPercent: number;
  startedAt: string;
  completedAt?: string;
  targetManagementIp: string;
  dellConfig?: DellOpenManageWorkflowConfig;
  lenovoConfig?: LenovoLxcaWorkflowConfig;
  logs: BaremetalDeploymentLog[];
  postInstallValidation?: PostInstallEsxiValidation;
}



