import React, { useState, useRef, useEffect } from 'react';
import {
  FileText,
  Network,
  Disc,
  Cpu,
  ShieldCheck,
  CheckCircle2,
  ChevronRight,
  ChevronLeft,
  Play,
  Server,
  Globe,
  Database,
  Lock,
  Eye,
  EyeOff,
  Check,
  AlertTriangle,
  Info,
  Radio,
  Sliders,
  ExternalLink,
  Upload,
  Trash2,
  Plus,
  Search,
  Copy,
  HardDrive,
  RefreshCw,
  FileUp,
  FileCheck,
  X
} from 'lucide-react';
import {
  BaremetalVendor,
  DellOpenManageWorkflowConfig,
  LenovoLxcaWorkflowConfig,
  BaremetalNetworkProfile,
  Server as ServerType
} from '../types';
import {
  StoredEsxiIso,
  getStoredEsxiIsos,
  addCustomEsxiIso,
  deleteStoredEsxiIso,
  computeFileSha256,
  inferIsoMetadataFromFilename
} from '../services/esxiIsoService';
import { BaremetalWorkflowVisualizer } from './BaremetalWorkflowVisualizer';
import { BaremetalStepOutputs } from './BaremetalStepOutputs';

export const FIXED_DNS_OPTIONS = ['8.8.8.8', '10.100.1.1'] as const;

interface BaremetalWizardViewProps {
  servers: ServerType[];
  catalog: any;
  selectedExistingServerId: string;
  setSelectedExistingServerId: (id: string) => void;
  selectedVendor: BaremetalVendor;
  setSelectedVendor: (v: BaremetalVendor) => void;
  hardwareForm: {
    hostname: string;
    model: string;
    bmcIp: string;
    macAddress: string;
    datacenter: string;
    rack: string;
  };
  setHardwareForm: React.Dispatch<React.SetStateAction<{
    hostname: string;
    model: string;
    bmcIp: string;
    macAddress: string;
    datacenter: string;
    rack: string;
  }>>;
  dellConfig: DellOpenManageWorkflowConfig;
  setDellConfig: React.Dispatch<React.SetStateAction<DellOpenManageWorkflowConfig>>;
  lenovoConfig: LenovoLxcaWorkflowConfig;
  setLenovoConfig: React.Dispatch<React.SetStateAction<LenovoLxcaWorkflowConfig>>;
  currentNetworkProfile: BaremetalNetworkProfile;
  updateNetworkProfile: (patch: Partial<BaremetalNetworkProfile>) => void;
  onStartDeployment: () => void;
  ritmNumber: string;
  setRitmNumber: (v: string) => void;
  esxiName: string;
  setEsxiName: (v: string) => void;
  hostIp: string;
  setHostIp: (v: string) => void;
  hostMask: string;
  setHostMask: (v: string) => void;
  vmotionIp: string;
  setVmotionIp: (v: string) => void;
  vmotionMask: string;
  setVmotionMask: (v: string) => void;
  selectedDnsIps: string[];
  setSelectedDnsIps: (v: string[]) => void;
  selectedIsoName: string;
  setSelectedIsoName: (v: string) => void;
  gatewayIp: string;
  setGatewayIp: (v: string) => void;
  vlanId: number;
  setVlanId: (v: number) => void;
}

