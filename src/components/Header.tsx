import React from 'react';
import { 
  Server as ServerIcon, 
  Layers, 
  Cpu, 
  ShieldAlert, 
  History, 
  Play, 
  RotateCcw, 
  CheckCircle2, 
  AlertTriangle, 
  Terminal,
  Database,
  Trash2,
  Disc,
  Download
} from 'lucide-react';
import { UpgradeCampaign } from '../types';
import { DatabaseStatus } from '../services/api';

export type NavTab = 'fleet' | 'catalog' | 'campaign' | 'compliance' | 'audit';

interface HeaderProps {
  activeTab: NavTab;
  onTabChange: (tab: NavTab) => void;
  activeCampaign: UpgradeCampaign | null;
  onOpenUpgradeWizard: () => void;
  onResetDemo: () => void;
  onOpenFlushConfirm?: () => void;
  totalServers: number;
  criticalCount: number;
  dbStatus?: DatabaseStatus | null;
  onOpenDockerDb?: () => void;
  onOpenVmwareIsoTester?: () => void;
  onOpenExportModal?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  onTabChange,
  activeCampaign,
  onOpenUpgradeWizard,
  onResetDemo,
  onOpenFlushConfirm,
  totalServers,
  criticalCount,
  dbStatus,
  onOpenDockerDb,
  onOpenVmwareIsoTester,
  onOpenExportModal,
}) => {
  const isCampaignActive = activeCampaign && (activeCampaign.status === 'running' || activeCampaign.status === 'paused');
  const completedServers = activeCampaign ? activeCampaign.servers.filter(s => s.stage === 'completed').length : 0;
  const totalCampaignServers = activeCampaign ? activeCampaign.servers.length : 0;

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-xs">
      {/* Top Banner / Utility Bar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand & Fleet Info */}
          <div className="flex items-center space-x-4">
            <div className="h-10 w-10 rounded-lg bg-slate-900 flex items-center justify-center text-white shadow-xs">
              <Cpu className="w-5 h-5 text-indigo-400" />
            </div>
            <div>
              <div className="flex items-center space-x-2.5">
                <h1 className="text-lg font-bold text-slate-900 tracking-tight">Server Firmware Manager</h1>
                <span className="text-[11px] font-semibold tracking-wide uppercase px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                  Redfish v1.17
                </span>
              </div>
              <p className="text-xs text-slate-500 flex items-center gap-2">
                <span>Fleet: <strong>{totalServers}</strong> servers managed</span>
                <span>•</span>
                {criticalCount > 0 ? (
                  <span className="text-amber-600 font-medium flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" />
                    {criticalCount} require critical security patches
                  </span>
                ) : (
                  <span className="text-emerald-600 font-medium flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" />
                    All nodes compliant
                  </span>
                )}
              </p>
            </div>
          </div>

          {/* Right Header Actions */}
          <div className="flex items-center space-x-3">
            {isCampaignActive && (
              <button
                type="button"
                id="btn-live-campaign-indicator"
                onClick={() => onTabChange('campaign')}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-700 text-xs font-medium hover:bg-indigo-100 transition-colors animate-pulse"
              >
                <Terminal className="w-3.5 h-3.5 text-indigo-600" />
                <span>Campaign In Progress ({completedServers}/{totalCampaignServers})</span>
              </button>
            )}

            {onOpenVmwareIsoTester && (
              <button
                type="button"
                id="btn-header-vmware-iso-tester"
                onClick={onOpenVmwareIsoTester}
                className="px-2.5 py-1.5 rounded-lg text-xs font-medium bg-cyan-50 text-cyan-800 border border-cyan-200 hover:bg-cyan-100 transition-colors flex items-center gap-1.5"
                title="VMware Virtual Machine Firmware ISO Package Tester"
              >
                <Disc className="w-3.5 h-3.5 text-cyan-600 animate-spin-slow" />
                <span>VMware VM Mount</span>
              </button>
            )}

            {onOpenDockerDb && (
              <button
                type="button"
                id="btn-open-docker-db"
                onClick={onOpenDockerDb}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors flex items-center gap-1.5 ${
                  dbStatus?.connected 
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
                title="PostgreSQL Database & Local Docker Configuration"
              >
                <Database className={`w-3.5 h-3.5 ${dbStatus?.connected ? 'text-emerald-600' : 'text-indigo-600'}`} />
                <span>
                  {dbStatus?.connected ? `Postgres (${dbStatus.latencyMs ?? 0}ms)` : 'Docker / DB'}
                </span>
                <span className={`w-2 h-2 rounded-full ${dbStatus?.connected ? 'bg-emerald-500' : 'bg-amber-400'}`} />
              </button>
            )}

            <button
              type="button"
              id="btn-reset-demo"
              onClick={onResetDemo}
              title="Reset fleet state to standard demo environment"
              className="px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200 transition-colors flex items-center gap-1.5"
            >
              <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
              <span>Reset Demo</span>
            </button>

            {onOpenFlushConfirm && (
              <button
                type="button"
                id="btn-flush-all-entries"
                onClick={onOpenFlushConfirm}
                title="Flush and clear all entries across fleet, packages, and database"
                className="px-2.5 py-1.5 rounded-lg text-xs font-medium text-rose-600 hover:text-rose-700 hover:bg-rose-50 border border-rose-200 transition-colors flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Flush All</span>
              </button>
            )}

            {onOpenExportModal && (
              <button
                type="button"
                id="btn-header-export-report"
                onClick={onOpenExportModal}
                title="Export fleet inventory and audit logs into CSV or JSON"
                className="px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-700 hover:text-slate-900 hover:bg-slate-100 border border-slate-200 transition-colors flex items-center gap-1.5"
              >
                <Download className="w-3.5 h-3.5 text-indigo-600" />
                <span>Export Reports</span>
              </button>
            )}

            <button
              type="button"
              id="btn-start-upgrade-wizard"
              onClick={onOpenUpgradeWizard}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 active:bg-indigo-800 transition-colors shadow-xs"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>Deploy Upgrade</span>
            </button>
          </div>
        </div>

        {/* Primary Tabs */}
        <div className="flex space-x-1 border-t border-slate-100 -mb-px">
          <button
            type="button"
            id="tab-fleet"
            onClick={() => onTabChange('fleet')}
            className={`flex items-center gap-2 py-3 px-4 text-xs font-semibold border-b-2 transition-colors ${
              activeTab === 'fleet'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-600 hover:text-slate-900 hover:border-slate-300'
            }`}
          >
            <ServerIcon className="w-4 h-4" />
            <span>Server Inventory</span>
            <span className="ml-1 text-[11px] px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-600 font-mono">
              {totalServers}
            </span>
          </button>

          <button
            type="button"
            id="tab-catalog"
            onClick={() => onTabChange('catalog')}
            className={`flex items-center gap-2 py-3 px-4 text-xs font-semibold border-b-2 transition-colors ${
              activeTab === 'catalog'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-600 hover:text-slate-900 hover:border-slate-300'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>Firmware Catalog</span>
          </button>

          <button
            type="button"
            id="tab-campaign"
            onClick={() => onTabChange('campaign')}
            className={`flex items-center gap-2 py-3 px-4 text-xs font-semibold border-b-2 transition-colors relative ${
              activeTab === 'campaign'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-600 hover:text-slate-900 hover:border-slate-300'
            }`}
          >
            <Terminal className="w-4 h-4" />
            <span>Active Rollout</span>
            {isCampaignActive && (
              <span className="w-2 h-2 rounded-full bg-indigo-500 animate-ping absolute top-3 right-2" />
            )}
          </button>

          <button
            type="button"
            id="tab-compliance"
            onClick={() => onTabChange('compliance')}
            className={`flex items-center gap-2 py-3 px-4 text-xs font-semibold border-b-2 transition-colors ${
              activeTab === 'compliance'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-600 hover:text-slate-900 hover:border-slate-300'
            }`}
          >
            <ShieldAlert className="w-4 h-4" />
            <span>Compliance & Drift</span>
            {criticalCount > 0 && (
              <span className="ml-1 text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-amber-100 text-amber-800">
                {criticalCount}
              </span>
            )}
          </button>

          <button
            type="button"
            id="tab-audit"
            onClick={() => onTabChange('audit')}
            className={`flex items-center gap-2 py-3 px-4 text-xs font-semibold border-b-2 transition-colors ${
              activeTab === 'audit'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-600 hover:text-slate-900 hover:border-slate-300'
            }`}
          >
            <History className="w-4 h-4" />
            <span>Audit Trail</span>
          </button>
        </div>
      </div>
    </header>
  );
};
