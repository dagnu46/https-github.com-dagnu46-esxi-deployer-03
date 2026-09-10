import React, { useState } from 'react';
import { 
  Terminal, 
  Pause, 
  Play, 
  Square, 
  CheckCircle2, 
  AlertTriangle, 
  Clock, 
  Server as ServerIcon, 
  Cpu, 
  ArrowRight, 
  RotateCcw,
  RefreshCw,
  Layers,
  ChevronRight,
  Plus,
  Edit3,
  Trash2,
  Filter,
  ShieldCheck,
  Zap,
  Activity,
  Wifi,
  KeyRound,
  Check,
  X
} from 'lucide-react';
import { UpgradeCampaign, UpgradeJobServerProgress, UpgradeStage, Server } from '../types';

interface ActiveCampaignViewProps {
  campaigns: UpgradeCampaign[];
  selectedCampaignId: string | null;
  fleetServers?: Server[];
  onSelectCampaign: (id: string) => void;
  onOpenUpgradeWizard: () => void;
  onOpenEditCampaign: (campaign: UpgradeCampaign) => void;
  onDeleteCampaign: (id: string) => void;
  onPauseCampaign: (id: string) => void;
  onResumeCampaign: (id: string) => void;
  onAbortCampaign: (id: string) => void;
  onTriggerRollback: (campaignId: string, serverId: string) => void;
  onRetryServerTask: (campaignId: string, serverId: string) => void;
}

