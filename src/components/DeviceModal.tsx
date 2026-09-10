import React, { useState, useEffect } from 'react';
import { 
  X, 
  Server as ServerIcon, 
  Plus, 
  Cpu, 
  HardDrive, 
  Wifi, 
  Layers, 
  MapPin, 
  Globe, 
  Check, 
  AlertCircle,
  Key,
  ShieldCheck,
  ShieldAlert,
  Eye,
  EyeOff,
  RefreshCw,
  CheckCircle2,
  XCircle,
  ChevronDown,
  ChevronUp,
  Terminal,
  Lock,
  Activity,
  Sparkles
} from 'lucide-react';
import { 
  Server, 
  ServerModel, 
  ServerVendor,
  HypervisorType,
  ComponentType, 
  FirmwarePackage, 
  ServerCredentials, 
  BmcProtocol, 
  AccessTestResult, 
  AccessTestStep 
} from '../types';
import { testServerAccess } from '../utils/accessTester';

const VENDOR_MODELS: Record<ServerVendor, { model: ServerModel; label: string; bmc: Server['bmcAffectedType']; defaultBios: string; defaultBmc: string; defaultRaid: string }[]> = {
  HP: [
    { model: 'HPE ProLiant DL380 Gen10', label: 'HPE ProLiant DL380 Gen10 (2U Rack)', bmc: 'iLO 5', defaultBios: '2.84_10-2025', defaultBmc: '2.95', defaultRaid: '5.10' },
    { model: 'HPE ProLiant DL360 Gen10', label: 'HPE ProLiant DL360 Gen10 (1U Rack)', bmc: 'iLO 5', defaultBios: '2.84_10-2025', defaultBmc: '2.95', defaultRaid: '5.10' },
    { model: 'HPE ProLiant DL380 Gen11', label: 'HPE ProLiant DL380 Gen11 (2U Rack)', bmc: 'iLO 6', defaultBios: '2.92_07-2026', defaultBmc: '2.98', defaultRaid: '5.10' },
    { model: 'HPE Synergy 480 Gen10', label: 'HPE Synergy 480 Gen10 (Blade Compute)', bmc: 'iLO 5', defaultBios: '2.84_10-2025', defaultBmc: '2.95', defaultRaid: '5.10' },
  ],
  DELL: [
    { model: 'Dell PowerEdge R750', label: 'Dell PowerEdge R750 (2U Rack)', bmc: 'iDRAC9', defaultBios: '2.18.1', defaultBmc: '6.10.30.00', defaultRaid: '52.14.0-3910' },
    { model: 'Dell PowerEdge R650', label: 'Dell PowerEdge R650 (1U Rack)', bmc: 'iDRAC9', defaultBios: '2.18.1', defaultBmc: '7.00.00.00', defaultRaid: '52.16.1-4122' },
    { model: 'Dell PowerEdge R740xd', label: 'Dell PowerEdge R740xd (2U High-Density)', bmc: 'iDRAC9', defaultBios: '2.18.1', defaultBmc: '6.10.30.00', defaultRaid: '52.14.0-3910' },
    { model: 'Dell PowerEdge MX750c', label: 'Dell PowerEdge MX750c (Modular Compute)', bmc: 'iDRAC9', defaultBios: '2.18.1', defaultBmc: '6.10.30.00', defaultRaid: '52.14.0-3910' },
  ],
  LENOVO: [
    { model: 'Lenovo ThinkSystem SR650 V2', label: 'Lenovo ThinkSystem SR650 V2 (2U Rack)', bmc: 'Lenovo XClarity', defaultBios: '3.12 (IVE170I)', defaultBmc: '7.90 (TEI382K)', defaultRaid: '52.16.0-4012' },
    { model: 'Lenovo ThinkSystem SR630 V2', label: 'Lenovo ThinkSystem SR630 V2 (1U Rack)', bmc: 'Lenovo XClarity', defaultBios: '3.12 (IVE170I)', defaultBmc: '8.12 (TEI392M)', defaultRaid: '52.18.0-4210' },
    { model: 'Lenovo ThinkSystem SR650 V3', label: 'Lenovo ThinkSystem SR650 V3 (2U Rack)', bmc: 'Lenovo XClarity', defaultBios: '3.40 (IVE182M)', defaultBmc: '8.12 (TEI392M)', defaultRaid: '52.18.0-4210' },
    { model: 'Lenovo ThinkSystem SR670 V2', label: 'Lenovo ThinkSystem SR670 V2 (GPU Deep Learning)', bmc: 'Lenovo XClarity', defaultBios: '3.12 (IVE170I)', defaultBmc: '7.90 (TEI382K)', defaultRaid: '52.18.0-4210' },
  ],
};

const HYPERVISOR_DEFAULTS: Record<HypervisorType, { defaultVersion: string; defaultCluster: string }> = {
  'Baremetal (No OS)': {
    defaultVersion: 'Uninstalled (Awaiting ESXi ISO Staging)',
    defaultCluster: 'Baremetal-Staging-Rack',
  },
  'VMware ESXi': {
    defaultVersion: 'ESXi 8.0 Update 2 (Build 22380479)',
    defaultCluster: 'ESXi-VCF-Production-Ashburn',
  },
  'VMware ESXi on Nutanix': {
    defaultVersion: 'ESXi 7.0u3 / Nutanix AOS 6.5.4',
    defaultCluster: 'Nutanix-HCI-Block-Frankfurt',
  },
  'Xen Server': {
    defaultVersion: 'XenServer 8.2 CU1 (Citrix Hypervisor)',
    defaultCluster: 'XenServer-VDI-Pool-Oregon',
  },
};

interface DeviceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaveServer: (server: Server) => void;
  editingServer?: Server | null;
  firmwarePackages?: FirmwarePackage[];
}

