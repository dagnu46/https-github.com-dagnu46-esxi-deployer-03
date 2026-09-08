import React, { useState, useEffect } from 'react';
import { 
  X, 
  Play, 
  Server as ServerIcon, 
  Layers, 
  ShieldCheck, 
  AlertTriangle, 
  Clock, 
  CheckCircle2, 
  ChevronRight, 
  ChevronLeft,
  Settings,
  Cpu
} from 'lucide-react';
import { Server, FirmwarePackage, ComponentType, ComponentFirmware } from '../types';

interface UpgradeWizardModalProps {
  isOpen: boolean;
  onClose: () => void;
  servers: Server[];
  packages: FirmwarePackage[];
  preSelectedServerIds?: string[];
  preSelectedComponent?: ComponentType;
  onStartCampaign: (
    title: string,
    targetComponent: ComponentType | 'FULL_BASELINE',
    targetFirmwareId: string | undefined,
    selectedServers: Server[],
    concurrency: number,
    autoReboot: boolean,
    stopOnFailure: boolean,
    preflight: boolean
  ) => void;
}

export const UpgradeWizardModal: React.FC<UpgradeWizardModalProps> = ({
  isOpen,
  onClose,
  servers,
  packages,
  preSelectedServerIds = [],
  preSelectedComponent,
  onStartCampaign,
}) => {
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);

  // Form selections
  const [selectedServerIds, setSelectedServerIds] = useState<string[]>([]);
  const [targetComponent, setTargetComponent] = useState<ComponentType | 'FULL_BASELINE'>(
    preSelectedComponent || 'BIOS'
  );
  const [selectedPackageId, setSelectedPackageId] = useState<string>('');
  
  // Strategy settings
  const [concurrency, setConcurrency] = useState<number>(2);
  const [autoReboot, setAutoReboot] = useState<boolean>(true);
  const [stopOnFailure, setStopOnFailure] = useState<boolean>(true);
  const [preflightChecks, setPreflightChecks] = useState<boolean>(true);
  const [campaignTitle, setCampaignTitle] = useState<string>('');

  useEffect(() => {
    if (isOpen) {
      if (preSelectedServerIds.length > 0) {
        setSelectedServerIds(preSelectedServerIds);
      } else {
        // By default select all servers that need this component update
        const needUpdate = servers.filter(s => {
          if (targetComponent === 'FULL_BASELINE') {
            return (Object.values(s.components) as ComponentFirmware[]).some(c => c.status !== 'up_to_date');
          }
          return s.components[targetComponent]?.status !== 'up_to_date';
        }).map(s => s.id);
        setSelectedServerIds(needUpdate.length > 0 ? needUpdate : servers.map(s => s.id));
      }

      if (preSelectedComponent) {
        setTargetComponent(preSelectedComponent);
      }
      setStep(1);
    }
  }, [isOpen, preSelectedServerIds, preSelectedComponent]);

  useEffect(() => {
    if (targetComponent !== 'FULL_BASELINE') {
      const matchingPkg = packages.find(p => p.component === targetComponent);
      if (matchingPkg) {
        setSelectedPackageId(matchingPkg.id);
      }
    }
  }, [targetComponent, packages]);

  if (!isOpen) return null;

  const targetPkg = packages.find(p => p.id === selectedPackageId);
  const chosenServers = servers.filter(s => selectedServerIds.includes(s.id));

  // Toggle server selection
  const handleToggleServer = (id: string) => {
    if (selectedServerIds.includes(id)) {
      setSelectedServerIds(selectedServerIds.filter(s => s !== id));
    } else {
      setSelectedServerIds([...selectedServerIds, id]);
    }
  };

  const handleSelectAllNeedingUpdate = () => {
    const ids = servers.filter(s => {
      if (targetComponent === 'FULL_BASELINE') {
        return (Object.values(s.components) as ComponentFirmware[]).some(c => c.status !== 'up_to_date');
      }
      return s.components[targetComponent]?.status !== 'up_to_date';
    }).map(s => s.id);
    setSelectedServerIds(ids);
  };

  const handleLaunch = () => {
    const defaultTitle = campaignTitle || `Fleet ${targetComponent} Rolling Upgrade (${chosenServers.length} nodes)`;
    onStartCampaign(
      defaultTitle,
      targetComponent,
      selectedPackageId,
      chosenServers,
      concurrency,
      autoReboot,
      stopOnFailure,
      preflightChecks
    );
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="relative bg-white rounded-2xl shadow-2xl max-w-3xl w-full flex flex-col border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold">Launch Firmware Upgrade Campaign</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Automated multi-server staging, pre-flight verification, and rolling flash orchestration
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Step Indicator */}
        <div className="px-6 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-xs">
          <div className={`flex items-center gap-2 font-semibold ${step >= 1 ? 'text-indigo-600' : 'text-slate-400'}`}>
            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[11px] ${step >= 1 ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-600'}`}>1</span>
            <span>Target Servers ({chosenServers.length})</span>
          </div>
          <ChevronRight className="w-3.5 h-3.5 text-slate-300" />
          <div className={`flex items-center gap-2 font-semibold ${step >= 2 ? 'text-indigo-600' : 'text-slate-400'}`}>
            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[11px] ${step >= 2 ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-600'}`}>2</span>
            <span>Firmware Binary</span>
          </div>
          <ChevronRight className="w-3.5 h-3.5 text-slate-300" />
          <div className={`flex items-center gap-2 font-semibold ${step >= 3 ? 'text-indigo-600' : 'text-slate-400'}`}>
            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[11px] ${step >= 3 ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-600'}`}>3</span>
            <span>Rollout Strategy</span>
          </div>
          <ChevronRight className="w-3.5 h-3.5 text-slate-300" />
          <div className={`flex items-center gap-2 font-semibold ${step >= 4 ? 'text-indigo-600' : 'text-slate-400'}`}>
            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[11px] ${step >= 4 ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-600'}`}>4</span>
            <span>Review & Deploy</span>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 max-h-[60vh] overflow-y-auto">
          {/* STEP 1: TARGET SERVERS */}
          {step === 1 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Select Servers for Upgrade</h3>
                  <p className="text-xs text-slate-500">Pick which physical server nodes will receive the flash job.</p>
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    type="button"
                    onClick={handleSelectAllNeedingUpdate}
                    className="text-xs text-indigo-600 hover:text-indigo-800 font-medium underline"
                  >
                    Select All Outdated Nodes
                  </button>
                  <span>•</span>
                  <button
                    type="button"
                    onClick={() => setSelectedServerIds(servers.map(s => s.id))}
                    className="text-xs text-slate-600 hover:text-slate-900 font-medium"
                  >
                    Select All
                  </button>
                </div>
              </div>

              {/* Server List */}
              <div className="divide-y divide-slate-200 border border-slate-200 rounded-xl overflow-hidden max-h-80 overflow-y-auto">
                {servers.map(server => {
                  const isSelected = selectedServerIds.includes(server.id);
                  const compStatus = targetComponent !== 'FULL_BASELINE'
                    ? server.components[targetComponent]?.status
                    : 'update_available';

                  return (
                    <div
                      key={server.id}
                      onClick={() => handleToggleServer(server.id)}
                      className={`p-3 flex items-center justify-between text-xs cursor-pointer transition-colors ${
                        isSelected ? 'bg-indigo-50/60' : 'hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center space-x-3">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleToggleServer(server.id)}
                          className="rounded-sm border-slate-300 text-indigo-600 w-4 h-4 cursor-pointer"
                        />
                        <div>
                          <div className="flex items-center space-x-2">
                            <span className="font-bold text-slate-900 font-mono">{server.hostname}</span>
                            <span className={`px-1.5 py-0.2 rounded text-[9px] font-bold ${
                              (server.vendor || (server.model?.includes('Dell') ? 'DELL' : server.model?.includes('Lenovo') ? 'LENOVO' : 'HP')) === 'HP' ? 'bg-emerald-100 text-emerald-800' :
                              (server.vendor || (server.model?.includes('Dell') ? 'DELL' : server.model?.includes('Lenovo') ? 'LENOVO' : 'HP')) === 'DELL' ? 'bg-blue-100 text-blue-800' :
                              'bg-red-100 text-red-800'
                            }`}>
                              {server.vendor || (server.model?.includes('Dell') ? 'DELL' : server.model?.includes('Lenovo') ? 'LENOVO' : 'HP')}
                            </span>
                            <span className="text-[11px] text-slate-500">{server.model}</span>
                            {server.hypervisorMaintenanceMode ? (
                              <span className="px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800 text-[9px] font-semibold">
                                Evacuated (Safe)
                              </span>
                            ) : (server.activeVmsCount || 0) > 0 ? (
                              <span className="px-1.5 py-0.2 rounded bg-amber-100 text-amber-800 text-[9px] font-medium">
                                {server.activeVmsCount} VMs Running
                              </span>
                            ) : null}
                          </div>
                          <div className="text-[11px] text-slate-500 font-mono flex items-center gap-1.5 mt-0.5">
                            <span className="text-indigo-600 font-medium">
                              {server.hypervisor || 'VMware ESXi'}
                            </span>
                            <span>•</span>
                            <span>{server.datacenter} ({server.rack})</span>
                            <span>•</span>
                            <span>BMC: {server.bmcIp}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center space-x-3 font-mono">
                        {targetComponent !== 'FULL_BASELINE' && server.components[targetComponent] && (
                          <div className="text-right">
                            <span className="text-slate-500">Current: </span>
                            <span className="font-bold text-slate-800">
                              {server.components[targetComponent].currentVersion}
                            </span>
                            {server.components[targetComponent].status !== 'up_to_date' && (
                              <span className="ml-2 px-1.5 py-0.2 rounded-sm bg-indigo-100 text-indigo-700 text-[10px] font-bold">
                                Update
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* STEP 2: FIRMWARE BINARY */}
          {step === 2 && (
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Choose Component & Firmware Binary</h3>
                <p className="text-xs text-slate-500">Specify which hardware component to flash across chosen nodes.</p>
              </div>

              {/* Component selection pills */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {(['BIOS', 'BMC', 'NIC', 'RAID', 'NVMe'] as ComponentType[]).map(comp => (
                  <button
                    key={comp}
                    type="button"
                    onClick={() => setTargetComponent(comp)}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      targetComponent === comp
                        ? 'border-indigo-600 bg-indigo-50/50 ring-2 ring-indigo-500/20'
                        : 'border-slate-200 hover:border-slate-300 bg-white'
                    }`}
                  >
                    <div className="font-bold text-slate-900 text-xs">{comp}</div>
                    <div className="text-[11px] text-slate-500 mt-0.5">
                      {comp === 'BIOS' && 'System ROM / UEFI'}
                      {comp === 'BMC' && 'iDRAC9 / iLO 5 Controller'}
                      {comp === 'NIC' && 'Mellanox ConnectX-6 100G'}
                      {comp === 'RAID' && 'PERC / SmartArray Controller'}
                      {comp === 'NVMe' && 'Enterprise SSD Microcode'}
                    </div>
                  </button>
                ))}
              </div>

              {/* Matching Packages */}
              <div className="mt-4">
                <label className="block text-xs font-semibold text-slate-700 mb-2">
                  Select Certified Binary Package:
                </label>
                <div className="space-y-2">
                  {packages
                    .filter(p => targetComponent === 'FULL_BASELINE' || p.component === targetComponent)
                    .map(pkg => (
                      <div
                        key={pkg.id}
                        onClick={() => setSelectedPackageId(pkg.id)}
                        className={`p-3 rounded-xl border cursor-pointer transition-all flex items-center justify-between ${
                          selectedPackageId === pkg.id
                            ? 'border-indigo-600 bg-indigo-50/50 ring-1 ring-indigo-600'
                            : 'border-slate-200 hover:border-slate-300 bg-white'
                        }`}
                      >
                        <div>
                          <div className="flex items-center space-x-2">
                            <span className="font-bold text-slate-900 text-xs">{pkg.name}</span>
                            <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-mono text-[11px] font-bold">
                              v{pkg.version}
                            </span>
                          </div>
                          <p className="text-xs text-slate-500 mt-1">{pkg.releaseNotes}</p>
                          <div className="mt-1 text-[11px] font-mono text-slate-400">
                            File: {pkg.fileName} ({pkg.fileSizeMb} MB) • SHA-256 Verified
                          </div>
                        </div>

                        <div className="w-5 h-5 rounded-full border flex items-center justify-center shrink-0 ml-4">
                          {selectedPackageId === pkg.id && (
                            <div className="w-3 h-3 rounded-full bg-indigo-600" />
                          )}
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: ROLLOUT STRATEGY */}
          {step === 3 && (
            <div className="space-y-5">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Configure Rollout Safety & Orchestration</h3>
                <p className="text-xs text-slate-500">Fine-tune concurrency batching and automated pre-flight checks.</p>
              </div>

              {/* Concurrency selector */}
              <div>
                <label className="block text-xs font-semibold text-slate-800 mb-1.5">
                  Concurrency Limit (Batch Size)
                </label>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { value: 1, label: 'Serial (1 by 1)', desc: 'Safest for DB primary/replicas' },
                    { value: 2, label: '2 Concurrent', desc: 'Standard rolling batch' },
                    { value: 4, label: '4 Concurrent', desc: 'Accelerated cluster update' },
                  ].map(opt => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setConcurrency(opt.value)}
                      className={`p-3 rounded-xl border text-left transition-all ${
                        concurrency === opt.value
                          ? 'border-indigo-600 bg-indigo-50/50 ring-2 ring-indigo-500/20'
                          : 'border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <div className="font-bold text-slate-900 text-xs">{opt.label}</div>
                      <div className="text-[11px] text-slate-500 mt-0.5">{opt.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Toggles */}
              <div className="space-y-3 pt-2">
                <label className="flex items-start space-x-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={preflightChecks}
                    onChange={e => setPreflightChecks(e.target.checked)}
                    className="mt-0.5 rounded-sm border-slate-300 text-indigo-600 w-4 h-4"
                  />
                  <div>
                    <span className="text-xs font-bold text-slate-800">Enforce Automated Pre-flight Health Checks</span>
                    <p className="text-xs text-slate-500">
                      Verifies Redfish BMC connectivity, checks dual PSU power redundancy, and confirms OS maintenance agent heartbeat before flashing.
                    </p>
                  </div>
                </label>

                <label className="flex items-start space-x-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={autoReboot}
                    onChange={e => setAutoReboot(e.target.checked)}
                    className="mt-0.5 rounded-sm border-slate-300 text-indigo-600 w-4 h-4"
                  />
                  <div>
                    <span className="text-xs font-bold text-slate-800">Trigger Warm Chassis Reboot When Flashing Completes</span>
                    <p className="text-xs text-slate-500">
                      Issues an ACPI graceful restart to latch new BIOS/NIC microcode. If disabled, firmware remains staged in pending state until next reboot.
                    </p>
                  </div>
                </label>

                <label className="flex items-start space-x-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={stopOnFailure}
                    onChange={e => setStopOnFailure(e.target.checked)}
                    className="mt-0.5 rounded-sm border-slate-300 text-indigo-600 w-4 h-4"
                  />
                  <div>
                    <span className="text-xs font-bold text-slate-800">Halt Rollout Immediately If Any Server Fails</span>
                    <p className="text-xs text-slate-500">
                      Prevents fleet-wide outage if a corrupted package or vendor regression occurs during the first node flash.
                    </p>
                  </div>
                </label>
              </div>

              {/* Campaign Title */}
              <div>
                <label className="block text-xs font-semibold text-slate-800 mb-1">
                  Campaign Title / Reference Note
                </label>
                <input
                  type="text"
                  placeholder="e.g. Q3 2026 Fleet Security Errata Patch (CVE-2026-21340)"
                  value={campaignTitle}
                  onChange={e => setCampaignTitle(e.target.value)}
                  className="w-full text-xs p-2.5 border border-slate-200 rounded-lg bg-slate-50 focus:bg-white"
                />
              </div>
            </div>
          )}

          {/* STEP 4: REVIEW & CONFIRM */}
          {step === 4 && (
            <div className="space-y-4">
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-start space-x-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                <div className="text-xs text-emerald-950">
                  <h4 className="font-bold">Ready to Execute Orchestrated Upgrade</h4>
                  <p className="mt-0.5 text-emerald-800">
                    All target nodes have passed compatibility matrix checks. Payloads are ready for Redfish streaming.
                  </p>
                </div>
              </div>

              {/* Summary details */}
              <div className="border border-slate-200 rounded-xl p-4 space-y-2.5 text-xs bg-slate-50/50 font-mono">
                <div className="flex justify-between py-1 border-b border-slate-200">
                  <span className="text-slate-500">Target Component:</span>
                  <span className="font-bold text-slate-900">{targetComponent}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-200">
                  <span className="text-slate-500">Target Firmware Version:</span>
                  <span className="font-bold text-indigo-700">{targetPkg?.version || 'Baseline Target'}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-200">
                  <span className="text-slate-500">Target Servers:</span>
                  <span className="font-bold text-slate-900">{chosenServers.length} nodes</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-200">
                  <span className="text-slate-500">Concurrency Policy:</span>
                  <span className="font-bold text-slate-900">{concurrency} nodes at a time</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-200">
                  <span className="text-slate-500">Auto-Reboot Latching:</span>
                  <span className="font-bold text-slate-900">{autoReboot ? 'Enabled' : 'Staged only (no reboot)'}</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-slate-500">Estimated Total Duration:</span>
                  <span className="font-bold text-slate-900">
                    ~{Math.ceil((chosenServers.length / concurrency) * 1.5)} minutes
                  </span>
                </div>
              </div>

              {/* Target Servers Preview */}
              <div>
                <span className="text-xs font-semibold text-slate-700 block mb-1.5">Nodes in this rollout:</span>
                <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto p-2 bg-slate-100 rounded-lg">
                  {chosenServers.map(s => (
                    <span key={s.id} className="text-[11px] font-mono bg-white px-2 py-0.5 rounded-sm border border-slate-200 text-slate-800">
                      {s.hostname}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Navigation */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <div>
            {step > 1 ? (
              <button
                type="button"
                onClick={() => setStep((step - 1) as any)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-200 transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
                <span>Back</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={onClose}
                className="text-xs font-semibold text-slate-500 hover:text-slate-800"
              >
                Cancel
              </button>
            )}
          </div>

          <div>
            {step < 4 ? (
              <button
                type="button"
                id="btn-wizard-next"
                disabled={step === 1 && chosenServers.length === 0}
                onClick={() => setStep((step + 1) as any)}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors"
              >
                <span>Continue</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                type="button"
                id="btn-confirm-start-campaign"
                onClick={handleLaunch}
                className="inline-flex items-center gap-1.5 px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Start Rollout Campaign</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
