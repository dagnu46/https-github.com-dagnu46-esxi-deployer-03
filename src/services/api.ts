import { 
  Server, 
  FirmwarePackage, 
  AuditRecord, 
  BaselineConfig, 
  UpgradeCampaign, 
  UpgradeStage,
  ComponentType,
  VmwareVcenterConfig, 
  VmwareIsoMountRequest, 
  VmwareIsoMountResult, 
  VmwareVmInfo,
  VmwareDatastoreInfo,
  VmwareFileUploadResult,
  VmwarePowerStateResult,
  DiskVerificationResult,
  ServerStorageFile,
  VmwareLiveVerificationResult,
  BaremetalEsxiDeploymentJob,
  PostInstallEsxiValidation
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
  saveActiveCampaign,
  loadCampaigns,
  saveCampaigns,
  saveCampaign,
  deleteCampaign
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

export async function syncTestServerAccess(params: {
  hostname: string;
  ip: string;
  bmcIp?: string;
  bmcAffectedType?: string;
  model?: string;
  credentials: any;
}): Promise<any> {
  const res = await fetch('/api/servers/test-access', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  return await res.json();
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

export async function syncLoadCampaigns(): Promise<{ campaigns: UpgradeCampaign[]; source: 'postgres' | 'local' }> {
  try {
    const res = await fetch('/api/campaigns');
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data)) {
        saveCampaigns(data);
        return { campaigns: data, source: 'postgres' };
      }
    }
  } catch (e) {}
  return { campaigns: loadCampaigns(), source: 'local' };
}

export async function syncLoadCampaign(): Promise<{ campaign: UpgradeCampaign | null; source: 'postgres' | 'local' }> {
  const result = await syncLoadCampaigns();
  const active = result.campaigns.find(c => c.status === 'running') || result.campaigns[0] || null;
  saveActiveCampaign(active);
  return { campaign: active, source: result.source };
}

export async function syncSaveCampaign(campaign: UpgradeCampaign): Promise<void> {
  saveCampaign(campaign);

  try {
    await fetch('/api/campaigns', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(campaign),
    });
  } catch (e) {}
}

export async function syncDeleteCampaign(id: string): Promise<void> {
  deleteCampaign(id);

  try {
    await fetch(`/api/campaigns/${id}`, {
      method: 'DELETE',
    });
  } catch (e) {}
}

export interface TaskStepExecutionParams {
  campaignId: string;
  serverId: string;
  server: Server;
  stage: UpgradeStage;
  component: ComponentType;
  fromVersion: string;
  toVersion: string;
  targetFirmwareId?: string;
  autoReboot?: boolean;
}

export interface TaskStepExecutionResult {
  success: boolean;
  stage: UpgradeStage;
  nextStage?: UpgradeStage;
  progressPercent: number;
  message: string;
  log: {
    timestamp: string;
    level: 'info' | 'warn' | 'error' | 'success';
    message: string;
  };
  networkStatus?: 'reachable' | 'unreachable';
  ipmiStatus?: 'verified' | 'failed';
  credentialsStatus?: 'valid' | 'invalid';
  telemetry?: {
    latencyMs?: number;
    powerState?: string;
    psuRedundant?: boolean;
    bmcVersion?: string;
  };
  error?: string;
}

export async function syncExecuteCampaignStep(params: TaskStepExecutionParams): Promise<TaskStepExecutionResult> {
  try {
    const res = await fetch('/api/campaigns/execute-server-step', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });

    if (res.ok) {
      return await res.json();
    } else {
      const errData = await res.json().catch(() => ({}));
      return {
        success: false,
        stage: params.stage,
        progressPercent: 0,
        message: errData.error || 'Server task execution failed on backend probe',
        error: errData.error || 'Task execution HTTP error',
        log: {
          timestamp: new Date().toLocaleTimeString(),
          level: 'error',
          message: `[Task Error] ${errData.error || 'Probe failed'}`
        }
      };
    }
  } catch (e: any) {
    return {
      success: false,
      stage: params.stage,
      progressPercent: 0,
      message: e.message || 'Network error executing server step',
      error: e.message,
      log: {
        timestamp: new Date().toLocaleTimeString(),
        level: 'error',
        message: `[Network Error] Could not reach backend task orchestrator: ${e.message}`
      }
    };
  }
}

// -------------------------------------------------------------
// VMware vCenter & Virtual Machine ISO Testing
// -------------------------------------------------------------

