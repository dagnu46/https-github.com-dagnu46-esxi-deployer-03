import React, { useState } from 'react';
import { 
  X, 
  Server as ServerIcon, 
  Cpu, 
  HardDrive, 
  Wifi, 
  ShieldAlert, 
  ShieldCheck,
  CheckCircle2, 
  XCircle,
  Play, 
  Terminal, 
  RefreshCw, 
  Power, 
  Layers, 
  ExternalLink,
  Lock,
  Sparkles,
  Edit,
  Trash2,
  Key,
  Eye,
  EyeOff,
  Activity,
  Check
} from 'lucide-react';
import { Server, ComponentType, AccessTestResult, AccessTestStep } from '../types';
import { testServerAccess } from '../utils/accessTester';

interface ServerDetailModalProps {
  server: Server | null;
  onClose: () => void;
  onUpgradeComponent: (server: Server, component: ComponentType) => void;
  onUpdateServerStatus: (serverId: string, newStatus: Server['status']) => void;
  onEditServer?: (server: Server) => void;
  onDeleteServer?: (server: Server) => void;
  onSaveServer?: (server: Server) => void;
}

export const ServerDetailModal: React.FC<ServerDetailModalProps> = ({
  server,
  onClose,
  onUpgradeComponent,
  onUpdateServerStatus,
  onEditServer,
  onDeleteServer,
  onSaveServer,
}) => {
  const [activeTab, setActiveTab] = useState<'components' | 'credentials' | 'console' | 'maintenance' | 'hypervisor'>('components');
  const [consoleLogMessage, setConsoleLogMessage] = useState<string>('');
  const [showPassword, setShowPassword] = useState(false);

  // Live access testing in details view
  const [isTestingAccess, setIsTestingAccess] = useState(false);
  const [liveTestResult, setLiveTestResult] = useState<AccessTestResult | null>(null);
  const [liveTestSteps, setLiveTestSteps] = useState<AccessTestStep[]>([]);
  const [testBanner, setTestBanner] = useState<string | null>(null);

  if (!server) return null;

  const vendor = server.vendor || (
    server.model?.includes('HPE') || server.model?.includes('HP') ? 'HP' :
    server.model?.includes('Dell') ? 'DELL' : 'LENOVO'
  );

  const hypervisor = server.hypervisor || (
    server.cluster?.includes('Nutanix') ? 'VMware ESXi on Nutanix' :
    server.cluster?.includes('Xen') ? 'Xen Server' : 'VMware ESXi'
  );

  const handleToggleHostMaintenance = () => {
    const nextMode = !server.hypervisorMaintenanceMode;
    const updated = {
      ...server,
      hypervisorMaintenanceMode: nextMode,
      status: (nextMode ? 'maintenance' : 'online') as Server['status'],
    };
    if (onSaveServer) {
      onSaveServer(updated);
    } else {
      onUpdateServerStatus(server.id, updated.status);
    }
  };

  const componentIcons: Record<ComponentType, React.ReactNode> = {
    BIOS: <Cpu className="w-4 h-4 text-indigo-600" />,
    BMC: <ServerIcon className="w-4 h-4 text-purple-600" />,
    NIC: <Wifi className="w-4 h-4 text-sky-600" />,
    RAID: <Layers className="w-4 h-4 text-amber-600" />,
    NVMe: <HardDrive className="w-4 h-4 text-emerald-600" />,
  };

  const handleToggleMaintenance = () => {
    const nextStatus = server.status === 'maintenance' ? 'online' : 'maintenance';
    onUpdateServerStatus(server.id, nextStatus);
  };

  const handleRunDetailAccessTest = async () => {
    setTestBanner(null);
    setIsTestingAccess(true);

    const creds = server.credentials || {
      bmcUsername: 'root',
      bmcPassword: '••••••••',
      bmcProtocol: server.bmcAffectedType === 'Supermicro IPMI' ? 'ipmi' : 'redfish',
      bmcPort: server.bmcAffectedType === 'Supermicro IPMI' ? 623 : 443,
      ignoreSslErrors: true,
      enableSsh: false,
    };

    try {
      const result = await testServerAccess({
        hostname: server.hostname,
        ip: server.ip,
        bmcIp: server.bmcIp,
        bmcAffectedType: server.bmcAffectedType,
        model: server.model,
        credentials: creds,
        onStepUpdate: steps => setLiveTestSteps(steps),
      });

      setLiveTestResult(result);
      setLiveTestSteps(result.steps);

      if (result.status === 'success') {
        setTestBanner(`Verified access via ${creds.bmcProtocol.toUpperCase()} (${result.latencyMs}ms RTT)`);
        // Save test result to server state
        if (onSaveServer) {
          onSaveServer({
            ...server,
            accessStatus: result,
          });
        }
      } else {
        setTestBanner(result.summary || 'Access probe failed.');
      }
    } catch (e: any) {
      setTestBanner(e?.message || 'Error executing connection test.');
    } finally {
      setIsTestingAccess(false);
    }
  };

  const currentAccess = liveTestResult || server.accessStatus;
  const currentSteps = liveTestSteps.length > 0 ? liveTestSteps : server.accessStatus?.steps || [];

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="relative bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col border border-slate-200 overflow-hidden">
        {/* Modal Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-lg bg-indigo-600/30 border border-indigo-500/40 flex items-center justify-center">
              <ServerIcon className="w-5 h-5 text-indigo-400" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-base font-bold font-mono text-white">{server.hostname}</h2>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase ${
                  server.status === 'online' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' :
                  server.status === 'maintenance' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' :
                  'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                }`}>
                  {server.status}
                </span>
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                  vendor === 'HP' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' :
                  vendor === 'DELL' ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30' :
                  'bg-red-500/20 text-red-300 border border-red-500/30'
                }`}>
                  {vendor}
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-slate-800 text-slate-300 border border-slate-700">
                  {hypervisor}
                </span>
                {server.accessStatus?.status === 'success' && (
                  <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    <ShieldCheck className="w-3 h-3" />
                    <span>Access Verified</span>
                  </span>
                )}
              </div>
              <div className="text-xs text-slate-400 flex items-center gap-2 mt-0.5">
                <span>{server.model}</span>
                <span>•</span>
                <span>{server.datacenter} ({server.rack}, {server.unit})</span>
                <span>•</span>
                <span className="font-mono text-slate-300">{server.ip}</span>
              </div>
            </div>
          </div>

          {/* Quick Header Actions */}
          <div className="flex items-center space-x-2">
            {onEditServer && (
              <button
                type="button"
                id="btn-modal-edit-device"
                onClick={() => {
                  onClose();
                  onEditServer(server);
                }}
                className="px-3 py-1.5 rounded-lg text-xs font-medium border border-slate-700 bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 flex items-center gap-1.5 transition-colors"
                title="Edit device configuration and credentials"
              >
                <Edit className="w-3.5 h-3.5" />
                <span>Edit Device</span>
              </button>
            )}
            {onDeleteServer && (
              <button
                type="button"
                id="btn-modal-delete-device"
                onClick={() => {
                  onClose();
                  onDeleteServer(server);
                }}
                className="px-3 py-1.5 rounded-lg text-xs font-medium border border-red-900/60 bg-red-950/40 text-red-300 hover:text-white hover:bg-red-900/60 flex items-center gap-1.5 transition-colors"
                title="Decommission and delete device"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete</span>
              </button>
            )}
            <button
              type="button"
              id="btn-toggle-maintenance"
              onClick={handleToggleMaintenance}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                server.status === 'maintenance'
                  ? 'bg-amber-500 text-white border-amber-600 hover:bg-amber-600'
                  : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
              }`}
            >
              {server.status === 'maintenance' ? 'Exit Maintenance' : 'Set Maintenance Mode'}
            </button>
            <button
              type="button"
              id="btn-close-server-modal"
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Sub-nav Tabs */}
        <div className="px-6 bg-slate-50 border-b border-slate-200 flex items-center space-x-6 text-xs font-semibold text-slate-600 overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab('components')}
            className={`py-3 border-b-2 transition-colors flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'components' ? 'border-indigo-600 text-indigo-600' : 'border-transparent hover:text-slate-900'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>Firmware Components ({Object.keys(server.components).length})</span>
          </button>
          <button
            type="button"
            id="tab-btn-credentials"
            onClick={() => setActiveTab('credentials')}
            className={`py-3 border-b-2 transition-colors flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'credentials' ? 'border-indigo-600 text-indigo-600' : 'border-transparent hover:text-slate-900'
            }`}
          >
            <Key className="w-4 h-4" />
            <span>Credentials & BMC Access</span>
            {server.accessStatus?.status === 'success' && (
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
            )}
          </button>
          <button
            type="button"
            id="tab-btn-hypervisor"
            onClick={() => setActiveTab('hypervisor')}
            className={`py-3 border-b-2 transition-colors flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'hypervisor' ? 'border-indigo-600 text-indigo-600' : 'border-transparent hover:text-slate-900'
            }`}
          >
            <Activity className="w-4 h-4" />
            <span>Virtualization & Hypervisor ({hypervisor})</span>
            {server.hypervisorMaintenanceMode && (
              <span className="px-1.5 py-0.2 rounded-sm bg-amber-100 text-amber-800 text-[9px] font-bold">
                Maint
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('console')}
            className={`py-3 border-b-2 transition-colors flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'console' ? 'border-indigo-600 text-indigo-600' : 'border-transparent hover:text-slate-900'
            }`}
          >
            <Terminal className="w-4 h-4" />
            <span>Out-of-Band BMC Console ({server.bmcAffectedType})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('maintenance')}
            className={`py-3 border-b-2 transition-colors flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'maintenance' ? 'border-indigo-600 text-indigo-600' : 'border-transparent hover:text-slate-900'
            }`}
          >
            <Power className="w-4 h-4" />
            <span>Hardware Diagnostics & Power</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {/* TAB 1: FIRMWARE COMPONENTS */}
          {activeTab === 'components' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Installed Component Firmware</h3>
                  <p className="text-xs text-slate-500">
                    Direct hardware controllers registered via Redfish Inventory Schema.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3">
                {(Object.entries(server.components) as [ComponentType, typeof server.components[ComponentType]][]).map(([compType, comp]) => {
                  const isCritical = comp.status === 'critical_update';
                  const isUpdate = comp.status === 'update_available';
                  const isUpToDate = comp.status === 'up_to_date';

                  return (
                    <div
                      key={compType}
                      className={`p-4 rounded-xl border transition-all ${
                        isCritical ? 'bg-amber-50/40 border-amber-300' :
                        isUpdate ? 'bg-indigo-50/20 border-indigo-200' :
                        'bg-white border-slate-200'
                      }`}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex items-start space-x-3">
                          <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center mt-0.5">
                            {componentIcons[compType]}
                          </div>
                          <div>
                            <div className="flex items-center space-x-2">
                              <span className="font-bold text-slate-900 text-xs">{comp.name}</span>
                              <span className="text-[11px] font-semibold uppercase px-1.5 py-0.2 rounded-sm bg-slate-100 text-slate-600 font-mono">
                                {compType}
                              </span>
                              {comp.rebootRequired && (
                                <span className="text-[10px] text-slate-500 bg-slate-100 px-1.5 py-0.2 rounded-sm">
                                  Warm Reboot Required
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-slate-500 mt-0.5">
                              Vendor: {comp.vendor}
                            </div>

                            {comp.cveAlerts && comp.cveAlerts.length > 0 && (
                              <div className="flex items-center gap-1.5 mt-2">
                                <ShieldAlert className="w-3.5 h-3.5 text-red-600" />
                                <span className="text-[11px] font-medium text-red-700">
                                  Vulnerable to: {comp.cveAlerts.join(', ')}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Version info & Upgrade trigger */}
                        <div className="flex items-center space-x-4 shrink-0 sm:border-l sm:border-slate-200 sm:pl-4">
                          <div className="text-right">
                            <div className="text-[11px] text-slate-500">Current Flashed Version</div>
                            <div className="font-mono text-xs font-bold text-slate-900">{comp.currentVersion}</div>
                            {comp.latestVersion !== comp.currentVersion && (
                              <div className="text-[10px] text-indigo-600 font-mono font-medium">
                                Target: {comp.latestVersion}
                              </div>
                            )}
                          </div>

                          <div>
                            {isUpToDate ? (
                              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 gap-1">
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                <span>Compliant</span>
                              </span>
                            ) : (
                              <button
                                type="button"
                                onClick={() => onUpgradeComponent(server, compType)}
                                className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 shadow-xs transition-colors ${
                                  isCritical 
                                    ? 'bg-amber-600 hover:bg-amber-700 text-white' 
                                    : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                                }`}
                              >
                                <Play className="w-3 h-3 fill-white" />
                                <span>Stage Update</span>
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 2: CREDENTIALS & BMC ACCESS (USER REQUIREMENT) */}
          {activeTab === 'credentials' && (
            <div className="space-y-6 text-xs">
              {/* Top Banner with Connectivity Action */}
              <div className="p-4 bg-slate-900 text-white rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <Key className="w-4 h-4 text-indigo-400" />
                    <h3 className="text-sm font-bold">Authentication Credentials & Out-of-Band Access</h3>
                    {currentAccess?.status === 'success' ? (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                        Verified ({currentAccess.latencyMs}ms)
                      </span>
                    ) : currentAccess?.status === 'failed' ? (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-500/20 text-red-300 border border-red-500/30">
                        Auth Failed
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-700 text-slate-300">
                        Unverified
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-400 mt-1">
                    Manage BMC/Redfish administrator credentials used for automated firmware staging and hardware resets.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    id="btn-detail-test-access"
                    onClick={handleRunDetailAccessTest}
                    disabled={isTestingAccess}
                    className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-xs"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isTestingAccess ? 'animate-spin' : ''}`} />
                    <span>{isTestingAccess ? 'Testing Access...' : 'Test Access Now'}</span>
                  </button>
                  {onEditServer && (
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        onEditServer(server);
                      }}
                      className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-semibold border border-slate-700 transition-colors"
                    >
                      Edit Credentials
                    </button>
                  )}
                </div>
              </div>

              {testBanner && (
                <div className={`p-3 rounded-lg border flex items-center gap-2 ${
                  currentAccess?.status === 'success'
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                    : 'bg-red-50 text-red-800 border-red-200'
                }`}>
                  {currentAccess?.status === 'success' ? (
                    <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                  ) : (
                    <ShieldAlert className="w-4 h-4 text-red-600 shrink-0" />
                  )}
                  <span className="font-medium text-xs">{testBanner}</span>
                </div>
              )}

              {/* Stored Credentials Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* BMC Credentials Box */}
                <div className="border border-slate-200 rounded-xl p-4 bg-white space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                    <span className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                      <ServerIcon className="w-3.5 h-3.5 text-indigo-600" />
                      BMC Out-of-Band Controller Credentials
                    </span>
                    <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-sm bg-slate-100 text-slate-700 uppercase">
                      {server.credentials?.bmcProtocol || 'Redfish'}
                    </span>
                  </div>

                  <div className="space-y-2 text-xs">
                    <div className="flex items-center justify-between py-1 border-b border-slate-50">
                      <span className="text-slate-500">Controller Type:</span>
                      <span className="font-medium text-slate-900">{server.bmcAffectedType}</span>
                    </div>
                    <div className="flex items-center justify-between py-1 border-b border-slate-50">
                      <span className="text-slate-500">BMC IP & Port:</span>
                      <span className="font-mono text-slate-900 font-medium">
                        {server.bmcIp}:{server.credentials?.bmcPort || 443}
                      </span>
                    </div>
                    <div className="flex items-center justify-between py-1 border-b border-slate-50">
                      <span className="text-slate-500">Admin Username:</span>
                      <span className="font-mono font-semibold text-slate-900">
                        {server.credentials?.bmcUsername || 'root'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between py-1 border-b border-slate-50">
                      <span className="text-slate-500">Password:</span>
                      <div className="flex items-center gap-2 font-mono">
                        <span>{showPassword ? (server.credentials?.bmcPassword || 'P@ssw0rd2026!') : '••••••••••••'}</span>
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="text-slate-400 hover:text-slate-700"
                        >
                          {showPassword ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                        </button>
                      </div>
                    </div>
                    <div className="flex items-center justify-between py-1">
                      <span className="text-slate-500">SSL / TLS Verification:</span>
                      <span className="text-emerald-700 font-medium">
                        {server.credentials?.ignoreSslErrors ?? true ? 'Self-Signed Allowed' : 'Strict CA Validation'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Host OS Credentials Box */}
                <div className="border border-slate-200 rounded-xl p-4 bg-white space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                    <span className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                      <Terminal className="w-3.5 h-3.5 text-emerald-600" />
                      Host OS In-Band Credentials (SSH)
                    </span>
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-sm ${
                      server.credentials?.enableSsh ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-500'
                    }`}>
                      {server.credentials?.enableSsh ? 'Enabled' : 'Not Configured'}
                    </span>
                  </div>

                  <div className="space-y-2 text-xs">
                    <div className="flex items-center justify-between py-1 border-b border-slate-50">
                      <span className="text-slate-500">Host IP:</span>
                      <span className="font-mono text-slate-900 font-medium">{server.ip}:{server.credentials?.sshPort || 22}</span>
                    </div>
                    <div className="flex items-center justify-between py-1 border-b border-slate-50">
                      <span className="text-slate-500">SSH Username:</span>
                      <span className="font-mono text-slate-900 font-medium">{server.credentials?.sshUsername || 'sysadmin'}</span>
                    </div>
                    <div className="flex items-center justify-between py-1 border-b border-slate-50">
                      <span className="text-slate-500">Auth Method:</span>
                      <span className="font-medium text-slate-700 capitalize">{server.credentials?.sshAuthType || 'Password'}</span>
                    </div>
                    <div className="flex items-center justify-between py-1">
                      <span className="text-slate-500">Staging Mode:</span>
                      <span className="text-slate-700">OS Kernel driver pre-load enabled</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Diagnostic Step Execution Log */}
              <div className="border border-slate-200 rounded-xl p-4 bg-slate-950 text-slate-200 font-mono space-y-3">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <span className="font-bold text-xs flex items-center gap-2 text-white">
                    <Activity className="w-3.5 h-3.5 text-indigo-400" />
                    Live Diagnostic & Telemetry Log
                  </span>
                  {currentAccess && (
                    <span className="text-[10px] text-slate-400">
                      Last tested: {currentAccess.testedAt ? new Date(currentAccess.testedAt).toLocaleTimeString() : 'Recent'}
                    </span>
                  )}
                </div>

                <div className="space-y-2">
                  {currentSteps.map(step => (
                    <div key={step.id} className="flex items-start justify-between gap-2 text-[11px]">
                      <div className="flex items-start gap-2">
                        {step.status === 'success' && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 mt-0.5 shrink-0" />}
                        {step.status === 'failed' && <XCircle className="w-3.5 h-3.5 text-red-400 mt-0.5 shrink-0" />}
                        {step.status === 'running' && <RefreshCw className="w-3.5 h-3.5 text-indigo-400 animate-spin mt-0.5 shrink-0" />}
                        {step.status === 'pending' && <div className="w-3.5 h-3.5 rounded-full border border-slate-600 mt-0.5 shrink-0" />}
                        <div>
                          <div className={step.status === 'failed' ? 'text-red-300' : 'text-slate-200'}>
                            {step.name}
                          </div>
                          {step.message && <div className="text-[10px] text-slate-400">{step.message}</div>}
                        </div>
                      </div>
                      {step.latencyMs !== undefined && (
                        <span className="text-[10px] text-slate-500 shrink-0">{step.latencyMs}ms</span>
                      )}
                    </div>
                  ))}
                </div>

                {/* Discovered Telemetry Snapshot */}
                {currentAccess?.discoveredHardware && (
                  <div className="mt-3 pt-3 border-t border-slate-800 font-sans text-xs bg-slate-900/90 p-3 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <div className="font-semibold text-white flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                        <span>Chassis Hardware Identified: {currentAccess.discoveredHardware.model}</span>
                        <span className="text-slate-400 font-mono text-[11px]">({currentAccess.discoveredHardware.serialNumber})</span>
                      </div>
                      <div className="text-[11px] text-slate-400 mt-0.5">
                        Power: <span className="text-emerald-400 font-bold uppercase">{currentAccess.discoveredHardware.powerState}</span> • 
                        Redfish Version: <span className="text-indigo-300 font-mono">{currentAccess.discoveredHardware.redfishVersion || 'v1.15'}</span> • 
                        Active BMC: <span className="text-indigo-300 font-mono">{currentAccess.discoveredHardware.bmcVersionDetected}</span> • 
                        Active BIOS: <span className="text-indigo-300 font-mono">{currentAccess.discoveredHardware.biosVersionDetected}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 3: OUT-OF-BAND BMC CONSOLE */}
          {activeTab === 'console' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    {server.bmcAffectedType} RESTful Redfish API Console
                  </h3>
                  <p className="text-xs text-slate-500">
                    Remote out-of-band management interface running at https://{server.bmcIp}
                  </p>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
                    Connected (TLS 1.3)
                  </span>
                </div>
              </div>

              {/* Terminal View */}
              <div className="bg-slate-950 text-slate-200 font-mono text-xs rounded-xl p-4 border border-slate-800 shadow-inner space-y-2">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2 text-slate-400 text-[11px]">
                  <span>REDFISH SESSION ID: session-bmc-{server.id.slice(-4)}</span>
                  <span>LATENCY: 12ms</span>
                </div>
                <div className="space-y-1 text-[11px] pt-1 text-slate-300">
                  <p className="text-emerald-400">&gt; GET /redfish/v1/Systems/System.Embedded.1 HTTP/1.1</p>
                  <p className="text-slate-400">&gt; Host: {server.bmcIp}</p>
                  <p className="text-slate-400">&gt; Authorization: Basic {btoa(`${server.credentials?.bmcUsername || 'root'}:••••••••`)}</p>
                  <p className="text-indigo-300">&lt; HTTP/1.1 200 OK</p>
                  <p className="text-slate-400">&lt; Content-Type: application/json;charset=utf-8</p>
                  <p className="text-slate-400">&lt; X-Auth-Token: 4a9f2c18d9e14a2b9101ff</p>
                  <div className="bg-slate-900 p-2.5 rounded-md text-[10px] text-slate-300 overflow-x-auto my-2">
                    {JSON.stringify({
                      "@odata.id": "/redfish/v1/Systems/System.Embedded.1",
                      "Id": "System.Embedded.1",
                      "Name": server.model,
                      "PowerState": server.powerState.toUpperCase(),
                      "Status": { "Health": "OK", "State": "Enabled" },
                      "BiosVersion": server.components.BIOS?.currentVersion,
                      "Manufacturer": server.model.split(' ')[0],
                      "Model": server.model,
                      "SerialNumber": `SN-${server.hostname.slice(-6).toUpperCase()}`,
                      "RedfishVersion": "1.15.1"
                    }, null, 2)}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: HYPERVISOR & VIRTUALIZATION */}
          {activeTab === 'hypervisor' && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-4">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Virtualization Hypervisor & Workloads</h3>
                  <p className="text-xs text-slate-500">
                    Host hypervisor lifecycle, guest VM state, and automated pre-flash evacuation orchestration.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${
                    server.hypervisorMaintenanceMode
                      ? 'bg-amber-100 text-amber-900 border border-amber-300'
                      : 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                  }`}>
                    {server.hypervisorMaintenanceMode ? 'Maintenance Mode Active' : 'Production Host (VMs Active)'}
                  </span>
                </div>
              </div>

              {/* Status Alert regarding safety during upgrade */}
              <div className={`p-4 rounded-xl border flex items-start gap-3 ${
                server.hypervisorMaintenanceMode 
                  ? 'bg-emerald-50/60 border-emerald-200 text-emerald-900' 
                  : (server.activeVmsCount || 0) > 0 
                    ? 'bg-amber-50/60 border-amber-300 text-amber-900'
                    : 'bg-slate-50 border-slate-200 text-slate-800'
              }`}>
                {server.hypervisorMaintenanceMode ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                ) : (server.activeVmsCount || 0) > 0 ? (
                  <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                ) : (
                  <Activity className="w-5 h-5 text-slate-500 shrink-0 mt-0.5" />
                )}
                <div className="text-xs space-y-1">
                  <div className="font-bold">
                    {server.hypervisorMaintenanceMode
                      ? 'Host Evacuated: Safe for Firmware Flash & Chassis Power Cycle'
                      : (server.activeVmsCount || 0) > 0
                        ? `Caution: Host Running ${server.activeVmsCount} Guest VMs`
                        : 'Host Idle: No Active Virtual Machines'}
                  </div>
                  <p className="text-slate-600 leading-relaxed">
                    {server.hypervisorMaintenanceMode
                      ? 'All guest workloads have been live-migrated via vMotion / Nutanix DRS / XenMotion. The host can safely receive BIOS/BMC warm resets without service outage.'
                      : (server.activeVmsCount || 0) > 0
                        ? 'Applying firmware with automated warm reboots or power resets will terminate running guest workloads. Place the host into Maintenance Mode before launching an upgrade campaign.'
                        : 'No active guest workloads currently pinned to this hypervisor node. Safe to maintain.'}
                  </p>
                </div>
              </div>

              {/* Grid: Hypervisor Specs + Maintenance Controls */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Panel 1: Hypervisor Configuration */}
                <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/50 space-y-3">
                  <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Hypervisor Environment</h4>
                  <div className="space-y-2.5 text-xs">
                    <div className="flex justify-between py-1 border-b border-slate-200">
                      <span className="text-slate-500 font-medium">Hypervisor Platform:</span>
                      <span className="font-semibold text-slate-900">{hypervisor}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-200">
                      <span className="text-slate-500 font-medium">Installed Version / Build:</span>
                      <span className="font-mono font-medium text-slate-800">{server.hypervisorVersion || 'ESXi 8.0 Update 2'}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-200">
                      <span className="text-slate-500 font-medium">Hardware Vendor:</span>
                      <span className="font-semibold text-slate-900">{vendor} ({server.model})</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-200">
                      <span className="text-slate-500 font-medium">Datacenter Cluster:</span>
                      <span className="font-mono text-slate-800">{server.cluster}</span>
                    </div>
                    <div className="flex justify-between py-1">
                      <span className="text-slate-500 font-medium">Active Guest VMs:</span>
                      <span className="font-mono font-bold text-slate-900">
                        {server.activeVmsCount || 0} instances
                      </span>
                    </div>
                  </div>
                </div>

                {/* Panel 2: Host Operations & Evacuation Control */}
                <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/50 space-y-3 flex flex-col justify-between">
                  <div>
                    <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-2">
                      Hypervisor Maintenance State
                    </h4>
                    <p className="text-xs text-slate-600 mb-3 leading-relaxed">
                      Toggle hypervisor maintenance mode to simulate live migration of active guest virtual machines across the cluster before flashing component firmware.
                    </p>
                  </div>

                  <div className="space-y-2 pt-2 border-t border-slate-200">
                    <button
                      type="button"
                      id="btn-modal-toggle-hypervisor-maint"
                      onClick={handleToggleHostMaintenance}
                      className={`w-full py-2.5 px-4 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition-all shadow-xs ${
                        server.hypervisorMaintenanceMode
                          ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                          : 'bg-amber-600 hover:bg-amber-700 text-white'
                      }`}
                    >
                      <Activity className="w-4 h-4" />
                      <span>
                        {server.hypervisorMaintenanceMode
                          ? 'Exit Maintenance Mode (Return to Cluster Pool)'
                          : 'Evacuate Host & Enter Maintenance Mode'}
                      </span>
                    </button>
                    <p className="text-[11px] text-slate-400 text-center font-mono">
                      Target Hypervisor API: {hypervisor === 'Xen Server' ? 'xe host-evacuate' : hypervisor.includes('Nutanix') ? 'acli host.enter_maintenance_mode' : 'vim-cmd hostsvc/maintenance_mode_enter'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Vendor Specific Redfish & Hypervisor Integration Notes */}
              <div className="bg-slate-900 text-slate-200 rounded-xl p-4 text-xs font-mono space-y-2 border border-slate-800">
                <div className="text-indigo-400 font-bold uppercase text-[10px] tracking-wider">
                  Hardware Vendor + Hypervisor Out-of-Band Integration
                </div>
                <div className="text-slate-300 space-y-1 text-[11px]">
                  {vendor === 'HP' && (
                    <p>• HP iLO5/iLO6 Redfish OEM Provider: Integrated with VMware vSphere Lifecycle Manager (vLCM) & HPE OneView Provider.</p>
                  )}
                  {vendor === 'DELL' && (
                    <p>• Dell iDRAC9 + Lifecycle Controller: Out-of-band firmware staging via Dell OpenManage Integration for VMware vCenter (OMIVV).</p>
                  )}
                  {vendor === 'LENOVO' && (
                    <p>• Lenovo XClarity Controller (XCC): Synchronized with Lenovo XClarity Integrator (LXCI) for ESXi / XenServer compliance.</p>
                  )}
                  <p className="text-slate-400">• Cluster Hypervisor: {hypervisor} | Host Management IP: {server.ip} | BMC IP: {server.bmcIp}</p>
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: MAINTENANCE & DIAGNOSTICS */}
          {activeTab === 'maintenance' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Hardware Telemetry & IPMI Diagnostics</h3>
                  <p className="text-xs text-slate-500">Live chassis sensors, thermal readings, and power controls.</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Power & Thermal */}
                <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/50 space-y-3">
                  <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Power & Chassis Thermal Sensors</h4>
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between py-1 border-b border-slate-200">
                      <span className="text-slate-600">Active Power Draw:</span>
                      <span className="font-mono font-bold text-slate-900">284 Watts (80 Plus Titanium)</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-200">
                      <span className="text-slate-600">CPU Package 0 Temp:</span>
                      <span className="font-mono text-emerald-600 font-semibold">41°C (Safe limit: 88°C)</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-200">
                      <span className="text-slate-600">CPU Package 1 Temp:</span>
                      <span className="font-mono text-emerald-600 font-semibold">43°C (Safe limit: 88°C)</span>
                    </div>
                    <div className="flex justify-between py-1">
                      <span className="text-slate-600">System Fan Speed:</span>
                      <span className="font-mono text-slate-800">4,800 RPM (Duty cycle 35%)</span>
                    </div>
                  </div>
                </div>

                {/* Chassis Control Actions */}
                <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/50">
                  <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-2">Chassis & Power Control</h4>
                  <div className="space-y-2">
                    <button
                      type="button"
                      onClick={() => setConsoleLogMessage('ACPI graceful warm reboot command dispatched via IPMI / Redfish.')}
                      className="w-full text-left px-3 py-2 bg-white border border-slate-200 rounded-lg hover:bg-slate-100 text-xs font-medium text-slate-800 flex items-center justify-between"
                    >
                      <span>Graceful OS Reboot (ACPI Signal)</span>
                      <Power className="w-3.5 h-3.5 text-slate-500" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setConsoleLogMessage('BMC cold reset signal dispatched to out-of-band controller.')}
                      className="w-full text-left px-3 py-2 bg-white border border-slate-200 rounded-lg hover:bg-slate-100 text-xs font-medium text-slate-800 flex items-center justify-between"
                    >
                      <span>Reset BMC Out-of-Band Controller</span>
                      <RefreshCw className="w-3.5 h-3.5 text-slate-500" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setConsoleLogMessage('Host chassis LED set to identify (Blinking blue).')}
                      className="w-full text-left px-3 py-2 bg-white border border-slate-200 rounded-lg hover:bg-slate-100 text-xs font-medium text-slate-800 flex items-center justify-between"
                    >
                      <span>Blink Rack Chassis Identify LED</span>
                      <Sparkles className="w-3.5 h-3.5 text-slate-500" />
                    </button>
                  </div>
                  {consoleLogMessage && (
                    <p className="mt-2 text-[11px] text-emerald-700 font-mono bg-emerald-50 p-2 rounded-md border border-emerald-200">
                      ✓ {consoleLogMessage}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
          <div className="font-mono text-[11px]">
            Server ID: {server.id} • Model: {server.model}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-lg font-medium transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
