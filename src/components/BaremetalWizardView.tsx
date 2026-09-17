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
  X,
  XCircle,
  Key,
  ShieldAlert
} from 'lucide-react';
import {
  BaremetalVendor,
  DellOpenManageWorkflowConfig,
  LenovoLxcaWorkflowConfig,
  BaremetalNetworkProfile,
  Server as ServerType,
  AccessTestResult,
  AccessTestStep,
  ServiceNowExtractedFields,
  ServiceNowRitmData,
  ServiceNowCredentials
} from '../types';
import {
  StoredEsxiIso,
  getStoredEsxiIsos,
  addCustomEsxiIso,
  deleteStoredEsxiIso,
  computeFileSha256,
  inferIsoMetadataFromFilename
} from '../services/esxiIsoService';
import { testServerAccess } from '../utils/accessTester';
import { BaremetalWorkflowVisualizer } from './BaremetalWorkflowVisualizer';
import { ServiceNowInspector } from './ServiceNowInspector';
import { ServiceNowCredentialsPromptModal } from './ServiceNowCredentialsPromptModal';
import {
  fetchDatabaseServiceNowCredentials,
  saveDatabaseServiceNowCredentials,
  testServiceNowConnection
} from '../services/servicenowService';
import { logBaremetalOutput } from '../services/baremetalOutputLogger';


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
    bmcPort?: number;
    bmcProtocol?: 'redfish' | 'ipmi' | 'https';
    bmcUsername?: string;
    bmcPassword?: string;
    macAddress: string;
    datacenter: string;
    rack: string;
    accessStatus?: AccessTestResult | null;
    isTestingIpmi?: boolean;
  };
  setHardwareForm: React.Dispatch<React.SetStateAction<any>>;
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
  onTestIpmiAccess?: (params?: {
    bmcIp?: string;
    bmcPort?: number;
    bmcProtocol?: 'redfish' | 'ipmi' | 'https';
    bmcUsername?: string;
    bmcPassword?: string;
  }) => Promise<any>;
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
  setVlanId,
  onTestIpmiAccess
}) => {
  const [wizardStep, setWizardStep] = useState<1 | 2 | 3 | 4 | 5>(1);
  const [ritmRequester, setRitmRequester] = useState('');
  const [ritmEnvironment, setRitmEnvironment] = useState<'Production' | 'Staging' | 'DMZ'>('Production');
  const [showPassword, setShowPassword] = useState(false);
  const [showBmcPassword, setShowBmcPassword] = useState(false);
  const [internalTesting, setInternalTesting] = useState(false);
  const [internalTestingSteps, setInternalTestingSteps] = useState<AccessTestStep[]>([]);

  // Step 1: ServiceNow credentials & database storage
  const [showCredentialsModal, setShowCredentialsModal] = useState(false);
  const [showInlineCreds, setShowInlineCreds] = useState(false);
  const [dbCredentials, setDbCredentials] = useState<ServiceNowCredentials | null>(null);
  const [loadingDbCreds, setLoadingDbCreds] = useState(true);
  const [credInstanceUrl, setCredInstanceUrl] = useState('https://generali.service-now.com');
  const [credUsername, setCredUsername] = useState('svc_vcenter_baremetal');
  const [credPassword, setCredPassword] = useState('');
  const [showCredPassword, setShowCredPassword] = useState(false);
  const [isSavingCreds, setIsSavingCreds] = useState(false);
  const [isTestingCreds, setIsTestingCreds] = useState(false);
  const [credTestFeedback, setCredTestFeedback] = useState<{ success: boolean; message: string } | null>(null);

  // Load database credentials on mount
  useEffect(() => {
    fetchDatabaseServiceNowCredentials().then((creds) => {
      setLoadingDbCreds(false);
      if (creds) {
        setDbCredentials(creds);
        if (creds.instanceUrl) setCredInstanceUrl(creds.instanceUrl);
        if (creds.username) setCredUsername(creds.username);
        if (creds.password) setCredPassword(creds.password);
      }
    });
  }, []);

  const handleSaveInlineCreds = async () => {
    if (!credInstanceUrl.trim()) return;
    setIsSavingCreds(true);
    setCredTestFeedback(null);
    try {
      const res = await saveDatabaseServiceNowCredentials({
        instanceUrl: credInstanceUrl.trim(),
        username: credUsername.trim(),
        password: credPassword,
        authType: 'basic',
        storedInDb: true
      });
      if (res.success) {
        setDbCredentials({
          instanceUrl: credInstanceUrl.trim(),
          username: credUsername.trim(),
          password: credPassword,
          storedInDb: true,
          updatedAt: new Date().toISOString()
        });
        setCredTestFeedback({
          success: true,
          message: 'Saved to PostgreSQL database (app_settings) successfully!'
        });
        logBaremetalOutput(
          'DATABASE',
          'success',
          `ServiceNow credentials saved to database for ${credInstanceUrl}`,
          `User: ${credUsername || 'svc_account'} | Persisted in app_settings table`
        );
      } else {
        setCredTestFeedback({
          success: false,
          message: res.message || 'Failed to save to database'
        });
      }
    } catch (err: any) {
      setCredTestFeedback({
        success: false,
        message: err.message || 'Error saving to database'
      });
    } finally {
      setIsSavingCreds(false);
    }
  };

  const handleTestInlineCreds = async () => {
    setIsTestingCreds(true);
    setCredTestFeedback(null);
    logBaremetalOutput('SERVICENOW', 'info', `Testing connection to ${credInstanceUrl}...`);
    try {
      const res = await testServiceNowConnection({
        instanceUrl: credInstanceUrl.trim(),
        username: credUsername.trim(),
        password: credPassword
      });
      setCredTestFeedback({
        success: res.success,
        message: res.message + (res.latencyMs ? ` (${res.latencyMs}ms)` : '')
      });
      logBaremetalOutput(
        'SERVICENOW',
        res.success ? 'success' : 'warn',
        res.message,
        `Latency: ${res.latencyMs || 0}ms`
      );
    } catch (err: any) {
      setCredTestFeedback({
        success: false,
        message: err.message || 'Connection test failed'
      });
      logBaremetalOutput('SERVICENOW', 'error', `Connection test error: ${err.message}`);
    } finally {
      setIsTestingCreds(false);
    }
  };

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

  const handleApplyServiceNowFields = (extracted: ServiceNowExtractedFields, ritmData: ServiceNowRitmData) => {
    setRitmNumber(ritmData.number);
    if (ritmData.requester) setRitmRequester(ritmData.requester);
    if (ritmData.environment) setRitmEnvironment(ritmData.environment as any);
    if (extracted.hostname) {
      setEsxiName(extracted.hostname);
      setHardwareForm((p: any) => ({ ...p, hostname: extracted.hostname }));
    }
    if (extracted.managementIp) setHostIp(extracted.managementIp);
    if (extracted.managementMask) setHostMask(extracted.managementMask);
    if (extracted.vmotionIp) setVmotionIp(extracted.vmotionIp);
    if (extracted.vmotionMask) setVmotionMask(extracted.vmotionMask);
    if (extracted.gatewayIp) setGatewayIp(extracted.gatewayIp);
    if (extracted.vlanId) setVlanId(extracted.vlanId);
    if (extracted.dnsServers && extracted.dnsServers.length > 0) {
      setSelectedDnsIps(extracted.dnsServers as any);
    }
    if (extracted.ipmiAddress) {
      setHardwareForm((p: any) => ({ ...p, bmcIp: extracted.ipmiAddress }));
    }
    if (extracted.hardwareModel) {
      setHardwareForm((p: any) => ({ ...p, model: extracted.hardwareModel }));
    }
    if (extracted.hardwareVendor) {
      setSelectedVendor(extracted.hardwareVendor);
    }
    setStatusMessage({
      type: 'success',
      text: `Fields successfully retrieved from ServiceNow ticket ${ritmData.number} and loaded into wizard!`
    });
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

  const handleTestIpmi = async () => {
    const targetIp = (hardwareForm.bmcIp || '').trim();
    if (!targetIp) {
      setStatusMessage({ type: 'error', text: 'Please specify the BMC / IPMI IP address before testing access.' });
      return;
    }
    setInternalTesting(true);
    setHardwareForm((p: any) => ({ ...p, isTestingIpmi: true }));

    try {
      if (onTestIpmiAccess) {
        const res = await onTestIpmiAccess({
          bmcIp: targetIp,
          bmcPort: hardwareForm.bmcPort || (hardwareForm.bmcProtocol === 'ipmi' ? 623 : 443),
          bmcProtocol: hardwareForm.bmcProtocol || 'redfish',
          bmcUsername: hardwareForm.bmcUsername ?? 'root',
          bmcPassword: hardwareForm.bmcPassword ?? ''
        });
        if (res && res.steps) {
          setInternalTestingSteps(res.steps);
        }
      } else {
        const res = await testServerAccess({
          hostname: esxiName || hardwareForm.hostname || 'target-server',
          ip: hostIp || '',
          bmcIp: targetIp,
          bmcAffectedType: (hardwareForm.bmcProtocol === 'ipmi' ? 'Supermicro IPMI' : selectedVendor === 'DELL' ? 'Dell iDRAC' : 'Lenovo XCC') as any,
          model: (hardwareForm.model as any) || (selectedVendor === 'DELL' ? 'Dell PowerEdge R750' : 'Lenovo ThinkSystem SR650 V2'),
          credentials: {
            bmcUsername: hardwareForm.bmcUsername ?? 'root',
            bmcPassword: hardwareForm.bmcPassword ?? '',
            bmcProtocol: hardwareForm.bmcProtocol || 'redfish',
            bmcPort: hardwareForm.bmcPort || (hardwareForm.bmcProtocol === 'ipmi' ? 623 : 443),
            ignoreSslErrors: true
          },
          onStepUpdate: (steps) => setInternalTestingSteps(steps)
        });
        setHardwareForm((p: any) => ({
          ...p,
          accessStatus: res,
          isTestingIpmi: false,
          model: res.discoveredHardware?.model || p.model
        }));
      }
    } catch (e: any) {
      const failedRes: AccessTestResult = {
        status: 'failed',
        testedAt: new Date().toISOString(),
        testedBy: 'Real Network Probe',
        summary: e.message || 'Failed to connect to target IPMI',
        steps: [
          {
            id: 'step-network',
            name: 'Target BMC Route Probe',
            status: 'failed',
            message: e.message || 'Host or port unreachable'
          }
        ]
      };
      setHardwareForm((p: any) => ({ ...p, accessStatus: failedRes, isTestingIpmi: false }));
    } finally {
      setInternalTesting(false);
      setHardwareForm((p: any) => ({ ...p, isTestingIpmi: false }));
    }
  };

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
  const isIpmiVerified = hardwareForm.accessStatus?.status === 'success';

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

              {/* SERVICENOW ACCESS CREDENTIALS & DATABASE PERSISTENCE PROMPT */}
              <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-xl border border-indigo-500/30 p-4 text-white shadow-xs space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-lg bg-indigo-500/20 border border-indigo-400/30 text-indigo-300">
                      <Key className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-sm text-white">ServiceNow API Credentials</span>
                        {dbCredentials?.storedInDb ? (
                          <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/40 font-mono font-medium">
                            <Database className="w-3 h-3" /> Stored in PostgreSQL (app_settings)
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-400/40 font-mono font-medium">
                            <ShieldAlert className="w-3 h-3" /> Credentials Needed for RITM API
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-300 mt-0.5">
                        {dbCredentials?.storedInDb
                          ? `Instance: ${dbCredentials.instanceUrl.replace(/^https?:\/\//, '')} | User: ${dbCredentials.username || 'svc_account'}`
                          : 'Prompt and store your ServiceNow credentials securely in the database for automated ticket parameter resolution'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-start sm:self-auto">
                    <button
                      type="button"
                      id="btn-prompt-credentials-modal"
                      onClick={() => setShowCredentialsModal(true)}
                      className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
                    >
                      <Key className="w-3.5 h-3.5" />
                      <span>{dbCredentials?.storedInDb ? 'Manage Credentials' : 'Prompt Credentials'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowInlineCreds(!showInlineCreds)}
                      className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 transition-colors cursor-pointer"
                    >
                      {showInlineCreds ? 'Close Quick Form' : 'Quick Configure'}
                    </button>
                  </div>
                </div>

                {/* Inline Credentials Prompt & Database Storage Form */}
                {showInlineCreds && (
                  <div className="pt-3 border-t border-slate-800 space-y-3 animate-in fade-in duration-150">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-[11px] text-slate-300 font-medium mb-1">
                          ServiceNow Instance URL
                        </label>
                        <input
                          type="text"
                          id="input-inline-sn-url"
                          value={credInstanceUrl}
                          onChange={e => setCredInstanceUrl(e.target.value)}
                          placeholder="https://generali.service-now.com"
                          className="w-full text-xs font-mono rounded bg-slate-800/90 border border-slate-700 p-2 text-white placeholder-slate-500 focus:ring-1 focus:ring-indigo-400"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] text-slate-300 font-medium mb-1">
                          Service Account Username
                        </label>
                        <input
                          type="text"
                          id="input-inline-sn-user"
                          value={credUsername}
                          onChange={e => setCredUsername(e.target.value)}
                          placeholder="svc_vcenter_baremetal"
                          className="w-full text-xs font-mono rounded bg-slate-800/90 border border-slate-700 p-2 text-white placeholder-slate-500 focus:ring-1 focus:ring-indigo-400"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] text-slate-300 font-medium mb-1">
                          Account Password / Token
                        </label>
                        <div className="relative">
                          <input
                            type={showCredPassword ? 'text' : 'password'}
                            id="input-inline-sn-password"
                            value={credPassword}
                            onChange={e => setCredPassword(e.target.value)}
                            placeholder="Enter password..."
                            className="w-full text-xs font-mono rounded bg-slate-800/90 border border-slate-700 p-2 pr-8 text-white placeholder-slate-500 focus:ring-1 focus:ring-indigo-400"
                          />
                          <button
                            type="button"
                            onClick={() => setShowCredPassword(!showCredPassword)}
                            className="absolute right-2 top-2 text-slate-400 hover:text-white"
                          >
                            {showCredPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-1">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          id="btn-inline-test-connection"
                          onClick={handleTestInlineCreds}
                          disabled={isTestingCreds}
                          className="px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1.5 border border-slate-700 disabled:opacity-50 cursor-pointer"
                        >
                          {isTestingCreds ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <ShieldCheck className="w-3.5 h-3.5 text-indigo-400" />}
                          <span>Test Access</span>
                        </button>
                        <button
                          type="button"
                          id="btn-inline-save-database"
                          onClick={handleSaveInlineCreds}
                          disabled={isSavingCreds}
                          className="px-3 py-1.5 rounded bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center gap-1.5 disabled:opacity-50 shadow-xs cursor-pointer"
                        >
                          {isSavingCreds ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Database className="w-3.5 h-3.5" />}
                          <span>Store into Database</span>
                        </button>
                      </div>

                      {credTestFeedback && (
                        <span className={`text-[11px] font-medium flex items-center gap-1.5 ${
                          credTestFeedback.success ? 'text-emerald-400' : 'text-amber-400'
                        }`}>
                          {credTestFeedback.success ? <CheckCircle2 className="w-3.5 h-3.5 shrink-0" /> : <AlertTriangle className="w-3.5 h-3.5 shrink-0" />}
                          <span>{credTestFeedback.message}</span>
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div className="bg-slate-50/70 p-5 rounded-xl border border-slate-200 space-y-4">
                {/* RITM # Field */}
                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1 flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <FileText className="w-3.5 h-3.5 text-indigo-600" />
                      <span>RITM # (ServiceNow / ITSM Request Item Number)</span>
                    </span>
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => setShowCredentialsModal(true)}
                        className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 cursor-pointer"
                      >
                        <Key className="w-3 h-3" />
                        <span>{dbCredentials?.storedInDb ? 'Credentials in DB' : 'Prompt Credentials for DB'}</span>
                      </button>
                      <span className="text-[10px] text-indigo-600 font-semibold uppercase tracking-wider">Required Field</span>
                    </div>
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

              {/* ServiceNow Enterprise Ticket & Specific Field Extractor */}
              <ServiceNowInspector
                currentRitm={ritmNumber}
                onApplyFields={handleApplyServiceNowFields}
                onRitmChange={setRitmNumber}
              />
            </div>
          )}

          {/* STEP 2: FORM: ESXi Name, IP (+mask), vMotion (+mask), IPMI IP, DNS IP: fix list ("8.8.8.8", "10.100.1.1") */}
          {wizardStep === 2 && (
            <div className="space-y-5">
              <div>
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 text-xs font-semibold border border-blue-200/60 mb-2">
                  <Network className="w-3.5 h-3.5 text-blue-600" />
                  <span>Step 2: Network & Host Profile</span>
                </div>
                <h2 className="text-base font-bold text-slate-900">ESXi Host Identity & Network Configuration</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Define the ESXi hostname, static management IP with subnet mask, dedicated vMotion interface with subnet mask, out-of-band IPMI address, and fixed DNS resolvers.
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
                      setHardwareForm((p: any) => ({ ...p, hostname: e.target.value }));
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

                {/* Step 2 IPMI / Out-of-Band Management Address */}
                <div className="p-4 bg-indigo-50/60 rounded-xl border border-indigo-200/80 space-y-2.5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                    <label className="block text-xs font-bold text-slate-900 flex items-center gap-1.5">
                      <Server className="w-3.5 h-3.5 text-indigo-600" />
                      <span>IPMI / BMC Out-of-Band Address</span>
                    </label>
                    <span className="text-[10px] text-indigo-700 font-semibold uppercase tracking-wider">Required for Virtual Media & PXE Boot</span>
                  </div>
                  
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                    <input
                      type="text"
                      id="input-step2-ipmi-ip"
                      value={hardwareForm.bmcIp || ''}
                      onChange={e => {
                        const val = e.target.value;
                        setHardwareForm((p: any) => ({ ...p, bmcIp: val }));
                      }}
                      placeholder="e.g. 192.168.10.150"
                      className="flex-1 text-xs font-mono font-bold rounded-lg border border-slate-300 p-2.5 bg-white focus:ring-2 focus:ring-indigo-500"
                    />
                    <button
                      type="button"
                      id="btn-step2-test-ipmi"
                      onClick={handleTestIpmi}
                      disabled={!hardwareForm.bmcIp?.trim() || internalTesting || hardwareForm.isTestingIpmi}
                      className="px-3.5 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white font-semibold text-xs flex items-center justify-center gap-1.5 shrink-0 transition-colors shadow-2xs cursor-pointer"
                    >
                      {internalTesting || hardwareForm.isTestingIpmi ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          <span>Testing IPMI...</span>
                        </>
                      ) : (
                        <>
                          <ShieldCheck className="w-3.5 h-3.5" />
                          <span>{hardwareForm.accessStatus?.status === 'success' ? 'IPMI Verified (Re-test)' : 'Test IPMI Access'}</span>
                        </>
                      )}
                    </button>
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-slate-500">
                    <span>Target BMC (Dell iDRAC9 / Lenovo XCC) interface used by the provisioning engine to mount ESXi ISO.</span>
                    {hardwareForm.accessStatus?.status === 'success' && (
                      <span className="text-emerald-700 font-bold flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Connected ({hardwareForm.accessStatus.latencyMs || 15}ms)</span>
                      </span>
                    )}
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
                            bmcPort: s.credentials?.bmcPort || (s.bmcAffectedType === 'Supermicro IPMI' ? 623 : 443),
                            bmcProtocol: s.credentials?.bmcProtocol || (s.bmcAffectedType === 'Supermicro IPMI' ? 'ipmi' : 'redfish'),
                            bmcUsername: s.credentials?.bmcUsername || 'root',
                            bmcPassword: s.credentials?.bmcPassword || '',
                            macAddress: s.accessStatus?.discoveredHardware?.macAddress || '',
                            datacenter: s.datacenter || '',
                            rack: s.rack || '',
                            accessStatus: s.accessStatus || null,
                            isTestingIpmi: false
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

                <div>
                  <label className="block text-xs font-semibold text-slate-800 mb-1">
                    Hardware Server Model
                  </label>
                  <div className="flex gap-2">
                    <select
                      id="select-server-model"
                      value={hardwareForm.model}
                      onChange={e => setHardwareForm((p: any) => ({ ...p, model: e.target.value }))}
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
                      onChange={e => setHardwareForm((p: any) => ({ ...p, model: e.target.value }))}
                      placeholder="Or type model..."
                      className="w-40 text-xs rounded-lg border-slate-300 p-2.5 bg-white"
                    />
                  </div>
                </div>

                {/* Target Server IPMI / BMC Access & Credentials Card */}
                <div className="bg-white rounded-xl border border-indigo-100 shadow-xs p-4 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2.5 border-b border-slate-100">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-700 shrink-0">
                        <Network className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-xs font-bold text-slate-900">
                            Server Out-of-Band IPMI / BMC Access Verification
                          </h4>
                          {hardwareForm.accessStatus?.status === 'success' ? (
                            <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-semibold text-[10px] flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              IPMI Verified
                            </span>
                          ) : hardwareForm.accessStatus?.status === 'failed' ? (
                            <span className="px-2 py-0.5 rounded-full bg-red-100 text-red-800 font-semibold text-[10px] flex items-center gap-1">
                              <XCircle className="w-3 h-3 text-red-600" />
                              Auth Failed
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-medium text-[10px]">
                              Untested
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-500">
                          Verify Out-of-Band connectivity and BMC credentials before automated ESXi bare-metal provisioning.
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      id="btn-test-ipmi-access"
                      onClick={handleTestIpmi}
                      disabled={!hardwareForm.bmcIp?.trim() || internalTesting || hardwareForm.isTestingIpmi}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 disabled:bg-slate-300 disabled:cursor-not-allowed text-white text-xs font-semibold shadow-xs transition-colors shrink-0"
                    >
                      {internalTesting || hardwareForm.isTestingIpmi ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          <span>Testing IPMI Access...</span>
                        </>
                      ) : (
                        <>
                          <ShieldCheck className="w-3.5 h-3.5" />
                          <span>Test IPMI Access (IP + Credentials)</span>
                        </>
                      )}
                    </button>
                  </div>

                  {/* Inputs Grid: IP, Port/Protocol, Username, Password */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                    <div>
                      <label className="block text-slate-700 font-medium mb-1">
                        IPMI / BMC Management IP <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        id="input-bmc-ip"
                        value={hardwareForm.bmcIp}
                        onChange={e => setHardwareForm((p: any) => ({ ...p, bmcIp: e.target.value }))}
                        placeholder="e.g. 192.168.10.120"
                        className="w-full text-xs font-mono rounded-lg border-slate-300 p-2.5 bg-slate-50/50 focus:bg-white transition-colors"
                      />
                    </div>

                    <div>
                      <label className="block text-slate-700 font-medium mb-1">
                        Protocol & Port
                      </label>
                      <div className="flex gap-1.5">
                        <select
                          id="select-bmc-protocol"
                          value={hardwareForm.bmcProtocol || 'redfish'}
                          onChange={e => {
                            const proto = e.target.value as 'redfish' | 'ipmi';
                            setHardwareForm((p: any) => ({
                              ...p,
                              bmcProtocol: proto,
                              bmcPort: proto === 'ipmi' ? 623 : 443
                            }));
                          }}
                          className="flex-1 text-xs rounded-lg border-slate-300 p-2.5 bg-slate-50/50 focus:bg-white"
                        >
                          <option value="redfish">Redfish (HTTPS)</option>
                          <option value="ipmi">IPMI 2.0 (RMCP+)</option>
                        </select>
                        <input
                          type="number"
                          id="input-bmc-port"
                          value={hardwareForm.bmcPort || (hardwareForm.bmcProtocol === 'ipmi' ? 623 : 443)}
                          onChange={e => setHardwareForm((p: any) => ({ ...p, bmcPort: parseInt(e.target.value, 10) || 443 }))}
                          className="w-16 text-xs font-mono rounded-lg border-slate-300 p-2.5 bg-slate-50/50 focus:bg-white text-center"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-slate-700 font-medium mb-1">
                        IPMI Username
                      </label>
                      <input
                        type="text"
                        id="input-bmc-username"
                        value={hardwareForm.bmcUsername ?? 'root'}
                        onChange={e => setHardwareForm((p: any) => ({ ...p, bmcUsername: e.target.value }))}
                        placeholder="e.g. root or ADMIN"
                        className="w-full text-xs font-mono rounded-lg border-slate-300 p-2.5 bg-slate-50/50 focus:bg-white"
                      />
                    </div>

                    <div>
                      <label className="block text-slate-700 font-medium mb-1">
                        IPMI Password
                      </label>
                      <div className="relative">
                        <input
                          type={showBmcPassword ? 'text' : 'password'}
                          id="input-bmc-password"
                          value={hardwareForm.bmcPassword ?? ''}
                          onChange={e => setHardwareForm((p: any) => ({ ...p, bmcPassword: e.target.value }))}
                          placeholder="BMC password..."
                          className="w-full text-xs font-mono rounded-lg border-slate-300 p-2.5 pr-8 bg-slate-50/50 focus:bg-white"
                        />
                        <button
                          type="button"
                          onClick={() => setShowBmcPassword(!showBmcPassword)}
                          className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600"
                          title={showBmcPassword ? "Hide password" : "Show password"}
                        >
                          {showBmcPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Interactive Test Progress / Result Banner */}
                  {(internalTesting || hardwareForm.isTestingIpmi) && (
                    <div className="p-3 bg-indigo-50/90 border border-indigo-200 rounded-lg space-y-2">
                      <div className="flex items-center gap-2 text-indigo-950 font-semibold text-xs">
                        <RefreshCw className="w-3.5 h-3.5 animate-spin text-indigo-600" />
                        <span>Running IPMI 2.0 / Redfish Connectivity & Credential Handshake...</span>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
                        <div className="p-2 rounded bg-white border border-indigo-100 flex items-center gap-1.5 text-indigo-900 font-medium shadow-2xs">
                          <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse"></span>
                          <span>1. TCP Route Probe</span>
                        </div>
                        <div className="p-2 rounded bg-white border border-indigo-100 flex items-center gap-1.5 text-indigo-900 font-medium shadow-2xs">
                          <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse"></span>
                          <span>2. Port Handshake</span>
                        </div>
                        <div className="p-2 rounded bg-white border border-indigo-100 flex items-center gap-1.5 text-indigo-900 font-medium shadow-2xs">
                          <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse"></span>
                          <span>3. Credentials Auth</span>
                        </div>
                        <div className="p-2 rounded bg-white border border-indigo-100 flex items-center gap-1.5 text-indigo-900 font-medium shadow-2xs">
                          <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse"></span>
                          <span>4. Chassis Discovery</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Success Result */}
                  {!internalTesting && !hardwareForm.isTestingIpmi && hardwareForm.accessStatus?.status === 'success' && (
                    <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-lg space-y-2">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2 text-emerald-950 font-bold text-xs">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                          <span>IPMI Access & Credentials Verified</span>
                          <span className="px-1.5 py-0.5 rounded bg-emerald-100 border border-emerald-300 text-emerald-800 text-[10px] font-mono">
                            {hardwareForm.accessStatus.latencyMs || 15}ms RTT
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={handleTestIpmi}
                          className="text-[11px] text-emerald-700 hover:text-emerald-900 font-semibold underline cursor-pointer"
                        >
                          Re-test Access
                        </button>
                      </div>
                      <p className="text-[11px] text-emerald-800">
                        {hardwareForm.accessStatus.summary || `Authenticated to ${hardwareForm.bmcIp}:${hardwareForm.bmcPort || 443} as "${hardwareForm.bmcUsername || 'root'}"`}
                      </p>
                      {hardwareForm.accessStatus.discoveredHardware && (
                        <div className="flex flex-wrap gap-2 pt-1">
                          <span className="px-2 py-0.5 rounded bg-white border border-emerald-200 text-emerald-900 text-[10px] font-mono font-medium">
                            Model: {hardwareForm.accessStatus.discoveredHardware.model || hardwareForm.model}
                          </span>
                          <span className="px-2 py-0.5 rounded bg-white border border-emerald-200 text-emerald-900 text-[10px] font-mono font-medium">
                            Chassis Power: {(hardwareForm.accessStatus.discoveredHardware.powerState || 'ON').toUpperCase()}
                          </span>
                          <span className="px-2 py-0.5 rounded bg-white border border-emerald-200 text-emerald-900 text-[10px] font-mono font-medium">
                            Serial: {hardwareForm.accessStatus.discoveredHardware.serialNumber || 'SN-VERIFIED'}
                          </span>
                          <span className="px-2 py-0.5 rounded bg-white border border-emerald-200 text-emerald-900 text-[10px] font-mono font-medium">
                            Firmware: {hardwareForm.accessStatus.discoveredHardware.bmcVersionDetected || 'Active'}
                          </span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Failure Result */}
                  {!internalTesting && !hardwareForm.isTestingIpmi && hardwareForm.accessStatus?.status === 'failed' && (
                    <div className="p-3.5 bg-red-50 border border-red-200 rounded-lg space-y-2">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2 text-red-950 font-bold text-xs">
                          <XCircle className="w-4 h-4 text-red-600 shrink-0" />
                          <span>IPMI Access Test Failed</span>
                        </div>
                        <button
                          type="button"
                          onClick={handleTestIpmi}
                          className="text-[11px] text-red-700 hover:text-red-900 font-semibold underline cursor-pointer"
                        >
                          Retry Test
                        </button>
                      </div>
                      <p className="text-[11px] text-red-800">
                        {hardwareForm.accessStatus.summary || 'Failed to authenticate to target IPMI. Please verify IP address and credentials.'}
                      </p>
                      {hardwareForm.accessStatus.errorDetails && (
                        <div className="text-[10px] font-mono bg-white p-2 rounded border border-red-200 text-red-700">
                          {hardwareForm.accessStatus.errorDetails}
                        </div>
                      )}
                    </div>
                  )}
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
                    <span>{isStep4Valid ? `Hardware: ${hardwareForm.model}` : 'Hardware Model Pending'}</span>
                  </div>

                  <div className={`flex items-center justify-between p-2 rounded-lg border sm:col-span-2 ${
                    hardwareForm.accessStatus?.status === 'success'
                      ? 'bg-emerald-50/60 border-emerald-200/80 text-slate-800'
                      : hardwareForm.accessStatus?.status === 'failed'
                      ? 'bg-red-50 border-red-200 text-red-900'
                      : 'bg-amber-50 border-amber-200 text-amber-900'
                  }`}>
                    <div className="flex items-center gap-2 text-xs">
                      {hardwareForm.accessStatus?.status === 'success' ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      ) : hardwareForm.accessStatus?.status === 'failed' ? (
                        <XCircle className="w-4 h-4 text-red-600 shrink-0" />
                      ) : (
                        <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                      )}
                      <span>
                        {hardwareForm.accessStatus?.status === 'success'
                          ? `IPMI Access & Credentials Verified: ${hardwareForm.bmcIp}:${hardwareForm.bmcPort || 443} (${hardwareForm.accessStatus.latencyMs || 15}ms RTT • User: "${hardwareForm.bmcUsername || 'root'}")`
                          : hardwareForm.accessStatus?.status === 'failed'
                          ? `IPMI Access Failed on ${hardwareForm.bmcIp}: ${hardwareForm.accessStatus.summary}`
                          : `IPMI Access Untested on ${hardwareForm.bmcIp || '<No IP>'}`}
                      </span>
                    </div>

                    <button
                      type="button"
                      id="btn-step5-test-ipmi"
                      onClick={handleTestIpmi}
                      disabled={!hardwareForm.bmcIp?.trim() || internalTesting || hardwareForm.isTestingIpmi}
                      className="text-[11px] font-bold px-2.5 py-1 rounded bg-white border border-slate-300 hover:bg-slate-50 text-slate-800 flex items-center gap-1.5 shrink-0 shadow-2xs cursor-pointer"
                    >
                      {internalTesting || hardwareForm.isTestingIpmi ? (
                        <RefreshCw className="w-3.5 h-3.5 animate-spin text-indigo-600" />
                      ) : (
                        <ShieldCheck className="w-3.5 h-3.5 text-indigo-600" />
                      )}
                      <span>{hardwareForm.accessStatus?.status === 'success' ? 'Re-test IPMI' : 'Test IPMI Access (IP + Credentials)'}</span>
                    </button>
                  </div>
                </div>

                {/* Target Server IPMI Review Box */}
                <div className="bg-slate-50/90 rounded-xl border border-slate-200 p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Network className="w-4 h-4 text-indigo-600" />
                      <span className="text-xs font-bold text-slate-800">Target Server IPMI / BMC Access Summary</span>
                    </div>
                    {hardwareForm.accessStatus?.status === 'success' ? (
                      <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" />
                        Credentials Authenticated
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-bold flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" />
                        Preflight Verification Advised
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs pt-1">
                    <div className="bg-white p-2 rounded border border-slate-200">
                      <div className="text-[10px] text-slate-500 font-semibold">BMC IP & Port</div>
                      <div className="font-mono font-bold text-slate-800">{hardwareForm.bmcIp || 'N/A'}:{hardwareForm.bmcPort || (hardwareForm.bmcProtocol === 'ipmi' ? 623 : 443)}</div>
                    </div>
                    <div className="bg-white p-2 rounded border border-slate-200">
                      <div className="text-[10px] text-slate-500 font-semibold">Protocol</div>
                      <div className="font-bold text-slate-800">{(hardwareForm.bmcProtocol || 'redfish').toUpperCase()}</div>
                    </div>
                    <div className="bg-white p-2 rounded border border-slate-200">
                      <div className="text-[10px] text-slate-500 font-semibold">Username</div>
                      <div className="font-mono font-bold text-slate-800">{hardwareForm.bmcUsername || 'root'}</div>
                    </div>
                    <div className="bg-white p-2 rounded border border-slate-200">
                      <div className="text-[10px] text-slate-500 font-semibold">Password</div>
                      <div className="font-mono text-slate-800">{hardwareForm.bmcPassword ? '••••••••' : '(Default / None)'}</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

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

      {/* ServiceNow Credentials Modal */}
      {showCredentialsModal && (
        <ServiceNowCredentialsPromptModal
          isOpen={showCredentialsModal}
          onClose={() => setShowCredentialsModal(false)}
          onSaved={(savedCreds) => {
            setDbCredentials(savedCreds);
            if (savedCreds.instanceUrl) setCredInstanceUrl(savedCreds.instanceUrl);
            if (savedCreds.username) setCredUsername(savedCreds.username);
            if (savedCreds.password) setCredPassword(savedCreds.password);
            setStatusMessage({
              type: 'success',
              text: 'ServiceNow credentials successfully stored in PostgreSQL database!'
            });
          }}
        />
      )}
    </div>
  );
};