export async function testVcenterConnection(config: VmwareVcenterConfig): Promise<{
  success: boolean;
  authenticated: boolean;
  vcenterHost?: string;
  datacenter?: string;
  latencyMs?: number;
  sessionToken?: string;
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

export async function unmountIsoFromVmwareVm(params: {
  vmId: string;
  vmName?: string;
  vcenter?: VmwareVcenterConfig;
}): Promise<{
  success: boolean;
  unmountedAt?: string;
  message?: string;
  realDispatched?: boolean;
  vcenterTaskId?: string;
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

export async function verifyLiveVmwareCdrom(params: {
  vcenter: VmwareVcenterConfig;
  vmId: string;
  vmName?: string;
  expectedIsoPath?: string;
}): Promise<VmwareLiveVerificationResult> {
  try {
    const res = await fetch('/api/vmware/vms/verify-live', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    return await res.json();
  } catch (e: any) {
    return {
      success: false,
      testedAt: new Date().toISOString(),
      vmId: params.vmId,
      vmName: params.vmName || 'Target VM',
      vcenterReachable: false,
      vmExistsInVcenter: false,
      matchesCurrentAppMount: false,
      diagnosticMessage: `Request to verify live vCenter failed: ${e.message}`,
      recommendedAction: 'Check your vCenter hostname, credentials, and network connectivity.',
      error: e.message
    };
  }
}

export async function fetchVmwareDatastores(params: {
  config: VmwareVcenterConfig;
  vmId?: string;
  vmName?: string;
}): Promise<{
  success: boolean;
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

export async function addCustomDatastore(params: {
  name: string;
  type?: string;
  capacityGb?: number;
  freeGb?: number;
}): Promise<{ success: boolean; datastore?: VmwareDatastoreInfo; error?: string }> {
  try {
    const res = await fetch('/api/vmware/datastores/custom', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    return await res.json();
  } catch (e: any) {
    return { success: false, error: e.message || 'Failed to register custom datastore' };
  }
}

export async function deleteCustomDatastore(name: string): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await fetch(`/api/vmware/datastores/custom/${encodeURIComponent(name)}`, {
      method: 'DELETE',
    });
    return await res.json();
  } catch (e: any) {
    return { success: false, error: e.message || 'Failed to delete custom datastore' };
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

// -------------------------------------------------------------
// Firmware Catalog Local Disk Storage & Verification APIs
// -------------------------------------------------------------

export async function uploadFirmwareFile(params: {
  fileName: string;
  fileContentBase64?: string;
  fileSize?: number;
  component?: string;
  vendor?: string;
}): Promise<DiskVerificationResult> {
  try {
    const res = await fetch('/api/firmware/upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    return await res.json();
  } catch (e: any) {
    return {
      success: false,
      exists: false,
      fileName: params.fileName,
      error: e.message || 'Failed to upload firmware file to server storage.',
    };
  }
}

export async function verifyFirmwareDiskFile(fileName: string): Promise<DiskVerificationResult> {
  try {
    const res = await fetch('/api/firmware/verify-disk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fileName }),
    });
    return await res.json();
  } catch (e: any) {
    return {
      success: false,
      exists: false,
      fileName,
      error: e.message || 'Verification request failed.',
    };
  }
}

export async function storeSampleFirmwareToDisk(params: {
  fileName: string;
  fileSizeMb?: number;
  sha256?: string;
  component?: string;
  vendor?: string;
}): Promise<DiskVerificationResult> {
  try {
    const res = await fetch('/api/firmware/store-sample-disk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    return await res.json();
  } catch (e: any) {
    return {
      success: false,
      exists: false,
      fileName: params.fileName,
      error: e.message || 'Failed to generate and store sample firmware file on disk.',
    };
  }
}

export async function fetchServerStorageFiles(): Promise<{
  success: boolean;
  serverWorkingDir: string;
  firmwareDir: string;
  datastoresDir: string;
  files: ServerStorageFile[];
  totalFiles: number;
  totalSizeBytes: number;
  error?: string;
}> {
  try {
    const res = await fetch('/api/firmware/storage-files');
    return await res.json();
  } catch (e: any) {
    return {
      success: false,
      serverWorkingDir: '',
      firmwareDir: '',
      datastoresDir: '',
      files: [],
      totalFiles: 0,
      totalSizeBytes: 0,
      error: e.message,
    };
  }
}

export async function deleteServerStorageFile(fileName: string, folder: 'firmware' | 'datastores' = 'firmware'): Promise<{
  success: boolean;
  message?: string;
  error?: string;
}> {
  try {
    const res = await fetch(`/api/firmware/files/${encodeURIComponent(fileName)}?folder=${folder}`, {
      method: 'DELETE',
    });
    return await res.json();
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

// -------------------------------------------------------------
// Bare-Metal VMware ESXi Deployment Client Services
// -------------------------------------------------------------

export async function fetchBaremetalCatalog(): Promise<{
  success: boolean;
  dell: {
    vendor: string;
    consoleName: string;
    defaultOmePort: number;
    templates: any[];
    customIsos: any[];
  };
  lenovo: {
    vendor: string;
    consoleName: string;
    defaultLxcaPort: number;
    patterns: any[];
    customIsos: any[];
  };
  error?: string;
}> {
  try {
    const res = await fetch('/api/baremetal/catalog');
    return await res.json();
  } catch (e: any) {
    return {
      success: false,
      dell: { vendor: 'DELL', consoleName: 'Dell OpenManage Enterprise (OME)', defaultOmePort: 443, templates: [], customIsos: [] },
      lenovo: { vendor: 'LENOVO', consoleName: 'Lenovo XClarity Administrator (LXCA)', defaultLxcaPort: 443, patterns: [], customIsos: [] },
      error: e.message,
    };
  }
}

export async function fetchBaremetalJobs(): Promise<{
  success: boolean;
  jobs: BaremetalEsxiDeploymentJob[];
  error?: string;
}> {
  try {
    const res = await fetch('/api/baremetal/jobs');
    return await res.json();
  } catch (e: any) {
    return { success: false, jobs: [], error: e.message };
  }
}

export async function fetchBaremetalJob(id: string): Promise<{
  success: boolean;
  job?: BaremetalEsxiDeploymentJob;
  error?: string;
}> {
  try {
    const res = await fetch(`/api/baremetal/job/${encodeURIComponent(id)}`);
    return await res.json();
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

export async function startBaremetalDeployment(payload: {
  serverId?: string;
  serverHostname?: string;
  vendor: 'DELL' | 'LENOVO';
  model?: string;
  bmcIp?: string;
  esxiVersion?: string;
  targetManagementIp?: string;
  dellConfig?: any;
  lenovoConfig?: any;
  networkProfile?: any;
}): Promise<{
  success: boolean;
  job?: BaremetalEsxiDeploymentJob;
  message?: string;
  error?: string;
}> {
  try {
    const res = await fetch('/api/baremetal/deploy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return await res.json();
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

export async function stepBaremetalJob(id: string): Promise<{
  success: boolean;
  job?: BaremetalEsxiDeploymentJob;
  error?: string;
}> {
  try {
    const res = await fetch(`/api/baremetal/job/${encodeURIComponent(id)}/step`, {
      method: 'POST',
    });
    return await res.json();
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

export async function verifyPostInstallEsxi(payload: {
  hostIp: string;
  vendor?: string;
  esxiVersion?: string;
  bmcIp?: string;
}): Promise<{
  success: boolean;
  hostIp: string;
  validation: PostInstallEsxiValidation;
  diagnostic?: string;
  error?: string;
}> {
  try {
    const res = await fetch('/api/baremetal/verify-post-install', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return await res.json();
  } catch (e: any) {
    return {
      success: false,
      hostIp: payload.hostIp,
      validation: {
        validatedAt: new Date().toISOString(),
        hostPingable: false,
        httpsResponding: false,
        sshResponding: false,
        vSphereAgentResponding: false,
        esxiVersionDetected: 'Unknown',
        esxiBuildDetected: 'Unknown',
        oemCustomImageVerified: false,
        oemAddonName: 'Unverified',
        managementAgentStatus: { agentName: 'Agent Probe', running: false, version: '', details: e.message },
        vendorConsoleManagedState: 'Failed',
        vcenterStatus: { registered: false, inMaintenanceMode: false, taskMessage: 'Probe failed' },
        networkConfig: { vmk0Ip: payload.hostIp, vmk0Mask: '255.255.255.0', uplinkNics: [], vSwitch: 'vSwitch0' },
        storageConfig: { bootDisk: 'Unknown', datastoreName: '', datastoreSizeGb: 0, vmfsVersion: 'VMFS-6' },
        healthCheckScore: 0,
      },
      error: e.message,
    };
  }
}

export async function joinBaremetalVcenter(payload: {
  hostIp: string;
  vcenterHost?: string;
  datacenter?: string;
  cluster?: string;
  maintenanceMode?: boolean;
}): Promise<{
  success: boolean;
  taskId?: string;
  message?: string;
  vcenterHost?: string;
  datacenter?: string;
  cluster?: string;
  inMaintenanceMode?: boolean;
  error?: string;
}> {
  try {
    const res = await fetch('/api/baremetal/join-vcenter', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return await res.json();
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}