export const DeviceModal: React.FC<DeviceModalProps> = ({
  isOpen,
  onClose,
  onSaveServer,
  editingServer,
  firmwarePackages = [],
}) => {
  const isEditing = !!editingServer;

  // Vendor & Hypervisor
  const [vendor, setVendor] = useState<ServerVendor>('DELL');
  const [hypervisor, setHypervisor] = useState<HypervisorType>('VMware ESXi');
  const [hypervisorVersion, setHypervisorVersion] = useState('ESXi 8.0 Update 2 (Build 22380479)');
  const [hypervisorMaintenanceMode, setHypervisorMaintenanceMode] = useState(false);
  const [activeVmsCount, setActiveVmsCount] = useState<number>(14);

  // Basic info
  const [hostname, setHostname] = useState('');
  const [model, setModel] = useState<ServerModel>('Dell PowerEdge R750');
  const [ip, setIp] = useState('');
  const [bmcIp, setBmcIp] = useState('');
  const [bmcAffectedType, setBmcAffectedType] = useState<Server['bmcAffectedType']>('iDRAC9');

  // Credentials State
  const [bmcProtocol, setBmcProtocol] = useState<BmcProtocol>('redfish');
  const [bmcPort, setBmcPort] = useState<number>(443);
  const [bmcUsername, setBmcUsername] = useState('root');
  const [bmcPassword, setBmcPassword] = useState('P@ssw0rd2026!');
  const [showPassword, setShowPassword] = useState(false);
  const [ignoreSslErrors, setIgnoreSslErrors] = useState(true);

  // In-band SSH (optional)
  const [enableSsh, setEnableSsh] = useState(false);
  const [sshPort, setSshPort] = useState<number>(22);
  const [sshUsername, setSshUsername] = useState('sysadmin');
  const [sshAuthType, setSshAuthType] = useState<'password' | 'key'>('password');
  const [sshPassword, setSshPassword] = useState('HostP@ss2026!');
  const [sshKey, setSshKey] = useState('');
  const [showSshPassword, setShowSshPassword] = useState(false);

  // Location fields
  const [datacenter, setDatacenter] = useState('US-East (Ashburn DC2)');
  const [rack, setRack] = useState('Rack B14');
  const [unit, setUnit] = useState('U24-U25');

  // Cluster & status
  const [cluster, setCluster] = useState('Production Kubernetes Cluster (US-East)');
  const [status, setStatus] = useState<Server['status']>('online');
  const [powerState, setPowerState] = useState<Server['powerState']>('on');
  const [powerSupplyRedundancy, setPowerSupplyRedundancy] = useState(true);
  const [tags, setTags] = useState('compute, primary');

  // Firmware versions
  const [biosVersion, setBiosVersion] = useState('2.18.1');
  const [bmcVersion, setBmcVersion] = useState('6.10.30.00');
  const [nicVersion, setNicVersion] = useState('22.36.1010');
  const [raidVersion, setRaidVersion] = useState('52.14.0-3910');
  const [nvmeVersion, setNvmeVersion] = useState('1.2.4');

  const [showAdvancedComponents, setShowAdvancedComponents] = useState(false);

  // Access Testing State
  const [isTestingAccess, setIsTestingAccess] = useState(false);
  const [testResult, setTestResult] = useState<AccessTestResult | null>(null);
  const [testSteps, setTestSteps] = useState<AccessTestStep[]>([]);
  const [testErrorBanner, setTestErrorBanner] = useState<string | null>(null);
  const [hasTestedAccess, setHasTestedAccess] = useState(false);

  // Sync form when editingServer changes
  useEffect(() => {
    if (editingServer) {
      const inferredVendor: ServerVendor = editingServer.vendor || (
        editingServer.model?.startsWith('HP') ? 'HP' : 
        editingServer.model?.startsWith('Lenovo') ? 'LENOVO' : 'DELL'
      );
      setVendor(inferredVendor);
      setHypervisor(editingServer.hypervisor || 'VMware ESXi');
      setHypervisorVersion(editingServer.hypervisorVersion || 'ESXi 8.0 Update 2 (Build 22380479)');
      setHypervisorMaintenanceMode(Boolean(editingServer.hypervisorMaintenanceMode));
      setActiveVmsCount(editingServer.activeVmsCount ?? 14);

      setHostname(editingServer.hostname);
      setModel(editingServer.model);
      setIp(editingServer.ip);
      setBmcIp(editingServer.bmcIp);
      setBmcAffectedType(editingServer.bmcAffectedType);
      setDatacenter(editingServer.datacenter);
      setRack(editingServer.rack);
      setUnit(editingServer.unit);
      setCluster(editingServer.cluster);
      setStatus(editingServer.status);
      setPowerState(editingServer.powerState);
      setPowerSupplyRedundancy(editingServer.powerSupplyRedundancy);
      setTags(editingServer.tags.join(', '));

      setBiosVersion(editingServer.components.BIOS?.currentVersion || '2.18.1');
      setBmcVersion(editingServer.components.BMC?.currentVersion || '6.10.30.00');
      setNicVersion(editingServer.components.NIC?.currentVersion || '22.36.1010');
      setRaidVersion(editingServer.components.RAID?.currentVersion || '52.14.0-3910');
      setNvmeVersion(editingServer.components.NVMe?.currentVersion || '1.2.4');

      // Populate credentials if available
      if (editingServer.credentials) {
        setBmcProtocol(editingServer.credentials.bmcProtocol || 'redfish');
        setBmcPort(editingServer.credentials.bmcPort || (editingServer.credentials.bmcProtocol === 'ipmi' ? 623 : 443));
        setBmcUsername(editingServer.credentials.bmcUsername || 'root');
        setBmcPassword(editingServer.credentials.bmcPassword || '••••••••');
        setIgnoreSslErrors(editingServer.credentials.ignoreSslErrors ?? true);
        setEnableSsh(!!editingServer.credentials.enableSsh);
        setSshPort(editingServer.credentials.sshPort || 22);
        setSshUsername(editingServer.credentials.sshUsername || 'sysadmin');
        setSshAuthType(editingServer.credentials.sshAuthType || 'password');
        setSshPassword(editingServer.credentials.sshPassword || '');
        setSshKey(editingServer.credentials.sshKey || '');
      }

      if (editingServer.accessStatus) {
        setTestResult(editingServer.accessStatus);
        setTestSteps(editingServer.accessStatus.steps || []);
        setHasTestedAccess(editingServer.accessStatus.status === 'success');
      } else {
        setTestResult(null);
        setTestSteps([]);
        setHasTestedAccess(false);
      }
    } else {
      // Default new device values
      const randomNum = Math.floor(10 + Math.random() * 89);
      setVendor('DELL');
      setHypervisor('VMware ESXi');
      setHypervisorVersion('ESXi 8.0 Update 2 (Build 22380479)');
      setHypervisorMaintenanceMode(false);
      setActiveVmsCount(14);

      setHostname(`us-east-srv-${randomNum}`);
      setModel('Dell PowerEdge R750');
      setIp(`10.120.4.${randomNum}`);
      setBmcIp(`10.120.250.${randomNum}`);
      setBmcAffectedType('iDRAC9');
      setBmcProtocol('redfish');
      setBmcPort(443);
      setBmcUsername('root');
      setBmcPassword('P@ssw0rd2026!');
      setIgnoreSslErrors(true);
      setEnableSsh(false);
      setSshPort(22);
      setSshUsername('sysadmin');
      setSshAuthType('password');
      setSshPassword('HostP@ss2026!');
      setSshKey('');

      setDatacenter('US-East (Ashburn DC2)');
      setRack('Rack B14');
      setUnit(`U${randomNum % 30 + 10}-U${randomNum % 30 + 11}`);
      setCluster('ESXi-VCF-Production-Ashburn');
      setStatus('online');
      setPowerState('on');
      setPowerSupplyRedundancy(true);
      setTags('worker, compute');
      setBiosVersion('2.18.1');
      setBmcVersion('6.10.30.00');
      setNicVersion('22.36.1010');
      setRaidVersion('52.14.0-3910');
      setNvmeVersion('1.2.4');

      setTestResult(null);
      setTestSteps([]);
      setTestErrorBanner(null);
      setHasTestedAccess(false);
    }
  }, [editingServer, isOpen]);

  // When vendor changes, switch to default model & settings for that vendor
  const handleVendorChange = (newVendor: ServerVendor) => {
    setVendor(newVendor);
    const availableModels = VENDOR_MODELS[newVendor];
    if (availableModels && availableModels.length > 0) {
      const first = availableModels[0];
      setModel(first.model);
      setBmcAffectedType(first.bmc);
      setBiosVersion(first.defaultBios);
      setBmcVersion(first.defaultBmc);
      setRaidVersion(first.defaultRaid);
      setBmcProtocol('redfish');
      setBmcPort(443);
    }
  };

  // When hypervisor changes, adapt default version and cluster
  const handleHypervisorChange = (newHypervisor: HypervisorType) => {
    setHypervisor(newHypervisor);
    const config = HYPERVISOR_DEFAULTS[newHypervisor];
    if (config) {
      setHypervisorVersion(config.defaultVersion);
      if (!isEditing) {
        setCluster(config.defaultCluster);
      }
    }
  };

  // When model changes, update default BMC type and suggested protocol
  const handleModelChange = (m: ServerModel) => {
    setModel(m);
    if (m.startsWith('HPE') || m.startsWith('HP')) {
      setVendor('HP');
      setBmcAffectedType(m.includes('Gen11') ? 'iLO 6' : 'iLO 5');
      setBmcProtocol('redfish');
      setBmcPort(443);
    } else if (m.startsWith('Dell')) {
      setVendor('DELL');
      setBmcAffectedType('iDRAC9');
      setBmcProtocol('redfish');
      setBmcPort(443);
    } else if (m.startsWith('Lenovo')) {
      setVendor('LENOVO');
      setBmcAffectedType('Lenovo XClarity');
      setBmcProtocol('redfish');
      setBmcPort(443);
    }
  };

  const handleProtocolChange = (proto: BmcProtocol) => {
    setBmcProtocol(proto);
    if (proto === 'ipmi') {
      setBmcPort(623);
    } else {
      setBmcPort(443);
    }
  };

  // Helper to find latest package version for a component
  const getLatestPkgVersion = (comp: ComponentType, defaultVer: string): string => {
    const pkg = firmwarePackages.find(p => p.component === comp && p.supportedModels.includes(model));
    return pkg ? pkg.version : defaultVer;
  };

  // Execute Connection and Authentication Test
  const handleRunAccessTest = async (): Promise<AccessTestResult | null> => {
    setTestErrorBanner(null);

    // Validation checks
    if (!ip.trim() && !bmcIp.trim()) {
      setTestErrorBanner('Please specify a Host IP or BMC IP address before testing access.');
      return null;
    }
    if (!bmcUsername.trim()) {
      setTestErrorBanner('Please enter a BMC username (e.g. root or admin).');
      return null;
    }

    setIsTestingAccess(true);
    setTestResult(null);

    const currentCreds: ServerCredentials = {
      bmcUsername: bmcUsername.trim(),
      bmcPassword: bmcPassword.trim(),
      bmcProtocol,
      bmcPort,
      ignoreSslErrors,
      enableSsh,
      sshPort,
      sshUsername: sshUsername.trim(),
      sshAuthType,
      sshPassword,
      sshKey,
    };

    try {
      const result = await testServerAccess({
        hostname: hostname.trim() || 'unnamed-server',
        ip: ip.trim(),
        bmcIp: bmcIp.trim(),
        bmcAffectedType,
        model,
        credentials: currentCreds,
        onStepUpdate: steps => setTestSteps(steps),
      });

      setTestResult(result);
      setTestSteps(result.steps);

      if (result.status === 'success') {
        setHasTestedAccess(true);
      } else {
        setHasTestedAccess(false);
        setTestErrorBanner(result.summary || 'Failed to authenticate to device.');
      }
      return result;
    } catch (err: any) {
      const errMsg = err?.message || 'Unexpected connection error while probing remote controller.';
      setTestErrorBanner(errMsg);
      return null;
    } finally {
      setIsTestingAccess(false);
    }
  };

  // Auto-populate detected firmware versions from BMC telemetry
  const handleSyncDiscoveredVersions = () => {
    if (!testResult?.discoveredHardware) return;
    if (testResult.discoveredHardware.biosVersionDetected) {
      setBiosVersion(testResult.discoveredHardware.biosVersionDetected);
    }
    if (testResult.discoveredHardware.bmcVersionDetected) {
      setBmcVersion(testResult.discoveredHardware.bmcVersionDetected);
    }
  };

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!hostname.trim() || !ip.trim()) return;

    let finalAccessStatus = testResult;

    // If access has not been tested yet for a new server, run the test automatically
    if (!hasTestedAccess && !isEditing) {
      const runResult = await handleRunAccessTest();
      if (!runResult || runResult.status !== 'success') {
        // Test failed or had error; display error banner and don't exit silently
        return;
      }
      finalAccessStatus = runResult;
    }

    const latestBios = getLatestPkgVersion('BIOS', '2.20.0');
    const latestBmc = getLatestPkgVersion('BMC', '7.00.00.00');
    const latestNic = getLatestPkgVersion('NIC', '22.39.1002');
    const latestRaid = getLatestPkgVersion('RAID', '52.16.1-4122');
    const latestNvme = getLatestPkgVersion('NVMe', '1.3.0');

    const getStatusFor = (curr: string, lat: string): 'up_to_date' | 'update_available' | 'critical_update' => {
      if (curr === lat) return 'up_to_date';
      if (curr.startsWith('2.18') || curr.startsWith('6.10')) return 'critical_update';
      return 'update_available';
    };

    const credentials: ServerCredentials = {
      bmcUsername: bmcUsername.trim(),
      bmcPassword: bmcPassword.trim(),
      bmcProtocol,
      bmcPort: Number(bmcPort) || 443,
      ignoreSslErrors,
      enableSsh,
      sshPort: Number(sshPort) || 22,
      sshUsername: sshUsername.trim(),
      sshAuthType,
      sshPassword,
      sshKey,
    };

    const serverData: Server = {
      id: editingServer ? editingServer.id : `srv-${Date.now().toString().slice(-6)}`,
      hostname: hostname.trim(),
      vendor,
      hypervisor,
      hypervisorVersion: hypervisorVersion.trim(),
      hypervisorMaintenanceMode,
      activeVmsCount: Number(activeVmsCount) || 0,
      model,
      ip: ip.trim(),
      bmcIp: bmcIp.trim() || ip.trim(),
      bmcAffectedType,
      datacenter: datacenter.trim(),
      rack: rack.trim(),
      unit: unit.trim(),
      cluster: cluster.trim(),
      architecture: editingServer?.architecture || 'x86_64',
      status,
      powerState,
      powerSupplyRedundancy,
      tags: tags.split(',').map(t => t.trim()).filter(Boolean),
      lastUpgradeDate: editingServer?.lastUpgradeDate || new Date().toISOString().split('T')[0],
      credentials,
      accessStatus: finalAccessStatus || {
        status: 'untested',
        summary: 'Credentials stored, pending initial fleet probe',
        steps: [],
      },
      components: {
        BIOS: {
          type: 'BIOS',
          name: `${vendor} ${model.split(' ').slice(1).join(' ')} UEFI BIOS`,
          vendor: vendor === 'DELL' ? 'Dell Technologies' : vendor === 'HP' ? 'Hewlett Packard Enterprise' : 'Lenovo Enterprise',
          currentVersion: biosVersion.trim(),
          latestVersion: latestBios,
          status: getStatusFor(biosVersion.trim(), latestBios),
          cveAlerts: biosVersion.trim() !== latestBios && biosVersion.startsWith('2.18') ? ['CVE-2026-21340'] : [],
          rebootRequired: true,
        },
        BMC: {
          type: 'BMC',
          name: `${bmcAffectedType} Controller`,
          vendor: vendor === 'DELL' ? 'Dell Technologies' : vendor === 'HP' ? 'Hewlett Packard Enterprise' : 'Lenovo Enterprise',
          currentVersion: bmcVersion.trim(),
          latestVersion: latestBmc,
          status: getStatusFor(bmcVersion.trim(), latestBmc),
          cveAlerts: bmcVersion.trim() !== latestBmc && bmcVersion.startsWith('6.10') ? ['CVE-2026-19401'] : [],
          rebootRequired: false,
        },
        NIC: {
          type: 'NIC',
          name: 'NVIDIA ConnectX-6 Dx Dual 100GbE',
          vendor: 'NVIDIA Networking',
          currentVersion: nicVersion.trim(),
          latestVersion: latestNic,
          status: getStatusFor(nicVersion.trim(), latestNic),
          rebootRequired: true,
        },
        RAID: {
          type: 'RAID',
          name: 'Enterprise SAS/NVMe RAID Controller',
          vendor: 'Broadcom',
          currentVersion: raidVersion.trim(),
          latestVersion: latestRaid,
          status: getStatusFor(raidVersion.trim(), latestRaid),
          rebootRequired: true,
        },
        NVMe: {
          type: 'NVMe',
          name: 'Enterprise NVMe U.3 SSD',
          vendor: 'Kioxia',
          currentVersion: nvmeVersion.trim(),
          latestVersion: latestNvme,
          status: getStatusFor(nvmeVersion.trim(), latestNvme),
          rebootRequired: false,
        },
      },
    };

    onSaveServer(serverData);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="relative bg-white rounded-2xl shadow-2xl max-w-2xl w-full border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-600/30 border border-indigo-500/40 flex items-center justify-center">
              <ServerIcon className="w-4 h-4 text-indigo-400" />
            </div>
            <div>
              <h3 className="text-base font-bold">
                {isEditing ? `Edit Device: ${editingServer.hostname}` : 'Register New Server Node'}
              </h3>
              <p className="text-xs text-slate-400">
                {isEditing 
                  ? 'Update server network, BMC credentials, firmware versions, and hypervisor settings' 
                  : 'Define server credentials, hypervisor virtualization, and register firmware baseline'}
              </p>
            </div>
          </div>
          <button
            type="button"
            id="btn-close-device-modal"
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5 overflow-y-auto flex-1 text-xs">
          {/* Section 1: Server Vendor & Hardware Model */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3.5">
            <div className="flex items-center justify-between">
              <h4 className="text-[11px] font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                <ServerIcon className="w-3.5 h-3.5 text-indigo-600" />
                <span>Server Vendor & Hardware Model</span>
              </h4>
              <span className="text-[10px] text-slate-500 font-mono">Supported: HP • DELL • LENOVO</span>
            </div>

            {/* Vendor Selector Buttons */}
            <div>
              <label className="block font-semibold text-slate-700 mb-1.5">
                Hardware Vendor <span className="text-red-500">*</span>
              </label>
              <div className="grid grid-cols-3 gap-2">
                {(['HP', 'DELL', 'LENOVO'] as ServerVendor[]).map(v => {
                  const isSelected = vendor === v;
                  return (
                    <button
                      key={v}
                      type="button"
                      id={`btn-select-vendor-${v.toLowerCase()}`}
                      onClick={() => handleVendorChange(v)}
                      className={`py-2.5 px-3 rounded-lg border font-bold text-xs flex flex-col items-center justify-center transition-all ${
                        isSelected
                          ? v === 'HP' 
                            ? 'bg-emerald-50 border-emerald-500 text-emerald-800 ring-2 ring-emerald-400/30'
                            : v === 'DELL'
                            ? 'bg-blue-50 border-blue-500 text-blue-800 ring-2 ring-blue-400/30'
                            : 'bg-red-50 border-red-500 text-red-800 ring-2 ring-red-400/30'
                          : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                      }`}
                    >
                      <span className="text-sm font-black tracking-tight">{v}</span>
                      <span className="text-[10px] font-normal text-slate-500">
                        {v === 'HP' ? 'ProLiant / iLO' : v === 'DELL' ? 'PowerEdge / iDRAC' : 'ThinkSystem / XCC'}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Device Hostname <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  id="input-device-hostname"
                  placeholder="e.g. us-east-srv-04"
                  value={hostname}
                  onChange={e => setHostname(e.target.value)}
                  className="w-full p-2.5 font-mono text-xs border border-slate-200 rounded-lg bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  {vendor} Server Model <span className="text-red-500">*</span>
                </label>
                <select
                  value={model}
                  id="select-device-model"
                  onChange={e => handleModelChange(e.target.value as ServerModel)}
                  className="w-full p-2.5 text-xs border border-slate-200 rounded-lg bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-hidden font-medium"
                >
                  {(VENDOR_MODELS[vendor] || []).map(item => (
                    <option key={item.model} value={item.model}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Section 2: Virtualization & Hypervisor Layer */}
          <div className="p-4 bg-indigo-50/50 border border-indigo-100 rounded-xl space-y-3.5">
            <div className="flex items-center justify-between">
              <h4 className="text-[11px] font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-indigo-600" />
                <span>Virtualization & Hypervisor Infrastructure</span>
              </h4>
              <span className="text-[10px] text-indigo-600 font-medium">VMware ESXi • Nutanix • Xen</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Hypervisor Platform <span className="text-red-500">*</span>
                </label>
                <select
                  value={hypervisor}
                  id="select-device-hypervisor"
                  onChange={e => handleHypervisorChange(e.target.value as HypervisorType)}
                  className="w-full p-2.5 text-xs border border-slate-200 rounded-lg bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-hidden font-medium"
                >
                  <option value="VMware ESXi">VMware ESXi (vSphere)</option>
                  <option value="VMware ESXi on Nutanix">VMware ESXi on Nutanix (HCI)</option>
                  <option value="Xen Server">Xen Server (Citrix / XCP-ng)</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Hypervisor Version / Build
                </label>
                <input
                  type="text"
                  id="input-device-hypervisor-version"
                  value={hypervisorVersion}
                  onChange={e => setHypervisorVersion(e.target.value)}
                  placeholder="e.g. ESXi 8.0 Update 2"
                  className="w-full p-2.5 font-mono text-xs border border-slate-200 rounded-lg bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-1">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Active Guest VMs Hosted
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={0}
                    max={150}
                    id="input-device-active-vms"
                    value={activeVmsCount}
                    onChange={e => setActiveVmsCount(Number(e.target.value))}
                    className="w-28 p-2 font-mono text-xs border border-slate-200 rounded-lg bg-white focus:ring-2 focus:ring-indigo-500"
                  />
                  <span className="text-[11px] text-slate-500">
                    {activeVmsCount > 0 ? `${activeVmsCount} guest instances active` : 'Host evacuated / idle'}
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between p-2.5 bg-white border border-slate-200 rounded-lg">
                <div>
                  <div className="font-semibold text-slate-800 text-xs">Host Maintenance Mode</div>
                  <div className="text-[10px] text-slate-500">
                    {hypervisorMaintenanceMode 
                      ? 'Host in Maintenance (VMs migrated)' 
                      : 'Production Host (VMs executing)'}
                  </div>
                </div>
                <button
                  type="button"
                  id="btn-toggle-maintenance-mode"
                  onClick={() => setHypervisorMaintenanceMode(!hypervisorMaintenanceMode)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                    hypervisorMaintenanceMode 
                      ? 'bg-amber-100 text-amber-800 border border-amber-300' 
                      : 'bg-slate-100 text-slate-600 border border-slate-200 hover:bg-slate-200'
                  }`}
                >
                  {hypervisorMaintenanceMode ? 'Enabled (Evacuated)' : 'Disabled (Active)'}
                </button>
              </div>
            </div>
          </div>

          {/* Section 2: IP Address & Network Settings */}
          <div>
            <h4 className="text-[11px] font-bold text-slate-900 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Globe className="w-3.5 h-3.5 text-indigo-600" />
              <span>Network & Out-of-Band BMC (IPMI / Redfish)</span>
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Host IP Address <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  id="input-device-host-ip"
                  placeholder="10.120.4.15"
                  value={ip}
                  onChange={e => setIp(e.target.value)}
                  className="w-full p-2.5 font-mono text-xs border border-slate-200 rounded-lg bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  BMC (OOB) IP Address
                </label>
                <input
                  type="text"
                  id="input-device-bmc-ip"
                  placeholder="10.120.250.15"
                  value={bmcIp}
                  onChange={e => setBmcIp(e.target.value)}
                  className="w-full p-2.5 font-mono text-xs border border-slate-200 rounded-lg bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">BMC Controller Type</label>
                <select
                  value={bmcAffectedType}
                  id="select-device-bmc-type"
                  onChange={e => setBmcAffectedType(e.target.value as any)}
                  className="w-full p-2.5 text-xs border border-slate-200 rounded-lg bg-slate-50 focus:bg-white font-mono"
                >
                  <option value="iDRAC9">Dell iDRAC9</option>
                  <option value="iLO 5">HPE iLO 5</option>
                  <option value="Supermicro IPMI">Supermicro IPMI</option>
                  <option value="Lenovo XClarity">Lenovo XClarity</option>
                  <option value="Cisco IMC">Cisco IMC</option>
                </select>
              </div>
            </div>
          </div>

          {/* Section 3: Credentials & Access Verification (CRITICAL USER REQUIREMENT) */}
          <div className="p-4 bg-slate-900 text-slate-100 rounded-xl border border-slate-800 space-y-4 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
              <div>
                <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                  <Key className="w-4 h-4 text-indigo-400" />
                  <span>Remote Management Credentials & Access Verification</span>
                </h4>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Supply authentication credentials to manage firmware and flash components via BMC.
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {hasTestedAccess && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                    <span>Access Verified</span>
                  </span>
                )}
                <button
                  type="button"
                  id="btn-test-access"
                  onClick={() => handleRunAccessTest()}
                  disabled={isTestingAccess}
                  className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-xs"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isTestingAccess ? 'animate-spin' : ''}`} />
                  <span>{isTestingAccess ? 'Testing Access...' : 'Test Access Now'}</span>
                </button>
              </div>
            </div>

            {/* Error Banner if Test Failed */}
            {testErrorBanner && (
              <div className="p-3 bg-red-950/70 border border-red-800/80 rounded-lg flex items-start gap-2 text-red-200">
                <ShieldAlert className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                <div className="text-xs">
                  <span className="font-semibold text-red-300">Access Test Failed: </span>
                  {testErrorBanner}
                </div>
              </div>
            )}

            {/* Credential Inputs Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                  Auth Protocol <span className="text-indigo-400">*</span>
                </label>
                <select
                  value={bmcProtocol}
                  id="select-bmc-protocol"
                  onChange={e => handleProtocolChange(e.target.value as BmcProtocol)}
                  className="w-full p-2 text-xs border border-slate-700 rounded-lg bg-slate-800 text-white focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                >
                  <option value="redfish">Redfish REST API v1</option>
                  <option value="ipmi">IPMI 2.0 / RMCP+</option>
                  <option value="https">HTTPS Web API</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                  BMC Port <span className="text-indigo-400">*</span>
                </label>
                <input
                  type="number"
                  min="1"
                  max="65535"
                  required
                  id="input-bmc-port"
                  value={bmcPort}
                  onChange={e => setBmcPort(Number(e.target.value))}
                  className="w-full p-2 font-mono text-xs border border-slate-700 rounded-lg bg-slate-800 text-white focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                  BMC Username <span className="text-red-400">*</span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    id="input-bmc-username"
                    placeholder="e.g. root or admin"
                    value={bmcUsername}
                    onChange={e => {
                      setBmcUsername(e.target.value);
                      setHasTestedAccess(false);
                    }}
                    className="w-full p-2 pr-7 font-mono text-xs border border-slate-700 rounded-lg bg-slate-800 text-white focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                  />
                  <Lock className="w-3 h-3 text-slate-400 absolute right-2.5 top-2.5 pointer-events-none" />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                  BMC Password <span className="text-red-400">*</span>
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    id="input-bmc-password"
                    placeholder="Controller password"
                    value={bmcPassword}
                    onChange={e => {
                      setBmcPassword(e.target.value);
                      setHasTestedAccess(false);
                    }}
                    className="w-full p-2 pr-8 font-mono text-xs border border-slate-700 rounded-lg bg-slate-800 text-white focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-200"
                    title={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
            </div>

            {/* SSL & Advanced In-band Settings */}
            <div className="pt-2 border-t border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  id="chk-ignore-ssl"
                  checked={ignoreSslErrors}
                  onChange={e => setIgnoreSslErrors(e.target.checked)}
                  className="rounded-sm border-slate-600 bg-slate-800 text-indigo-600 focus:ring-indigo-500 w-3.5 h-3.5 cursor-pointer"
                />
                <span className="text-slate-300 text-[11px]">
                  Bypass self-signed SSL/TLS certificate warnings (standard for internal BMCs)
                </span>
              </label>

              <button
                type="button"
                onClick={() => setEnableSsh(!enableSsh)}
                className="text-[11px] text-indigo-400 hover:text-indigo-300 flex items-center gap-1 font-medium transition-colors"
              >
                <Terminal className="w-3 h-3" />
                <span>{enableSsh ? 'Hide In-Band SSH Credentials' : '+ Configure Host SSH Credentials'}</span>
              </button>
            </div>

            {/* Optional In-Band SSH Settings */}
            {enableSsh && (
              <div className="p-3 bg-slate-800/60 rounded-lg border border-slate-700/80 space-y-2.5 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-slate-200 flex items-center gap-1.5">
                    <Terminal className="w-3.5 h-3.5 text-emerald-400" />
                    Host OS In-Band Credentials (for staging kernel/driver firmware)
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono">Port {sshPort}</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[10px] text-slate-400 mb-1">SSH Username</label>
                    <input
                      type="text"
                      value={sshUsername}
                      onChange={e => setSshUsername(e.target.value)}
                      placeholder="sysadmin or ansible"
                      className="w-full p-1.5 font-mono text-xs border border-slate-700 rounded-md bg-slate-900 text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-400 mb-1">Auth Type</label>
                    <select
                      value={sshAuthType}
                      onChange={e => setSshAuthType(e.target.value as any)}
                      className="w-full p-1.5 text-xs border border-slate-700 rounded-md bg-slate-900 text-white"
                    >
                      <option value="password">Password</option>
                      <option value="key">SSH Private Key</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-400 mb-1">
                      {sshAuthType === 'password' ? 'SSH Password' : 'SSH Key Passphrase'}
                    </label>
                    <div className="relative">
                      <input
                        type={showSshPassword ? 'text' : 'password'}
                        value={sshPassword}
                        onChange={e => setSshPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full p-1.5 pr-7 font-mono text-xs border border-slate-700 rounded-md bg-slate-900 text-white"
                      />
                      <button
                        type="button"
                        onClick={() => setShowSshPassword(!showSshPassword)}
                        className="absolute right-2 top-2 text-slate-400 hover:text-white"
                      >
                        {showSshPassword ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Test Access Steps & Live Diagnostics Output */}
            {(isTestingAccess || testSteps.length > 0) && (
              <div className="p-3 bg-slate-950/80 rounded-lg border border-slate-800 space-y-2 font-mono text-[11px]">
                <div className="flex items-center justify-between text-[11px] font-sans font-semibold text-slate-300 border-b border-slate-800 pb-1.5">
                  <span className="flex items-center gap-1.5">
                    <Activity className="w-3.5 h-3.5 text-indigo-400" />
                    Access Test Diagnostics & Telemetry
                  </span>
                  {testResult && (
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${
                      testResult.status === 'success' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-red-500/20 text-red-300'
                    }`}>
                      {testResult.status === 'success' ? `Success (${testResult.latencyMs}ms)` : 'Failed'}
                    </span>
                  )}
                </div>

                {/* Individual Steps */}
                <div className="space-y-1.5">
                  {testSteps.map((step, idx) => (
                    <div key={step.id || idx} className="flex items-start justify-between gap-2">
                      <div className="flex items-start gap-2">
                        {step.status === 'running' && (
                          <RefreshCw className="w-3.5 h-3.5 text-indigo-400 animate-spin shrink-0 mt-0.5" />
                        )}
                        {step.status === 'success' && (
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                        )}
                        {step.status === 'failed' && (
                          <XCircle className="w-3.5 h-3.5 text-red-400 shrink-0 mt-0.5" />
                        )}
                        {step.status === 'pending' && (
                          <div className="w-3.5 h-3.5 rounded-full border border-slate-600 shrink-0 mt-0.5" />
                        )}
                        <div>
                          <div className={`text-xs ${
                            step.status === 'success' ? 'text-slate-200' :
                            step.status === 'failed' ? 'text-red-300' :
                            step.status === 'running' ? 'text-indigo-300 font-semibold' : 'text-slate-500'
                          }`}>
                            {step.name}
                          </div>
                          {step.message && (
                            <div className="text-[10px] text-slate-400 font-normal">
                              {step.message}
                            </div>
                          )}
                        </div>
                      </div>
                      {step.latencyMs !== undefined && (
                        <span className="text-[10px] text-slate-400 shrink-0">
                          {step.latencyMs}ms
                        </span>
                      )}
                    </div>
                  ))}
                </div>

                {/* Discovered Hardware Telemetry Card */}
                {testResult?.discoveredHardware && (
                  <div className="mt-2 pt-2 border-t border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[10px] text-slate-300 bg-slate-900/80 p-2.5 rounded-md">
                    <div className="space-y-0.5 font-sans">
                      <div className="font-semibold text-white flex items-center gap-1">
                        <Sparkles className="w-3 h-3 text-amber-400" />
                        <span>Discovered Hardware: {testResult.discoveredHardware.model}</span>
                        <span className="text-slate-400 font-normal">({testResult.discoveredHardware.serialNumber})</span>
                      </div>
                      <div className="text-slate-400">
                        Power: <span className="text-emerald-400 uppercase font-semibold">{testResult.discoveredHardware.powerState}</span> • 
                        Active BMC: <span className="text-indigo-300 font-mono">{testResult.discoveredHardware.bmcVersionDetected}</span> • 
                        Active BIOS: <span className="text-indigo-300 font-mono">{testResult.discoveredHardware.biosVersionDetected}</span>
                      </div>
                    </div>
                    <button
                      type="button"
                      id="btn-sync-discovered-fw"
                      onClick={handleSyncDiscoveredVersions}
                      className="px-2.5 py-1 bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-200 border border-indigo-500/40 rounded-md font-medium text-[10px] flex items-center gap-1 shrink-0 transition-colors"
                      title="Update the Current Firmware form fields below using these discovered versions"
                    >
                      <RefreshCw className="w-2.5 h-2.5" />
                      <span>Sync to Form</span>
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Section 4: Physical Location */}
          <div>
            <h4 className="text-[11px] font-bold text-slate-900 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-indigo-600" />
              <span>Physical Datacenter Location</span>
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Datacenter</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. US-East (Ashburn DC2)"
                  value={datacenter}
                  onChange={e => setDatacenter(e.target.value)}
                  className="w-full p-2.5 text-xs border border-slate-200 rounded-lg bg-slate-50 focus:bg-white"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Rack Identifier</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Rack B14"
                  value={rack}
                  onChange={e => setRack(e.target.value)}
                  className="w-full p-2.5 text-xs border border-slate-200 rounded-lg bg-slate-50 focus:bg-white"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Rack Unit (U-Slot)</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. U24-U25"
                  value={unit}
                  onChange={e => setUnit(e.target.value)}
                  className="w-full p-2.5 text-xs border border-slate-200 rounded-lg bg-slate-50 focus:bg-white"
                />
              </div>
            </div>
          </div>

          {/* Section 5: Current Firmware Version Tracking */}
          <div className="p-4 bg-indigo-50/50 border border-indigo-200/80 rounded-xl space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-xs font-bold text-indigo-950 uppercase tracking-wider flex items-center gap-1.5">
                  <Cpu className="w-4 h-4 text-indigo-700" />
                  <span>Current Installed Firmware Versions</span>
                </h4>
                <p className="text-[11px] text-slate-600 mt-0.5">
                  Specify or sync the active firmware flashed on this server's primary controllers.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowAdvancedComponents(!showAdvancedComponents)}
                className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
              >
                <span>{showAdvancedComponents ? 'Hide Peripheral Firmware' : 'More Components (NIC, RAID, NVMe)'}</span>
                {showAdvancedComponents ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="block font-semibold text-slate-700 mb-1 flex items-center justify-between">
                  <span>UEFI / System BIOS Version <span className="text-red-500">*</span></span>
                  <span className="text-[10px] text-indigo-600 font-mono">Latest: {getLatestPkgVersion('BIOS', '2.20.0')}</span>
                </label>
                <input
                  type="text"
                  required
                  id="input-fw-bios"
                  placeholder="e.g. 2.18.1"
                  value={biosVersion}
                  onChange={e => setBiosVersion(e.target.value)}
                  className="w-full p-2.5 font-mono text-xs border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1 flex items-center justify-between">
                  <span>BMC / Out-of-Band Controller Firmware <span className="text-red-500">*</span></span>
                  <span className="text-[10px] text-indigo-600 font-mono">Latest: {getLatestPkgVersion('BMC', '7.00.00.00')}</span>
                </label>
                <input
                  type="text"
                  required
                  id="input-fw-bmc"
                  placeholder="e.g. 6.10.30.00"
                  value={bmcVersion}
                  onChange={e => setBmcVersion(e.target.value)}
                  className="w-full p-2.5 font-mono text-xs border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                />
              </div>
            </div>

            {/* Advanced Peripheral Firmware */}
            {showAdvancedComponents && (
              <div className="pt-3 border-t border-indigo-200/60 grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1 flex items-center gap-1">
                    <Wifi className="w-3 h-3 text-indigo-600" /> NIC PCIe Firmware
                  </label>
                  <input
                    type="text"
                    value={nicVersion}
                    onChange={e => setNicVersion(e.target.value)}
                    className="w-full p-2 font-mono text-xs border border-slate-300 rounded-lg bg-white"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1 flex items-center gap-1">
                    <HardDrive className="w-3 h-3 text-amber-600" /> RAID Controller Firmware
                  </label>
                  <input
                    type="text"
                    value={raidVersion}
                    onChange={e => setRaidVersion(e.target.value)}
                    className="w-full p-2 font-mono text-xs border border-slate-300 rounded-lg bg-white"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1 flex items-center gap-1">
                    <HardDrive className="w-3 h-3 text-emerald-600" /> NVMe SSD Firmware
                  </label>
                  <input
                    type="text"
                    value={nvmeVersion}
                    onChange={e => setNvmeVersion(e.target.value)}
                    className="w-full p-2 font-mono text-xs border border-slate-300 rounded-lg bg-white"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Section 6: Cluster & Operational Status */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Cluster Assignment</label>
              <input
                type="text"
                value={cluster}
                onChange={e => setCluster(e.target.value)}
                className="w-full p-2.5 text-xs border border-slate-200 rounded-lg bg-slate-50 focus:bg-white"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Lifecycle Status</label>
              <select
                value={status}
                onChange={e => setStatus(e.target.value as any)}
                className="w-full p-2.5 text-xs border border-slate-200 rounded-lg bg-slate-50 focus:bg-white capitalize font-medium"
              >
                <option value="online">Online (Serving Traffic)</option>
                <option value="maintenance">Maintenance Mode (Drained)</option>
                <option value="degraded">Degraded</option>
                <option value="offline">Offline / Unreachable</option>
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Power Redundancy</label>
              <div className="flex items-center gap-3 pt-2">
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={powerSupplyRedundancy}
                    onChange={e => setPowerSupplyRedundancy(e.target.checked)}
                    className="rounded-sm border-slate-300 text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer"
                  />
                  <span className="text-xs text-slate-700 font-medium">Dual Redundant PSU</span>
                </label>
              </div>
            </div>
          </div>

          {/* Tags */}
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Inventory Tags (comma separated)</label>
            <input
              type="text"
              placeholder="worker, compute, tier-1"
              value={tags}
              onChange={e => setTags(e.target.value)}
              className="w-full p-2.5 text-xs border border-slate-200 rounded-lg bg-slate-50 focus:bg-white"
            />
          </div>

          {/* Form Actions */}
          <div className="pt-4 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
            <div className="text-[11px] text-slate-500 flex items-center gap-1.5">
              {hasTestedAccess ? (
                <span className="text-emerald-600 font-semibold flex items-center gap-1">
                  <ShieldCheck className="w-4 h-4" />
                  BMC & host access verified
                </span>
              ) : (
                <span className="text-amber-600 font-medium flex items-center gap-1">
                  <ShieldAlert className="w-4 h-4" />
                  Access test will run upon registration
                </span>
              )}
            </div>

            <div className="flex items-center space-x-3 w-full sm:w-auto justify-end">
              <button
                type="button"
                id="btn-cancel-device-modal"
                onClick={onClose}
                className="px-4 py-2 text-slate-600 hover:text-slate-900 font-semibold"
              >
                Cancel
              </button>
              <button
                type="submit"
                id="btn-save-device-modal"
                disabled={isTestingAccess}
                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white rounded-lg font-semibold shadow-xs flex items-center gap-1.5 transition-colors"
              >
                {isTestingAccess ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Verifying Access...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    <span>{isEditing ? 'Save Device Changes' : 'Test & Register Server'}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
