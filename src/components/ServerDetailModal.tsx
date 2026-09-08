import React, { useState } from 'react';
import { 
  X, 
  Server as ServerIcon, 
  Cpu, 
  HardDrive, 
  Wifi, 
  ShieldAlert, 
  CheckCircle2, 
  Play, 
  Terminal, 
  RefreshCw, 
  Power, 
  Layers, 
  ExternalLink,
  Lock,
  Sparkles,
  Edit,
  Trash2
} from 'lucide-react';
import { Server, ComponentType } from '../types';

interface ServerDetailModalProps {
  server: Server | null;
  onClose: () => void;
  onUpgradeComponent: (server: Server, component: ComponentType) => void;
  onUpdateServerStatus: (serverId: string, newStatus: Server['status']) => void;
  onEditServer?: (server: Server) => void;
  onDeleteServer?: (server: Server) => void;
}

export const ServerDetailModal: React.FC<ServerDetailModalProps> = ({
  server,
  onClose,
  onUpgradeComponent,
  onUpdateServerStatus,
  onEditServer,
  onDeleteServer,
}) => {
  const [activeTab, setActiveTab] = useState<'components' | 'console' | 'maintenance'>('components');
  const [consoleLogMessage, setConsoleLogMessage] = useState<string>('');

  if (!server) return null;

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

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="relative bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-lg bg-slate-800 flex items-center justify-center border border-slate-700">
              <ServerIcon className="w-5 h-5 text-indigo-400" />
            </div>
            <div>
              <div className="flex items-center space-x-3">
                <h2 className="text-base font-bold font-mono text-white tracking-tight">{server.hostname}</h2>
                <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold uppercase tracking-wider ${
                  server.status === 'online' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40' :
                  server.status === 'maintenance' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40' :
                  'bg-indigo-500/20 text-indigo-400 border border-indigo-500/40'
                }`}>
                  {server.status}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                {server.model} • {server.datacenter} ({server.rack} / {server.unit})
              </p>
            </div>
          </div>

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
                title="Edit device configuration and current firmware"
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
        <div className="px-6 bg-slate-50 border-b border-slate-200 flex items-center space-x-6 text-xs font-semibold text-slate-600">
          <button
            type="button"
            onClick={() => setActiveTab('components')}
            className={`py-3 border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === 'components' ? 'border-indigo-600 text-indigo-600' : 'border-transparent hover:text-slate-900'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>Firmware Components ({Object.keys(server.components).length})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('console')}
            className={`py-3 border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === 'console' ? 'border-indigo-600 text-indigo-600' : 'border-transparent hover:text-slate-900'
            }`}
          >
            <Terminal className="w-4 h-4" />
            <span>Out-of-Band BMC Console ({server.bmcAffectedType})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('maintenance')}
            className={`py-3 border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === 'maintenance' ? 'border-indigo-600 text-indigo-600' : 'border-transparent hover:text-slate-900'
            }`}
          >
            <Power className="w-4 h-4" />
            <span>Hardware Diagnostics & Power</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
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

                            {/* Version comparison */}
                            <div className="mt-2 flex items-center space-x-2 font-mono text-xs">
                              <span className="text-slate-600">
                                Installed: <strong>{comp.currentVersion}</strong>
                              </span>
                              {!isUpToDate && (
                                <>
                                  <span className="text-slate-400">→</span>
                                  <span className="font-bold text-indigo-600">
                                    Target: {comp.latestVersion}
                                  </span>
                                </>
                              )}
                            </div>

                            {/* CVE Alerts if any */}
                            {comp.cveAlerts && comp.cveAlerts.length > 0 && (
                              <div className="mt-2 flex items-center gap-1.5 text-xs text-amber-800 bg-amber-100 px-2 py-1 rounded-md w-fit">
                                <ShieldAlert className="w-3.5 h-3.5 text-amber-700" />
                                <span className="font-semibold">Security Errata:</span>
                                <span>{comp.cveAlerts.join(', ')}</span>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Action */}
                        <div className="flex items-center space-x-2">
                          {isUpToDate ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-medium">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              Baseline Compliant
                            </span>
                          ) : (
                            <button
                              type="button"
                              id={`btn-flash-comp-${compType}`}
                              onClick={() => onUpgradeComponent(server, compType)}
                              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold shadow-xs transition-colors ${
                                isCritical
                                  ? 'bg-amber-600 hover:bg-amber-700 text-white'
                                  : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                              }`}
                            >
                              <Play className="w-3 h-3 fill-current" />
                              <span>Flash {compType} to {comp.latestVersion}</span>
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {activeTab === 'console' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Out-of-Band Remote Interface</h3>
                  <p className="text-xs text-slate-500">
                    Direct BMC Redfish API connection endpoint: <code className="text-indigo-600 font-mono">https://{server.bmcIp}/redfish/v1</code>
                  </p>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-[11px] font-mono px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-md font-semibold">
                    BMC Link: UP (4ms)
                  </span>
                </div>
              </div>

              {/* Simulated vKVM Terminal View */}
              <div className="bg-slate-950 text-slate-200 rounded-xl p-4 font-mono text-xs border border-slate-800 shadow-inner">
                <div className="flex items-center justify-between pb-2 border-b border-slate-800 text-[11px] text-slate-400">
                  <span>{server.bmcAffectedType} HTML5 Virtual Console — Session #4092</span>
                  <span>1920x1080 @ 60Hz</span>
                </div>
                <div className="pt-3 space-y-1.5 min-h-[220px]">
                  <p className="text-slate-400">[{new Date().toLocaleDateString()}] System Initialized. UEFI 2.7 Specification.</p>
                  <p className="text-emerald-400">BMC POST Sequence: Completed in 3.42s (iDRAC / iLO Ready)</p>
                  <p className="text-slate-300">PCIe Bus enumeration: Slot 1 (ConnectX-6 100GbE), Slot 2 (PERC RAID H755)</p>
                  <p className="text-slate-300">Target host: {server.hostname} [IP: {server.ip}]</p>
                  <p className="text-slate-300">Dual 1400W Titanium Redundant PSUs: AC Input 230V, Draw: 388W</p>
                  <p className="text-indigo-400">Redfish UpdateService: Ready for payload streaming.</p>
                  <div className="mt-4 pt-2 border-t border-slate-800/80 text-slate-500 flex items-center justify-between">
                    <span>Press &lt;F2&gt; System Setup | &lt;F11&gt; Boot Manager | &lt;F12&gt; PXE Boot</span>
                    <span className="text-emerald-500">Host OS: Running</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'maintenance' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Diagnostics */}
                <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/50">
                  <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-2">Hardware Telemetry</h4>
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between py-1 border-b border-slate-200">
                      <span className="text-slate-500">Power Supply Redundancy:</span>
                      <span className={`font-semibold ${server.powerSupplyRedundancy ? 'text-emerald-600' : 'text-amber-600'}`}>
                        {server.powerSupplyRedundancy ? 'Dual Redundant OK' : 'Degraded (Single Feed)'}
                      </span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-200">
                      <span className="text-slate-500">Chassis Intrusion Switch:</span>
                      <span className="font-semibold text-slate-800">Closed (Normal)</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-200">
                      <span className="text-slate-500">System Thermal Status:</span>
                      <span className="font-semibold text-emerald-600">28°C Ambient / 52°C CPU Package</span>
                    </div>
                    <div className="flex justify-between py-1">
                      <span className="text-slate-500">Last Cold Reboot:</span>
                      <span className="font-mono text-slate-700">{server.lastUpgradeDate || '2026-03-12'}</span>
                    </div>
                  </div>
                </div>

                {/* Chassis Control Actions */}
                <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/50">
                  <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-2">Chassis & Power Control</h4>
                  <div className="space-y-2">
                    <button
                      type="button"
                      onClick={() => setConsoleLogMessage('Simulated ACPI graceful warm reboot sent via IPMI.')}
                      className="w-full text-left px-3 py-2 bg-white border border-slate-200 rounded-lg hover:bg-slate-100 text-xs font-medium text-slate-800 flex items-center justify-between"
                    >
                      <span>Graceful OS Reboot (ACPI Signal)</span>
                      <Power className="w-3.5 h-3.5 text-slate-500" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setConsoleLogMessage('Simulated BMC cold reset signal sent.')}
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
            Server ID: {server.id} • UUID: 4c4c4544-004a-4a10-8032-b7c04f535832
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