export const ActiveCampaignView: React.FC<ActiveCampaignViewProps> = ({
  campaigns,
  selectedCampaignId,
  fleetServers = [],
  onSelectCampaign,
  onOpenUpgradeWizard,
  onOpenEditCampaign,
  onDeleteCampaign,
  onPauseCampaign,
  onResumeCampaign,
  onAbortCampaign,
  onTriggerRollback,
  onRetryServerTask,
}) => {
  const [selectedServerId, setSelectedServerId] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [campaignToDelete, setCampaignToDelete] = useState<UpgradeCampaign | null>(null);

  // Filter campaigns
  const filteredCampaigns = campaigns.filter(c => {
    if (filterStatus === 'all') return true;
    return c.status === filterStatus;
  });

  // Current selected campaign
  const activeCampaign = campaigns.find(c => c.id === selectedCampaignId) || campaigns[0] || null;

  // Selected server for console inspection
  const inspectedServer = activeCampaign?.servers.find(s => s.serverId === selectedServerId) 
    || activeCampaign?.servers.find(s => s.stage !== 'completed' && s.stage !== 'pending')
    || activeCampaign?.servers[0];

  const matchingFleetServer = fleetServers.find(s => s.id === inspectedServer?.serverId);

  // Compute stats for selected campaign
  const completedCount = activeCampaign?.servers.filter(s => s.stage === 'completed').length || 0;
  const failedCount = activeCampaign?.servers.filter(s => s.stage === 'failed').length || 0;
  const inProgressCount = activeCampaign?.servers.filter(
    s => s.stage !== 'completed' && s.stage !== 'failed' && s.stage !== 'pending' && s.stage !== 'rolled_back'
  ).length || 0;
  const pendingCount = activeCampaign?.servers.filter(s => s.stage === 'pending').length || 0;
  const totalServers = activeCampaign?.servers.length || 0;

  const overallProgress = totalServers > 0 && activeCampaign
    ? Math.round(
        activeCampaign.servers.reduce((acc, s) => acc + (s.progressPercent || 0), 0) / totalServers
      )
    : 0;

  const getStageBadge = (stage: UpgradeStage) => {
    switch (stage) {
      case 'completed':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[11px] font-semibold">
            <CheckCircle2 className="w-3 h-3" /> Verified & Active
          </span>
        );
      case 'failed':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-100 text-red-800 text-[11px] font-bold">
            <AlertTriangle className="w-3 h-3" /> Check Failed
          </span>
        );
      case 'rolled_back':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[11px] font-semibold">
            <RotateCcw className="w-3 h-3" /> Rolled Back
          </span>
        );
      case 'pending':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[11px] font-medium font-mono">
            <Clock className="w-3 h-3" /> Queued
          </span>
        );
      case 'preflight':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800 text-[11px] font-semibold animate-pulse">
            <Activity className="w-3 h-3 animate-spin" /> IPMI & Network Checks
          </span>
        );
      case 'bmc_staging':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 text-[11px] font-semibold animate-pulse">
            Payload Staging
          </span>
        );
      case 'flashing':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 text-[11px] font-semibold animate-pulse">
            Writing SPI EEPROM
          </span>
        );
      case 'rebooting':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 text-[11px] font-semibold animate-pulse">
            Chassis Warm Restart
          </span>
        );
      case 'postcheck':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-teal-100 text-teal-800 text-[11px] font-semibold animate-pulse">
            Verifying POST Code
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      {/* ALL EXISTING ACTIVE ROLLOUTS SHOWN ON LINE */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-200 bg-slate-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-600">
              <Layers className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-slate-900">All Active Rollouts</h3>
                <span className="px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800 text-[11px] font-bold">
                  {campaigns.length} Rollout{campaigns.length === 1 ? '' : 's'}
                </span>
              </div>
              <p className="text-xs text-slate-500">
                All scheduled and active firmware campaigns shown on line with live execution progress and direct edit/delete controls.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Filter pills */}
            <div className="inline-flex rounded-lg border border-slate-200 p-0.5 bg-slate-100">
              {['all', 'running', 'paused', 'completed', 'failed'].map(st => {
                const count = st === 'all' 
                  ? campaigns.length 
                  : campaigns.filter(c => c.status === st).length;
                return (
                  <button
                    key={st}
                    type="button"
                    onClick={() => setFilterStatus(st)}
                    className={`px-2 py-1 rounded-md text-[11px] font-semibold transition-colors ${
                      filterStatus === st 
                        ? 'bg-white text-indigo-700 shadow-xs' 
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {st.charAt(0).toUpperCase() + st.slice(1)} ({count})
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              id="btn-new-campaign-line"
              onClick={onOpenUpgradeWizard}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New Rollout</span>
            </button>
          </div>
        </div>

        {/* Existing Active Rollouts Line Presentation */}
        {filteredCampaigns.length === 0 ? (
          <div className="p-8 text-center text-slate-500">
            <Layers className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <p className="text-xs font-medium text-slate-600">No active rollouts matching filter "{filterStatus}"</p>
            <button
              type="button"
              onClick={onOpenUpgradeWizard}
              className="mt-3 inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Create Rollout</span>
            </button>
          </div>
        ) : (
          <div className="divide-y divide-slate-200">
            {filteredCampaigns.map(c => {
              const isSelected = activeCampaign?.id === c.id;
              const completedNodes = c.servers.filter(s => s.stage === 'completed').length;
              const failedNodes = c.servers.filter(s => s.stage === 'failed').length;
              const totalNodes = c.servers.length;
              const progressPct = totalNodes === 0 ? 0 : Math.round((completedNodes / totalNodes) * 100);
              const hasMultipleTasks = c.tasks && c.tasks.length > 1;

              return (
                <div
                  key={c.id}
                  onClick={() => onSelectCampaign(c.id)}
                  className={`p-3.5 sm:px-5 flex flex-col md:flex-row md:items-center justify-between gap-3 cursor-pointer transition-colors ${
                    isSelected 
                      ? 'bg-indigo-50/50 border-l-4 border-l-indigo-600' 
                      : 'hover:bg-slate-50/80 bg-white'
                  }`}
                >
                  {/* Left: Status, Title, and Ranked Tasks */}
                  <div className="flex items-center space-x-3 min-w-0">
                    <div className="flex items-center space-x-1.5 shrink-0">
                      <span className={`w-2.5 h-2.5 rounded-full ${
                        c.status === 'running' ? 'bg-emerald-500 animate-pulse' :
                        c.status === 'paused' ? 'bg-amber-500' :
                        c.status === 'failed' ? 'bg-red-500' :
                        'bg-slate-400'
                      }`} />
                      <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${
                        c.status === 'running' ? 'bg-emerald-100 text-emerald-800' :
                        c.status === 'paused' ? 'bg-amber-100 text-amber-800' :
                        c.status === 'failed' ? 'bg-red-100 text-red-800' :
                        'bg-slate-100 text-slate-700'
                      }`}>
                        {c.status}
                      </span>
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-xs font-bold truncate ${isSelected ? 'text-indigo-950' : 'text-slate-900'}`}>
                          {c.title}
                        </span>
                        {isSelected && (
                          <span className="px-1.5 py-0.2 rounded bg-indigo-600 text-white text-[9px] font-bold">
                            CURRENT PIPELINE
                          </span>
                        )}
                      </div>

                      {/* Firmware Tasks Summary */}
                      <div className="text-[11px] text-slate-500 flex items-center gap-2 mt-0.5 flex-wrap">
                        {hasMultipleTasks ? (
                          <span className="inline-flex items-center gap-1 font-mono text-indigo-700 font-semibold">
                            <Layers className="w-3 h-3 text-indigo-500" />
                            {c.tasks!.length} Ranked Tasks ({c.tasks!.map(t => `#${t.order} ${t.component}`).join(' → ')})
                          </span>
                        ) : (
                          <span className="font-mono text-slate-600">
                            Target: <strong className="text-slate-800">{c.targetComponent}</strong>
                          </span>
                        )}
                        <span>•</span>
                        <span>{c.concurrencyLimit} Parallel</span>
                      </div>
                    </div>
                  </div>

                  {/* Middle: Progress Bar and Node Count */}
                  <div className="flex items-center space-x-3 w-full md:w-56 shrink-0">
                    <div className="flex-1">
                      <div className="flex items-center justify-between text-[10px] font-mono text-slate-600 mb-1">
                        <span>{completedNodes}/{totalNodes} Nodes</span>
                        <span className="font-bold text-slate-800">{progressPct}%</span>
                      </div>
                      <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-300 ${
                            failedNodes > 0 ? 'bg-amber-500' : 'bg-indigo-600'
                          }`}
                          style={{ width: `${progressPct}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Right: Dedicated Edit and Delete Buttons for EACH Active Rollout */}
                  <div className="flex items-center space-x-1.5 shrink-0 justify-end">
                    {/* Pause / Resume button */}
                    {c.status === 'running' ? (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onPauseCampaign(c.id);
                        }}
                        className="p-1.5 text-amber-700 hover:bg-amber-100 rounded-md border border-amber-200 transition-colors"
                        title="Pause Rollout"
                      >
                        <Pause className="w-3.5 h-3.5" />
                      </button>
                    ) : c.status === 'paused' ? (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onResumeCampaign(c.id);
                        }}
                        className="p-1.5 text-emerald-700 hover:bg-emerald-100 rounded-md border border-emerald-200 transition-colors"
                        title="Resume Rollout"
                      >
                        <Play className="w-3.5 h-3.5" />
                      </button>
                    ) : null}

                    {/* Edit button */}
                    <button
                      type="button"
                      id={`btn-edit-rollout-${c.id}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenEditCampaign(c);
                      }}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-white hover:bg-slate-100 border border-slate-300 rounded-md text-xs font-semibold text-slate-700 transition-colors shadow-2xs"
                      title="Edit Rollout Settings & Firmware Tasks"
                    >
                      <Edit3 className="w-3.5 h-3.5 text-slate-500" />
                      <span>Edit</span>
                    </button>

                    {/* Delete button */}
                    <button
                      type="button"
                      id={`btn-delete-rollout-${c.id}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        setCampaignToDelete(c);
                      }}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-white hover:bg-red-50 border border-red-200 rounded-md text-xs font-semibold text-red-600 transition-colors shadow-2xs"
                      title="Delete Rollout"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Delete</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* If no active campaign */}
      {!activeCampaign ? (
        <div className="bg-white border border-slate-200 rounded-xl p-12 text-center shadow-xs">
          <Terminal className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-base font-bold text-slate-800">No Upgrade Campaign Selected</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            Select a rollout above or create a new campaign to orchestrate real-world rollout tasks and IPMI checks across your physical servers.
          </p>
          <button
            type="button"
            onClick={onOpenUpgradeWizard}
            className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>Launch Upgrade Campaign</span>
          </button>
        </div>
      ) : (
        <>
          {/* Active Campaign Detail Card */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <div className="flex items-center space-x-2.5 flex-wrap gap-y-1">
                  <span className={`w-2.5 h-2.5 rounded-full ${
                    activeCampaign.status === 'running' ? 'bg-indigo-500 animate-ping' :
                    activeCampaign.status === 'paused' ? 'bg-amber-500' :
                    activeCampaign.status === 'failed' ? 'bg-red-500' :
                    'bg-emerald-500'
                  }`} />
                  <h2 className="text-base font-bold text-slate-900">{activeCampaign.title}</h2>
                  <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 text-[11px] font-mono uppercase font-bold">
                    {activeCampaign.status}
                  </span>
                  <span className="px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 text-[11px] font-mono font-semibold">
                    Target: {activeCampaign.targetComponent}
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-1.5">
                  Concurrency: <strong className="text-slate-700">{activeCampaign.concurrencyLimit} nodes</strong> • Auto-Reboot: <strong>{activeCampaign.autoReboot ? 'Yes' : 'No'}</strong> • Pre-flight IPMI Checks: <strong>{activeCampaign.preflightChecksRequired ? 'Required' : 'Disabled'}</strong> • Stop on Failure: <strong>{activeCampaign.stopOnFirstFailure ? 'Yes' : 'No'}</strong>
                </p>
              </div>

              {/* Controls */}
              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  id="btn-edit-active-campaign"
                  onClick={() => onOpenEditCampaign(activeCampaign)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-700 text-xs font-semibold hover:bg-slate-50 transition-colors shadow-xs"
                  title="Configure Rollout & Ranked Firmware Tasks"
                >
                  <Edit3 className="w-3.5 h-3.5 text-slate-500" />
                  <span>Configure Settings</span>
                </button>

                {activeCampaign.status === 'running' ? (
                  <button
                    type="button"
                    id="btn-pause-campaign"
                    onClick={() => onPauseCampaign(activeCampaign.id)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg border border-amber-300 bg-amber-50 text-amber-800 text-xs font-semibold hover:bg-amber-100 transition-colors shadow-xs"
                  >
                    <Pause className="w-3.5 h-3.5 fill-current" />
                    <span>Pause Rollout</span>
                  </button>
                ) : activeCampaign.status === 'paused' ? (
                  <button
                    type="button"
                    id="btn-resume-campaign"
                    onClick={() => onResumeCampaign(activeCampaign.id)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg border border-indigo-300 bg-indigo-50 text-indigo-800 text-xs font-semibold hover:bg-indigo-100 transition-colors shadow-xs"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>Resume Rollout</span>
                  </button>
                ) : null}

                {activeCampaign.status !== 'completed' && activeCampaign.status !== 'aborted' && (
                  <button
                    type="button"
                    id="btn-abort-campaign"
                    onClick={() => onAbortCampaign(activeCampaign.id)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 text-slate-700 text-xs font-semibold hover:bg-slate-100 transition-colors shadow-xs"
                  >
                    <Square className="w-3.5 h-3.5" />
                    <span>Abort</span>
                  </button>
                )}
              </div>
            </div>

            {/* Multi-Firmware Ranked Tasks Sequence Banner */}
            {activeCampaign.tasks && activeCampaign.tasks.length > 0 && (
              <div className="mt-4 pt-3.5 border-t border-slate-100">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-indigo-600" />
                    Multi-Firmware Ranked Tasks Sequence ({activeCampaign.tasks.length} Ordered Tasks):
                  </span>
                  <button
                    type="button"
                    onClick={() => onOpenEditCampaign(activeCampaign)}
                    className="text-[11px] text-indigo-600 hover:text-indigo-800 font-semibold flex items-center gap-1"
                  >
                    <Edit3 className="w-3 h-3" />
                    Manage Tasks Sequence
                  </button>
                </div>

                <div className="flex items-center flex-wrap gap-2">
                  {activeCampaign.tasks.map((task, idx) => (
                    <div key={task.id} className="flex items-center space-x-1.5">
                      <div className="flex items-center space-x-2 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-lg text-xs font-mono">
                        <span className="w-4 h-4 rounded-full bg-slate-900 text-white text-[10px] font-bold flex items-center justify-center">
                          #{task.order}
                        </span>
                        <span className="font-bold text-slate-900">{task.component}</span>
                        <span className="text-indigo-600 font-bold">v{task.targetVersion}</span>
                        {task.rebootRequired && (
                          <span className="text-[9px] bg-slate-200 text-slate-700 px-1 rounded">Reboot</span>
                        )}
                      </div>
                      {idx < activeCampaign.tasks!.length - 1 && (
                        <ArrowRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Overall Progress bar */}
            <div className="mt-4 pt-4 border-t border-slate-100">
              <div className="flex items-center justify-between text-xs mb-1.5">
                <span className="font-semibold text-slate-700">Campaign Execution Completion</span>
                <span className="font-mono font-bold text-indigo-700">{overallProgress}%</span>
              </div>
              <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                <div
                  className="bg-indigo-600 h-full rounded-full transition-all duration-300"
                  style={{ width: `${overallProgress}%` }}
                />
              </div>

              {/* Counts */}
              <div className="mt-3 flex flex-wrap gap-4 text-xs font-mono text-slate-600">
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  Completed: <strong>{completedCount}</strong>
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-indigo-500" />
                  In Progress: <strong>{inProgressCount}</strong>
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-slate-300" />
                  Queued: <strong>{pendingCount}</strong>
                </span>
                {failedCount > 0 && (
                  <span className="flex items-center gap-1.5 text-red-600 font-bold">
                    <span className="w-2 h-2 rounded-full bg-red-500" />
                    Failed Checks: <strong>{failedCount}</strong>
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Main Split: Left = Server Job Statuses with Real Checks, Right = Live BMC Streaming Logs */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left: Server list in rollout */}
            <div className="lg:col-span-6 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                  <Activity className="w-4 h-4 text-indigo-600" />
                  Node Orchestration Pipeline ({activeCampaign.servers.length} servers)
                </h3>
                <span className="text-[11px] text-slate-500 font-mono">
                  Real tasks on physical hardware
                </span>
              </div>

              <div className="space-y-2.5 max-h-[520px] overflow-y-auto pr-1">
                {activeCampaign.servers.map(serverJob => {
                  const isSelected = inspectedServer?.serverId === serverJob.serverId;
                  const fleetSrv = fleetServers.find(s => s.id === serverJob.serverId);

                  return (
                    <div
                      key={serverJob.serverId}
                      onClick={() => setSelectedServerId(serverJob.serverId)}
                      className={`p-4 rounded-xl border transition-all cursor-pointer ${
                        isSelected
                          ? 'border-indigo-600 bg-indigo-50/40 ring-1 ring-indigo-600 shadow-xs'
                          : 'border-slate-200 bg-white hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2.5">
                          <ServerIcon className="w-4 h-4 text-slate-500" />
                          <span className="font-bold text-slate-900 font-mono text-xs">
                            {serverJob.hostname}
                          </span>
                          {fleetSrv && (
                            <span className="text-[10px] font-mono text-slate-400">
                              [{fleetSrv.ip}]
                            </span>
                          )}
                        </div>
                        <div>{getStageBadge(serverJob.stage)}</div>
                      </div>

                      {/* Component Versions & Ranked Task Indicator */}
                      {(serverJob.totalTasksCount || (activeCampaign.tasks && activeCampaign.tasks.length > 1)) && (
                        <div className="mt-1.5 flex items-center gap-1.5">
                          <span className="px-1.5 py-0.5 rounded bg-indigo-50 border border-indigo-200 text-indigo-700 text-[10px] font-bold font-mono">
                            Task #{(serverJob.currentTaskIndex || 0) + 1} of {serverJob.totalTasksCount || activeCampaign.tasks?.length || 1}
                          </span>
                          <span className="text-[10px] text-slate-500 font-sans">
                            {activeCampaign.tasks?.[serverJob.currentTaskIndex || 0]?.packageName || `${serverJob.component} Task`}
                          </span>
                        </div>
                      )}

                      <div className="mt-1.5 flex items-center space-x-2 text-[11px] font-mono text-slate-600">
                        <span>{serverJob.component}:</span>
                        <span className="line-through text-slate-400">{serverJob.fromVersion}</span>
                        <ArrowRight className="w-3 h-3 text-slate-400" />
                        <span className="font-bold text-indigo-700">{serverJob.toVersion}</span>
                      </div>

                      {/* Real Step Status Indicators */}
                      <div className="mt-2 flex flex-wrap gap-1.5 text-[10px] font-mono">
                        {/* Network Status */}
                        {serverJob.networkStatus && serverJob.networkStatus !== 'untested' && (
                          <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded ${
                            serverJob.networkStatus === 'reachable'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-red-50 text-red-700 border border-red-200'
                          }`}>
                            <Wifi className="w-3 h-3" />
                            {serverJob.networkStatus === 'reachable' ? 'Network OK' : 'Network Unreachable'}
                          </span>
                        )}

                        {/* IPMI Credentials Status */}
                        {serverJob.ipmiStatus && serverJob.ipmiStatus !== 'untested' && (
                          <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded ${
                            serverJob.ipmiStatus === 'verified'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-red-50 text-red-700 border border-red-200'
                          }`}>
                            <KeyRound className="w-3 h-3" />
                            {serverJob.ipmiStatus === 'verified' ? 'IPMI/Redfish Auth OK' : 'IPMI Auth Failed'}
                          </span>
                        )}

                        {/* Power state telemetry if reported */}
                        {serverJob.lastTelemetry?.powerState && (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                            Power: {serverJob.lastTelemetry.powerState.toUpperCase()}
                          </span>
                        )}
                      </div>

                      {/* Current step message */}
                      <p className="mt-2 text-xs text-slate-600 truncate">
                        {serverJob.currentStepMessage}
                      </p>

                      {/* Server Progress bar */}
                      <div className="mt-2 flex items-center space-x-2">
                        <div className="flex-1 bg-slate-100 h-1.5 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-300 ${
                              serverJob.stage === 'failed' ? 'bg-red-500' :
                              serverJob.stage === 'completed' ? 'bg-emerald-500' :
                              'bg-indigo-600'
                            }`}
                            style={{ width: `${serverJob.progressPercent}%` }}
                          />
                        </div>
                        <span className="text-[11px] font-mono text-slate-500 w-8 text-right">
                          {serverJob.progressPercent}%
                        </span>
                      </div>

                      {/* Actions when Failed: Retry Task & Rollback */}
                      {serverJob.stage === 'failed' && (
                        <div className="mt-3 pt-2.5 border-t border-red-100 flex flex-wrap items-center justify-between gap-2">
                          <span className="text-xs text-red-600 font-semibold truncate max-w-[200px]">
                            {serverJob.error || 'Check failed'}
                          </span>
                          <div className="flex items-center space-x-2">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onRetryServerTask(activeCampaign.id, serverJob.serverId);
                              }}
                              className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md text-xs font-semibold flex items-center gap-1 shadow-xs"
                            >
                              <RefreshCw className="w-3 h-3" /> Retry Task
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onTriggerRollback(activeCampaign.id, serverJob.serverId);
                              }}
                              className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-md text-xs font-semibold flex items-center gap-1 shadow-xs"
                            >
                              <RotateCcw className="w-3 h-3" /> Rollback
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Right: Live Terminal Logs for Selected Server */}
            <div className="lg:col-span-6 flex flex-col">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center space-x-2">
                  <Terminal className="w-4 h-4 text-indigo-600" />
                  <h3 className="text-sm font-bold text-slate-900">
                    BMC IPMI Stream: <span className="font-mono text-indigo-700">{inspectedServer?.hostname}</span>
                  </h3>
                </div>
                <span className="text-[11px] font-mono text-emerald-600 font-medium flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  Live Socket Stream
                </span>
              </div>

              {/* Hardware & Connection Telemetry Bar */}
              {matchingFleetServer && (
                <div className="mb-2 bg-slate-900 text-slate-300 rounded-lg px-3 py-2 text-[11px] font-mono flex flex-wrap items-center justify-between gap-2 border border-slate-800">
                  <span>Target BMC: <strong className="text-white">{matchingFleetServer.bmcIp || matchingFleetServer.ip}</strong>:{matchingFleetServer.credentials?.bmcPort || 443}</span>
                  <span>Protocol: <strong className="text-indigo-400">{(matchingFleetServer.credentials?.bmcProtocol || 'REDFISH').toUpperCase()}</strong></span>
                  <span>User: <strong className="text-amber-300">{matchingFleetServer.credentials?.bmcUsername || 'root'}</strong></span>
                </div>
              )}

              <div className="bg-slate-950 text-slate-300 rounded-xl p-4 font-mono text-xs border border-slate-800 shadow-inner flex-1 flex flex-col justify-between min-h-[440px] max-h-[520px]">
                {/* Terminal Header */}
                <div className="flex items-center justify-between pb-2 border-b border-slate-800 text-[11px] text-slate-400">
                  <span>Task: #{inspectedServer?.serverId} • Host: {inspectedServer?.hostname}</span>
                  <span>Component: {inspectedServer?.component} ({inspectedServer?.toVersion})</span>
                </div>

                {/* Terminal Logs List */}
                <div className="py-3 space-y-2 overflow-y-auto flex-1 text-[11px] leading-relaxed">
                  {inspectedServer?.logs && inspectedServer.logs.length > 0 ? (
                    inspectedServer.logs.map((log, idx) => (
                      <div key={idx} className="flex items-start space-x-2">
                        <span className="text-slate-500 shrink-0">[{log.timestamp}]</span>
                        <span
                          className={
                            log.level === 'error'
                              ? 'text-red-400 font-semibold'
                              : log.level === 'warn'
                              ? 'text-amber-400 font-semibold'
                              : log.level === 'success'
                              ? 'text-emerald-400 font-semibold'
                              : 'text-slate-300'
                          }
                        >
                          {log.message}
                        </span>
                      </div>
                    ))
                  ) : (
                    <div className="text-slate-500 italic py-4 text-center">
                      No logs recorded yet for this node. Task queued.
                    </div>
                  )}
                </div>

                {/* Terminal Footer Status */}
                <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
                  <span className="flex items-center gap-1.5">
                    {inspectedServer?.stage === 'failed' ? (
                      <span className="text-red-400 font-semibold flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" /> Check Halted
                      </span>
                    ) : inspectedServer?.stage === 'completed' ? (
                      <span className="text-emerald-400 font-semibold flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" /> Step Verified Nominal
                      </span>
                    ) : (
                      <span className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                        Executing Real Hardware Task
                      </span>
                    )}
                  </span>
                  <span>Stage: <strong className="text-slate-200">{inspectedServer?.stage}</strong></span>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Delete Confirmation Modal */}
      {campaignToDelete && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="relative bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 border border-slate-200">
            <div className="flex items-center space-x-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center text-red-600">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Delete Upgrade Campaign?</h3>
                <p className="text-xs text-slate-500">This action cannot be undone.</p>
              </div>
            </div>

            <p className="text-xs text-slate-600 mb-5">
              Are you sure you want to delete campaign <strong className="text-slate-900 font-bold">"{campaignToDelete.title}"</strong>? All staged tasks, progression history, and IPMI connection records for this campaign will be removed.
            </p>

            <div className="flex items-center justify-end space-x-3">
              <button
                type="button"
                onClick={() => setCampaignToDelete(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800"
              >
                Cancel
              </button>
              <button
                type="button"
                id="btn-confirm-delete-campaign"
                onClick={() => {
                  onDeleteCampaign(campaignToDelete.id);
                  setCampaignToDelete(null);
                }}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-semibold shadow-xs"
              >
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
