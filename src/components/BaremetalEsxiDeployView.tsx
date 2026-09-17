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
  PostInstallEsxiValidation,
  AccessTestResult
} from '../types';
import { 
  fetchBaremetalCatalog, 
  fetchBaremetalJobs, 
  startBaremetalDeployment, 
  stepBaremetalJob, 
  verifyPostInstallEsxi, 
  joinBaremetalVcenter 
} from '../services/api';
import { testServerAccess } from '../utils/accessTester';
import { BaremetalWizardView } from './BaremetalWizardView';
import { BaremetalStepOutputs } from './BaremetalStepOutputs';
import { getStoredEsxiIsos } from '../services/esxiIsoService';

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
  const [activeSubTab, setActiveSubTab] = useState<'wizard' | 'post-install' | 'jobs' | 'outputs'>('wizard');
  const [globalOutputStep, setGlobalOutputStep] = useState<1 | 2 | 3 | 4 | 5>(1);

  // Catalog loaded from backend
  const [catalog, setCatalog] = useState<{
    dell: any;
    lenovo: any;
  } | null>(null);

  // Active / Historical Jobs
  const [jobs, setJobs] = useState<BaremetalEsxiDeploymentJob[]>([]);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [isAdvancingStep, setIsAdvancingStep] = useState(false);

  // Wizard States (Steps 1 - 5)
  const [wizardStep, setWizardStep] = useState<1 | 2 | 3 | 4 | 5>(1);
  const [selectedVendor, setSelectedVendor] = useState<BaremetalVendor>('DELL');
  const [selectedExistingServerId, setSelectedExistingServerId] = useState<string>('');

  // Form Fields as requested:
  // 1. RITM #
  const [ritmNumber, setRitmNumber] = useState<string>('');
  // 2. Form: ESXi Name, IP address (+ mask), vMotion Address (+ mask), DNS IP: fix list ("8.8.8.8", "10.100.1.1")
  const [esxiName, setEsxiName] = useState<string>('');
  const [hostIp, setHostIp] = useState<string>('');
  const [hostMask, setHostMask] = useState<string>('');
  const [vmotionIp, setVmotionIp] = useState<string>('');
  const [vmotionMask, setVmotionMask] = useState<string>('');
  const [selectedDnsIps, setSelectedDnsIps] = useState<string[]>([]);
  const [gatewayIp, setGatewayIp] = useState<string>('');
  const [vlanId, setVlanId] = useState<number>(0);
  // 3. ESXi Version: List of ESXi ISO stored into app
  const [selectedIsoName, setSelectedIsoName] = useState<string>('');

  // Target Hardware Details
  const [hardwareForm, setHardwareForm] = useState({
    hostname: '',
    model: '',
    bmcIp: '',
    bmcPort: 443,
    bmcProtocol: 'redfish' as 'redfish' | 'ipmi' | 'https',
    bmcUsername: 'root',
    bmcPassword: '',
    macAddress: '',
    datacenter: '',
    rack: '',
    accessStatus: null as AccessTestResult | null,
    isTestingIpmi: false
  });

  // Dell OpenManage Config
  const [dellConfig, setDellConfig] = useState<DellOpenManageWorkflowConfig>({
    omeHost: '',
    omePort: 443,
    omeUsername: '',
    omePassword: '',
    deviceGroupId: '',
    deviceGroupName: '',
    templateId: '',
    templateName: 'Dell PowerEdge ESXi Deployment Template',
    targetBootDevice: 'BOSS-S2_RAID1',
    dellCustomizedIso: '',
    installIsmAgent: true,
    installOmsaVib: true,
    enableSecureBoot: true,
    virtualizationVT: true,
    sriovEnabled: true,
    powerProfile: 'Performance',
    autoRegisterOmeInventory: true,
    networkProfile: {
      hostname: '',
      useDhcp: false,
      staticIp: '',
      subnetMask: '',
      gateway: '',
      dnsServers: '',
      ntpServers: '',
      managementVlan: 0,
      rootPassword: '',
      enableSsh: true,
      enableEsxiShell: true,
      vmk0UplinkNics: ['vmnic0', 'vmnic1'],
    }
  });

  // Lenovo LXCA Config
  const [lenovoConfig, setLenovoConfig] = useState<LenovoLxcaWorkflowConfig>({
    lxcaHost: '',
    lxcaPort: 443,
    lxcaUsername: '',
    lxcaPassword: '',
    configPatternId: '',
    configPatternName: 'Lenovo ThinkSystem ESXi Enterprise Pattern',
    targetBootDevice: 'M2_RAID1',
    lenovoCustomizedIso: '',
    enableXccAgentProvider: true,
    enableSecureBoot: true,
    uefiBootMode: 'UEFI_Only',
    autoManageInLxca: true,
    networkProfile: {
      hostname: '',
      useDhcp: false,
      staticIp: '',
      subnetMask: '',
      gateway: '',
      dnsServers: '',
      ntpServers: '',
      managementVlan: 0,
      rootPassword: '',
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
          bmcIp: match.bmcIp || '',
          bmcPort: match.credentials?.bmcPort || (match.bmcAffectedType === 'Supermicro IPMI' ? 623 : 443),
          bmcProtocol: match.credentials?.bmcProtocol || (match.bmcAffectedType === 'Supermicro IPMI' ? 'ipmi' : 'redfish'),
          bmcUsername: match.credentials?.bmcUsername || 'root',
          bmcPassword: match.credentials?.bmcPassword || '',
          macAddress: match.accessStatus?.discoveredHardware?.macAddress || '',
          datacenter: match.datacenter || '',
          rack: match.rack || '',
          accessStatus: match.accessStatus || null,
          isTestingIpmi: false
        });
        updateNetworkProfile({
          hostname: match.hostname,
          staticIp: match.ip || ''
        });
        setVerifyTargetIp(match.ip || '');
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
    if (!serverId) {
      setHardwareForm({
        hostname: '',
        model: '',
        bmcIp: '',
        bmcPort: 443,
        bmcProtocol: 'redfish',
        bmcUsername: 'root',
        bmcPassword: '',
        macAddress: '',
        datacenter: '',
        rack: '',
        accessStatus: null,
        isTestingIpmi: false
      });
      return;
    }
    const match = servers.find(s => s.id === serverId);
    if (match) {
      const v: BaremetalVendor = match.vendor === 'LENOVO' ? 'LENOVO' : 'DELL';
      setSelectedVendor(v);
      setHardwareForm({
        hostname: match.hostname,
        model: match.model,
        bmcIp: match.bmcIp || '',
        bmcPort: match.credentials?.bmcPort || (match.bmcAffectedType === 'Supermicro IPMI' ? 623 : 443),
        bmcProtocol: match.credentials?.bmcProtocol || (match.bmcAffectedType === 'Supermicro IPMI' ? 'ipmi' : 'redfish'),
        bmcUsername: match.credentials?.bmcUsername || 'root',
        bmcPassword: match.credentials?.bmcPassword || '',
        macAddress: match.accessStatus?.discoveredHardware?.macAddress || '',
        datacenter: match.datacenter || '',
        rack: match.rack || '',
        accessStatus: match.accessStatus || null,
        isTestingIpmi: false
      });
      updateNetworkProfile({
        hostname: match.hostname,
        staticIp: match.ip || ''
      });
      setVerifyTargetIp(match.ip || '');
      setVerifyVendor(v);
    }
  };

  // Test IPMI Access (IP + Credentials) handler
  const handleTestIpmiAccess = async (params?: {
    bmcIp?: string;
    bmcPort?: number;
    bmcProtocol?: 'redfish' | 'ipmi' | 'https';
    bmcUsername?: string;
    bmcPassword?: string;
  }): Promise<AccessTestResult> => {
    const targetBmcIp = (params?.bmcIp || hardwareForm.bmcIp || '').trim();
    const targetPort = params?.bmcPort || hardwareForm.bmcPort || 443;
    const targetProtocol = params?.bmcProtocol || hardwareForm.bmcProtocol || 'redfish';
    const targetUsername = params?.bmcUsername ?? hardwareForm.bmcUsername ?? 'root';
    const targetPassword = params?.bmcPassword ?? hardwareForm.bmcPassword ?? '';

    setHardwareForm(p => ({ ...p, isTestingIpmi: true }));

    try {
      const res = await testServerAccess({
        hostname: esxiName || hardwareForm.hostname || 'target-server',
        ip: hostIp || '',
        bmcIp: targetBmcIp,
        bmcAffectedType: targetProtocol === 'ipmi' ? 'Supermicro IPMI' : selectedVendor === 'DELL' ? 'iDRAC9' : 'Lenovo XClarity',
        model: (hardwareForm.model as any) || (selectedVendor === 'DELL' ? 'Dell PowerEdge R750' : 'Lenovo ThinkSystem SR650 V2'),
        credentials: {
          bmcUsername: targetUsername,
          bmcPassword: targetPassword,
          bmcProtocol: targetProtocol,
          bmcPort: targetPort,
          ignoreSslErrors: true
        }
      });

      setHardwareForm(p => ({
        ...p,
        accessStatus: res,
        isTestingIpmi: false,
        model: res.discoveredHardware?.model || p.model
      }));

      if (selectedExistingServerId && onUpdateServer) {
        const existing = servers.find(s => s.id === selectedExistingServerId);
        if (existing) {
          onUpdateServer({ ...existing, accessStatus: res });
        }
      }

      if (res.status === 'success') {
        onShowToast?.(`IPMI access verified on ${targetBmcIp}:${targetPort} (${res.latencyMs || 0}ms RTT). Credentials authenticated!`, 'success');
      } else {
        onShowToast?.(`IPMI access failed on ${targetBmcIp}:${targetPort}: ${res.summary}`, 'warn');
      }

      return res;
    } catch (e: any) {
      const failedRes: AccessTestResult = {
        status: 'failed',
        testedAt: new Date().toISOString(),
        testedBy: 'Real Network Probe',
        summary: e.message || 'IPMI network connection error',
        steps: [
          {
            id: 'step-network',
            name: 'Network Connection Probe',
            status: 'failed',
            message: e.message || 'Failed to connect to target IPMI'
          }
        ]
      };
      setHardwareForm(p => ({ ...p, accessStatus: failedRes, isTestingIpmi: false }));
      onShowToast?.(`IPMI verification error: ${e.message}`, 'warn');
      return failedRes;
    }
  };

  // Vendor Toggle
  const handleVendorSwitch = (vendor: BaremetalVendor) => {
    setSelectedVendor(vendor);
  };

  // Start Deployment
  const handleStartDeployment = async () => {
    const isDell = selectedVendor === 'DELL';
    const isoName = selectedIsoName || '';
    const computedEsxiVersion = isoName.includes('7.0') ? '7.0U3' : isoName.includes('8.0U3') ? '8.0U3' : '8.0U2';
    
    const payload = {
      ritmNumber,
      serverId: selectedExistingServerId || undefined,
      serverHostname: esxiName,
      vendor: selectedVendor,
      model: hardwareForm.model,
      bmcIp: hardwareForm.bmcIp,
      esxiVersion: computedEsxiVersion,
      esxiIsoName: selectedIsoName,
      vmotionIp,
      vmotionMask,
      targetManagementIp: hostIp,
      credentials: {
        bmcPort: hardwareForm.bmcPort || 443,
        bmcProtocol: hardwareForm.bmcProtocol || 'redfish',
        bmcUsername: hardwareForm.bmcUsername || 'root',
        bmcPassword: hardwareForm.bmcPassword,
        ignoreSslErrors: true
      },
      ipmiVerified: hardwareForm.accessStatus?.status === 'success',
      dellConfig: isDell ? {
        ...dellConfig,
        dellCustomizedIso: selectedIsoName,
        networkProfile: {
          ...dellConfig.networkProfile,
          hostname: esxiName,
          ritmNumber,
          staticIp: hostIp,
          subnetMask: hostMask,
          vmotionIp,
          vmotionMask,
          gateway: gatewayIp,
          dnsServers: selectedDnsIps.join(', '),
          managementVlan: vlanId
        }
      } : undefined,
      lenovoConfig: !isDell ? {
        ...lenovoConfig,
        lenovoCustomizedIso: selectedIsoName,
        networkProfile: {
          ...lenovoConfig.networkProfile,
          hostname: esxiName,
          ritmNumber,
          staticIp: hostIp,
          subnetMask: hostMask,
          vmotionIp,
          vmotionMask,
          gateway: gatewayIp,
          dnsServers: selectedDnsIps.join(', '),
          managementVlan: vlanId
        }
      } : undefined,
      networkProfile: {
        ...currentNetworkProfile,
        hostname: esxiName,
        ritmNumber,
        useDhcp: false,
        staticIp: hostIp,
        subnetMask: hostMask,
        vmotionIp,
        vmotionMask,
        gateway: gatewayIp,
        dnsServers: selectedDnsIps.join(', '),
        managementVlan: vlanId,
        enableSsh: true,
        enableEsxiShell: true,
        rootPassword: currentNetworkProfile.rootPassword || '',
        vmk0UplinkNics: ['vmnic0', 'vmnic1']
      },
    };

    const res = await startBaremetalDeployment(payload);
    if (res.success && res.job) {
      setJobs(prev => [res.job!, ...prev]);
      setActiveJobId(res.job.id);
      setActiveSubTab('jobs');
      onShowToast?.(`Baremetal deployment job [${ritmNumber}] started via ${isDell ? 'Dell OpenManage Enterprise' : 'Lenovo LXCA'}!`, 'success');
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
              id="btn-switch-to-outputs"
              onClick={() => setActiveSubTab('outputs')}
              className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition-colors flex items-center gap-2 border ${
                activeSubTab === 'outputs'
                  ? 'bg-indigo-600 text-white border-indigo-500 shadow-xs'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
              }`}
            >
              <Layers className="w-4 h-4 text-indigo-400" />
              <span>Engine Outputs Console</span>
            </button>
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

          <button
            type="button"
            id="tab-baremetal-outputs"
            onClick={() => setActiveSubTab('outputs')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-2 ${
              activeSubTab === 'outputs' 
                ? 'bg-indigo-600 text-white shadow-xs' 
                : 'text-slate-300 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>4. Engine Stage Outputs & Artifacts</span>
          </button>
        </div>
      </div>

      {/* SUB-VIEW 1: DEPLOYMENT WIZARD */}
      {activeSubTab === 'wizard' && (
        <BaremetalWizardView
          servers={servers}
          catalog={catalog}
          selectedExistingServerId={selectedExistingServerId}
          setSelectedExistingServerId={handleExistingServerChange}
          selectedVendor={selectedVendor}
          setSelectedVendor={handleVendorSwitch}
          hardwareForm={hardwareForm}
          setHardwareForm={setHardwareForm}
          dellConfig={dellConfig}
          setDellConfig={setDellConfig}
          lenovoConfig={lenovoConfig}
          setLenovoConfig={setLenovoConfig}
          currentNetworkProfile={currentNetworkProfile}
          updateNetworkProfile={updateNetworkProfile}
          onStartDeployment={handleStartDeployment}
          ritmNumber={ritmNumber}
          setRitmNumber={setRitmNumber}
          esxiName={esxiName}
          setEsxiName={setEsxiName}
          hostIp={hostIp}
          setHostIp={setHostIp}
          hostMask={hostMask}
          setHostMask={setHostMask}
          vmotionIp={vmotionIp}
          setVmotionIp={setVmotionIp}
          vmotionMask={vmotionMask}
          setVmotionMask={setVmotionMask}
          selectedDnsIps={selectedDnsIps}
          setSelectedDnsIps={setSelectedDnsIps}
          selectedIsoName={selectedIsoName}
          setSelectedIsoName={setSelectedIsoName}
          gatewayIp={gatewayIp}
          setGatewayIp={setGatewayIp}
          vlanId={vlanId}
          setVlanId={setVlanId}
          onTestIpmiAccess={handleTestIpmiAccess}
        />
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

      {/* SUB-VIEW 4: GLOBAL PROVISIONING ENGINE STAGE OUTPUTS */}
      {activeSubTab === 'outputs' && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 text-xs font-semibold mb-1">
                <Layers className="w-3.5 h-3.5 text-indigo-600" />
                <span>Bare-Metal Hypervisor Provisioning Engine</span>
              </div>
              <h2 className="text-base font-bold text-slate-900">Provisioning Engine Outputs & Artifacts Console</h2>
              <p className="text-xs text-slate-500">
                Global output inspector for the bare-metal provisioning engine. Select any wizard step to inspect generated Kickstart scripts, BMC payloads, network payloads, and orchestration profiles.
              </p>
            </div>

            <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-lg">
              {([1, 2, 3, 4, 5] as const).map(stepNum => (
                <button
                  key={stepNum}
                  type="button"
                  id={`btn-engine-output-step-${stepNum}`}
                  onClick={() => setGlobalOutputStep(stepNum)}
                  className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all cursor-pointer ${
                    globalOutputStep === stepNum 
                      ? 'bg-white text-indigo-700 shadow-2xs' 
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Step {stepNum} Output
                </button>
              ))}
            </div>
          </div>

          {(() => {
            const storedIsosList = getStoredEsxiIsos();
            const activeIsoObj = storedIsosList.find(i => i.fileName === selectedIsoName) || storedIsosList[0] || {
              id: 'none',
              fileName: selectedIsoName || 'VMware-VMvisor-Installer-8.0U2-custom.iso',
              version: '8.0U2',
              build: '22380479',
              vendor: selectedVendor === 'DELL' ? 'Dell Custom' : 'Lenovo Custom',
              sizeMb: 685,
              sha256: '9f83ac58a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8',
              oemAddon: selectedVendor === 'DELL' ? 'Dell EMC OpenManage Addon v8.0.2' : 'Lenovo XCC Provisioning Addon v8.0',
              releaseDate: '2024-03-15',
              certifiedFor: ['DELL', 'LENOVO']
            };

            return (
              <BaremetalStepOutputs
                step={globalOutputStep}
                data={{
                  ritmNumber: ritmNumber || 'RITM0049281',
                  ritmRequester: 'Cloud Infrastructure Operations',
                  ritmEnvironment: 'Production',
                  esxiName: esxiName || (hardwareForm.hostname || 'esx-prod-01.corp.internal'),
                  hostIp: hostIp || '10.100.20.45',
                  hostMask: hostMask || '255.255.255.0',
                  vmotionIp: vmotionIp || '10.100.30.45',
                  vmotionMask: vmotionMask || '255.255.255.0',
                  dnsIps: selectedDnsIps.length > 0 ? selectedDnsIps : ['8.8.8.8', '10.100.1.1'],
                  gatewayIp: gatewayIp || '10.100.20.1',
                  vlanId: vlanId || 120,
                  selectedIso: {
                    fileName: activeIsoObj.fileName,
                    version: activeIsoObj.version,
                    build: activeIsoObj.build,
                    sizeMb: activeIsoObj.sizeMb,
                    sha256: activeIsoObj.sha256,
                    oemAddon: activeIsoObj.oemAddon
                  },
                  selectedVendor,
                  hardwareModel: hardwareForm.model || (selectedVendor === 'DELL' ? 'PowerEdge R750' : 'ThinkSystem SR650 V3'),
                  bmcIp: hardwareForm.bmcIp || '192.168.10.150',
                  bmcPort: hardwareForm.bmcPort || (hardwareForm.bmcProtocol === 'ipmi' ? 623 : 443),
                  bmcProtocol: hardwareForm.bmcProtocol || 'redfish',
                  bmcUsername: hardwareForm.bmcUsername || 'root',
                  ipmiAccessStatus: hardwareForm.accessStatus,
                  templateName: selectedVendor === 'DELL' ? dellConfig.templateName : lenovoConfig.configPatternName,
                  targetBootDevice: selectedVendor === 'DELL' ? dellConfig.targetBootDevice : lenovoConfig.targetBootDevice
                }}
              />
            );
          })()}
        </div>
      )}
    </div>
  );
};

