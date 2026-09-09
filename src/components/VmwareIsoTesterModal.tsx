import React, { useState, useEffect } from 'react';
import { 
  X, 
  Disc, 
  Server, 
  ShieldCheck, 
  CheckCircle2, 
  AlertTriangle, 
  Loader2, 
  Play, 
  RefreshCw, 
  Key, 
  HardDrive, 
  FileCode, 
  Activity, 
  Power,
  XCircle,
  ExternalLink,
  Info
} from 'lucide-react';
import { 
  FirmwarePackage, 
  VmwareVcenterConfig, 
  VmwareVmInfo, 
  VmwareIsoMountResult, 
  VmwareMountStep 
} from '../types';
import { 
  testVcenterConnection, 
  mountIsoOnVmwareVm, 
  unmountIsoFromVmwareVm 
} from '../services/api';

interface VmwareIsoTesterModalProps {
  isOpen: boolean;
  onClose: () => void;
  packages: FirmwarePackage[];
  initialPackage?: FirmwarePackage | null;
  onShowToast?: (message: string, type?: 'success' | 'info' | 'warn') => void;
}

export const VmwareIsoTesterModal: React.FC<VmwareIsoTesterModalProps> = ({
  isOpen,
  onClose,
  packages,
  initialPackage,
  onShowToast,
}) => {
  // vCenter Connection Form
  const [vcenterHost, setVcenterHost] = useState<string>(() => {
    return localStorage.getItem('vmware_vcenter_host') || '';
  });
  const [vcenterPort, setVcenterPort] = useState<number>(443);
  const [vcenterUsername, setVcenterUsername] = useState<string>(() => {
    return localStorage.getItem('vmware_vcenter_username') || 'administrator@vsphere.local';
  });
  const [vcenterPassword, setVcenterPassword] = useState<string>(() => {
    return localStorage.getItem('vmware_vcenter_password') || '';
  });
  const [vcenterDatacenter, setVcenterDatacenter] = useState<string>('Datacenter-01');
  const [vcenterDatastore, setVcenterDatastore] = useState<string>('datastore1');
  const [ignoreSsl, setIgnoreSsl] = useState<boolean>(true);
  const [simulationMode, setSimulationMode] = useState<boolean>(false);

  // Connection State
  const [isTestingConn, setIsTestingConn] = useState(false);
  const [connStatus, setConnStatus] = useState<{
    connected: boolean;
    isSimulation?: boolean;
    testedAt?: string;
    latencyMs?: number;
    error?: string;
  } | null>(null);

  // VMs List
  const [availableVms, setAvailableVms] = useState<VmwareVmInfo[]>([]);
  const [selectedVmId, setSelectedVmId] = useState<string>('');
  const [customVmName, setCustomVmName] = useState<string>('');

  // Selected Firmware ISO Package
  const [selectedPkgId, setSelectedPkgId] = useState<string>('');
  const [isoDatastorePath, setIsoDatastorePath] = useState<string>('');
  const [autoPowerOn, setAutoPowerOn] = useState<boolean>(false);

  // Execution & Mount Result
  const [isMounting, setIsMounting] = useState(false);
  const [isUnmounting, setIsUnmounting] = useState(false);
  const [mountResult, setMountResult] = useState<VmwareIsoMountResult | null>(null);
  const [mountSteps, setMountSteps] = useState<VmwareMountStep[]>([]);
  const [activeMountedIso, setActiveMountedIso] = useState<{
    vmId: string;
    vmName: string;
    isoPath: string;
    mountedAt: string;
    connected: boolean;
  } | null>(null);

  // Synchronize when initialPackage is provided or modal opens
  useEffect(() => {
    if (initialPackage) {
      setSelectedPkgId(initialPackage.id);
      const isoName = initialPackage.fileName || `${initialPackage.id}.iso`;
      setIsoDatastorePath(`[datastore1] iso/${isoName}`);
    } else {
      const isoPkgs = packages.filter(p => p.packageFormat === 'ISO' || p.fileName.endsWith('.iso'));
      if (isoPkgs.length > 0 && !selectedPkgId) {
        setSelectedPkgId(isoPkgs[0].id);
        setIsoDatastorePath(`[datastore1] iso/${isoPkgs[0].fileName}`);
      }
    }
  }, [initialPackage, packages]);

  // Update ISO path when selected package changes
  const handlePackageChange = (pkgId: string) => {
    setSelectedPkgId(pkgId);
    const pkg = packages.find(p => p.id === pkgId);
    if (pkg) {
      setIsoDatastorePath(`[datastore1] iso/${pkg.fileName}`);
    }
  };

  // Test vCenter Connection & Fetch VMs
  const handleTestConnection = async () => {
    if (!simulationMode && !vcenterHost.trim()) {
      alert('Please enter a valid vCenter Host / FQDN / IP, or enable "Simulate Lab Environment" for offline testing.');
      return;
    }

    setIsTestingConn(true);
    setConnStatus(null);

    // Save vCenter host and username preference
    if (vcenterHost) localStorage.setItem('vmware_vcenter_host', vcenterHost);
    if (vcenterUsername) localStorage.setItem('vmware_vcenter_username', vcenterUsername);
    if (vcenterPassword) localStorage.setItem('vmware_vcenter_password', vcenterPassword);

    const config: VmwareVcenterConfig = {
      host: vcenterHost,
      port: vcenterPort,
      username: vcenterUsername,
      password: vcenterPassword,
      datacenter: vcenterDatacenter,
      datastore: vcenterDatastore,
      ignoreSsl,
      simulationMode,
    };

    const res = await testVcenterConnection(config);
    setIsTestingConn(false);

    if (res.success && res.vms) {
      setConnStatus({
        connected: true,
        isSimulation: res.isSimulation,
        testedAt: new Date().toLocaleTimeString(),
        latencyMs: res.latencyMs,
      });
      setAvailableVms(res.vms);
      if (res.vms.length > 0 && !selectedVmId) {
        setSelectedVmId(res.vms[0].id);
      }
      if (onShowToast) {
        onShowToast(
          res.isSimulation
            ? `Loaded Simulated vCenter Lab (${res.vms.length} VMs available)`
            : `Connected to live vCenter ${res.vcenterHost} (${res.vms.length} VMs found)`,
          'success'
        );
      }
    } else {
      setConnStatus({
        connected: false,
        error: res.error || 'Unable to authenticate with vCenter Server.',
      });
      setAvailableVms([]);
      setSelectedVmId('');
      if (onShowToast) {
        onShowToast(`vCenter Connection Failed: ${res.error}`, 'warn');
      }
    }
  };

  // Execute Mount ISO Operation
  const handleMountIso = async () => {
    const targetVm = availableVms.find(v => v.id === selectedVmId);
    const vmName = targetVm ? targetVm.name : (customVmName || selectedVmId || 'esxi-test-node-01');
    const vmId = targetVm ? targetVm.id : (selectedVmId || 'vm-101');
    const pkg = packages.find(p => p.id === selectedPkgId);

    if (!simulationMode && (!vcenterHost || !vcenterUsername)) {
      alert('Please specify vCenter Host and Username, or enable "Simulate Lab Environment".');
      return;
    }

    if (!isoDatastorePath) {
      alert('Please specify a Datastore ISO File Path.');
      return;
    }

    setIsMounting(true);
    setMountResult(null);
    
    // Animated progress simulation steps
    const initialSteps: VmwareMountStep[] = [
      { id: 's1', name: 'Authenticate vSphere Session API', status: 'running', message: `Connecting to ${vcenterHost || 'vCenter'}...` },
      { id: 's2', name: 'Locate Virtual Machine Hardware Devices', status: 'pending', message: 'Waiting for session...' },
      { id: 's3', name: 'Validate Datastore ISO Image Integrity', status: 'pending', message: 'Waiting...' },
      { id: 's4', name: 'Reconfigure Virtual CD/DVD Device Backing', status: 'pending', message: 'Waiting...' },
      { id: 's5', name: 'Verify Media Attachment & Power State', status: 'pending', message: 'Waiting...' },
    ];
    setMountSteps(initialSteps);

    // Call API
    const mountReq = {
      vcenter: {
        host: vcenterHost,
        port: vcenterPort,
        username: vcenterUsername,
        password: vcenterPassword,
        datacenter: vcenterDatacenter,
        datastore: vcenterDatastore,
        ignoreSsl,
        simulationMode,
      },
      vmId,
      vmName,
      packageId: selectedPkgId,
      packageName: pkg ? pkg.name : 'Firmware ISO Package',
      isoDatastorePath,
      autoPowerOn,
    };

    const res = await mountIsoOnVmwareVm(mountReq);
    setIsMounting(false);
    setMountResult(res);
    setMountSteps(res.steps || []);

    if (res.success) {
      setActiveMountedIso({
        vmId,
        vmName,
        isoPath: res.isoPathMounted,
        mountedAt: res.mountedAt,
        connected: true,
      });
      if (onShowToast) {
        onShowToast(`ISO Image successfully attached to VM ${vmName}!`, 'success');
      }
    } else {
      if (!res.steps || res.steps.length === 0) {
        setMountSteps([
          {
            id: 'err-1',
            name: 'vCenter Reachability & Pre-flight Check',
            status: 'failed',
            message: res.error || 'Failed to establish connection to target vCenter.',
            details: 'Action aborted: Target host is unreachable. Please verify host, port, credentials, or enable "Simulate Lab Environment" for offline testing.'
          }
        ]);
      }
      if (onShowToast) {
        onShowToast(`Failed to mount ISO: ${res.error}`, 'warn');
      }
    }
  };

  // Execute Unmount ISO Operation
  const handleUnmountIso = async () => {
    const targetVm = availableVms.find(v => v.id === selectedVmId);
    const vmName = targetVm ? targetVm.name : (customVmName || selectedVmId || 'esxi-test-node-01');
    const vmId = targetVm ? targetVm.id : (selectedVmId || 'vm-101');

    setIsUnmounting(true);
    const res = await unmountIsoFromVmwareVm({ vmId, vmName });
    setIsUnmounting(false);

    if (res.success) {
      setActiveMountedIso(null);
      if (onShowToast) {
        onShowToast(`ISO Image ejected from VM ${vmName}`, 'info');
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md overflow-y-auto animate-in fade-in duration-200">
      <div className="relative w-full max-w-4xl bg-slate-900 border border-slate-700/70 rounded-2xl shadow-2xl shadow-cyan-950/40 text-slate-100 overflow-hidden my-8">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-5 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 border-b border-slate-700/70">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-cyan-500/10 border border-cyan-500/30 rounded-xl text-cyan-400">
              <Disc className="w-6 h-6 animate-spin-slow" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
                VMware Virtual Machine ISO Package Tester
                <span className="px-2.5 py-0.5 text-xs font-semibold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 rounded-full">
                  vCenter API
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Connect and mount firmware packages (.iso) onto target VMware Virtual Machines to verify installer bootloaders.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-100 bg-slate-800/60 hover:bg-slate-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Content Body */}
        <div className="p-6 space-y-6 max-h-[78vh] overflow-y-auto custom-scrollbar">
          
          {/* Active Mounted Banner (if mounted) */}
          {activeMountedIso && (
            <div className="p-4 bg-emerald-950/40 border border-emerald-500/40 rounded-xl flex items-center justify-between gap-4 animate-in fade-in">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-emerald-500/20 text-emerald-400 rounded-lg">
                  <Disc className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">ISO Currently Attached</span>
                    <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded-full">
                      Connected
                    </span>
                  </div>
                  <p className="text-sm font-semibold text-slate-200 mt-0.5">
                    VM: <span className="text-cyan-300">{activeMountedIso.vmName}</span> &bull; Path: <span className="font-mono text-xs text-emerald-300">{activeMountedIso.isoPath}</span>
                  </p>
                </div>
              </div>
              <button
                onClick={handleUnmountIso}
                disabled={isUnmounting}
                className="flex items-center gap-2 px-3 py-1.5 bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30 rounded-lg text-xs font-semibold transition-colors disabled:opacity-50"
              >
                {isUnmounting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <XCircle className="w-3.5 h-3.5" />}
                Eject ISO
              </button>
            </div>
          )}

          {/* Section 1: vCenter Credentials & Connection Setup */}
          <div className="bg-slate-800/50 border border-slate-700/60 rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-700/50 pb-3">
              <div className="flex items-center gap-2 text-slate-200 font-semibold text-sm">
                <Key className="w-4 h-4 text-cyan-400" />
                <span>1. vCenter Credentials & Datacenter Configuration</span>
              </div>
              {connStatus && (
                <div className="flex items-center gap-2 text-xs">
                  {connStatus.connected ? (
                    connStatus.isSimulation ? (
                      <span className="flex items-center gap-1.5 text-amber-300 font-medium bg-amber-500/10 px-2.5 py-1 rounded-full border border-amber-500/20">
                        <CheckCircle2 className="w-3.5 h-3.5 text-amber-400" />
                        Simulated Lab Mode ({connStatus.latencyMs}ms)
                      </span>
                    ) : (
                      <span className="flex items-center gap-1.5 text-emerald-400 font-medium bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Live vCenter Connected ({connStatus.latencyMs}ms)
                      </span>
                    )
                  ) : (
                    <span className="flex items-center gap-1.5 text-rose-400 font-medium bg-rose-500/10 px-2.5 py-1 rounded-full border border-rose-500/20">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      Connection Failed
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Prominent Error & Troubleshooting Banner if connection failed */}
            {connStatus && !connStatus.connected && (
              <div className="p-3.5 bg-rose-950/40 border border-rose-500/40 rounded-xl space-y-2 text-xs">
                <div className="flex items-start gap-2.5">
                  <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <p className="font-semibold text-rose-200">vCenter Connectivity Check Failed</p>
                    <p className="text-rose-300 font-mono text-[11px] leading-relaxed break-words whitespace-pre-wrap">
                      {connStatus.error}
                    </p>
                  </div>
                </div>
                <div className="pt-2 pl-6 border-t border-rose-500/20 text-slate-300 space-y-1 text-[11px]">
                  <p className="font-medium text-slate-200">Diagnostic Notes:</p>
                  <ul className="list-disc list-inside space-y-0.5 text-slate-400">
                    <li>The system performed a real network socket probe against host <span className="font-mono text-slate-200">{vcenterHost || '(empty)'}</span> on port <span className="font-mono text-slate-200">{vcenterPort}</span>.</li>
                    <li>If this vCenter is on a private corporate/home LAN (e.g. 192.168.x.x or 10.x.x.x), external cloud containers cannot reach it without a public reverse proxy or VPN.</li>
                    <li>To safely test ISO firmware mounting without requiring live network access to your internal vCenter, check the <strong className="text-amber-300">"Simulate Lab Environment (Offline Sandbox)"</strong> option below.</li>
                  </ul>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  vCenter Host / FQDN / IP
                </label>
                <input
                  type="text"
                  value={vcenterHost}
                  onChange={(e) => setVcenterHost(e.target.value)}
                  placeholder="vcenter.lab.example.com or 10.0.0.50"
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs font-mono text-slate-200 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  vCenter Port
                </label>
                <input
                  type="number"
                  value={vcenterPort}
                  onChange={(e) => setVcenterPort(parseInt(e.target.value, 10) || 443)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs font-mono text-slate-200 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Username
                </label>
                <input
                  type="text"
                  value={vcenterUsername}
                  onChange={(e) => setVcenterUsername(e.target.value)}
                  placeholder="administrator@vsphere.local"
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs font-mono text-slate-200 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Password
                </label>
                <input
                  type="password"
                  value={vcenterPassword}
                  onChange={(e) => setVcenterPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs font-mono text-slate-200 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Datacenter Name
                </label>
                <input
                  type="text"
                  value={vcenterDatacenter}
                  onChange={(e) => setVcenterDatacenter(e.target.value)}
                  placeholder="Datacenter-01"
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Target Datastore
                </label>
                <input
                  type="text"
                  value={vcenterDatastore}
                  onChange={(e) => setVcenterDatastore(e.target.value)}
                  placeholder="datastore1"
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
                />
              </div>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
              <div className="flex items-center gap-4 flex-wrap">
                <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={ignoreSsl}
                    onChange={(e) => setIgnoreSsl(e.target.checked)}
                    className="rounded bg-slate-900 border-slate-700 text-cyan-500 focus:ring-0"
                  />
                  Ignore SSL / Self-signed certificate errors
                </label>

                <label className="flex items-center gap-2 text-xs text-amber-300/90 hover:text-amber-200 cursor-pointer select-none font-medium bg-amber-500/10 px-2.5 py-1 rounded-lg border border-amber-500/20 transition-colors">
                  <input
                    type="checkbox"
                    checked={simulationMode}
                    onChange={(e) => setSimulationMode(e.target.checked)}
                    className="rounded bg-slate-900 border-amber-600/50 text-amber-500 focus:ring-0"
                  />
                  Simulate Lab Environment (Offline Sandbox)
                </label>
              </div>

              <button
                onClick={handleTestConnection}
                disabled={isTestingConn}
                className="flex items-center justify-center gap-2 px-4 py-2 bg-cyan-600/30 hover:bg-cyan-600/50 text-cyan-200 border border-cyan-500/40 rounded-lg text-xs font-semibold transition-colors disabled:opacity-50"
              >
                {isTestingConn ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                {simulationMode ? 'Load Simulated Lab Inventory' : 'Test Real Connection & Fetch VMs'}
              </button>
            </div>
          </div>

          {/* Section 2: Target Virtual Machine & Firmware ISO Selection */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Target VM Card */}
            <div className="bg-slate-800/50 border border-slate-700/60 rounded-xl p-5 space-y-3">
              <div className="flex items-center gap-2 text-slate-200 font-semibold text-sm border-b border-slate-700/50 pb-2.5">
                <Server className="w-4 h-4 text-cyan-400" />
                <span>2. Select Target Virtual Machine</span>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Virtual Machine (vCenter Inventory)
                </label>
                {availableVms.length > 0 ? (
                  <select
                    value={selectedVmId}
                    onChange={(e) => setSelectedVmId(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
                  >
                    {availableVms.map((vm) => (
                      <option key={vm.id} value={vm.id}>
                        {vm.name} ({vm.guestOs} &bull; {vm.powerState})
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    value={customVmName}
                    onChange={(e) => {
                      setCustomVmName(e.target.value);
                      setSelectedVmId(e.target.value);
                    }}
                    placeholder="Enter VM Name or click 'Test Connection' above"
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
                  />
                )}
                <p className="text-[11px] text-slate-400 mt-1">
                  VM must have a Virtual CD/DVD Drive configured with IDE or SATA controller.
                </p>
              </div>

              <div className="pt-2">
                <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={autoPowerOn}
                    onChange={(e) => setAutoPowerOn(e.target.checked)}
                    className="rounded bg-slate-900 border-slate-700 text-cyan-500 focus:ring-0"
                  />
                  Auto Power ON Virtual Machine after attaching ISO
                </label>
              </div>
            </div>

            {/* Target Firmware ISO Card */}
            <div className="bg-slate-800/50 border border-slate-700/60 rounded-xl p-5 space-y-3">
              <div className="flex items-center gap-2 text-slate-200 font-semibold text-sm border-b border-slate-700/50 pb-2.5">
                <Disc className="w-4 h-4 text-cyan-400" />
                <span>3. Select Firmware ISO Package</span>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Firmware Package Catalog
                </label>
                <select
                  value={selectedPkgId}
                  onChange={(e) => handlePackageChange(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
                >
                  {packages.map((pkg) => (
                    <option key={pkg.id} value={pkg.id}>
                      [{pkg.vendor}] {pkg.name} ({pkg.fileName})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  vSphere Datastore ISO Backing Path
                </label>
                <input
                  type="text"
                  value={isoDatastorePath}
                  onChange={(e) => setIsoDatastorePath(e.target.value)}
                  placeholder="[datastore1] iso/firmware-package.iso"
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs font-mono text-slate-200 focus:outline-none focus:border-cyan-500"
                />
              </div>
            </div>

          </div>

          {/* Section 3: Live Step Execution Progress Log */}
          {mountSteps.length > 0 && (
            <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-5 space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center justify-between">
                <span>Mount Progress & Verification Diagnostics</span>
                {isMounting && <span className="text-cyan-400 text-xs font-normal flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" /> Executing vCenter Reconfig...</span>}
              </h3>

              <div className="space-y-2">
                {mountSteps.map((step) => (
                  <div key={step.id} className="p-3 bg-slate-900/90 border border-slate-800 rounded-lg flex items-start gap-3">
                    <div className="mt-0.5">
                      {step.status === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
                      {step.status === 'running' && <Loader2 className="w-4 h-4 text-cyan-400 animate-spin" />}
                      {step.status === 'failed' && <AlertTriangle className="w-4 h-4 text-rose-400" />}
                      {step.status === 'pending' && <div className="w-4 h-4 rounded-full border border-slate-700" />}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-slate-200">{step.name}</span>
                        {step.latencyMs && <span className="text-[10px] font-mono text-slate-400">{step.latencyMs}ms</span>}
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5">{step.message}</p>
                      {step.details && <p className="text-[11px] font-mono text-slate-400/90 mt-1 bg-slate-950 px-2 py-1 rounded border border-slate-800">{step.details}</p>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>

        {/* Modal Footer Actions */}
        <div className="flex items-center justify-between px-6 py-4 bg-slate-900 border-t border-slate-700/70">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <Info className="w-4 h-4 text-cyan-400" />
            <span>ISO will be attached to VirtualCDROM IDE 0:0 on target Virtual Machine</span>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-300 hover:text-slate-100 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors"
            >
              Cancel
            </button>

            <button
              onClick={handleMountIso}
              disabled={isMounting}
              className="flex items-center gap-2 px-5 py-2 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white text-xs font-bold rounded-lg shadow-lg shadow-cyan-600/30 transition-all disabled:opacity-50 cursor-pointer"
            >
              {isMounting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
              Connect & Mount ISO to Virtual Machine
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
