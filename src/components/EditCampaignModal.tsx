import React, { useState, useEffect } from 'react';
import { 
  X, 
  Save, 
  Settings2, 
  Server as ServerIcon, 
  ShieldCheck, 
  AlertTriangle, 
  Cpu, 
  Layers, 
  RotateCcw, 
  CheckCircle2, 
  Plus, 
  Trash2, 
  ArrowUp, 
  ArrowDown, 
  FileCode, 
  Wifi, 
  HardDrive,
  Check
} from 'lucide-react';
import { 
  UpgradeCampaign, 
  Server, 
  ComponentType, 
  UpgradeJobServerProgress, 
  CampaignFirmwareTask, 
  FirmwarePackage 
} from '../types';

interface EditCampaignModalProps {
  isOpen: boolean;
  onClose: () => void;
  campaign: UpgradeCampaign | null;
  fleetServers: Server[];
  packages?: FirmwarePackage[];
  onSaveCampaign: (updatedCampaign: UpgradeCampaign) => void;
}

export const EditCampaignModal: React.FC<EditCampaignModalProps> = ({
  isOpen,
  onClose,
  campaign,
  fleetServers,
  packages = [],
  onSaveCampaign,
}) => {
  const [title, setTitle] = useState('');
  const [concurrencyLimit, setConcurrencyLimit] = useState(2);
  const [autoReboot, setAutoReboot] = useState(true);
  const [stopOnFirstFailure, setStopOnFirstFailure] = useState(true);
  const [preflightChecksRequired, setPreflightChecksRequired] = useState(true);
  const [selectedServerIds, setSelectedServerIds] = useState<string[]>([]);
  
  // Ranked firmware tasks with ordering
  const [tasks, setTasks] = useState<CampaignFirmwareTask[]>([]);
  const [isAddingTask, setIsAddingTask] = useState(false);
  const [selectedPackageToAdd, setSelectedPackageToAdd] = useState<string>('');
  const [customComponent, setCustomComponent] = useState<ComponentType>('BIOS');
  const [customVersion, setCustomVersion] = useState<string>('2.18.1');

  useEffect(() => {
    if (campaign && isOpen) {
      setTitle(campaign.title);
      setConcurrencyLimit(campaign.concurrencyLimit || 2);
      setAutoReboot(campaign.autoReboot !== false);
      setStopOnFirstFailure(campaign.stopOnFirstFailure !== false);
      setPreflightChecksRequired(campaign.preflightChecksRequired !== false);
      setSelectedServerIds(campaign.servers.map(s => s.serverId));

      // Load or initialize ordered tasks
      if (campaign.tasks && campaign.tasks.length > 0) {
        setTasks([...campaign.tasks].sort((a, b) => a.order - b.order));
      } else {
        // Fallback initial task from current campaign target
        const comp = campaign.targetComponent === 'FULL_BASELINE' ? 'BIOS' : campaign.targetComponent;
        const matchingPkg = packages.find(p => p.component === comp);
        setTasks([
          {
            id: `task-${Date.now()}-1`,
            order: 1,
            component: comp,
            packageId: campaign.targetFirmwareId || matchingPkg?.id,
            packageName: matchingPkg?.name || `${comp} Baseline Upgrade`,
            targetVersion: matchingPkg?.version || '2.18.1',
            rebootRequired: matchingPkg?.rebootRequired ?? true,
          }
        ]);
      }
      setIsAddingTask(false);
    }
  }, [campaign, isOpen, packages]);

  if (!isOpen || !campaign) return null;

  const handleToggleServer = (serverId: string) => {
    if (selectedServerIds.includes(serverId)) {
      if (selectedServerIds.length <= 1) {
        return; // Keep at least one server
      }
      setSelectedServerIds(selectedServerIds.filter(id => id !== serverId));
    } else {
      setSelectedServerIds([...selectedServerIds, serverId]);
    }
  };

  // Reordering helpers
  const handleMoveUp = (index: number) => {
    if (index === 0) return;
    const newTasks = [...tasks];
    const temp = newTasks[index - 1];
    newTasks[index - 1] = newTasks[index];
    newTasks[index] = temp;
    // Re-assign 1-based order numbers
    newTasks.forEach((t, i) => { t.order = i + 1; });
    setTasks(newTasks);
  };

  const handleMoveDown = (index: number) => {
    if (index === tasks.length - 1) return;
    const newTasks = [...tasks];
    const temp = newTasks[index + 1];
    newTasks[index + 1] = newTasks[index];
    newTasks[index] = temp;
    // Re-assign 1-based order numbers
    newTasks.forEach((t, i) => { t.order = i + 1; });
    setTasks(newTasks);
  };

  const handleRemoveTask = (taskId: string) => {
    if (tasks.length <= 1) {
      alert('A rollout campaign must include at least 1 firmware task.');
      return;
    }
    const newTasks = tasks.filter(t => t.id !== taskId);
    newTasks.forEach((t, i) => { t.order = i + 1; });
    setTasks(newTasks);
  };

  const handleAddTaskFromPackage = (pkgId: string) => {
    const pkg = packages.find(p => p.id === pkgId);
    if (!pkg) return;

    const newTask: CampaignFirmwareTask = {
      id: `task-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      order: tasks.length + 1,
      component: pkg.component,
      packageId: pkg.id,
      packageName: pkg.name,
      targetVersion: pkg.version,
      rebootRequired: pkg.rebootRequired,
    };

    setTasks([...tasks, newTask]);
    setIsAddingTask(false);
    setSelectedPackageToAdd('');
  };

  const handleAddCustomTask = () => {
    const newTask: CampaignFirmwareTask = {
      id: `task-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      order: tasks.length + 1,
      component: customComponent,
      packageName: `${customComponent} Update to ${customVersion}`,
      targetVersion: customVersion,
      rebootRequired: true,
    };

    setTasks([...tasks, newTask]);
    setIsAddingTask(false);
  };

  const getComponentIcon = (comp: ComponentType) => {
    switch (comp) {
      case 'BIOS': return <Cpu className="w-3.5 h-3.5 text-blue-600" />;
      case 'BMC': return <ServerIcon className="w-3.5 h-3.5 text-indigo-600" />;
      case 'NIC': return <Wifi className="w-3.5 h-3.5 text-emerald-600" />;
      case 'RAID': return <HardDrive className="w-3.5 h-3.5 text-purple-600" />;
      case 'NVMe': return <HardDrive className="w-3.5 h-3.5 text-cyan-600" />;
      default: return <Layers className="w-3.5 h-3.5 text-amber-600" />;
    }
  };

  const handleSave = () => {
    const sortedTasks = [...tasks].sort((a, b) => a.order - b.order);
    sortedTasks.forEach((t, i) => { t.order = i + 1; });

    // Build or update servers
    const existingServerMap = new Map<string, UpgradeJobServerProgress>(campaign.servers.map(s => [s.serverId, s]));
    const firstTask = sortedTasks[0];

    const updatedServers: UpgradeJobServerProgress[] = selectedServerIds.map(srvId => {
      const fleetServer = fleetServers.find(s => s.id === srvId);
      const hostname = fleetServer?.hostname || `node-${srvId}`;

      if (existingServerMap.has(srvId)) {
        const existing = existingServerMap.get(srvId)!;
        return {
          ...existing,
          totalTasksCount: sortedTasks.length,
          currentTaskIndex: existing.currentTaskIndex || 0,
        };
      }
      
      const fromVer = firstTask && fleetServer?.components[firstTask.component]?.currentVersion || '1.0.0';
      const toVer = firstTask?.targetVersion || '2.0.0';

      return {
        serverId: srvId,
        hostname,
        component: firstTask ? firstTask.component : 'BIOS',
        fromVersion: fromVer,
        toVersion: toVer,
        stage: 'pending',
        progressPercent: 0,
        currentStepMessage: `Queued in rollout pipeline (Task 1 of ${sortedTasks.length})`,
        currentTaskIndex: 0,
        completedTasksCount: 0,
        totalTasksCount: sortedTasks.length,
        networkStatus: 'untested',
        ipmiStatus: 'untested',
        credentialsStatus: 'untested',
        logs: [
          {
            timestamp: new Date().toLocaleTimeString(),
            level: 'info',
            message: `Added to rollout "${title.trim()}". Multi-task sequence configured (${sortedTasks.length} firmware tasks).`,
          },
        ],
      };
    });

    const updatedCampaign: UpgradeCampaign = {
      ...campaign,
      title: title.trim() || campaign.title,
      concurrencyLimit,
      autoReboot,
      stopOnFirstFailure,
      preflightChecksRequired,
      tasks: sortedTasks,
      targetComponent: sortedTasks.length > 1 ? 'FULL_BASELINE' : (sortedTasks[0]?.component || 'BIOS'),
      targetFirmwareId: sortedTasks[0]?.packageId || campaign.targetFirmwareId,
      servers: updatedServers,
      updatedAt: new Date().toISOString(),
    };

    onSaveCampaign(updatedCampaign);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="relative bg-white rounded-2xl shadow-2xl max-w-3xl w-full flex flex-col border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-indigo-400">
              <Settings2 className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold">Active Rollout Settings & Configuration</h2>
              <p className="text-xs text-slate-400">
                Configure multiple firmware tasks by ranked order, concurrency, and target server nodes.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6 max-h-[78vh] overflow-y-auto">
          {/* Campaign Title */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Rollout Campaign Title
            </label>
            <input
              type="text"
              id="edit-campaign-title"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="e.g., Critical BIOS, BMC & NIC Multi-Firmware Fleet Rollout"
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 focus:bg-white font-medium"
            />
          </div>

          {/* MULTI-FIRMWARE RANKED TASKS ORDERING SECTION */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <Layers className="w-4 h-4 text-indigo-600" />
                  <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                    Firmware Execution Sequence (Ranked Tasks Ordering)
                  </h4>
                  <span className="px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800 text-[10px] font-bold font-mono">
                    {tasks.length} Ranked Tasks
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Tasks execute sequentially on each server node in strict rank order (Task 1 verifies before Task 2 begins).
                </p>
              </div>

              {!isAddingTask && (
                <button
                  type="button"
                  id="btn-add-firmware-task"
                  onClick={() => setIsAddingTask(true)}
                  className="inline-flex items-center gap-1 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold transition-colors shadow-xs"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Firmware Task</span>
                </button>
              )}
            </div>

            {/* Task Cards in Sequence */}
            <div className="space-y-2">
              {tasks.map((task, idx) => (
                <div 
                  key={task.id}
                  className="flex items-center justify-between p-3 bg-white border border-slate-200 rounded-lg shadow-2xs hover:border-slate-300 transition-colors"
                >
                  <div className="flex items-center space-x-3">
                    {/* Rank Badge */}
                    <div className="flex items-center justify-center w-7 h-7 rounded-full bg-slate-900 text-white font-mono text-xs font-bold shrink-0">
                      #{task.order}
                    </div>

                    <div className="p-1.5 rounded-md bg-slate-100 border border-slate-200 shrink-0">
                      {getComponentIcon(task.component)}
                    </div>

                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-900">{task.component} Firmware</span>
                        <span className="font-mono text-xs font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-1.5 py-0.2 rounded">
                          v{task.targetVersion}
                        </span>
                        {task.rebootRequired && (
                          <span className="text-[10px] text-slate-500 bg-slate-100 px-1.5 py-0.2 rounded">
                            Reboot Required
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500 truncate max-w-sm">
                        {task.packageName || `Target payload for ${task.component}`}
                      </p>
                    </div>
                  </div>

                  {/* Ordering & Delete Controls */}
                  <div className="flex items-center space-x-1">
                    <button
                      type="button"
                      onClick={() => handleMoveUp(idx)}
                      disabled={idx === 0}
                      className="p-1.5 rounded hover:bg-slate-100 text-slate-600 disabled:opacity-30 transition-colors"
                      title="Move Up in Rank Order"
                    >
                      <ArrowUp className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleMoveDown(idx)}
                      disabled={idx === tasks.length - 1}
                      className="p-1.5 rounded hover:bg-slate-100 text-slate-600 disabled:opacity-30 transition-colors"
                      title="Move Down in Rank Order"
                    >
                      <ArrowDown className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRemoveTask(task.id)}
                      disabled={tasks.length <= 1}
                      className="p-1.5 rounded hover:bg-red-50 text-slate-400 hover:text-red-600 disabled:opacity-30 transition-colors ml-1"
                      title="Remove Task"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Add Task Sub-panel */}
            {isAddingTask && (
              <div className="p-3.5 bg-indigo-50/70 border border-indigo-200 rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <h5 className="text-xs font-bold text-indigo-950 flex items-center gap-1.5">
                    <Plus className="w-3.5 h-3.5 text-indigo-600" />
                    Add Firmware to Rollout Sequence (Rank #{tasks.length + 1})
                  </h5>
                  <button
                    type="button"
                    onClick={() => setIsAddingTask(false)}
                    className="text-indigo-600 hover:text-indigo-800 text-xs font-medium"
                  >
                    Cancel
                  </button>
                </div>

                {/* Option 1: Pick from catalog packages */}
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Select from Available Firmware Packages:
                  </label>
                  <div className="flex items-center gap-2">
                    <select
                      value={selectedPackageToAdd}
                      onChange={e => setSelectedPackageToAdd(e.target.value)}
                      className="flex-1 px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="">-- Choose a validated firmware package --</option>
                      {packages.map(p => (
                        <option key={p.id} value={p.id}>
                          [{p.component}] {p.name} (v{p.version}) - {p.vendor}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      disabled={!selectedPackageToAdd}
                      onClick={() => handleAddTaskFromPackage(selectedPackageToAdd)}
                      className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold disabled:opacity-40 transition-colors"
                    >
                      Add to Sequence
                    </button>
                  </div>
                </div>

                {/* Option 2: Define Custom Component & Version */}
                <div className="pt-2 border-t border-indigo-100/80">
                  <span className="text-[10px] text-slate-500 uppercase tracking-wider font-bold">Or define custom task:</span>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-1">
                    <div>
                      <select
                        value={customComponent}
                        onChange={e => setCustomComponent(e.target.value as ComponentType)}
                        className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs"
                      >
                        <option value="BIOS">BIOS / UEFI</option>
                        <option value="BMC">BMC / iDRAC / iLO</option>
                        <option value="NIC">NIC / Network</option>
                        <option value="RAID">RAID / Storage Controller</option>
                        <option value="NVMe">NVMe SSD Firmware</option>
                        <option value="CPLD">CPLD System Board</option>
                        <option value="PSU">PSU Redundant Power</option>
                      </select>
                    </div>
                    <div>
                      <input
                        type="text"
                        placeholder="Target Version (e.g., 2.18.1)"
                        value={customVersion}
                        onChange={e => setCustomVersion(e.target.value)}
                        className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs"
                      />
                    </div>
                    <div>
                      <button
                        type="button"
                        onClick={handleAddCustomTask}
                        className="w-full px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold transition-colors"
                      >
                        Add Custom Task
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Execution Strategy */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Parallel Concurrency Limit
              </label>
              <select
                id="edit-campaign-concurrency"
                value={concurrencyLimit}
                onChange={e => setConcurrencyLimit(Number(e.target.value))}
                className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
              >
                <option value={1}>1 Server (Strict Serial)</option>
                <option value={2}>2 Servers Concurrent</option>
                <option value={3}>3 Servers Concurrent</option>
                <option value={4}>4 Servers Concurrent</option>
                <option value={6}>6 Servers Concurrent</option>
                <option value={8}>8 Servers Concurrent</option>
              </select>
              <p className="text-[11px] text-slate-500 mt-1">
                Controls maximum servers undergoing flash and reboot simultaneously.
              </p>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Execution Model
              </label>
              <div className="px-3.5 py-2 bg-slate-100 border border-slate-200 rounded-lg text-xs font-mono text-slate-800 flex items-center justify-between">
                <span>{tasks.length > 1 ? `Multi-Firmware Pipeline (${tasks.length} Stages)` : `${tasks[0]?.component || 'Single'} Task`}</span>
                <span className="text-[10px] bg-slate-200 px-2 py-0.5 rounded text-slate-600 font-sans font-semibold">Active</span>
              </div>
              <p className="text-[11px] text-slate-500 mt-1">
                Each server node runs tasks in ranked sequence #{tasks.map(t => t.order).join(' → #')}.
              </p>
            </div>
          </div>

          {/* Safety & Reboot Policies */}
          <div className="space-y-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
            <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Safety & Reboot Policies</h4>

            <label className="flex items-start space-x-3 cursor-pointer">
              <input
                type="checkbox"
                id="edit-campaign-preflight"
                checked={preflightChecksRequired}
                onChange={e => setPreflightChecksRequired(e.target.checked)}
                className="mt-0.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
              />
              <div className="text-xs">
                <span className="font-semibold text-slate-800">Mandatory Pre-flight Network & IPMI Checks</span>
                <p className="text-slate-500 text-[11px]">
                  Requires active TCP probe and live BMC/Redfish authentication before any payload staging.
                </p>
              </div>
            </label>

            <label className="flex items-start space-x-3 cursor-pointer">
              <input
                type="checkbox"
                id="edit-campaign-stop-failure"
                checked={stopOnFirstFailure}
                onChange={e => setStopOnFirstFailure(e.target.checked)}
                className="mt-0.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
              />
              <div className="text-xs">
                <span className="font-semibold text-slate-800">Halt Rollout on First Node Failure</span>
                <p className="text-slate-500 text-[11px]">
                  Automatically pauses the entire campaign if any server fails preflight or flash validation.
                </p>
              </div>
            </label>

            <label className="flex items-start space-x-3 cursor-pointer">
              <input
                type="checkbox"
                id="edit-campaign-auto-reboot"
                checked={autoReboot}
                onChange={e => setAutoReboot(e.target.checked)}
                className="mt-0.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
              />
              <div className="text-xs">
                <span className="font-semibold text-slate-800">Automatic Warm Chassis Reboot</span>
                <p className="text-slate-500 text-[11px]">
                  Sends graceful ACPI reboot signal through Redfish to apply firmware changes immediately.
                </p>
              </div>
            </label>
          </div>

          {/* Server Node Selection */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                Target Physical Server Nodes ({selectedServerIds.length} of {fleetServers.length} selected)
              </label>
              <div className="space-x-2">
                <button
                  type="button"
                  onClick={() => setSelectedServerIds(fleetServers.map(s => s.id))}
                  className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold"
                >
                  Select All
                </button>
                <span className="text-slate-300">•</span>
                <button
                  type="button"
                  onClick={() => setSelectedServerIds(fleetServers.slice(0, 2).map(s => s.id))}
                  className="text-xs text-slate-500 hover:text-slate-800"
                >
                  Select Canary Nodes
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto p-1 border border-slate-200 rounded-lg bg-slate-50">
              {fleetServers.map(srv => {
                const isSelected = selectedServerIds.includes(srv.id);
                return (
                  <div
                    key={srv.id}
                    onClick={() => handleToggleServer(srv.id)}
                    className={`flex items-center justify-between p-2.5 rounded-lg border cursor-pointer transition-colors text-xs ${
                      isSelected
                        ? 'bg-indigo-50/80 border-indigo-300 text-indigo-950 font-medium'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <div className="flex items-center space-x-2 truncate">
                      <ServerIcon className={`w-3.5 h-3.5 shrink-0 ${isSelected ? 'text-indigo-600' : 'text-slate-400'}`} />
                      <span className="truncate">{srv.hostname}</span>
                      <span className="text-[10px] text-slate-400 font-mono">({srv.model.split(' ')[0]})</span>
                    </div>
                    <div className={`w-4 h-4 rounded flex items-center justify-center shrink-0 ${
                      isSelected ? 'bg-indigo-600 text-white' : 'border border-slate-300'
                    }`}>
                      {isSelected && <Check className="w-3 h-3" />}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 rounded-lg"
          >
            Cancel
          </button>

          <button
            type="button"
            id="btn-save-campaign-modal"
            onClick={handleSave}
            className="inline-flex items-center gap-1.5 px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold shadow-xs transition-colors"
          >
            <Save className="w-4 h-4" />
            <span>Save Rollout Settings ({tasks.length} Tasks)</span>
          </button>
        </div>
      </div>
    </div>
  );
};
