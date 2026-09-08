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
  ChevronRight
} from 'lucide-react';
import { UpgradeCampaign, UpgradeJobServerProgress, UpgradeStage } from '../types';

interface ActiveCampaignViewProps {
  campaign: UpgradeCampaign | null;
  onPauseCampaign: () => void;
  onResumeCampaign: () => void;
  onAbortCampaign: () => void;
  onTriggerRollback: (serverId: string) => void;
  onOpenUpgradeWizard: () => void;
}

export const ActiveCampaignView: React.FC<ActiveCampaignViewProps> = ({
  campaign,
  onPauseCampaign,
  onResumeCampaign,
  onAbortCampaign,
  onTriggerRollback,
  onOpenUpgradeWizard,
}) => {
  const [selectedServerId, setSelectedServerId] = useState<string | null>(null);

  if (!campaign) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-12 text-center shadow-xs">
        <Terminal className="w-12 h-12 text-slate-300 mx-auto mb-3" />
        <h3 className="text-base font-bold text-slate-800">No Active Rollout Campaign</h3>
        <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
          There are currently no active firmware upgrade jobs in progress across the fleet.
        </p>
        <button
          type="button"
          onClick={onOpenUpgradeWizard}
          className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors"
        >
          <Play className="w-3.5 h-3.5 fill-current" />
          <span>Launch New Upgrade Campaign</span>
        </button>
      </div>
    );
  }

  // Find inspected server or default to first active or first server
  const inspectedServer = campaign.servers.find(s => s.serverId === selectedServerId) 
    || campaign.servers.find(s => s.stage !== 'completed' && s.stage !== 'pending')
    || campaign.servers[0];

  // Compute total progress
  const completedCount = campaign.servers.filter(s => s.stage === 'completed').length;
  const failedCount = campaign.servers.filter(s => s.stage === 'failed').length;
  const inProgressCount = campaign.servers.filter(
    s => s.stage !== 'completed' && s.stage !== 'failed' && s.stage !== 'pending' && s.stage !== 'rolled_back'
  ).length;
  const pendingCount = campaign.servers.filter(s => s.stage === 'pending').length;

  const totalServers = campaign.servers.length;
  const overallProgress = totalServers > 0
    ? Math.round(
        campaign.servers.reduce((acc, s) => acc + s.progressPercent, 0) / totalServers
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
            <AlertTriangle className="w-3 h-3" /> Failed
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
            Pre-flight Checks
          </span>
        );
      case 'bmc_staging':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 text-[11px] font-semibold animate-pulse">
            BMC Uploading
          </span>
        );
      case 'flashing':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 text-[11px] font-semibold animate-pulse">
            Flashing EEPROM
          </span>
        );
      case 'rebooting':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 text-[11px] font-semibold animate-pulse">
            Chassis Rebooting
          </span>
        );
      case 'postcheck':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-teal-100 text-teal-800 text-[11px] font-semibold animate-pulse">
            Verifying POST
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      {/* Campaign Status Card */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2.5">
              <span className={`w-2.5 h-2.5 rounded-full ${
                campaign.status === 'running' ? 'bg-indigo-500 animate-ping' :
                campaign.status === 'paused' ? 'bg-amber-500' :
                'bg-emerald-500'
              }`} />
              <h2 className="text-base font-bold text-slate-900">{campaign.title}</h2>
              <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 text-[11px] font-mono uppercase">
                {campaign.status}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Component Target: <strong className="text-slate-800">{campaign.targetComponent}</strong> • Concurrency: <strong>{campaign.concurrencyLimit} nodes</strong> • Auto-Reboot: <strong>{campaign.autoReboot ? 'Yes' : 'No'}</strong>
            </p>
          </div>

          {/* Controls */}
          <div className="flex items-center space-x-2">
            {campaign.status === 'running' ? (
              <button
                type="button"
                id="btn-pause-campaign"
                onClick={onPauseCampaign}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-amber-300 bg-amber-50 text-amber-800 text-xs font-semibold hover:bg-amber-100 transition-colors"
              >
                <Pause className="w-3.5 h-3.5 fill-current" />
                <span>Pause Rollout</span>
              </button>
            ) : campaign.status === 'paused' ? (
              <button
                type="button"
                id="btn-resume-campaign"
                onClick={onResumeCampaign}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-indigo-300 bg-indigo-50 text-indigo-800 text-xs font-semibold hover:bg-indigo-100 transition-colors"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Resume Rollout</span>
              </button>
            ) : null}

            <button
              type="button"
              id="btn-abort-campaign"
              onClick={onAbortCampaign}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 text-slate-700 text-xs font-semibold hover:bg-slate-100 transition-colors"
            >
              <Square className="w-3.5 h-3.5" />
              <span>Abort</span>
            </button>
          </div>
        </div>

        {/* Overall Progress bar */}
        <div className="mt-4 pt-4 border-t border-slate-100">
          <div className="flex items-center justify-between text-xs mb-1.5">
            <span className="font-semibold text-slate-700">Fleet Upgrade Completion</span>
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
                Failed: <strong>{failedCount}</strong>
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Main Split: Left = Server Job Statuses, Right = Live BMC Streaming Logs */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Server list in rollout */}
        <div className="lg:col-span-6 space-y-3">
          <h3 className="text-sm font-bold text-slate-900">Node Orchestration Pipeline</h3>
          <div className="space-y-2 max-h-[500px] overflow-y-auto">
            {campaign.servers.map(serverJob => {
              const isSelected = inspectedServer?.serverId === serverJob.serverId;

              return (
                <div
                  key={serverJob.serverId}
                  onClick={() => setSelectedServerId(serverJob.serverId)}
                  className={`p-4 rounded-xl border transition-all cursor-pointer ${
                    isSelected
                      ? 'border-indigo-600 bg-indigo-50/40 ring-1 ring-indigo-600'
                      : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2.5">
                      <ServerIcon className="w-4 h-4 text-slate-500" />
                      <span className="font-bold text-slate-900 font-mono text-xs">
                        {serverJob.hostname}
                      </span>
                    </div>
                    <div>{getStageBadge(serverJob.stage)}</div>
                  </div>

                  {/* Versions */}
                  <div className="mt-2 flex items-center space-x-2 text-[11px] font-mono text-slate-600">
                    <span>{serverJob.component}:</span>
                    <span className="line-through text-slate-400">{serverJob.fromVersion}</span>
                    <ArrowRight className="w-3 h-3 text-slate-400" />
                    <span className="font-bold text-indigo-700">{serverJob.toVersion}</span>
                  </div>

                  {/* Current step text */}
                  <p className="mt-2 text-xs text-slate-500 truncate">
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

                  {/* If failed, show Rollback button */}
                  {serverJob.stage === 'failed' && (
                    <div className="mt-3 pt-2 border-t border-red-100 flex items-center justify-between">
                      <span className="text-xs text-red-600">Flash verification failed</span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onTriggerRollback(serverJob.serverId);
                        }}
                        className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-md text-xs font-semibold flex items-center gap-1"
                      >
                        <RotateCcw className="w-3 h-3" /> Rollback to Backup Bank
                      </button>
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
                Redfish IPMI Console Stream: <span className="font-mono text-indigo-700">{inspectedServer?.hostname}</span>
              </h3>
            </div>
            <span className="text-[11px] font-mono text-emerald-600 font-medium">
              ● Live Stream Active
            </span>
          </div>

          <div className="bg-slate-950 text-slate-300 rounded-xl p-4 font-mono text-xs border border-slate-800 shadow-inner flex-1 flex flex-col justify-between min-h-[420px] max-h-[500px]">
            {/* Terminal Header */}
            <div className="flex items-center justify-between pb-2 border-b border-slate-800 text-[11px] text-slate-400">
              <span>Task ID: #JID_382109 • Target: {inspectedServer?.hostname}</span>
              <span>Protocol: Redfish v1.17</span>
            </div>

            {/* Terminal Logs List */}
            <div className="py-3 space-y-2 overflow-y-auto flex-1 text-[11px] leading-relaxed">
              {inspectedServer?.logs.map((log, idx) => (
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
              ))}
            </div>

            {/* Terminal Footer Status */}
            <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-500">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                Session Active (Bearer Token Verified)
              </span>
              <span>Stage: {inspectedServer?.stage}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