export const BaremetalWizardView: React.FC<BaremetalWizardViewProps> = ({
  servers,
  selectedExistingServerId,
  setSelectedExistingServerId,
  selectedVendor,
  setSelectedVendor,
  hardwareForm,
  setHardwareForm,
  dellConfig,
  setDellConfig,
  lenovoConfig,
  setLenovoConfig,
  currentNetworkProfile,
  updateNetworkProfile,
  onStartDeployment,
  ritmNumber,
  setRitmNumber,
  esxiName,
  setEsxiName,
  hostIp,
  setHostIp,
  hostMask,
  setHostMask,
  vmotionIp,
  setVmotionIp,
  vmotionMask,
  setVmotionMask,
  selectedDnsIps,
  setSelectedDnsIps,
  selectedIsoName,
  setSelectedIsoName,
  gatewayIp,
  setGatewayIp,
  vlanId,
  setVlanId
}) => {
  const [wizardStep, setWizardStep] = useState<1 | 2 | 3 | 4 | 5>(1);
  const [ritmRequester, setRitmRequester] = useState('');
  const [ritmEnvironment, setRitmEnvironment] = useState<'Production' | 'Staging' | 'DMZ'>('Production');
  const [showPassword, setShowPassword] = useState(false);

  // Stored ISOs state from service
  const [storedIsos, setStoredIsos] = useState<StoredEsxiIso[]>(() => getStoredEsxiIsos());
  const [isoSearchQuery, setIsoSearchQuery] = useState('');
  const [isoFilter, setIsoFilter] = useState<'ALL' | 'DELL' | 'LENOVO' | 'CUSTOM'>('ALL');

  // Upload ISO state
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [pendingUploadIso, setPendingUploadIso] = useState<{
    fileName: string;
    version: string;
    build: string;
    vendor: string;
    certifiedFor: BaremetalVendor[];
    sizeMb: number;
    sha256: string;
    oemAddon: string;
  } | null>(null);
  const [copiedSha, setCopiedSha] = useState<string | null>(null);
  const [isDraggingFile, setIsDraggingFile] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  // Sync active ISO lookup
  const activeIso = storedIsos.find(i => i.fileName === selectedIsoName) || storedIsos[0] || {
    id: 'none',
    fileName: '',
    version: '',
    build: '',
    vendor: '',
    sizeMb: 0,
    sha256: '',
    oemAddon: '',
    releaseDate: '',
    certifiedFor: []
  };

  // If selectedIsoName is empty and we have storedIsos, default to the vendor-matching ISO or first
  useEffect(() => {
    if (!selectedIsoName && storedIsos.length > 0) {
      const match = storedIsos.find(i => (i.certifiedFor || []).includes(selectedVendor)) || storedIsos[0];
      setSelectedIsoName(match?.fileName || '');
    }
  }, [selectedIsoName, storedIsos, selectedVendor, setSelectedIsoName]);

  const handleVendorSwitch = (vendor: BaremetalVendor) => {
    setSelectedVendor(vendor);
  };

  const handleToggleDns = (dns: string) => {
    const currentDns = Array.isArray(selectedDnsIps) ? selectedDnsIps : [];
    if (currentDns.includes(dns)) {
      setSelectedDnsIps(currentDns.filter(d => d !== dns));
    } else {
      setSelectedDnsIps([...currentDns, dns]);
    }
  };

  // Handle file selection for upload
  const handleFileProcess = async (file: File) => {
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.iso') && !file.name.toLowerCase().endsWith('.img')) {
      setStatusMessage({
        type: 'error',
        text: `Invalid file format: "${file.name}". Please upload a valid ESXi ISO installer image (.iso).`
      });
      return;
    }

    setIsUploading(true);
    setUploadProgress(20);

    try {
      // Compute cryptographic SHA256 checksum
      setUploadProgress(45);
      const sha256 = await computeFileSha256(file);
      setUploadProgress(85);

      // Infer metadata from filename
      const inferred = inferIsoMetadataFromFilename(file.name);
      const sizeMb = Math.round(file.size / (1024 * 1024)) || 650;

      setPendingUploadIso({
        fileName: file.name,
        version: inferred.version,
        build: inferred.build,
        vendor: inferred.vendor,
        certifiedFor: inferred.certifiedFor,
        sizeMb,
        sha256,
        oemAddon: inferred.oemAddon
      });

      setUploadProgress(100);
      setIsUploadModalOpen(true);
    } catch (err: any) {
      setStatusMessage({
        type: 'error',
        text: `Failed to process ISO file: ${err?.message || 'Unknown error'}`
      });
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleSaveUploadedIso = () => {
    if (!pendingUploadIso) return;

    const newIso: StoredEsxiIso = {
      id: `custom-iso-${Date.now()}`,
      fileName: pendingUploadIso.fileName,
      version: pendingUploadIso.version,
      build: pendingUploadIso.build,
      vendor: pendingUploadIso.vendor,
      certifiedFor: pendingUploadIso.certifiedFor,
      sizeMb: pendingUploadIso.sizeMb,
      sha256: pendingUploadIso.sha256,
      oemAddon: pendingUploadIso.oemAddon,
      releaseDate: new Date().toISOString().split('T')[0],
      isCustomUpload: true,
      uploadDate: new Date().toISOString().split('T')[0]
    };

    const updated = addCustomEsxiIso(newIso);
    setStoredIsos(updated);
    setSelectedIsoName(newIso.fileName);
    setIsUploadModalOpen(false);
    setPendingUploadIso(null);
    setStatusMessage({
      type: 'success',
      text: `Successfully uploaded and registered "${newIso.fileName}" in the application ISO catalog!`
    });
  };

  const handleDeleteIso = (fileName: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm(`Are you sure you want to remove ISO image "${fileName}" from the application repository?`)) {
      const updated = deleteStoredEsxiIso(fileName);
      setStoredIsos(updated);
      if (selectedIsoName === fileName && updated.length > 0) {
        setSelectedIsoName(updated[0].fileName);
      }
      setStatusMessage({
        type: 'info',
        text: `Removed ISO "${fileName}" from local app cache.`
      });
    }
  };

  const handleCopySha = (sha: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(sha);
    setCopiedSha(sha);
    setTimeout(() => setCopiedSha(null), 2000);
  };

  // Filter stored ISOs
  const filteredIsos = storedIsos.filter(iso => {
    const q = (isoSearchQuery || '').toLowerCase().trim();
    const fileName = (iso.fileName || '').toLowerCase();
    const version = (iso.version || '').toLowerCase();
    const build = (iso.build || '').toLowerCase();
    const vendor = (iso.vendor || '').toLowerCase();
    const oemAddon = (iso.oemAddon || '').toLowerCase();

    const matchesSearch = !q ||
      fileName.includes(q) ||
      version.includes(q) ||
      build.includes(q) ||
      vendor.includes(q) ||
      oemAddon.includes(q);

    if (!matchesSearch) return false;

    const certs = Array.isArray(iso.certifiedFor) ? iso.certifiedFor : [];
    if (isoFilter === 'DELL') return certs.includes('DELL');
    if (isoFilter === 'LENOVO') return certs.includes('LENOVO');
    if (isoFilter === 'CUSTOM') return Boolean(iso.isCustomUpload);
    return true;
  });

  // Filter real servers for Step 4
  const realServers = servers;
  const vendorMatchedServers = realServers.filter(s =>
    selectedVendor === 'DELL' ? s.vendor === 'DELL' : s.vendor === 'LENOVO'
  );

  const stepsList = [
    { step: 1 as const, title: '1. RITM # Reference' },
    { step: 2 as const, title: '2. ESXi Network Form' },
    { step: 3 as const, title: '3. ESXi ISO Version' },
    { step: 4 as const, title: '4. Hardware Model & Engine' },
    { step: 5 as const, title: '5. Review & Launch' },
  ];

  // Validation helper for review
  const isStep1Valid = Boolean(ritmNumber.trim());
  const isStep2Valid = Boolean(esxiName.trim() && hostIp.trim() && hostMask.trim() && vmotionIp.trim() && vmotionMask.trim() && (selectedDnsIps || []).length > 0);
  const isStep3Valid = Boolean(selectedIsoName);
  const isStep4Valid = Boolean(hardwareForm.model && hardwareForm.bmcIp);

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
      {/* Top Wizard Steps Bar */}
      <div className="bg-slate-50 border-b border-slate-200 px-6 py-3.5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-1 sm:gap-4 overflow-x-auto py-1">
            {stepsList.map(s => (
              <button
                key={s.step}
                type="button"
                id={`wizard-step-pill-${s.step}`}
                onClick={() => setWizardStep(s.step)}
                className={`flex items-center gap-2 text-xs font-semibold px-2.5 py-1 rounded-lg transition-colors whitespace-nowrap ${
                  wizardStep === s.step
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : wizardStep > s.step
                    ? 'text-slate-800 hover:bg-slate-200/70'
                    : 'text-slate-400 hover:text-slate-600'
                }`}
              >
                <span
                  className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                    wizardStep === s.step
                      ? 'bg-white text-indigo-700'
                      : wizardStep > s.step
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-slate-200 text-slate-600'
                  }`}
                >
                  {wizardStep > s.step ? <Check className="w-3 h-3 stroke-[3]" /> : s.step}
                </span>
                <span>{s.title}</span>
              </button>
            ))}
          </div>

          <div className="text-[11px] font-mono text-slate-500 font-semibold shrink-0">
            Step {wizardStep} of 5
          </div>
        </div>
      </div>

      {/* Main Two-Column Layout */}
      <div className="p-6 flex flex-col lg:flex-row gap-6">
        {/* LEFT COLUMN: Visual Workflow of this job with steps */}
        <div className="w-full lg:w-80 shrink-0">
          <BaremetalWorkflowVisualizer
            currentStep={wizardStep}
            onSelectStep={setWizardStep}
            data={{
              ritmNumber,
              esxiName,
              hostIp,
              hostMask,
              vmotionIp,
              vmotionMask,
              dnsIps: selectedDnsIps,
              selectedIsoName: selectedIsoName || activeIso.fileName || '',
              isoVersion: activeIso.version || 'Pending ISO',
              isoFileName: activeIso.fileName || '',
              selectedVendor,
              vendor: selectedVendor,
              hardwareModel: hardwareForm.model,
              bmcIp: hardwareForm.bmcIp
            }}
          />
        </div>

        {/* RIGHT COLUMN: Step Form Content & Step Output */}
        <div className="flex-1 min-w-0 space-y-6">
          {/* Status Message Notification */}
          {statusMessage && (
            <div
              className={`p-3.5 rounded-xl border flex items-center justify-between text-xs transition-all ${
                statusMessage.type === 'success'
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                  : statusMessage.type === 'error'
                  ? 'bg-red-50 text-red-800 border-red-200'
                  : 'bg-blue-50 text-blue-800 border-blue-200'
              }`}
            >
              <div className="flex items-center gap-2">
                {statusMessage.type === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />}
                {statusMessage.type === 'error' && <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />}
                {statusMessage.type === 'info' && <Info className="w-4 h-4 text-blue-600 shrink-0" />}
                <span>{statusMessage.text}</span>
              </div>
              <button
                type="button"
                onClick={() => setStatusMessage(null)}
                className="text-slate-400 hover:text-slate-600 ml-2"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* STEP 1: RITM # Reference */}
          {wizardStep === 1 && (
            <div className="space-y-5">
              <div>
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 text-xs font-semibold border border-indigo-200/60 mb-2">
                  <FileText className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Step 1: ITIL Request Item Authorization</span>
                </div>
                <h2 className="text-base font-bold text-slate-900">Change Request & RITM # Reference</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Specify the ServiceNow Request Item ticket (RITM #) authorizing this baremetal hypervisor provisioning job.
                </p>
              </div>

              <div className="bg-slate-50/70 p-5 rounded-xl border border-slate-200 space-y-4">
                {/* RITM # Field */}
                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1 flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <FileText className="w-3.5 h-3.5 text-indigo-600" />
                      <span>RITM # (ServiceNow / ITSM Request Item Number)</span>
                    </span>
                    <span className="text-[10px] text-indigo-600 font-semibold uppercase tracking-wider">Required Field</span>
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      id="input-ritm-number"
                      value={ritmNumber}
                      onChange={e => setRitmNumber(e.target.value)}
                      placeholder="e.g. RITM0012345"
                      className="w-full text-sm font-mono font-bold rounded-lg border border-slate-300 p-2.5 pl-3 pr-10 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white"
                    />
                    {ritmNumber && ritmNumber.trim().length > 2 && (
                      <span className="absolute right-3 top-3 text-emerald-600">
                        <Check className="w-4 h-4 stroke-[3]" />
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Every baremetal deployment job is cryptographically tagged with this RITM # for enterprise change auditing and compliance logs.
                  </p>
                </div>

                {/* Additional ITIL Metadata */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-slate-200/80">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Requesting Engineering Group / Entity
                    </label>
                    <input
                      type="text"
                      value={ritmRequester}
                      onChange={e => setRitmRequester(e.target.value)}
                      className="w-full text-xs rounded-lg border-slate-300 p-2 bg-white"
                      placeholder="e.g. Cloud Infrastructure Operations"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Deployment Environment Target
                    </label>
                    <select
                      value={ritmEnvironment}
                      onChange={e => setRitmEnvironment(e.target.value as any)}
                      className="w-full text-xs rounded-lg border-slate-300 p-2 bg-white"
                    >
                      <option value="Production">Production Cluster (Strict SLA)</option>
                      <option value="Staging">Staging & Pre-Production</option>
                      <option value="DMZ">Edge / DMZ Perimeter Cluster</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: FORM: ESXi Name, IP (+mask), vMotion (+mask), DNS IP: fix list ("8.8.8.8", "10.100.1.1") */}
          {wizardStep === 2 && (
            <div className="space-y-5">
              <div>
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 text-xs font-semibold border border-blue-200/60 mb-2">
                  <Network className="w-3.5 h-3.5 text-blue-600" />
                  <span>Step 2: Network & Host Profile</span>
                </div>
                <h2 className="text-base font-bold text-slate-900">ESXi Host Identity & Network Configuration</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Define the ESXi hostname, static management IP with subnet mask, dedicated vMotion interface with subnet mask, and fixed DNS resolvers.
                </p>
              </div>

              <div className="bg-slate-50/70 p-5 rounded-xl border border-slate-200 space-y-4">
                {/* 1. ESXi Name */}
                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1 flex items-center justify-between">
                    <span>ESXi Name (Fully Qualified Hostname)</span>
                    <span className="text-[10px] text-indigo-600 font-semibold font-mono">DNS A-Record</span>
                  </label>
                  <input
                    type="text"
                    id="input-esxi-name"
                    value={esxiName}
                    onChange={e => {
                      setEsxiName(e.target.value);
                      setHardwareForm(p => ({ ...p, hostname: e.target.value }));
                    }}
                    placeholder="e.g. esx-prod-rack02-01.corp.internal"
                    className="w-full text-xs font-mono font-semibold rounded-lg border border-slate-300 p-2.5 bg-white focus:ring-2 focus:ring-indigo-500"
                  />
                  <p className="text-[11px] text-slate-500 mt-1">
                    Will be provisioned as the hypervisor FQDN and registered with local DNS during kickstart boot.
                  </p>
                </div>

                {/* 2. Management IP address (+ mask) */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-800 mb-1">
                      IP Address (Management vmk0)
                    </label>
                    <input
                      type="text"
                      id="input-esxi-ip"
                      value={hostIp}
                      onChange={e => setHostIp(e.target.value)}
                      placeholder="e.g. 10.100.20.45"
                      className="w-full text-xs font-mono rounded-lg border border-slate-300 p-2.5 bg-white focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-800 mb-1">
                      Subnet Mask (Management)
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        id="input-esxi-mask"
                        value={hostMask}
                        onChange={e => setHostMask(e.target.value)}
                        placeholder="e.g. 255.255.255.0"
                        className="flex-1 text-xs font-mono rounded-lg border border-slate-300 p-2.5 bg-white focus:ring-2 focus:ring-indigo-500"
                      />
                      <select
                        value={hostMask}
                        onChange={e => setHostMask(e.target.value)}
                        className="text-xs font-mono rounded-lg border-slate-300 bg-slate-100 p-2 text-slate-700"
                      >
                        <option value="">Choose Mask</option>
                        <option value="255.255.255.0">/24 (255.255.255.0)</option>
                        <option value="255.255.255.128">/25 (255.255.255.128)</option>
                        <option value="255.255.255.192">/26 (255.255.255.192)</option>
                        <option value="255.255.254.0">/23 (255.255.254.0)</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* 3. vMotion Address (+ mask) */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-800 mb-1 flex items-center gap-1.5">
                      <span>vMotion Address (Dedicated vmk1)</span>
                      <span className="text-[10px] text-blue-600 font-semibold px-1.5 py-0.2 bg-blue-50 rounded">
                        vMotion Tag
                      </span>
                    </label>
                    <input
                      type="text"
                      id="input-vmotion-ip"
                      value={vmotionIp}
                      onChange={e => setVmotionIp(e.target.value)}
                      placeholder="e.g. 10.100.30.45"
                      className="w-full text-xs font-mono rounded-lg border border-slate-300 p-2.5 bg-white focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-800 mb-1">
                      vMotion Subnet Mask
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        id="input-vmotion-mask"
                        value={vmotionMask}
                        onChange={e => setVmotionMask(e.target.value)}
                        placeholder="e.g. 255.255.255.0"
                        className="flex-1 text-xs font-mono rounded-lg border border-slate-300 p-2.5 bg-white focus:ring-2 focus:ring-indigo-500"
                      />
                      <select
                        value={vmotionMask}
                        onChange={e => setVmotionMask(e.target.value)}
                        className="text-xs font-mono rounded-lg border-slate-300 bg-slate-100 p-2 text-slate-700"
                      >
                        <option value="">Choose Mask</option>
                        <option value="255.255.255.0">/24 (255.255.255.0)</option>
                        <option value="255.255.255.128">/25 (255.255.255.128)</option>
                        <option value="255.255.254.0">/23 (255.255.254.0)</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* 4. DNS IP: fix list ("8.8.8.8", "10.100.1.1") */}
                <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-bold text-slate-800">
                      DNS IP: Fix List ("8.8.8.8", "10.100.1.1")
                    </label>
                    <span className="text-[10px] text-slate-500">Select one or both fixed DNS servers</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {FIXED_DNS_OPTIONS.map(dnsOption => {
                      const isSelected = (selectedDnsIps || []).includes(dnsOption);
                      return (
                        <div
                          key={dnsOption}
                          id={`dns-option-${dnsOption.replace(/\./g, '-')}`}
                          onClick={() => handleToggleDns(dnsOption)}
                          className={`p-3 rounded-lg border-2 cursor-pointer transition-all flex items-center justify-between ${
                            isSelected
                              ? 'border-indigo-600 bg-indigo-50/50 shadow-xs ring-1 ring-indigo-500/20'
                              : 'border-slate-200 hover:border-slate-300 bg-slate-50/60'
                          }`}
                        >
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-xs font-bold text-slate-900">{dnsOption}</span>
                              <span className="text-[10px] px-1.5 py-0.2 rounded font-semibold bg-slate-200 text-slate-700">
                                {dnsOption === '8.8.8.8' ? 'Public DNS' : 'Corporate DNS'}
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-500">
                              {dnsOption === '8.8.8.8'
                                ? 'Google Public DNS / Anycast Resolver'
                                : 'Core Datacenter Internal Active Directory DNS'}
                            </p>
                          </div>

                          <div
                            className={`w-5 h-5 rounded-md flex items-center justify-center border transition-colors ${
                              isSelected
                                ? 'bg-indigo-600 border-indigo-600 text-white'
                                : 'border-slate-300 bg-white'
                            }`}
                          >
                            {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="flex items-center justify-between text-[11px] pt-1 text-slate-500">
                    <span>
                      Active Resolvers:{' '}
                      <strong className="text-slate-800 font-mono">
                        {(selectedDnsIps || []).length > 0 ? selectedDnsIps.join(', ') : 'None selected (Click above to select)'}
                      </strong>
                    </span>
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => setSelectedDnsIps(['10.100.1.1', '8.8.8.8'])}
                        className="text-indigo-600 hover:text-indigo-800 font-medium"
                      >
                        Select Both
                      </button>
                      <button
                        type="button"
                        onClick={() => setSelectedDnsIps([])}
                        className="text-slate-500 hover:text-slate-700"
                      >
                        Clear
                      </button>
                    </div>
                  </div>
                </div>

                {/* Gateway, VLAN & Root Password */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2 border-t border-slate-200">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Management Gateway
                    </label>
                    <input
                      type="text"
                      value={gatewayIp}
                      onChange={e => setGatewayIp(e.target.value)}
                      placeholder="e.g. 10.100.20.1"
                      className="w-full text-xs font-mono rounded-lg border-slate-300 p-2 bg-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Management VLAN ID
                    </label>
                    <input
                      type="number"
                      value={vlanId || ''}
                      onChange={e => setVlanId(Number(e.target.value))}
                      placeholder="e.g. 100 (0 for untagged)"
                      className="w-full text-xs font-mono rounded-lg border-slate-300 p-2 bg-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      ESXi Host Root Password
                    </label>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={currentNetworkProfile.rootPassword || ''}
                        onChange={e => updateNetworkProfile({ rootPassword: e.target.value })}
                        placeholder="e.g. Enter ESXi root password"
                        className="w-full text-xs font-mono rounded-lg border-slate-300 p-2 pr-12 bg-white"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-2 top-2 text-[11px] text-slate-400 hover:text-slate-600 font-semibold"
                      >
                        {showPassword ? 'Hide' : 'Show'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: ESXi Version: List of ESXi ISO stored into app + Upload Button */}
          {wizardStep === 3 && (
            <div className="space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-purple-50 text-purple-700 text-xs font-semibold border border-purple-200/60 mb-2">
                    <Disc className="w-3.5 h-3.5 text-purple-600" />
                    <span>Step 3: Stored Image Catalog</span>
                  </div>
                  <h2 className="text-base font-bold text-slate-900">ESXi Version: App Stored ISO Catalog</h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Select an existing VMware ESXi ISO stored in the application repository, or upload a real ESXi ISO installer.
                  </p>
                </div>

                {/* Upload ESXi ISO Button */}
                <div className="shrink-0 flex items-center gap-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".iso,.img"
                    className="hidden"
                    onChange={e => {
                      const file = e.target.files?.[0];
                      if (file) handleFileProcess(file);
                    }}
                  />
                  <button
                    type="button"
                    id="btn-upload-esxi-iso"
                    disabled={isUploading}
                    onClick={() => fileInputRef.current?.click()}
                    className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white text-xs font-bold shadow-xs transition-colors cursor-pointer"
                  >
                    {isUploading ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Processing ISO ({uploadProgress}%)...</span>
                      </>
                    ) : (
                      <>
                        <Upload className="w-4 h-4" />
                        <span>Upload ESXi ISO</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Drag and Drop Area */}
              <div
                onDragOver={e => {
                  e.preventDefault();
                  setIsDraggingFile(true);
                }}
                onDragLeave={() => setIsDraggingFile(false)}
                onDrop={e => {
                  e.preventDefault();
                  setIsDraggingFile(false);
                  const file = e.dataTransfer.files?.[0];
                  if (file) handleFileProcess(file);
                }}
                className={`border-2 border-dashed rounded-xl p-4 text-center transition-all ${
                  isDraggingFile
                    ? 'border-indigo-500 bg-indigo-50/70 scale-[1.01]'
                    : 'border-slate-200 bg-slate-50/50 hover:border-slate-300'
                }`}
              >
                <div className="flex flex-col sm:flex-row items-center justify-center gap-2 text-xs text-slate-600">
                  <FileUp className="w-5 h-5 text-indigo-500" />
                  <span>
                    Drag & drop real <strong>.iso</strong> files here or click <strong>Upload ESXi ISO</strong> to register custom hypervisor images.
                  </span>
                </div>
              </div>

              {/* Search & Filter Controls */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-slate-400 absolute left-2.5 top-2.5" />
                  <input
                    type="text"
                    value={isoSearchQuery}
                    onChange={e => setIsoSearchQuery(e.target.value)}
                    placeholder="Search stored ISO by version, build, vendor, or OEM add-on..."
                    className="w-full text-xs pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-lg focus:ring-1 focus:ring-indigo-500"
                  />
                </div>

                <div className="flex items-center gap-1.5 overflow-x-auto shrink-0">
                  <button
                    type="button"
                    onClick={() => setIsoFilter('ALL')}
                    className={`text-xs px-2.5 py-1 rounded-lg font-medium transition-colors ${
                      isoFilter === 'ALL'
                        ? 'bg-slate-800 text-white'
                        : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                    }`}
                  >
                    All ({storedIsos.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsoFilter('DELL')}
                    className={`text-xs px-2.5 py-1 rounded-lg font-medium transition-colors ${
                      isoFilter === 'DELL'
                        ? 'bg-blue-600 text-white'
                        : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                    }`}
                  >
                    DELL ({storedIsos.filter(i => (i.certifiedFor || []).includes('DELL')).length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsoFilter('LENOVO')}
                    className={`text-xs px-2.5 py-1 rounded-lg font-medium transition-colors ${
                      isoFilter === 'LENOVO'
                        ? 'bg-emerald-600 text-white'
                        : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                    }`}
                  >
                    LENOVO ({storedIsos.filter(i => (i.certifiedFor || []).includes('LENOVO')).length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsoFilter('CUSTOM')}
                    className={`text-xs px-2.5 py-1 rounded-lg font-medium transition-colors ${
                      isoFilter === 'CUSTOM'
                        ? 'bg-amber-600 text-white'
                        : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                    }`}
                  >
                    Custom Uploads ({storedIsos.filter(i => Boolean(i.isCustomUpload)).length})
                  </button>
                </div>
              </div>

              {/* ISO List Grid */}
              <div className="space-y-3">
                {filteredIsos.length === 0 ? (
                  <div className="p-8 text-center bg-slate-50 rounded-xl border border-slate-200">
                    <Disc className="w-8 h-8 text-slate-400 mx-auto mb-2 opacity-50" />
                    <p className="text-xs font-semibold text-slate-700">No matching ISO images found in the application repository.</p>
                    <p className="text-[11px] text-slate-500 mt-1">
                      Clear your search filter or click <strong>Upload ESXi ISO</strong> to add a new file.
                    </p>
                  </div>
                ) : (
                  filteredIsos.map(iso => {
                    const isSelected = selectedIsoName === iso.fileName;
                    const isVendorMatch = (iso.certifiedFor || []).includes(selectedVendor);

                    return (
                      <div
                        key={iso.fileName}
                        id={`iso-card-${(iso.version || 'ver').toLowerCase().replace(/[^a-z0-9]/g, '-')}`}
                        onClick={() => setSelectedIsoName(iso.fileName)}
                        className={`p-4 rounded-xl border-2 cursor-pointer transition-all relative ${
                          isSelected
                            ? 'border-indigo-600 bg-indigo-50/40 shadow-sm ring-2 ring-indigo-500/20'
                            : 'border-slate-200 hover:border-slate-300 bg-white'
                        }`}
                      >
                        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                          <div className="space-y-1.5 flex-1 min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-mono text-xs font-bold text-indigo-700 bg-indigo-100/80 px-2 py-0.5 rounded">
                                ESXi {iso.version}
                              </span>
                              <span className="font-mono text-xs text-slate-600 bg-slate-100 px-2 py-0.5 rounded">
                                Build {iso.build}
                              </span>
                              <span
                                className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider ${
                                  (iso.vendor || '').includes('DELL')
                                    ? 'bg-blue-100 text-blue-800'
                                    : (iso.vendor || '').includes('LENOVO')
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : 'bg-slate-200 text-slate-700'
                                }`}
                              >
                                {iso.vendor}
                              </span>
                              {isVendorMatch && (
                                <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                                  Certified for {selectedVendor}
                                </span>
                              )}
                              {iso.isCustomUpload ? (
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-200">
                                  Custom Uploaded
                                </span>
                              ) : (
                                <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200/60">
                                  Stored into App
                                </span>
                              )}
                            </div>

                            {iso.title && (
                              <div className="text-xs font-bold text-slate-900">
                                {iso.title}
                              </div>
                            )}

                            <div className="font-mono text-[11px] font-medium text-slate-600 break-all" title={iso.fileName}>
                              {iso.fileName}
                            </div>

                            <p className="text-[11px] text-slate-500 leading-relaxed">
                              {iso.oemAddon}
                            </p>

                            <div className="flex items-center gap-2 text-[10px] font-mono text-slate-500 pt-1">
                              <span>SHA256: {iso.sha256.slice(0, 16)}...{iso.sha256.slice(-8)}</span>
                              <button
                                type="button"
                                title="Copy SHA256"
                                onClick={e => handleCopySha(iso.sha256, e)}
                                className="text-slate-400 hover:text-slate-700 p-0.5"
                              >
                                {copiedSha === iso.sha256 ? (
                                  <span className="text-emerald-600 font-bold">Copied!</span>
                                ) : (
                                  <Copy className="w-3 h-3" />
                                )}
                              </button>
                            </div>
                          </div>

                          <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center gap-2 shrink-0 border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-100">
                            <div className="text-right text-[11px] text-slate-500">
                              <div>Size: <strong>{iso.sizeMb} MB</strong></div>
                              <div className="font-mono text-[10px] text-slate-400">
                                {iso.releaseDate ? `Date: ${iso.releaseDate}` : ''}
                              </div>
                            </div>

                            <div className="flex items-center gap-2">
                              {iso.isCustomUpload && (
                                <button
                                  type="button"
                                  title="Delete custom uploaded ISO"
                                  onClick={e => handleDeleteIso(iso.fileName, e)}
                                  className="p-1.5 rounded-md text-red-500 hover:bg-red-50 transition-colors"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}

                              <div
                                className={`w-6 h-6 rounded-full flex items-center justify-center transition-colors ${
                                  isSelected ? 'bg-indigo-600 text-white' : 'border border-slate-300 bg-slate-50'
                                }`}
                              >
                                {isSelected ? <Check className="w-4 h-4 stroke-[3]" /> : null}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* STEP 4: HARDWARE MODEL: DELL (deploy with DELL OME) / LENOVO (deploy with LXCA) */}
          {wizardStep === 4 && (
            <div className="space-y-5">
              <div>
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-xs font-semibold border border-emerald-200/60 mb-2">
                  <Cpu className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Step 4: Baremetal Hardware & Orchestration Engine</span>
                </div>
                <h2 className="text-base font-bold text-slate-900">Hardware Model & Orchestration Engine</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Select whether you are deploying to DELL hardware using DELL OpenManage Enterprise (OME) or LENOVO hardware using Lenovo XClarity Administrator (LXCA).
                </p>
              </div>

              {/* Vendor Selector Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* DELL Card */}
                <div
                  id="vendor-card-dell"
                  onClick={() => handleVendorSwitch('DELL')}
                  className={`p-5 rounded-xl border-2 cursor-pointer transition-all flex flex-col justify-between ${
                    selectedVendor === 'DELL'
                      ? 'border-indigo-600 bg-indigo-50/40 shadow-sm ring-2 ring-indigo-500/20'
                      : 'border-slate-200 hover:border-slate-300 bg-white'
                  }`}
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-blue-100 text-blue-800 uppercase tracking-wider">
                        DELL: deploy with DELL OME
                      </span>
                      {selectedVendor === 'DELL' && (
                        <span className="w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center">
                          <Check className="w-3.5 h-3.5 stroke-[3]" />
                        </span>
                      )}
                    </div>
                    <h3 className="text-sm font-bold text-slate-900">DELL PowerEdge Servers</h3>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      Automated orchestration via <strong>DELL OpenManage Enterprise (OME)</strong>: Template deployment, BOSS-S1/S2 NVMe RAID 1 boot mirror, iDRAC Virtual Media injection, and iSM agent provisioning.
                    </p>
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-200/80 text-[11px] text-slate-500">
                    Target Models: <strong>PowerEdge R750, R650, R740xd, MX750c</strong>
                  </div>
                </div>

                {/* LENOVO Card */}
                <div
                  id="vendor-card-lenovo"
                  onClick={() => handleVendorSwitch('LENOVO')}
                  className={`p-5 rounded-xl border-2 cursor-pointer transition-all flex flex-col justify-between ${
                    selectedVendor === 'LENOVO'
                      ? 'border-indigo-600 bg-indigo-50/40 shadow-sm ring-2 ring-indigo-500/20'
                      : 'border-slate-200 hover:border-slate-300 bg-white'
                  }`}
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-100 text-emerald-800 uppercase tracking-wider">
                        LENOVO: deploy with LXCA
                      </span>
                      {selectedVendor === 'LENOVO' && (
                        <span className="w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center">
                          <Check className="w-3.5 h-3.5 stroke-[3]" />
                        </span>
                      )}
                    </div>
                    <h3 className="text-sm font-bold text-slate-900">Lenovo ThinkSystem Servers</h3>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      Automated orchestration via <strong>Lenovo XClarity Administrator (LXCA)</strong>: Server configuration pattern application, ThinkSystem M.2 RAID mirror, XCC Virtual Media streaming, and XCC CIM provider.
                    </p>
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-200/80 text-[11px] text-slate-500">
                    Target Models: <strong>ThinkSystem SR650 V2/V3, SR630 V2</strong>
                  </div>
                </div>
              </div>

              {/* Hardware Source: Real Server Selection or New Hardware Registration */}
              <div className="bg-slate-50/70 p-5 rounded-xl border border-slate-200 space-y-4">
                <div className="border-b border-slate-200 pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Server className="w-4 h-4 text-indigo-600" />
                    <span className="text-xs font-bold text-slate-800">Target Physical Hardware</span>
                  </div>
                  <span className="text-[11px] text-slate-500">Only real inventory nodes or verified hardware</span>
                </div>

                {/* Server Selection Dropdown */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Select Target Server from Fleet Inventory
                  </label>
                  <select
                    id="select-existing-server"
                    value={selectedExistingServerId}
                    onChange={e => {
                      const id = e.target.value;
                      setSelectedExistingServerId(id);
                      if (id) {
                        const s = servers.find(srv => srv.id === id);
                        if (s) {
                          setHardwareForm({
                            hostname: s.hostname,
                            model: s.model,
                            bmcIp: s.bmcIp || '',
                            macAddress: s.accessStatus?.discoveredHardware?.macAddress || '',
                            datacenter: s.datacenter || '',
                            rack: s.rack || ''
                          });
                          updateNetworkProfile({
                            hostname: s.hostname,
                            staticIp: s.ip || ''
                          });
                        }
                      } else {
                        setHardwareForm({
                          hostname: '',
                          model: '',
                          bmcIp: '',
                          macAddress: '',
                          datacenter: '',
                          rack: ''
                        });
                      }
                    }}
                    className="w-full text-xs font-medium rounded-lg border border-slate-300 p-2.5 bg-white"
                  >
                    <option value="">-- Register / Configure New Physical Server (Manual Entry) --</option>
                    {realServers.map(s => (
                      <option key={s.id} value={s.id}>
                        {s.hostname} — {s.model} ({s.vendor}) | BMC: {s.bmcIp || 'N/A'} [{s.status}]
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-800 mb-1">
                      Hardware Server Model
                    </label>
                    <div className="flex gap-2">
                      <select
                        id="select-server-model"
                        value={hardwareForm.model}
                        onChange={e => setHardwareForm(p => ({ ...p, model: e.target.value }))}
                        className="flex-1 text-xs font-bold rounded-lg border-slate-300 p-2.5 bg-white"
                      >
                        <option value="">-- Select Standard Model --</option>
                        {selectedVendor === 'DELL' ? (
                          <>
                            <option value="Dell PowerEdge R750">Dell PowerEdge R750 (2U 2-Socket)</option>
                            <option value="Dell PowerEdge R650">Dell PowerEdge R650 (1U 2-Socket)</option>
                            <option value="Dell PowerEdge R740xd">Dell PowerEdge R740xd (2U 14G)</option>
                            <option value="Dell PowerEdge MX750c">Dell PowerEdge MX750c (Modular Sled)</option>
                          </>
                        ) : (
                          <>
                            <option value="Lenovo ThinkSystem SR650 V2">Lenovo ThinkSystem SR650 V2 (2U 2-Socket)</option>
                            <option value="Lenovo ThinkSystem SR650 V3">Lenovo ThinkSystem SR650 V3 (4th Gen Xeon)</option>
                            <option value="Lenovo ThinkSystem SR630 V2">Lenovo ThinkSystem SR630 V2 (1U)</option>
                          </>
                        )}
                      </select>
                      <input
                        type="text"
                        value={hardwareForm.model}
                        onChange={e => setHardwareForm(p => ({ ...p, model: e.target.value }))}
                        placeholder="Or type model..."
                        className="w-40 text-xs rounded-lg border-slate-300 p-2.5 bg-white"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-800 mb-1">
                      Target BMC Management IP (iDRAC / XCC)
                    </label>
                    <input
                      type="text"
                      id="input-bmc-ip"
                      value={hardwareForm.bmcIp}
                      onChange={e => setHardwareForm(p => ({ ...p, bmcIp: e.target.value }))}
                      placeholder="e.g. 192.168.10.120"
                      className="w-full text-xs font-mono rounded-lg border-slate-300 p-2.5 bg-white"
                    />
                  </div>
                </div>

                {/* Orchestrator Configuration Details */}
                {selectedVendor === 'DELL' ? (
                  <div className="space-y-3 pt-2 border-t border-slate-200">
                    <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
                      <Globe className="w-4 h-4 text-blue-600" />
                      <span>DELL OpenManage Enterprise (OME) Engine Parameters</span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                      <div>
                        <label className="block text-slate-600 mb-1">OME Appliance Host / FQDN</label>
                        <input
                          type="text"
                          value={dellConfig.omeHost}
                          onChange={e => setDellConfig(p => ({ ...p, omeHost: e.target.value }))}
                          placeholder="e.g. ome.datacenter.corp"
                          className="w-full rounded-lg border-slate-300 p-2 bg-white font-mono text-xs"
                        />
                      </div>
                      <div>
                        <label className="block text-slate-600 mb-1">Target Boot Device (RAID 1 Mirror)</label>
                        <select
                          value={dellConfig.targetBootDevice}
                          onChange={e => setDellConfig(p => ({ ...p, targetBootDevice: e.target.value as any }))}
                          className="w-full rounded-lg border-slate-300 p-2 bg-white text-xs"
                        >
                          <option value="BOSS-S2_RAID1">BOSS-S2 Controller RAID 1 (Dual M.2 NVMe SSDs)</option>
                          <option value="BOSS-S1_RAID1">BOSS-S1 Controller RAID 1 (Dual M.2 SATA SSDs)</option>
                          <option value="PERC_H755_RAID1">PERC H755 Front RAID 1 (VD0 on Bay 0/1)</option>
                        </select>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3 pt-2 border-t border-slate-200">
                    <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
                      <Globe className="w-4 h-4 text-emerald-600" />
                      <span>Lenovo XClarity Administrator (LXCA) Engine Parameters</span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                      <div>
                        <label className="block text-slate-600 mb-1">LXCA Appliance Host / FQDN</label>
                        <input
                          type="text"
                          value={lenovoConfig.lxcaHost}
                          onChange={e => setLenovoConfig(p => ({ ...p, lxcaHost: e.target.value }))}
                          placeholder="e.g. lxca.datacenter.corp"
                          className="w-full rounded-lg border-slate-300 p-2 bg-white font-mono text-xs"
                        />
                      </div>
                      <div>
                        <label className="block text-slate-600 mb-1">Target Boot Device (RAID 1 Mirror)</label>
                        <select
                          value={lenovoConfig.targetBootDevice}
                          onChange={e => setLenovoConfig(p => ({ ...p, targetBootDevice: e.target.value as any }))}
                          className="w-full rounded-lg border-slate-300 p-2 bg-white text-xs"
                        >
                          <option value="M2_RAID1">ThinkSystem M.2 NVMe RAID 1 Boot Drive</option>
                          <option value="RAID_930_8i_VD0">ThinkSystem RAID 930-8i Virtual Drive 0</option>
                          <option value="FIRST_DRIVE">First Detected Physical Boot Drive</option>
                        </select>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* STEP 5: REVIEW, CONSOLIDATED OUTPUT & LAUNCH */}
          {wizardStep === 5 && (
            <div className="space-y-5">
              <div>
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-xs font-semibold border border-emerald-200/60 mb-2">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Step 5: Review & Automated Orchestration</span>
                </div>
                <h2 className="text-base font-bold text-slate-900">Preflight Readiness & Deployment Launch</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Confirm all deployment parameters and preflight verification checks before starting the unattended bare-metal job.
                </p>
              </div>

              {/* Side-by-side Review Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                    Target Hypervisor Node
                  </span>
                  <div className="font-mono text-sm font-bold text-indigo-700 truncate" title={esxiName}>
                    {esxiName || '<Host FQDN Not Set>'}
                  </div>
                  <div className="text-xs text-slate-600 space-y-1">
                    <div>Hardware: <strong>{hardwareForm.model || '<Pending Model>'}</strong></div>
                    <div>BMC IP: <strong className="font-mono">{hardwareForm.bmcIp || '<Pending BMC IP>'}</strong></div>
                    <div>RITM Reference: <strong className="font-mono text-indigo-700">{ritmNumber || '<Pending RITM>'}</strong></div>
                  </div>
                </div>

                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                    Network Configuration
                  </span>
                  <div className="font-mono text-xs font-bold text-slate-800">
                    Mgmt IP: <span className="text-emerald-700">{hostIp || '<Not Set>'}</span> / {hostMask || '<Not Set>'}
                  </div>
                  <div className="font-mono text-xs font-bold text-slate-800">
                    vMotion IP: <span className="text-blue-700">{vmotionIp || '<Not Set>'}</span> / {vmotionMask || '<Not Set>'}
                  </div>
                  <div className="text-xs text-slate-600">
                    DNS: <strong className="font-mono">{(selectedDnsIps || []).length > 0 ? selectedDnsIps.join(', ') : '<No DNS Selected>'}</strong>
                  </div>
                </div>
              </div>

              {/* Preflight Checks Matrix */}
              <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-3">
                <span className="text-xs font-bold text-slate-800 block">Preflight Validation Checklist</span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  <div className={`flex items-center gap-2 p-2 rounded-lg border ${
                    isStep1Valid ? 'bg-emerald-50/50 border-emerald-200/80 text-slate-800' : 'bg-amber-50 border-amber-200 text-amber-800'
                  }`}>
                    {isStep1Valid ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                    )}
                    <span>{isStep1Valid ? `RITM Ticket Authorized: ${ritmNumber}` : 'RITM # Required'}</span>
                  </div>

                  <div className={`flex items-center gap-2 p-2 rounded-lg border ${
                    isStep2Valid ? 'bg-emerald-50/50 border-emerald-200/80 text-slate-800' : 'bg-amber-50 border-amber-200 text-amber-800'
                  }`}>
                    {isStep2Valid ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                    )}
                    <span>{isStep2Valid ? `Network Profile: ${hostIp}` : 'Network Settings Incomplete'}</span>
                  </div>

                  <div className={`flex items-center gap-2 p-2 rounded-lg border ${
                    isStep3Valid ? 'bg-emerald-50/50 border-emerald-200/80 text-slate-800' : 'bg-amber-50 border-amber-200 text-amber-800'
                  }`}>
                    {isStep3Valid ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                    )}
                    <span>{isStep3Valid ? `ESXi ISO: ${activeIso.version}` : 'No ESXi ISO Selected'}</span>
                  </div>

                  <div className={`flex items-center gap-2 p-2 rounded-lg border ${
                    isStep4Valid ? 'bg-emerald-50/50 border-emerald-200/80 text-slate-800' : 'bg-amber-50 border-amber-200 text-amber-800'
                  }`}>
                    {isStep4Valid ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                    )}
                    <span>{isStep4Valid ? `BMC Reachable: ${hardwareForm.bmcIp}:443` : 'BMC IP / Model Pending'}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* DEDICATED OUTPUT FOR EACH STEP */}
          <BaremetalStepOutputs
            step={wizardStep}
            data={{
              ritmNumber,
              ritmRequester,
              ritmEnvironment,
              esxiName,
              hostIp,
              hostMask,
              vmotionIp,
              vmotionMask,
              dnsIps: selectedDnsIps,
              gatewayIp,
              vlanId,
              selectedIso: {
                fileName: activeIso.fileName,
                version: activeIso.version,
                build: activeIso.build,
                sizeMb: activeIso.sizeMb,
                sha256: activeIso.sha256,
                oemAddon: activeIso.oemAddon
              },
              selectedVendor,
              hardwareModel: hardwareForm.model,
              bmcIp: hardwareForm.bmcIp,
              templateName: selectedVendor === 'DELL' ? dellConfig.templateName : lenovoConfig.configPatternName,
              targetBootDevice: selectedVendor === 'DELL' ? dellConfig.targetBootDevice : lenovoConfig.targetBootDevice
            }}
          />

          {/* STEP NAVIGATION BUTTONS */}
          <div className="flex items-center justify-between pt-4 border-t border-slate-200">
            {wizardStep > 1 ? (
              <button
                type="button"
                id="btn-wizard-back"
                onClick={() => setWizardStep((wizardStep - 1) as any)}
                className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 text-xs font-semibold hover:bg-slate-50 transition-colors flex items-center gap-1.5"
              >
                <ChevronLeft className="w-4 h-4" />
                <span>Back</span>
              </button>
            ) : (
              <div />
            )}

            {wizardStep < 5 ? (
              <button
                type="button"
                id="btn-wizard-next"
                onClick={() => setWizardStep((wizardStep + 1) as any)}
                className="px-5 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold transition-colors flex items-center gap-1.5 shadow-xs"
              >
                <span>Continue to Step {wizardStep + 1}</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                type="button"
                id="btn-launch-baremetal-deployment"
                disabled={!isStep1Valid || !isStep2Valid || !isStep3Valid || !isStep4Valid}
                onClick={onStartDeployment}
                className={`px-6 py-2.5 rounded-lg text-white text-xs font-bold transition-all flex items-center gap-2 shadow-sm ${
                  isStep1Valid && isStep2Valid && isStep3Valid && isStep4Valid
                    ? 'bg-emerald-600 hover:bg-emerald-700 animate-pulse cursor-pointer'
                    : 'bg-slate-400 cursor-not-allowed opacity-60'
                }`}
              >
                <Play className="w-4 h-4 fill-current" />
                <span>Launch Bare-Metal VMware ESXi Deployment</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Upload Confirmation Modal */}
      {isUploadModalOpen && pendingUploadIso && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-lg w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="bg-slate-900 text-white px-5 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileCheck className="w-5 h-5 text-emerald-400" />
                <h3 className="font-bold text-sm">Register Uploaded ESXi ISO</h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsUploadModalOpen(false);
                  setPendingUploadIso(null);
                }}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
                <span className="text-[10px] text-slate-500 uppercase tracking-wider block font-semibold">
                  Detected ISO File Name
                </span>
                <span className="font-mono font-bold text-slate-800 break-all text-xs">
                  {pendingUploadIso.fileName}
                </span>
                <div className="flex items-center gap-3 text-[11px] text-slate-500 pt-1">
                  <span>Size: <strong>{pendingUploadIso.sizeMb} MB</strong></span>
                  <span className="font-mono text-[10px] truncate max-w-[200px]" title={pendingUploadIso.sha256}>
                    SHA: {pendingUploadIso.sha256.slice(0, 16)}...
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">ESXi Kernel Version</label>
                  <input
                    type="text"
                    value={pendingUploadIso.version}
                    onChange={e => setPendingUploadIso({ ...pendingUploadIso, version: e.target.value })}
                    placeholder="e.g. 8.0U3"
                    className="w-full text-xs font-mono rounded-lg border-slate-300 p-2 bg-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Build Number</label>
                  <input
                    type="text"
                    value={pendingUploadIso.build}
                    onChange={e => setPendingUploadIso({ ...pendingUploadIso, build: e.target.value })}
                    placeholder="e.g. 24022510"
                    className="w-full text-xs font-mono rounded-lg border-slate-300 p-2 bg-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Hardware Vendor Certification</label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const current = Array.isArray(pendingUploadIso.certifiedFor) ? pendingUploadIso.certifiedFor : [];
                      const next = current.includes('DELL') ? current.filter(v => v !== 'DELL') : [...current, 'DELL' as BaremetalVendor];
                      setPendingUploadIso({ ...pendingUploadIso, certifiedFor: next, vendor: next.join(' / ') || 'Universal' });
                    }}
                    className={`flex-1 py-1.5 px-3 rounded-lg border text-xs font-semibold ${
                      (pendingUploadIso.certifiedFor || []).includes('DELL')
                        ? 'bg-blue-50 border-blue-400 text-blue-800'
                        : 'bg-slate-50 border-slate-200 text-slate-600'
                    }`}
                  >
                    DELL PowerEdge
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const current = Array.isArray(pendingUploadIso.certifiedFor) ? pendingUploadIso.certifiedFor : [];
                      const next = current.includes('LENOVO') ? current.filter(v => v !== 'LENOVO') : [...current, 'LENOVO' as BaremetalVendor];
                      setPendingUploadIso({ ...pendingUploadIso, certifiedFor: next, vendor: next.join(' / ') || 'Universal' });
                    }}
                    className={`flex-1 py-1.5 px-3 rounded-lg border text-xs font-semibold ${
                      (pendingUploadIso.certifiedFor || []).includes('LENOVO')
                        ? 'bg-emerald-50 border-emerald-400 text-emerald-800'
                        : 'bg-slate-50 border-slate-200 text-slate-600'
                    }`}
                  >
                    Lenovo ThinkSystem
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">OEM Add-on / Driver Stack Description</label>
                <textarea
                  rows={2}
                  value={pendingUploadIso.oemAddon}
                  onChange={e => setPendingUploadIso({ ...pendingUploadIso, oemAddon: e.target.value })}
                  placeholder="Custom drivers, OEM bundles, or hypervisor packages..."
                  className="w-full text-xs rounded-lg border-slate-300 p-2 bg-white"
                />
              </div>
            </div>

            <div className="bg-slate-50 px-5 py-3 border-t border-slate-200 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setIsUploadModalOpen(false);
                  setPendingUploadIso(null);
                }}
                className="px-3.5 py-1.5 rounded-lg border border-slate-300 text-slate-700 text-xs font-semibold hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                type="button"
                id="btn-confirm-save-iso"
                onClick={handleSaveUploadedIso}
                className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-xs flex items-center gap-1.5"
              >
                <Check className="w-4 h-4" />
                <span>Save & Select ISO</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
