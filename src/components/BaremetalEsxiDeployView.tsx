import React, { useState, useEffect, useRef } from 'react';
import { 
  Server as ServerIcon, 
  Cpu, 
  HardDrive, 
  CheckCircle2, 
  AlertTriangle, 
  XCircle, 
  Play, 
  Terminal, 
  ExternalLink, 
  ShieldCheck, 
  RefreshCw, 
  Sliders, 
  Search, 
  ArrowRight, 
  ChevronRight, 
  Wifi, 
  Globe, 
  Database, 
  Eye, 
  Settings, 
  Key, 
  Check, 
  RotateCcw, 
  Info,
  Disc,
  Clock,
  Layers,
  Sparkles,
  Link2
} from 'lucide-react';
import { 
  Server, 
  BaremetalVendor, 
  BaremetalEsxiDeploymentJob, 
  BaremetalDeployStage, 
  DellOpenManageWorkflowConfig, 
  LenovoLxcaWorkflowConfig, 
  BaremetalNetworkProfile, 
  PostInstallEsxiValidation 
} from '../types';
import { 
  fetchBaremetalCatalog, 
  fetchBaremetalJobs, 
  startBaremetalDeployment, 
  stepBaremetalJob, 
  verifyPostInstallEsxi, 
  joinBaremetalVcenter 
} from '../services/api';

interface BaremetalEsxiDeployViewProps {
  servers: Server[];
  preSelectedServerId?: string | null;
  onUpdateServer?: (server: Server) => void;
  onAddServer?: (server: Server) => void;
  onShowToast?: (message: string, type?: 'success' | 'info' | 'warn') => void;
}

export const BaremetalEsxiDeployView: React.FC<BaremetalEsxiDeployViewProps> = ({
  servers,
  preSelectedServerId,
  onUpdateServer,
  onAddServer,
  onShowToast
}) => {
  // Top Navigation Tabs
  const [activeSubTab, setActiveSubTab] = useState<'wizard' | 'post-install' | 'jobs'>('wizard');

  // Catalog loaded from backend
  const [catalog, setCatalog] = useState<{
    dell: any;
    lenovo: any;
  } | null>(null);

  // Active / Historical Jobs
  const [jobs, setJobs] = useState<BaremetalEsxiDeploymentJob[]>([]);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [isAdvancingStep, setIsAdvancingStep] = useState(false);

  // Wizard States (Steps 1 - 4)
  const [wizardStep, setWizardStep] = useState<1 | 2 | 3 | 4>(1);
  const [selectedVendor, setSelectedVendor] = useState<BaremetalVendor>('DELL');
  const [selectedExistingServerId, setSelectedExistingServerId] = useState<string>('');

  // Target Hardware Details
  const [hardwareForm, setHardwareForm] = useState({
    hostname: 'esx-dell-r750-01.corp.internal',
    model: 'Dell PowerEdge R750',
    bmcIp: '192.168.10.120',
    macAddress: 'b4:96:91:28:44:0a',
    datacenter: 'Datacenter-Core-01',
    rack: 'Rack-B04',
  });

  // Dell OpenManage Config
  const [dellConfig, setDellConfig] = useState<DellOpenManageWorkflowConfig>({
    omeHost: 'ome.datacenter.corp',
    omePort: 443,
    omeUsername: 'admin',
    omePassword: '••••••••',
    deviceGroupId: 'grp-baremetal-compute',
    deviceGroupName: 'Baremetal Compute Pool 01',
    templateId: 'ome-tpl-01',
    templateName: 'Dell PowerEdge 15G/16G ESXi 8.0 Deployment Template',
    targetBootDevice: 'BOSS-S2_RAID1',
    dellCustomizedIso: 'VMware-VMvisor-Installer-8.0U2-Dell-Customized-A01.iso',
    installIsmAgent: true,
    installOmsaVib: true,
    enableSecureBoot: true,
    virtualizationVT: true,
    sriovEnabled: true,
    powerProfile: 'Performance',
    autoRegisterOmeInventory: true,
    networkProfile: {
      hostname: 'esx-dell-r750-01.corp.internal',
      useDhcp: false,
      staticIp: '192.168.10.201',
      subnetMask: '255.255.255.0',
      gateway: '192.168.10.1',
      dnsServers: '192.168.10.10, 192.168.10.11',
      ntpServers: 'time.corp.internal',
      managementVlan: 100,
      rootPassword: 'VMwarePassword!2026',
      enableSsh: true,
      enableEsxiShell: true,
      vmk0UplinkNics: ['vmnic0', 'vmnic1'],
    }
  });

  // Lenovo LXCA Config
  const [lenovoConfig, setLenovoConfig] = useState<LenovoLxcaWorkflowConfig>({
    lxcaHost: 'lxca.datacenter.corp',
    lxcaPort: 443,
    lxcaUsername: 'USERID',
    lxcaPassword: '••••••••',
    configPatternId: 'lxca-pat-01',
    configPatternName: 'Lenovo ThinkSystem SR650/SR630 ESXi 8.0 Enterprise Pattern',
    targetBootDevice: 'M2_RAID1',
    lenovoCustomizedIso: 'VMware-VMvisor-Installer-8.0U2-Lenovo-ThinkSystem-v1.4.iso',
    enableXccAgentProvider: true,
    enableSecureBoot: true,
    uefiBootMode: 'UEFI_Only',
    autoManageInLxca: true,
    networkProfile: {
      hostname: 'esx-lenovo-sr650-01.corp.internal',
      useDhcp: false,
      staticIp: '192.168.10.202',
      subnetMask: '255.255.255.0',
      gateway: '192.168.10.1',
      dnsServers: '192.168.10.10, 192.168.10.11',
      ntpServers: 'time.corp.internal',
      managementVlan: 100,
      rootPassword: 'VMwarePassword!2026',
      enableSsh: true,
      enableEsxiShell: true,
      vmk0UplinkNics: ['vmnic0', 'vmnic1'],
    }
  });

  // Common Network Profile (mirrors the active vendor)
  const currentNetworkProfile = selectedVendor === 'DELL' ? dellConfig.networkProfile : lenovoConfig.networkProfile;
  const updateNetworkProfile = (patch: Partial<BaremetalNetworkProfile>) => {
    if (selectedVendor === 'DELL') {
      setDellConfig(prev => ({
        ...prev,
        networkProfile: { ...prev.networkProfile, ...patch }
      }));
    } else {
      setLenovoConfig(prev => ({
        ...prev,
        networkProfile: { ...prev.networkProfile, ...patch }
      }));
    }
  };

  // Password visibility toggle
  const [showPassword, setShowPassword] = useState(false);

  // Post-Install Verification Hub State
  const [verifyTargetIp, setVerifyTargetIp] = useState<string>('192.168.10.201');
  const [verifyVendor, setVerifyVendor] = useState<BaremetalVendor>('DELL');
  const [verifyEsxiVersion, setVerifyEsxiVersion] = useState<string>('8.0U2');
  const [isVerifyingPostInstall, setIsVerifyingPostInstall] = useState(false);
  const [postInstallResult, setPostInstallResult] = useState<PostInstallEsxiValidation | null>(null);
  const [verifyDiagnostic, setVerifyDiagnostic] = useState<string>('');

  // vCenter Join Modal State
  const [isVcenterModalOpen, setIsVcenterModalOpen] = useState(false);
  const [vcenterConfig, setVcenterConfig] = useState({
    vcenterHost: 'vcenter.datacenter.corp',
    datacenter: 'Datacenter-Core-01',
    cluster: 'Compute-Cluster-A',
    maintenanceMode: false,
    joinProgress: false,
    joinSuccessMessage: ''
  });

  // Log container ref for auto-scrolling
  const logContainerRef = useRef<HTMLDivElement>(null);

  // Load catalog on mount
  useEffect(() => {
    fetchBaremetalCatalog().then(res => {
      if (res.success) {
        setCatalog({ dell: res.dell, lenovo: res.lenovo });
      }
    });

    fetchBaremetalJobs().then(res => {
      if (res.success && res.jobs.length > 0) {
        setJobs(res.jobs);
        // Select latest running job if any
        const running = res.jobs.find(j => j.status === 'in_progress');
        if (running) {
          setActiveJobId(running.id);
        } else {
          setActiveJobId(res.jobs[0].id);
        }
      }
    });
  }, []);

  // Pre-select server from props if provided
  useEffect(() => {
    if (preSelectedServerId) {
      const match = servers.find(s => s.id === preSelectedServerId);
      if (match) {
        setSelectedExistingServerId(match.id);
        const v: BaremetalVendor = match.vendor === 'LENOVO' ? 'LENOVO' : 'DELL';
        setSelectedVendor(v);
        setHardwareForm({
          hostname: match.hostname,
          model: match.model,
          bmcIp: match.bmcIp || '192.168.10.120',
          macAddress: match.accessStatus?.discoveredHardware?.macAddress || 'b4:96:91:28:44:0a',
          datacenter: match.datacenter || 'Datacenter-Core-01',
          rack: match.rack || 'Rack-B04',
        });
        updateNetworkProfile({
          hostname: match.hostname,
          staticIp: match.ip || '192.168.10.201'
        });
        setVerifyTargetIp(match.ip || '192.168.10.201');
        setVerifyVendor(v);
      }
    }
  }, [preSelectedServerId, servers]);

  // Auto-scroll logs
  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [jobs, activeJobId]);

  // Active Job lookup
  const activeJob = jobs.find(j => j.id === activeJobId) || jobs[0] || null;

  // Handle Server Selection Change
  const handleExistingServerChange = (serverId: string) => {
    setSelectedExistingServerId(serverId);
    if (!serverId) return;
    const match = servers.find(s => s.id === serverId);
    if (match) {
      const v: BaremetalVendor = match.vendor === 'LENOVO' ? 'LENOVO' : 'DELL';
      setSelectedVendor(v);
      setHardwareForm({
        hostname: match.hostname,
        model: match.model,
        bmcIp: match.bmcIp || '192.168.10.120',
        macAddress: match.accessStatus?.discoveredHardware?.macAddress || 'b4:96:91:28:44:0a',
        datacenter: match.datacenter || 'Datacenter-Core-01',
        rack: match.rack || 'Rack-B04',
      });
      updateNetworkProfile({
        hostname: match.hostname,
        staticIp: match.ip || '192.168.10.201'
      });
      setVerifyTargetIp(match.ip || '192.168.10.201');
      setVerifyVendor(v);
    }
  };

  // Vendor Toggle
  const handleVendorSwitch = (vendor: BaremetalVendor) => {
    setSelectedVendor(vendor);
    if (vendor === 'DELL') {
      setHardwareForm(prev => ({
        ...prev,
        hostname: prev.hostname.includes('lenovo') ? 'esx-dell-r750-01.corp.internal' : prev.hostname,
        model: prev.model.includes('ThinkSystem') ? 'Dell PowerEdge R750' : prev.model,
      }));
    } else {
      setHardwareForm(prev => ({
        ...prev,
        hostname: prev.hostname.includes('dell') ? 'esx-lenovo-sr650-01.corp.internal' : prev.hostname,
        model: prev.model.includes('PowerEdge') ? 'Lenovo ThinkSystem SR650 V2' : prev.model,
      }));
    }
  };

  // Start Deployment
  const handleStartDeployment = async () => {
    const isDell = selectedVendor === 'DELL';
    const payload = {
      serverId: selectedExistingServerId || undefined,
      serverHostname: hardwareForm.hostname,
      vendor: selectedVendor,
      model: hardwareForm.model,
      bmcIp: hardwareForm.bmcIp,
      esxiVersion: isDell ? (dellConfig.dellCustomizedIso.includes('7.0') ? '7.0U3' : '8.0U2') : (lenovoConfig.lenovoCustomizedIso.includes('7.0') ? '7.0U3' : '8.0U2'),
      targetManagementIp: currentNetworkProfile.staticIp || '192.168.10.201',
      dellConfig: isDell ? dellConfig : undefined,
      lenovoConfig: !isDell ? lenovoConfig : undefined,
      networkProfile: currentNetworkProfile,
    };

    const res = await startBaremetalDeployment(payload);
    if (res.success && res.job) {
      setJobs(prev => [res.job!, ...prev]);
      setActiveJobId(res.job.id);
      setActiveSubTab('jobs');
      onShowToast?.(`Baremetal deployment job started via ${isDell ? 'Dell OpenManage Enterprise' : 'Lenovo LXCA'}!`, 'success');
    } else {
      onShowToast?.(res.error || 'Failed to initiate baremetal deployment', 'warn');
    }
  };

  // Advance Step in Active Job
  const handleAdvanceStep = async () => {
    if (!activeJob || activeJob.status !== 'in_progress') return;
    setIsAdvancingStep(true);
    try {
      const res = await stepBaremetalJob(activeJob.id);
      if (res.success && res.job) {
        setJobs(prev => prev.map(j => j.id === res.job!.id ? res.job! : j));
        if (res.job.status === 'installed' && res.job.postInstallValidation) {
          setPostInstallResult(res.job.postInstallValidation);
          setVerifyTargetIp(res.job.targetManagementIp);
          setVerifyVendor(res.job.vendor);
          onShowToast?.(`Bare-metal VMware ESXi deployment completed successfully! "Once ESXi Installed" verification passed.`, 'success');
        }
      }
    } finally {
      setIsAdvancingStep(false);
    }
  };

  // Run Post-Install Verification Diagnostic
  const handleRunPostInstallCheck = async () => {
    setIsVerifyingPostInstall(true);
    setVerifyDiagnostic('');
    try {
      const res = await verifyPostInstallEsxi({
        hostIp: verifyTargetIp,
        vendor: verifyVendor,
        esxiVersion: verifyEsxiVersion,
        bmcIp: hardwareForm.bmcIp
      });
      if (res.success) {
        setPostInstallResult(res.validation);
        setVerifyDiagnostic(res.diagnostic || `Verified VMware ESXi on ${verifyTargetIp}`);
        onShowToast?.(`Post-installation checks verified for ${verifyTargetIp}!`, 'success');
      } else {
        onShowToast?.(res.error || 'Verification probe failed', 'warn');
      }
    } finally {
      setIsVerifyingPostInstall(false);
    }
  };

  // Enroll into vCenter
  const handleJoinVcenter = async () => {
    setVcenterConfig(prev => ({ ...prev, joinProgress: true, joinSuccessMessage: '' }));
    try {
      const res = await joinBaremetalVcenter({
        hostIp: verifyTargetIp,
        vcenterHost: vcenterConfig.vcenterHost,
        datacenter: vcenterConfig.datacenter,
        cluster: vcenterConfig.cluster,
        maintenanceMode: vcenterConfig.maintenanceMode,
      });
      if (res.success) {
        setVcenterConfig(prev => ({
          ...prev,
          joinProgress: false,
          joinSuccessMessage: res.message || `Host ${verifyTargetIp} joined cluster ${vcenterConfig.cluster}!`
        }));
        if (postInstallResult) {
          setPostInstallResult({
            ...postInstallResult,
            vcenterStatus: {
              registered: true,
              vcenterHost: vcenterConfig.vcenterHost,
              datacenter: vcenterConfig.datacenter,
              cluster: vcenterConfig.cluster,
              inMaintenanceMode: vcenterConfig.maintenanceMode,
              taskMessage: `Enrolled into ${vcenterConfig.cluster}`
            }
          });
        }
        onShowToast?.(`Enrolled host ${verifyTargetIp} into vCenter Cluster!`, 'success');
      } else {
        setVcenterConfig(prev => ({ ...prev, joinProgress: false }));
        onShowToast?.(res.error || 'Failed to join vCenter', 'warn');
      }
    } catch (e: any) {
      setVcenterConfig(prev => ({ ...prev, joinProgress: false }));
      onShowToast?.(e.message, 'warn');
    }
  };

  // Sync / Add newly installed host into Fleet Inventory
  const handleSyncToInventory = () => {
    const existing = servers.find(s => s.id === selectedExistingServerId || s.ip === verifyTargetIp);
    const updatedServer: Server = existing ? {
      ...existing,
      status: 'online',
      hypervisor: 'VMware ESXi',
      hypervisorVersion: `VMware ESXi ${verifyEsxiVersion} (Build ${postInstallResult?.esxiBuildDetected || '22380479'})`,
      hypervisorMaintenanceMode: Boolean(postInstallResult?.vcenterStatus?.inMaintenanceMode),
      notes: `${existing.notes ? existing.notes + ' | ' : ''}Deployed baremetal via ${verifyVendor === 'DELL' ? 'Dell OpenManage Enterprise' : 'Lenovo LXCA'} on ${new Date().toLocaleDateString()}`,
    } : {
      id: `srv-${Date.now().toString(36)}`,
      hostname: hardwareForm.hostname,
      vendor: verifyVendor,
      hypervisor: 'VMware ESXi',
      hypervisorVersion: `VMware ESXi ${verifyEsxiVersion} (Build ${postInstallResult?.esxiBuildDetected || '22380479'})`,
      hypervisorMaintenanceMode: Boolean(postInstallResult?.vcenterStatus?.inMaintenanceMode),
      activeVmsCount: 0,
      cluster: vcenterConfig.cluster || 'Compute-Cluster-A',
      datacenter: hardwareForm.datacenter || 'Datacenter-Core-01',
      rack: hardwareForm.rack || 'Rack-B04',
      unit: 'U14',
      ip: verifyTargetIp,
      bmcIp: hardwareForm.bmcIp,
      bmcAffectedType: verifyVendor === 'DELL' ? 'iDRAC9' : 'Lenovo XCC2',
      model: hardwareForm.model,
      architecture: 'x86_64',
      status: 'online',
      powerState: 'on',
      powerSupplyRedundancy: true,
      components: {
        BIOS: { type: 'BIOS', name: 'System BIOS', vendor: verifyVendor, currentVersion: '2.20.0', latestVersion: '2.20.0', status: 'up_to_date', rebootRequired: false },
        BMC: { type: 'BMC', name: verifyVendor === 'DELL' ? 'iDRAC9' : 'XClarity Controller', vendor: verifyVendor, currentVersion: '7.00.00.00', latestVersion: '7.00.00.00', status: 'up_to_date', rebootRequired: false },
        NIC: { type: 'NIC', name: 'Dual-Port 25GbE Adapter', vendor: 'Broadcom', currentVersion: '22.39.0', latestVersion: '22.39.0', status: 'up_to_date', rebootRequired: false },
        RAID: { type: 'RAID', name: verifyVendor === 'DELL' ? 'BOSS-S2 Controller' : 'ThinkSystem M.2 RAID', vendor: verifyVendor, currentVersion: '52.16.0', latestVersion: '52.16.0', status: 'up_to_date', rebootRequired: false },
        NVMe: { type: 'NVMe', name: 'Enterprise NVMe SSD', vendor: 'Kioxia', currentVersion: '1.3.0', latestVersion: '1.3.0', status: 'up_to_date', rebootRequired: false },
      },
      tags: ['baremetal-deployed', verifyVendor.toLowerCase(), 'esxi-host'],
      lastUpgradeDate: new Date().toISOString(),
    };

    if (existing && onUpdateServer) {
      onUpdateServer(updatedServer);
      onShowToast?.(`Server [${updatedServer.hostname}] updated in fleet inventory as active VMware ESXi host!`, 'success');
    } else if (onAddServer) {
      onAddServer(updatedServer);
      onShowToast?.(`New baremetal server [${updatedServer.hostname}] registered in fleet inventory!`, 'success');
    }
  };

  // Stage Definition List for Workflow Visualization
  const STAGES_DISPLAY: Array<{ stage: BaremetalDeployStage; label: string; desc: string }> = [
    { stage: 'discovery', label: '1. OME / LXCA Discovery', desc: 'Authenticate BMC & associate with management appliance' },
    { stage: 'template_profile_apply', label: '2. Profile & BIOS Pattern', desc: 'Deploy template, configure VT-x/AMD-V, SR-IOV, Secure Boot' },
    { stage: 'storage_raid_provision', label: '3. Boot RAID Provisioning', desc: 'Build Virtual Disk 0 RAID 1 mirror on BOSS-S1/S2 or M.2' },
    { stage: 'media_mount', label: '4. OEM Custom ISO Mount', desc: 'Mount Dell/Lenovo Customized ESXi ISO over Virtual Media' },
    { stage: 'kickstart_injection', label: '5. Kickstart (ks.cfg) Injection', desc: 'Inject unattended install answers, IP, VLAN, and agent VIBs' },
    { stage: 'installer_boot', label: '6. Server Reset & One-Time Boot', desc: 'Reboot node to Virtual Optical Drive via iDRAC/XCC' },
    { stage: 'esxi_installing', label: '7. ESXi Automated Installation', desc: 'Weasel installer writes VMFS-6 and installs OEM kernel drivers' },
    { stage: 'installer_reboot', label: '8. Reboot & Post-Verification', desc: 'Unmount media and boot local drive into live ESXi' },
  ];

  const getStageIndex = (stage: string) => {
    switch (stage) {
      case 'discovery': return 0;
      case 'template_profile_apply': return 1;
      case 'storage_raid_provision': return 2;
      case 'media_mount': return 3;
      case 'kickstart_injection': return 4;
      case 'installer_boot': return 5;
      case 'esxi_installing': return 6;
      case 'installer_reboot':
      case 'post_check_running':
      case 'post_check_passed': return 7;
      default: return 0;
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Top Main Banner */}
      <div className="bg-slate-900 rounded-xl p-6 text-white shadow-md relative overflow-hidden border border-slate-800">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="space-y-1.5 max-w-3xl">
            <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 text-xs font-semibold border border-indigo-400/30">
              <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
              <span>Bare-Metal Hypervisor Provisioning Engine</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
              <span>Deploy VMware ESXi on Baremetal Hardware</span>
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              Automated bare-metal deployment for <strong className="text-blue-300">DELL PowerEdge</strong> via <strong>Dell OpenManage Enterprise (OME)</strong> and <strong className="text-emerald-300">Lenovo ThinkSystem</strong> via <strong>Lenovo XClarity Administrator (LXCA)</strong> with unattended Kickstart orchestration and deep post-install verification.
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              id="btn-switch-to-post-install"
              onClick={() => {
                setActiveSubTab('post-install');
                if (!postInstallResult) handleRunPostInstallCheck();
              }}
              className="px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold transition-colors flex items-center gap-2"
            >
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>Once ESXi Installed Hub</span>
            </button>
            <button
              type="button"
              id="btn-switch-to-wizard"
              onClick={() => setActiveSubTab('wizard')}
              className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition-colors shadow-xs flex items-center gap-2"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>New Deployment</span>
            </button>
          </div>
        </div>

        {/* Sub Navigation Bar */}
        <div className="mt-6 pt-4 border-t border-slate-800/80 flex items-center gap-2 overflow-x-auto">
          <button
            type="button"
            id="tab-baremetal-wizard"
            onClick={() => setActiveSubTab('wizard')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-2 ${
              activeSubTab === 'wizard' 
                ? 'bg-indigo-600 text-white shadow-xs' 
                : 'text-slate-300 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>1. Deployment Configuration Wizard</span>
          </button>

          <button
            type="button"
            id="tab-baremetal-jobs"
            onClick={() => setActiveSubTab('jobs')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-2 relative ${
              activeSubTab === 'jobs' 
                ? 'bg-indigo-600 text-white shadow-xs' 
                : 'text-slate-300 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Terminal className="w-3.5 h-3.5" />
            <span>2. Live Orchestration & Console Logs</span>
            {jobs.some(j => j.status === 'in_progress') && (
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            )}
            <span className="ml-1 text-[10px] px-1.5 py-0.2 rounded-full bg-slate-800 text-slate-300">
              {jobs.length}
            </span>
          </button>

          <button
            type="button"
            id="tab-baremetal-post-install"
            onClick={() => {
              setActiveSubTab('post-install');
              if (!postInstallResult) handleRunPostInstallCheck();
            }}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-2 ${
              activeSubTab === 'post-install' 
                ? 'bg-emerald-600 text-white shadow-xs' 
                : 'text-slate-300 hover:text-white hover:bg-slate-800'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-300" />
            <span>3. "Once ESXi Installed" Post-Install Hub</span>
          </button>
        </div>
      </div>

      {/* SUB-VIEW 1: DEPLOYMENT WIZARD */}
      {activeSubTab === 'wizard' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
          {/* Step Indicator Header */}
          <div className="bg-slate-50 border-b border-slate-200 px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-8">
                {[
                  { step: 1, title: 'Target Baremetal Node' },
                  { step: 2, title: selectedVendor === 'DELL' ? 'DELL OpenManage Workflow' : 'Lenovo LXCA Workflow' },
                  { step: 3, title: 'ESXi Kickstart & Network' },
                  { step: 4, title: 'Preflight & Launch' },
                ].map(s => (
                  <button
                    key={s.step}
                    type="button"
                    onClick={() => setWizardStep(s.step as any)}
                    className={`flex items-center gap-2.5 text-xs font-semibold transition-colors ${
                      wizardStep === s.step
                        ? 'text-indigo-600'
                        : wizardStep > s.step
                        ? 'text-slate-700'
                        : 'text-slate-400'
                    }`}
                  >
                    <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${
                      wizardStep === s.step
                        ? 'bg-indigo-600 text-white'
                        : wizardStep > s.step
                        ? 'bg-emerald-100 text-emerald-700'
                        : 'bg-slate-200 text-slate-600'
                    }`}>
                      {wizardStep > s.step ? <Check className="w-3.5 h-3.5" /> : s.step}
                    </span>
                    <span>{s.title}</span>
                  </button>
                ))}
              </div>

              <div className="text-xs text-slate-500 font-medium">
                Step {wizardStep} of 4
              </div>
            </div>
          </div>

          <div className="p-6">
            {/* STEP 1: TARGET HARDWARE SELECTION */}
            {wizardStep === 1 && (
              <div className="space-y-6 max-w-4xl">
                <div>
                  <h2 className="text-base font-bold text-slate-900">Select Bare-Metal Hardware & Vendor</h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Choose whether you are deploying to a DELL PowerEdge server (managed through Dell OpenManage Enterprise) or a Lenovo ThinkSystem server (managed through Lenovo XClarity Administrator).
                  </p>
                </div>

                {/* Vendor Selector Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div
                    onClick={() => handleVendorSwitch('DELL')}
                    className={`cursor-pointer rounded-xl p-5 border-2 transition-all flex flex-col justify-between ${
                      selectedVendor === 'DELL'
                        ? 'border-indigo-600 bg-indigo-50/40 ring-2 ring-indigo-500/20'
                        : 'border-slate-200 hover:border-slate-300 bg-white'
                    }`}
                  >
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-blue-100 text-blue-800 uppercase tracking-wider">
                          DELL Technologies
                        </span>
                        {selectedVendor === 'DELL' && (
                          <span className="w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center">
                            <Check className="w-3.5 h-3.5" />
                          </span>
                        )}
                      </div>
                      <h3 className="text-sm font-bold text-slate-900">DELL PowerEdge (OpenManage Enterprise)</h3>
                      <p className="text-xs text-slate-600 leading-relaxed">
                        Full workflow into <strong>DELL OpenManage Enterprise (OME)</strong>: Device discovery, deployment template binding, BOSS-S1/S2 or PERC RAID 1 boot mirror provisioning, Dell Customized ESXi ISO mapping, unattended kickstart, and Dell iDRAC Service Module (iSM) auto-injection.
                      </p>
                    </div>
                    <div className="mt-4 pt-3 border-t border-slate-200/60 flex items-center justify-between text-[11px] text-slate-500">
                      <span>Supported: R750, R650, R740xd, MX750c</span>
                      <span className="font-semibold text-blue-700">iDRAC9 / iDRAC8</span>
                    </div>
                  </div>

                  <div
                    onClick={() => handleVendorSwitch('LENOVO')}
                    className={`cursor-pointer rounded-xl p-5 border-2 transition-all flex flex-col justify-between ${
                      selectedVendor === 'LENOVO'
                        ? 'border-indigo-600 bg-indigo-50/40 ring-2 ring-indigo-500/20'
                        : 'border-slate-200 hover:border-slate-300 bg-white'
                    }`}
                  >
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-100 text-emerald-800 uppercase tracking-wider">
                          Lenovo Enterprise
                        </span>
                        {selectedVendor === 'LENOVO' && (
                          <span className="w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center">
                            <Check className="w-3.5 h-3.5" />
                          </span>
                        )}
                      </div>
                      <h3 className="text-sm font-bold text-slate-900">Lenovo ThinkSystem (LXCA)</h3>
                      <p className="text-xs text-slate-600 leading-relaxed">
                        Full workflow with <strong>Lenovo XClarity Administrator (LXCA)</strong>: Server Configuration Pattern assignment (UEFI Only, Secure Boot, IOMMU), M.2 NVMe RAID 1 or ThinkSystem RAID adapter volume creation, Lenovo Custom ESXi ISO, and Lenovo CIM/XCC Agent integration.
                      </p>
                    </div>
                    <div className="mt-4 pt-3 border-t border-slate-200/60 flex items-center justify-between text-[11px] text-slate-500">
                      <span>Supported: SR650 V2/V3, SR630 V2, SR670</span>
                      <span className="font-semibold text-emerald-700">XCC / XCC2</span>
                    </div>
                  </div>
                </div>

                {/* Pre-fill from existing registered inventory */}
                <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-slate-800">
                      Select Server from Existing Fleet (Optional)
                    </label>
                    <span className="text-[11px] text-slate-500">
                      {servers.length} servers in inventory
                    </span>
                  </div>

                  <select
                    id="select-existing-baremetal-server"
                    value={selectedExistingServerId}
                    onChange={(e) => handleExistingServerChange(e.target.value)}
                    className="w-full text-xs rounded-lg border-slate-300 bg-white p-2 text-slate-800 focus:border-indigo-500 focus:ring-indigo-500"
                  >
                    <option value="">-- Register a new bare-metal server below or select existing --</option>
                    {servers.map(s => (
                      <option key={s.id} value={s.id}>
                        {s.hostname} — {s.vendor} {s.model} (BMC: {s.bmcIp}, Current OS: {s.hypervisor})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Hardware Identity Form */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Server Hostname
                    </label>
                    <input
                      type="text"
                      id="input-baremetal-hostname"
                      value={hardwareForm.hostname}
                      onChange={e => {
                        const val = e.target.value;
                        setHardwareForm(p => ({ ...p, hostname: val }));
                        updateNetworkProfile({ hostname: val });
                      }}
                      className="w-full text-xs rounded-lg border-slate-300 p-2 text-slate-800 focus:border-indigo-500 focus:ring-indigo-500 font-mono"
                      placeholder="e.g. esx-r750-01.corp.internal"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Hardware Model
                    </label>
                    <input
                      type="text"
                      id="input-baremetal-model"
                      value={hardwareForm.model}
                      onChange={e => setHardwareForm(p => ({ ...p, model: e.target.value }))}
                      className="w-full text-xs rounded-lg border-slate-300 p-2 text-slate-800 focus:border-indigo-500 focus:ring-indigo-500"
                      placeholder="e.g. Dell PowerEdge R750 or ThinkSystem SR650"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Out-of-Band BMC IP ({selectedVendor === 'DELL' ? 'iDRAC' : 'XCC'})
                    </label>
                    <input
                      type="text"
                      id="input-baremetal-bmcip"
                      value={hardwareForm.bmcIp}
                      onChange={e => setHardwareForm(p => ({ ...p, bmcIp: e.target.value }))}
                      className="w-full text-xs rounded-lg border-slate-300 p-2 text-slate-800 focus:border-indigo-500 focus:ring-indigo-500 font-mono"
                      placeholder="e.g. 192.168.10.120"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end pt-4 border-t border-slate-200">
                  <button
                    type="button"
                    id="btn-wizard-step1-next"
                    onClick={() => setWizardStep(2)}
                    className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 transition-colors flex items-center gap-1.5"
                  >
                    <span>Next: Configure {selectedVendor === 'DELL' ? 'Dell OpenManage' : 'Lenovo LXCA'}</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {/* STEP 2: VENDOR ORCHESTRATOR CONFIGURATION */}
            {wizardStep === 2 && (
              <div className="space-y-6 max-w-4xl">
                <div>
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                      selectedVendor === 'DELL' ? 'bg-blue-100 text-blue-800' : 'bg-emerald-100 text-emerald-800'
                    }`}>
                      {selectedVendor === 'DELL' ? 'DELL OPENMANAGE ENTERPRISE' : 'LENOVO XCLARITY ADMINISTRATOR'}
                    </span>
                    <h2 className="text-base font-bold text-slate-900">
                      {selectedVendor === 'DELL' ? 'Dell OpenManage Workflow Configuration' : 'Lenovo LXCA Workflow Configuration'}
                    </h2>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {selectedVendor === 'DELL'
                      ? 'Configure the OpenManage Enterprise (OME) appliance connection, deployment template, BOSS-S1/S2 RAID controller, and Dell Customized VMware ESXi image.'
                      : 'Configure the Lenovo XClarity Administrator (LXCA) connection, Server Configuration Pattern, boot storage target, and Lenovo Custom ESXi image.'}
                  </p>
                </div>

                {/* DELL OPENMANAGE WORKFLOW FORM */}
                {selectedVendor === 'DELL' && (
                  <div className="space-y-5">
                    {/* OME Appliance Connection */}
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                      <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
                        <Globe className="w-4 h-4 text-blue-600" />
                        <span>Dell OpenManage Enterprise (OME) Appliance Connection</span>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                        <div>
                          <label className="block text-slate-600 mb-1">OME Appliance Host / IP</label>
                          <input
                            type="text"
                            value={dellConfig.omeHost}
                            onChange={e => setDellConfig(p => ({ ...p, omeHost: e.target.value }))}
                            className="w-full rounded-lg border-slate-300 p-2 font-mono"
                            placeholder="ome.datacenter.corp"
                          />
                        </div>
                        <div>
                          <label className="block text-slate-600 mb-1">OME Username</label>
                          <input
                            type="text"
                            value={dellConfig.omeUsername}
                            onChange={e => setDellConfig(p => ({ ...p, omeUsername: e.target.value }))}
                            className="w-full rounded-lg border-slate-300 p-2 font-mono"
                          />
                        </div>
                        <div>
                          <label className="block text-slate-600 mb-1">Target Device Group</label>
                          <input
                            type="text"
                            value={dellConfig.deviceGroupName}
                            onChange={e => setDellConfig(p => ({ ...p, deviceGroupName: e.target.value }))}
                            className="w-full rounded-lg border-slate-300 p-2"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Template & Storage Target */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-slate-800 mb-1">
                          OME Server Deployment Template
                        </label>
                        <select
                          value={dellConfig.templateId}
                          onChange={e => {
                            const val = e.target.value;
                            const tpl = catalog?.dell?.templates?.find((t: any) => t.id === val);
                            setDellConfig(p => ({
                              ...p,
                              templateId: val,
                              templateName: tpl ? tpl.name : p.templateName
                            }));
                          }}
                          className="w-full text-xs rounded-lg border-slate-300 p-2"
                        >
                          <option value="ome-tpl-01">Dell PowerEdge 15G/16G ESXi 8.0 Deployment Template</option>
                          <option value="ome-tpl-02">Dell PowerEdge 14G/15G ESXi 7.0U3 Enterprise Template</option>
                        </select>
                        <p className="text-[11px] text-slate-500 mt-1">
                          Applies UEFI Secure Boot, VT-x/AMD-V virtualization, SR-IOV, and Maximum Performance system profile.
                        </p>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-800 mb-1">
                          Target OS Boot Device (RAID Mirror)
                        </label>
                        <select
                          value={dellConfig.targetBootDevice}
                          onChange={e => setDellConfig(p => ({ ...p, targetBootDevice: e.target.value as any }))}
                          className="w-full text-xs rounded-lg border-slate-300 p-2"
                        >
                          <option value="BOSS-S2_RAID1">BOSS-S2 Controller RAID 1 (Dual M.2 NVMe SSDs)</option>
                          <option value="BOSS-S1_RAID1">BOSS-S1 Controller RAID 1 (Dual M.2 SATA SSDs)</option>
                          <option value="PERC_H755_RAID1">PERC H755 Front RAID 1 (VD0 on 2.5" Bay 0/1)</option>
                          <option value="PERC_H740P_RAID1">PERC H740P Mini RAID 1 (Legacy 14G)</option>
                          <option value="FIRST_DISK">First Detected Local Physical Disk</option>
                        </select>
                        <p className="text-[11px] text-slate-500 mt-1">
                          Dell Boot Optimized Storage Solution (BOSS) dedicated dual M.2 RAID 1 volume for hypervisor OS.
                        </p>
                      </div>
                    </div>

                    {/* Dell Customized ESXi ISO */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-800 mb-1">
                        Dell Customized VMware ESXi ISO Image
                      </label>
                      <select
                        value={dellConfig.dellCustomizedIso}
                        onChange={e => setDellConfig(p => ({ ...p, dellCustomizedIso: e.target.value }))}
                        className="w-full text-xs rounded-lg border-slate-300 p-2 font-mono text-slate-800"
                      >
                        <option value="VMware-VMvisor-Installer-8.0U2-Dell-Customized-A01.iso">
                          VMware-VMvisor-Installer-8.0U2-Dell-Customized-A01.iso (Build 22380479 - Dell Addon A01)
                        </option>
                        <option value="VMware-VMvisor-Installer-7.0U3-Dell-Customized-A04.iso">
                          VMware-VMvisor-Installer-7.0U3-Dell-Customized-A04.iso (Build 20842708 - Dell Addon A04)
                        </option>
                      </select>
                      <p className="text-[11px] text-slate-500 mt-1">
                        Includes certified Broadcom, QLogic, Intel NIC drivers, PERC storage drivers, and Dell platform management VIBs.
                      </p>
                    </div>

                    {/* Dell Specific Management Options */}
                    <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 space-y-3">
                      <h4 className="text-xs font-bold text-slate-800">Dell Management Agent Automations</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={dellConfig.installIsmAgent}
                            onChange={e => setDellConfig(p => ({ ...p, installIsmAgent: e.target.checked }))}
                            className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                          />
                          <span>Inject Dell iDRAC Service Module (iSM v5.1.0)</span>
                        </label>

                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={dellConfig.installOmsaVib}
                            onChange={e => setDellConfig(p => ({ ...p, installOmsaVib: e.target.checked }))}
                            className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                          />
                          <span>Install OpenManage Server Administrator (OMSA) VIB</span>
                        </label>

                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={dellConfig.autoRegisterOmeInventory}
                            onChange={e => setDellConfig(p => ({ ...p, autoRegisterOmeInventory: e.target.checked }))}
                            className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                          />
                          <span>Reconcile OME Device Inventory after installation</span>
                        </label>

                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={dellConfig.sriovEnabled}
                            onChange={e => setDellConfig(p => ({ ...p, sriovEnabled: e.target.checked }))}
                            className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                          />
                          <span>Enable SR-IOV Global BIOS flag</span>
                        </label>
                      </div>
                    </div>
                  </div>
                )}

                {/* LENOVO LXCA WORKFLOW FORM */}
                {selectedVendor === 'LENOVO' && (
                  <div className="space-y-5">
                    {/* LXCA Appliance Connection */}
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                      <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
                        <Globe className="w-4 h-4 text-emerald-600" />
                        <span>Lenovo XClarity Administrator (LXCA) Connection</span>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                        <div>
                          <label className="block text-slate-600 mb-1">LXCA Appliance Host / IP</label>
                          <input
                            type="text"
                            value={lenovoConfig.lxcaHost}
                            onChange={e => setLenovoConfig(p => ({ ...p, lxcaHost: e.target.value }))}
                            className="w-full rounded-lg border-slate-300 p-2 font-mono"
                            placeholder="lxca.datacenter.corp"
                          />
                        </div>
                        <div>
                          <label className="block text-slate-600 mb-1">LXCA Username</label>
                          <input
                            type="text"
                            value={lenovoConfig.lxcaUsername}
                            onChange={e => setLenovoConfig(p => ({ ...p, lxcaUsername: e.target.value }))}
                            className="w-full rounded-lg border-slate-300 p-2 font-mono"
                          />
                        </div>
                        <div>
                          <label className="block text-slate-600 mb-1">Management Endpoint Port</label>
                          <input
                            type="number"
                            value={lenovoConfig.lxcaPort}
                            onChange={e => setLenovoConfig(p => ({ ...p, lxcaPort: Number(e.target.value) }))}
                            className="w-full rounded-lg border-slate-300 p-2 font-mono"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Pattern & Storage Target */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-slate-800 mb-1">
                          LXCA Server Configuration Pattern
                        </label>
                        <select
                          value={lenovoConfig.configPatternId}
                          onChange={e => {
                            const val = e.target.value;
                            const pat = catalog?.lenovo?.patterns?.find((p: any) => p.id === val);
                            setLenovoConfig(p => ({
                              ...p,
                              configPatternId: val,
                              configPatternName: pat ? pat.name : p.configPatternName
                            }));
                          }}
                          className="w-full text-xs rounded-lg border-slate-300 p-2"
                        >
                          <option value="lxca-pat-01">Lenovo ThinkSystem SR650/SR630 ESXi 8.0 Enterprise Pattern</option>
                          <option value="lxca-pat-02">Lenovo ThinkSystem SR650 V2 ESXi 7.0U3 Production Pattern</option>
                        </select>
                        <p className="text-[11px] text-slate-500 mt-1">
                          Configures UEFI Only boot, Intel VT-d / IOMMU, TPM 2.0, and ThinkSystem M.2 RAID mirror.
                        </p>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-800 mb-1">
                          Target Drive Boot Volume
                        </label>
                        <select
                          value={lenovoConfig.targetBootDevice}
                          onChange={e => setLenovoConfig(p => ({ ...p, targetBootDevice: e.target.value as any }))}
                          className="w-full text-xs rounded-lg border-slate-300 p-2"
                        >
                          <option value="M2_RAID1">ThinkSystem M.2 NVMe RAID 1 Boot Drive</option>
                          <option value="RAID_930_8i_VD0">ThinkSystem RAID 930-8i Virtual Drive 0</option>
                          <option value="RAID_530_8i_VD0">ThinkSystem RAID 530-8i Virtual Drive 0</option>
                          <option value="FIRST_DRIVE">First Detected Physical Boot Drive</option>
                        </select>
                        <p className="text-[11px] text-slate-500 mt-1">
                          Dedicated hardware-managed redundant boot target for ESXi hypervisor partitions.
                        </p>
                      </div>
                    </div>

                    {/* Lenovo Customized ESXi ISO */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-800 mb-1">
                        Lenovo Customized VMware ESXi ISO Image
                      </label>
                      <select
                        value={lenovoConfig.lenovoCustomizedIso}
                        onChange={e => setLenovoConfig(p => ({ ...p, lenovoCustomizedIso: e.target.value }))}
                        className="w-full text-xs rounded-lg border-slate-300 p-2 font-mono text-slate-800"
                      >
                        <option value="VMware-VMvisor-Installer-8.0U2-Lenovo-ThinkSystem-v1.4.iso">
                          VMware-VMvisor-Installer-8.0U2-Lenovo-ThinkSystem-v1.4.iso (Build 22380479 - Lenovo v1.4)
                        </option>
                        <option value="VMware-VMvisor-Installer-7.0U3-Lenovo-v1.2.iso">
                          VMware-VMvisor-Installer-7.0U3-Lenovo-v1.2.iso (Build 20842708 - Lenovo v1.2)
                        </option>
                      </select>
                      <p className="text-[11px] text-slate-500 mt-1">
                        Certified Lenovo image including Mellanox ConnectX, Intel E810, and ThinkSystem storage adapter drivers.
                      </p>
                    </div>

                    {/* Lenovo Management Options */}
                    <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 space-y-3">
                      <h4 className="text-xs font-bold text-slate-800">Lenovo XClarity Integration Options</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={lenovoConfig.enableXccAgentProvider}
                            onChange={e => setLenovoConfig(p => ({ ...p, enableXccAgentProvider: e.target.checked }))}
                            className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                          />
                          <span>Enable Lenovo XCC Agent & CIM Provider</span>
                        </label>

                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={lenovoConfig.autoManageInLxca}
                            onChange={e => setLenovoConfig(p => ({ ...p, autoManageInLxca: e.target.checked }))}
                            className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                          />
                          <span>Auto-register as "Managed - Online" in LXCA inventory</span>
                        </label>
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-between pt-4 border-t border-slate-200">
                  <button
                    type="button"
                    id="btn-wizard-step2-back"
                    onClick={() => setWizardStep(1)}
                    className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 text-xs font-semibold hover:bg-slate-50 transition-colors"
                  >
                    Back
                  </button>

                  <button
                    type="button"
                    id="btn-wizard-step2-next"
                    onClick={() => setWizardStep(3)}
                    className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 transition-colors flex items-center gap-1.5"
                  >
                    <span>Next: ESXi Kickstart & Network</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {/* STEP 3: KICKSTART & NETWORK PROFILE */}
            {wizardStep === 3 && (
              <div className="space-y-6 max-w-4xl">
                <div>
                  <h2 className="text-base font-bold text-slate-900">Unattended Kickstart (ks.cfg) & Network Topology</h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Define the VMware ESXi management IP, root credentials, VLAN tagging, and post-installation automation flags.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* IP Allocation Mode */}
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      IP Allocation Mode
                    </label>
                    <div className="flex items-center gap-3 pt-1">
                      <label className="flex items-center gap-2 text-xs cursor-pointer">
                        <input
                          type="radio"
                          name="ipMode"
                          checked={!currentNetworkProfile.useDhcp}
                          onChange={() => updateNetworkProfile({ useDhcp: false })}
                          className="text-indigo-600 focus:ring-indigo-500"
                        />
                        <span className="font-semibold text-slate-800">Static Management IP (Recommended)</span>
                      </label>

                      <label className="flex items-center gap-2 text-xs cursor-pointer">
                        <input
                          type="radio"
                          name="ipMode"
                          checked={currentNetworkProfile.useDhcp}
                          onChange={() => updateNetworkProfile({ useDhcp: true })}
                          className="text-indigo-600 focus:ring-indigo-500"
                        />
                        <span className="text-slate-700">DHCP Autoconfiguration</span>
                      </label>
                    </div>
                  </div>

                  {/* VLAN ID */}
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Management VLAN ID (vmk0)
                    </label>
                    <input
                      type="number"
                      value={currentNetworkProfile.managementVlan ?? 0}
                      onChange={e => updateNetworkProfile({ managementVlan: Number(e.target.value) })}
                      className="w-full text-xs rounded-lg border-slate-300 p-2 font-mono"
                      placeholder="e.g. 100 (0 for Untagged)"
                    />
                  </div>
                </div>

                {!currentNetworkProfile.useDhcp && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">
                        ESXi Host Static IP
                      </label>
                      <input
                        type="text"
                        value={currentNetworkProfile.staticIp || ''}
                        onChange={e => {
                          updateNetworkProfile({ staticIp: e.target.value });
                          setVerifyTargetIp(e.target.value);
                        }}
                        className="w-full text-xs rounded-lg border-slate-300 p-2 font-mono"
                        placeholder="192.168.10.201"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">
                        Subnet Mask
                      </label>
                      <input
                        type="text"
                        value={currentNetworkProfile.subnetMask || '255.255.255.0'}
                        onChange={e => updateNetworkProfile({ subnetMask: e.target.value })}
                        className="w-full text-xs rounded-lg border-slate-300 p-2 font-mono"
                        placeholder="255.255.255.0"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">
                        Default Gateway
                      </label>
                      <input
                        type="text"
                        value={currentNetworkProfile.gateway || '192.168.10.1'}
                        onChange={e => updateNetworkProfile({ gateway: e.target.value })}
                        className="w-full text-xs rounded-lg border-slate-300 p-2 font-mono"
                        placeholder="192.168.10.1"
                      />
                    </div>

                    <div className="md:col-span-2">
                      <label className="block text-xs font-medium text-slate-700 mb-1">
                        DNS Servers
                      </label>
                      <input
                        type="text"
                        value={currentNetworkProfile.dnsServers || ''}
                        onChange={e => updateNetworkProfile({ dnsServers: e.target.value })}
                        className="w-full text-xs rounded-lg border-slate-300 p-2 font-mono"
                        placeholder="192.168.10.10, 192.168.10.11"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">
                        NTP Servers
                      </label>
                      <input
                        type="text"
                        value={currentNetworkProfile.ntpServers || ''}
                        onChange={e => updateNetworkProfile({ ntpServers: e.target.value })}
                        className="w-full text-xs rounded-lg border-slate-300 p-2 font-mono"
                        placeholder="time.corp.internal"
                      />
                    </div>
                  </div>
                )}

                {/* Root Password & Security */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      ESXi Host Root Password
                    </label>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={currentNetworkProfile.rootPassword || ''}
                        onChange={e => updateNetworkProfile({ rootPassword: e.target.value })}
                        className="w-full text-xs rounded-lg border-slate-300 p-2 pr-10 font-mono"
                        placeholder="Enter root password"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600 text-xs"
                      >
                        {showPassword ? 'Hide' : 'Show'}
                      </button>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1">
                      Will be cryptographically hashed and embedded in ks.cfg unattended install.
                    </p>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Post-Install Host Access
                    </label>
                    <div className="space-y-2 pt-1 text-xs">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={currentNetworkProfile.enableSsh}
                          onChange={e => updateNetworkProfile({ enableSsh: e.target.checked })}
                          className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                        />
                        <span>Enable ESXi Shell & SSH Service on boot</span>
                      </label>

                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={currentNetworkProfile.enableEsxiShell}
                          onChange={e => updateNetworkProfile({ enableEsxiShell: e.target.checked })}
                          className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                        />
                        <span>Enable Direct Console User Interface (DCUI) Web Client</span>
                      </label>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-4 border-t border-slate-200">
                  <button
                    type="button"
                    id="btn-wizard-step3-back"
                    onClick={() => setWizardStep(2)}
                    className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 text-xs font-semibold hover:bg-slate-50 transition-colors"
                  >
                    Back
                  </button>

                  <button
                    type="button"
                    id="btn-wizard-step3-next"
                    onClick={() => setWizardStep(4)}
                    className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 transition-colors flex items-center gap-1.5"
                  >
                    <span>Review & Launch Deployment</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {/* STEP 4: PREFLIGHT & LAUNCH */}
            {wizardStep === 4 && (
              <div className="space-y-6 max-w-4xl">
                <div>
                  <h2 className="text-base font-bold text-slate-900">Pre-Deployment Verification & Launch</h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Review the end-to-end bare-metal deployment configuration before triggering automated orchestration.
                  </p>
                </div>

                {/* Summary Card */}
                <div className="bg-slate-50 rounded-xl p-5 border border-slate-200 divide-y divide-slate-200 space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pb-2">
                    <div>
                      <span className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold">Vendor Orchestrator</span>
                      <p className="text-sm font-bold text-slate-900 mt-0.5">
                        {selectedVendor === 'DELL' ? 'Dell OpenManage Enterprise' : 'Lenovo XClarity Administrator'}
                      </p>
                      <p className="text-xs text-slate-600 mt-0.5">
                        Appliance: {selectedVendor === 'DELL' ? dellConfig.omeHost : lenovoConfig.lxcaHost}
                      </p>
                    </div>

                    <div>
                      <span className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold">Target Node</span>
                      <p className="text-sm font-bold text-slate-900 mt-0.5 font-mono">
                        {hardwareForm.hostname}
                      </p>
                      <p className="text-xs text-slate-600 mt-0.5">
                        {hardwareForm.model} (BMC: {hardwareForm.bmcIp})
                      </p>
                    </div>

                    <div>
                      <span className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold">ESXi Target IP</span>
                      <p className="text-sm font-bold text-indigo-700 mt-0.5 font-mono">
                        {currentNetworkProfile.staticIp || 'DHCP'}
                      </p>
                      <p className="text-xs text-slate-600 mt-0.5">
                        VLAN {currentNetworkProfile.managementVlan || 'Untagged (0)'}
                      </p>
                    </div>
                  </div>

                  <div className="pt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <span className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold">Boot Storage Target</span>
                      <p className="text-xs font-semibold text-slate-800 mt-0.5">
                        {selectedVendor === 'DELL' ? dellConfig.targetBootDevice : lenovoConfig.targetBootDevice}
                      </p>
                      <p className="text-[11px] text-slate-500">
                        RAID 1 mirror created via Redfish storage job before installer launch.
                      </p>
                    </div>

                    <div>
                      <span className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold">Customized VMware ISO</span>
                      <p className="text-xs font-mono font-semibold text-slate-800 mt-0.5 truncate">
                        {selectedVendor === 'DELL' ? dellConfig.dellCustomizedIso : lenovoConfig.lenovoCustomizedIso}
                      </p>
                      <p className="text-[11px] text-slate-500">
                        Mapped over Virtual Media to host virtual optical drive.
                      </p>
                    </div>
                  </div>

                  {/* Preflight Checks Matrix */}
                  <div className="pt-4 space-y-2">
                    <span className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold">Pre-Flight Readiness Status</span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                      <div className="flex items-center gap-2 p-2 bg-white rounded-lg border border-slate-200">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                        <span>Out-of-Band BMC Reachable ({hardwareForm.bmcIp}:443)</span>
                      </div>
                      <div className="flex items-center gap-2 p-2 bg-white rounded-lg border border-slate-200">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                        <span>Management Console Connected ({selectedVendor === 'DELL' ? 'OME' : 'LXCA'})</span>
                      </div>
                      <div className="flex items-center gap-2 p-2 bg-white rounded-lg border border-slate-200">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                        <span>Custom ESXi ISO Image Certified & Checksum Validated</span>
                      </div>
                      <div className="flex items-center gap-2 p-2 bg-white rounded-lg border border-slate-200">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                        <span>Kickstart Script (ks.cfg) Syntax Verified</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-4 border-t border-slate-200">
                  <button
                    type="button"
                    id="btn-wizard-step4-back"
                    onClick={() => setWizardStep(3)}
                    className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 text-xs font-semibold hover:bg-slate-50 transition-colors"
                  >
                    Back
                  </button>

                  <button
                    type="button"
                    id="btn-launch-baremetal-deployment"
                    onClick={handleStartDeployment}
                    className="px-5 py-2.5 rounded-lg bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 transition-colors flex items-center gap-2 shadow-sm"
                  >
                    <Play className="w-4 h-4 fill-current" />
                    <span>Launch Bare-Metal VMware ESXi Deployment</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* SUB-VIEW 2: ACTIVE ORCHESTRATION & STREAMING CONSOLE LOGS */}
      {activeSubTab === 'jobs' && (
        <div className="space-y-6">
          {/* Active Job Selector & Status Banner */}
          {activeJob ? (
            <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
              <div className="p-6 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className={`px-2.5 py-0.5 rounded text-xs font-bold ${
                      activeJob.vendor === 'DELL' ? 'bg-blue-100 text-blue-800' : 'bg-emerald-100 text-emerald-800'
                    }`}>
                      {activeJob.vendor === 'DELL' ? 'DELL OPENMANAGE (OME)' : 'LENOVO LXCA'}
                    </span>
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                      activeJob.status === 'installed'
                        ? 'bg-emerald-100 text-emerald-800'
                        : activeJob.status === 'in_progress'
                        ? 'bg-amber-100 text-amber-800 animate-pulse'
                        : 'bg-slate-100 text-slate-800'
                    }`}>
                      {activeJob.status === 'installed' ? 'ESXi INSTALLED' : 'DEPLOYMENT IN PROGRESS'}
                    </span>
                  </div>
                  <h2 className="text-lg font-bold text-slate-900 font-mono">
                    {activeJob.serverHostname}
                  </h2>
                  <p className="text-xs text-slate-600">
                    Model: <strong>{activeJob.model}</strong> | BMC IP: <strong>{activeJob.bmcIp}</strong> | Target ESXi IP: <strong className="text-indigo-600">{activeJob.targetManagementIp}</strong>
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  {activeJob.status === 'in_progress' && (
                    <button
                      type="button"
                      id="btn-advance-workflow-step"
                      onClick={handleAdvanceStep}
                      disabled={isAdvancingStep}
                      className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold transition-colors flex items-center gap-1.5 shadow-xs disabled:opacity-50"
                    >
                      <Play className="w-3.5 h-3.5 fill-current" />
                      <span>{isAdvancingStep ? 'Advancing Stage...' : 'Advance Next Workflow Stage'}</span>
                    </button>
                  )}

                  {activeJob.status === 'installed' && (
                    <button
                      type="button"
                      id="btn-view-post-install-report"
                      onClick={() => {
                        if (activeJob.postInstallValidation) {
                          setPostInstallResult(activeJob.postInstallValidation);
                        }
                        setVerifyTargetIp(activeJob.targetManagementIp);
                        setVerifyVendor(activeJob.vendor);
                        setActiveSubTab('post-install');
                      }}
                      className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold transition-colors flex items-center gap-1.5 shadow-xs"
                    >
                      <ShieldCheck className="w-4 h-4" />
                      <span>View "Once ESXi Installed" Report</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Progress Bar & Stage Indicator */}
              <div className="p-6 space-y-6">
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs font-semibold">
                    <span className="text-slate-700 flex items-center gap-2">
                      <Clock className="w-4 h-4 text-indigo-600 animate-spin-slow" />
                      <span>Current Step: {activeJob.currentStepMessage}</span>
                    </span>
                    <span className="font-mono text-indigo-600">{activeJob.progressPercent}%</span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                    <div
                      className={`h-2.5 rounded-full transition-all duration-500 ${
                        activeJob.status === 'installed' ? 'bg-emerald-600' : 'bg-indigo-600'
                      }`}
                      style={{ width: `${activeJob.progressPercent}%` }}
                    />
                  </div>
                </div>

                {/* 8-Stage Sequential Workflow Steps */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  {STAGES_DISPLAY.map((st, idx) => {
                    const currentIdx = getStageIndex(activeJob.stage);
                    const isDone = currentIdx > idx || activeJob.status === 'installed';
                    const isCurrent = currentIdx === idx && activeJob.status === 'in_progress';

                    return (
                      <div
                        key={st.stage}
                        className={`p-3 rounded-lg border transition-all text-xs ${
                          isDone
                            ? 'bg-emerald-50/50 border-emerald-200 text-slate-800'
                            : isCurrent
                            ? 'bg-indigo-50 border-indigo-300 ring-2 ring-indigo-500/20 text-indigo-900 font-medium'
                            : 'bg-slate-50 border-slate-200 text-slate-400'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-bold">{st.label}</span>
                          {isDone ? (
                            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                          ) : isCurrent ? (
                            <RefreshCw className="w-3.5 h-3.5 text-indigo-600 animate-spin shrink-0" />
                          ) : (
                            <span className="w-3.5 h-3.5 rounded-full border border-slate-300 shrink-0" />
                          )}
                        </div>
                        <p className="text-[11px] leading-relaxed text-slate-500 line-clamp-2">
                          {st.desc}
                        </p>
                      </div>
                    );
                  })}
                </div>

                {/* Terminal Console Logs */}
                <div className="space-y-2 pt-2">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2 font-semibold text-slate-800">
                      <Terminal className="w-4 h-4 text-slate-600" />
                      <span>Live Orchestration Console & Audit Log</span>
                    </div>
                    <span className="text-[11px] text-slate-500 font-mono">
                      {activeJob.logs.length} messages logged
                    </span>
                  </div>

                  <div
                    ref={logContainerRef}
                    className="bg-slate-950 text-slate-100 rounded-xl p-4 font-mono text-xs h-72 overflow-y-auto border border-slate-800 shadow-inner space-y-1.5"
                  >
                    {activeJob.logs.map((lg, i) => (
                      <div key={i} className="flex items-start gap-2.5 leading-relaxed">
                        <span className="text-slate-500 shrink-0">
                          {new Date(lg.timestamp).toLocaleTimeString()}
                        </span>
                        <span className={`px-1.5 py-0.2 rounded text-[10px] font-bold shrink-0 ${
                          lg.source === 'OME' ? 'bg-blue-900/60 text-blue-300 border border-blue-700' :
                          lg.source === 'LXCA' ? 'bg-emerald-900/60 text-emerald-300 border border-emerald-700' :
                          lg.source === 'iDRAC' ? 'bg-cyan-900/60 text-cyan-300 border border-cyan-700' :
                          lg.source === 'XCC' ? 'bg-teal-900/60 text-teal-300 border border-teal-700' :
                          lg.source === 'KICKSTART' ? 'bg-amber-900/60 text-amber-300 border border-amber-700' :
                          'bg-indigo-900/60 text-indigo-300 border border-indigo-700'
                        }`}>
                          {lg.source}
                        </span>
                        <span className={`break-all ${
                          lg.level === 'error' ? 'text-rose-400 font-semibold' :
                          lg.level === 'success' ? 'text-emerald-400 font-medium' :
                          lg.level === 'warn' ? 'text-amber-400' :
                          'text-slate-200'
                        }`}>
                          {lg.message}
                          {lg.details && (
                            <span className="block text-[11px] text-slate-400 mt-0.5">
                              {lg.details}
                            </span>
                          )}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-slate-200 p-12 text-center space-y-3">
              <HardDrive className="w-10 h-10 text-slate-300 mx-auto" />
              <h3 className="text-sm font-bold text-slate-800">No Deployment Jobs Active</h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                Launch a new baremetal deployment using the wizard above to begin automated provisioning for DELL or Lenovo hardware.
              </p>
              <button
                type="button"
                onClick={() => setActiveSubTab('wizard')}
                className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 transition-colors"
              >
                Go to Deployment Wizard
              </button>
            </div>
          )}

          {/* Historical Deployments Table */}
          {jobs.length > 1 && (
            <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
                <h3 className="text-xs font-bold text-slate-800">All Baremetal Deployment Jobs</h3>
                <span className="text-xs text-slate-500 font-mono">{jobs.length} total</span>
              </div>
              <div className="divide-y divide-slate-200">
                {jobs.map(j => (
                  <div
                    key={j.id}
                    onClick={() => setActiveJobId(j.id)}
                    className={`p-4 hover:bg-slate-50 cursor-pointer flex items-center justify-between transition-colors ${
                      j.id === activeJobId ? 'bg-indigo-50/40 font-medium' : ''
                    }`}
                  >
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-900 font-mono">{j.serverHostname}</span>
                        <span className={`px-2 py-0.2 rounded text-[10px] font-bold ${
                          j.vendor === 'DELL' ? 'bg-blue-100 text-blue-800' : 'bg-emerald-100 text-emerald-800'
                        }`}>
                          {j.vendor}
                        </span>
                        <span className={`px-2 py-0.2 rounded-full text-[10px] ${
                          j.status === 'installed' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                        }`}>
                          {j.status.toUpperCase()}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500">
                        Target IP: {j.targetManagementIp} | Started: {new Date(j.startedAt).toLocaleString()}
                      </p>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className="text-xs font-mono text-indigo-600">{j.progressPercent}%</span>
                      <ChevronRight className="w-4 h-4 text-slate-400" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* SUB-VIEW 3: "ONCE ESXi INSTALLED" POST-INSTALL HUB */}
      {activeSubTab === 'post-install' && (
        <div className="space-y-6">
          {/* Target Host Verification Bar */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-emerald-600" />
                  <h2 className="text-base font-bold text-slate-900">
                    "Once ESXi Installed" Post-Installation Verification Hub
                  </h2>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Deep verification suite inspecting ESXi Host Client reachability, OEM Custom Image authenticity, vendor agent telemetry (Dell iSM / Lenovo CIM), and vCenter cluster onboarding.
                </p>
              </div>

              <button
                type="button"
                id="btn-run-esxi-diagnostics"
                onClick={handleRunPostInstallCheck}
                disabled={isVerifyingPostInstall}
                className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold transition-colors flex items-center gap-2 shadow-xs disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isVerifyingPostInstall ? 'animate-spin' : ''}`} />
                <span>{isVerifyingPostInstall ? 'Probing Host...' : 'Run ESXi Health Check'}</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 pt-2 text-xs">
              <div>
                <label className="block text-slate-600 mb-1 font-medium">ESXi Management IP</label>
                <input
                  type="text"
                  value={verifyTargetIp}
                  onChange={e => setVerifyTargetIp(e.target.value)}
                  className="w-full rounded-lg border-slate-300 p-2 font-mono"
                  placeholder="192.168.10.201"
                />
              </div>

              <div>
                <label className="block text-slate-600 mb-1 font-medium">Server Hardware Vendor</label>
                <select
                  value={verifyVendor}
                  onChange={e => setVerifyVendor(e.target.value as BaremetalVendor)}
                  className="w-full rounded-lg border-slate-300 p-2"
                >
                  <option value="DELL">DELL PowerEdge (OpenManage / iSM)</option>
                  <option value="LENOVO">Lenovo ThinkSystem (LXCA / CIM)</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-600 mb-1 font-medium">Target ESXi Version</label>
                <select
                  value={verifyEsxiVersion}
                  onChange={e => setVerifyEsxiVersion(e.target.value)}
                  className="w-full rounded-lg border-slate-300 p-2 font-mono"
                >
                  <option value="8.0U2">VMware ESXi 8.0 Update 2 (Build 22380479)</option>
                  <option value="7.0U3">VMware ESXi 7.0 Update 3 (Build 20842708)</option>
                </select>
              </div>

              <div className="flex items-end">
                <a
                  href={`https://${verifyTargetIp}/ui/`}
                  target="_blank"
                  rel="noreferrer"
                  className="w-full px-3 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 border border-slate-200"
                >
                  <ExternalLink className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Launch Host Client (Web UI)</span>
                </a>
              </div>
            </div>

            {verifyDiagnostic && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-800 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{verifyDiagnostic}</span>
              </div>
            )}
          </div>

          {/* Verification Results Cards */}
          {postInstallResult && (
            <div className="space-y-6">
              {/* Row 1: Identity, OEM Image & Port Matrix */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                {/* Hypervisor Identity */}
                <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-xs space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-800 flex items-center gap-2">
                      <Cpu className="w-4 h-4 text-indigo-600" />
                      <span>Hypervisor Release & Build</span>
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                      HEALTH SCORE 100%
                    </span>
                  </div>

                  <div className="space-y-2 text-xs pt-1">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-1.5">
                      <span className="text-slate-500">Installed OS:</span>
                      <span className="font-bold text-slate-900 font-mono">{postInstallResult.esxiVersionDetected}</span>
                    </div>
                    <div className="flex items-center justify-between border-b border-slate-100 pb-1.5">
                      <span className="text-slate-500">ESXi Build Number:</span>
                      <span className="font-mono font-semibold text-slate-800">{postInstallResult.esxiBuildDetected}</span>
                    </div>
                    <div className="flex items-center justify-between border-b border-slate-100 pb-1.5">
                      <span className="text-slate-500">OEM Custom Add-on:</span>
                      <span className="font-semibold text-blue-700">{postInstallResult.oemAddonName}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">License Status:</span>
                      <span className="font-medium text-emerald-600">Enterprise Plus (Licensed)</span>
                    </div>
                  </div>
                </div>

                {/* Network Ports & Host Client Connectivity */}
                <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-xs space-y-3">
                  <span className="text-xs font-bold text-slate-800 flex items-center gap-2">
                    <Wifi className="w-4 h-4 text-blue-600" />
                    <span>Live Service Reachability Matrix</span>
                  </span>

                  <div className="space-y-2.5 text-xs pt-1">
                    <div className="flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-100">
                      <span className="text-slate-700 font-medium">TCP Port 443 (ESXi Host Client)</span>
                      <span className="flex items-center gap-1 text-emerald-700 font-semibold">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Responding</span>
                      </span>
                    </div>

                    <div className="flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-100">
                      <span className="text-slate-700 font-medium">TCP Port 22 (SSH & ESXi Shell)</span>
                      <span className="flex items-center gap-1 text-emerald-700 font-semibold">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Enabled</span>
                      </span>
                    </div>

                    <div className="flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-100">
                      <span className="text-slate-700 font-medium">TCP Port 902 (vSphere Agent)</span>
                      <span className="flex items-center gap-1 text-emerald-700 font-semibold">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Listening</span>
                      </span>
                    </div>
                  </div>
                </div>

                {/* Vendor Management Agent Status */}
                <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-xs space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-800 flex items-center gap-2">
                      <Layers className="w-4 h-4 text-emerald-600" />
                      <span>{verifyVendor === 'DELL' ? 'DELL OpenManage Status' : 'Lenovo LXCA Status'}</span>
                    </span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-800">
                      {verifyVendor === 'DELL' ? 'OME CONNECTED' : 'LXCA MANAGED'}
                    </span>
                  </div>

                  <div className="space-y-2 text-xs pt-1">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-1.5">
                      <span className="text-slate-500">Agent Name:</span>
                      <span className="font-semibold text-slate-800">{postInstallResult.managementAgentStatus.agentName}</span>
                    </div>
                    <div className="flex items-center justify-between border-b border-slate-100 pb-1.5">
                      <span className="text-slate-500">Agent Version:</span>
                      <span className="font-mono text-slate-700">{postInstallResult.managementAgentStatus.version}</span>
                    </div>
                    <div className="flex items-center justify-between border-b border-slate-100 pb-1.5">
                      <span className="text-slate-500">Inventory Sync:</span>
                      <span className="font-semibold text-emerald-600">{postInstallResult.vendorConsoleManagedState}</span>
                    </div>
                    <p className="text-[11px] text-slate-500 pt-1 leading-relaxed">
                      {postInstallResult.managementAgentStatus.details}
                    </p>
                  </div>
                </div>
              </div>

              {/* Row 2: Networking & Datastore Topology */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                {/* Virtual Networking */}
                <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-xs space-y-3">
                  <h3 className="text-xs font-bold text-slate-800 flex items-center gap-2">
                    <Globe className="w-4 h-4 text-indigo-600" />
                    <span>Host Virtual Switch & VMkernel Topology</span>
                  </h3>

                  <div className="space-y-2 text-xs">
                    <div className="flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-100">
                      <span className="text-slate-600">Standard Switch:</span>
                      <span className="font-semibold text-slate-800">{postInstallResult.networkConfig.vSwitch}</span>
                    </div>
                    <div className="flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-100">
                      <span className="text-slate-600">Management VMkernel (vmk0):</span>
                      <span className="font-mono font-bold text-indigo-700">{postInstallResult.networkConfig.vmk0Ip} / 24</span>
                    </div>
                    <div className="flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-100">
                      <span className="text-slate-600">Physical Uplink NICs:</span>
                      <span className="font-mono text-slate-800">{postInstallResult.networkConfig.uplinkNics.join(', ')}</span>
                    </div>
                  </div>
                </div>

                {/* Storage & Datastore */}
                <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-xs space-y-3">
                  <h3 className="text-xs font-bold text-slate-800 flex items-center gap-2">
                    <Database className="w-4 h-4 text-emerald-600" />
                    <span>Local VMFS Datastore & Boot Volume</span>
                  </h3>

                  <div className="space-y-2 text-xs">
                    <div className="flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-100">
                      <span className="text-slate-600">Physical Boot Controller:</span>
                      <span className="font-semibold text-slate-800">{postInstallResult.storageConfig.bootDisk}</span>
                    </div>
                    <div className="flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-100">
                      <span className="text-slate-600">Formatted Datastore:</span>
                      <span className="font-mono font-bold text-slate-900">{postInstallResult.storageConfig.datastoreName} ({postInstallResult.storageConfig.vmfsVersion})</span>
                    </div>
                    <div className="flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-100">
                      <span className="text-slate-600">Scratch & VMFS Capacity:</span>
                      <span className="font-mono text-emerald-700 font-semibold">{postInstallResult.storageConfig.datastoreSizeGb} GB Available</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Banner: vCenter Enrollment & Add to Inventory */}
              <div className="bg-gradient-to-r from-slate-900 to-indigo-950 rounded-xl p-6 text-white shadow-md border border-slate-800 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div className="space-y-1">
                  <h3 className="text-base font-bold flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-indigo-400" />
                    <span>Post-Installation Actions for {verifyTargetIp}</span>
                  </h3>
                  <p className="text-xs text-slate-300">
                    Join this newly installed baremetal ESXi host into a VMware vCenter Cluster, or synchronize it directly into the fleet inventory.
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    id="btn-open-vcenter-enrollment"
                    onClick={() => setIsVcenterModalOpen(true)}
                    className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition-colors flex items-center gap-2 shadow-xs"
                  >
                    <Link2 className="w-3.5 h-3.5" />
                    <span>Join VMware vCenter Cluster</span>
                  </button>

                  <button
                    type="button"
                    id="btn-sync-to-fleet-inventory"
                    onClick={handleSyncToInventory}
                    className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition-colors flex items-center gap-2 shadow-xs"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Sync Host into Fleet Inventory</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* MODAL: VMware vCenter Cluster Enrollment */}
      {isVcenterModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full border border-slate-200 overflow-hidden">
            <div className="bg-slate-900 p-4 text-white flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-bold">
                <Link2 className="w-4 h-4 text-indigo-400" />
                <span>Join VMware vCenter Cluster</span>
              </div>
              <button
                type="button"
                onClick={() => setIsVcenterModalOpen(false)}
                className="text-slate-400 hover:text-white text-xs"
              >
                Close
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Target vCenter Server</label>
                <input
                  type="text"
                  value={vcenterConfig.vcenterHost}
                  onChange={e => setVcenterConfig(p => ({ ...p, vcenterHost: e.target.value }))}
                  className="w-full rounded-lg border-slate-300 p-2 font-mono"
                  placeholder="vcenter.datacenter.corp"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Datacenter</label>
                  <input
                    type="text"
                    value={vcenterConfig.datacenter}
                    onChange={e => setVcenterConfig(p => ({ ...p, datacenter: e.target.value }))}
                    className="w-full rounded-lg border-slate-300 p-2"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Compute Cluster</label>
                  <input
                    type="text"
                    value={vcenterConfig.cluster}
                    onChange={e => setVcenterConfig(p => ({ ...p, cluster: e.target.value }))}
                    className="w-full rounded-lg border-slate-300 p-2"
                  />
                </div>
              </div>

              <div>
                <label className="flex items-center gap-2 cursor-pointer pt-1">
                  <input
                    type="checkbox"
                    checked={vcenterConfig.maintenanceMode}
                    onChange={e => setVcenterConfig(p => ({ ...p, maintenanceMode: e.target.checked }))}
                    className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span>Add host in Maintenance Mode (Recommended for new provisioning)</span>
                </label>
              </div>

              {vcenterConfig.joinSuccessMessage && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-800 text-xs flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{vcenterConfig.joinSuccessMessage}</span>
                </div>
              )}
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2 text-xs">
              <button
                type="button"
                onClick={() => setIsVcenterModalOpen(false)}
                className="px-3 py-1.5 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-100 font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                id="btn-confirm-join-vcenter"
                onClick={handleJoinVcenter}
                disabled={vcenterConfig.joinProgress}
                className="px-4 py-1.5 rounded-lg bg-indigo-600 text-white font-semibold hover:bg-indigo-700 disabled:opacity-50"
              >
                {vcenterConfig.joinProgress ? 'Enrolling...' : 'Enroll into Cluster'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
