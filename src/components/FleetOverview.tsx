import React from 'react';
import { 
  CheckCircle2, 
  AlertTriangle, 
  Search, 
  Filter, 
  ArrowUpCircle,
  HardDrive,
  X,
  Play
} from 'lucide-react';
import { Server, ComponentType, ComponentFirmware } from '../types';

interface FleetOverviewProps {
  servers: Server[];
  searchQuery: string;
  onSearchChange: (q: string) => void;
  statusFilter: string;
  onStatusFilterChange: (f: string) => void;
  clusterFilter: string;
  onClusterFilterChange: (c: string) => void;
  selectedServerIds: string[];
  onClearSelection: () => void;
  onUpgradeSelected: () => void;
  onSelectAllVisible: (ids: string[]) => void;
}

export const FleetOverview: React.FC<FleetOverviewProps> = ({
  servers,
  searchQuery,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  clusterFilter,
  onClusterFilterChange,
  selectedServerIds,
  onClearSelection,
  onUpgradeSelected,
}) => {
  // Compute analytics
  const totalServers = servers.length;
  
  // A server is critical if any component has 'critical_update'
  const criticalServers = servers.filter(s => 
    (Object.values(s.components) as ComponentFirmware[]).some(c => c.status === 'critical_update')
  );

  // A server has updates if any component has status !== 'up_to_date'
  const updateAvailableServers = servers.filter(s => 
    (Object.values(s.components) as ComponentFirmware[]).some(c => c.status !== 'up_to_date')
  );

  const fullyCompliantServers = servers.filter(s => 
    (Object.values(s.components) as ComponentFirmware[]).every(c => c.status === 'up_to_date')
  );

  const compliancePercentage = totalServers > 0 
    ? Math.round((fullyCompliantServers.length / totalServers) * 100) 
    : 100;

  // Distinct clusters
  const clusters = Array.from(new Set(servers.map(s => s.cluster)));

  return (
    <div className="space-y-4 mb-6">
      {/* Metric Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Fleet */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Fleet Nodes</span>
            <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-700">
              <HardDrive className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-slate-900">{totalServers}</span>
            <span className="text-xs font-medium text-slate-500">x86_64 Architecture</span>
          </div>
          <p className="mt-1 text-xs text-slate-500">100% Redfish BMC API Reachable</p>
        </div>

        {/* Card 2: Compliance Rate */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Baseline Compliance</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-600">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-slate-900">{compliancePercentage}%</span>
            <span className="text-xs font-medium text-emerald-600 font-mono">
              {fullyCompliantServers.length}/{totalServers} nodes
            </span>
          </div>
          {/* Visual Mini Progress Bar */}
          <div className="mt-2 w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
            <div 
              className="bg-emerald-500 h-full rounded-full transition-all duration-500" 
              style={{ width: `${compliancePercentage}%` }}
            />
          </div>
        </div>

        {/* Card 3: Security & Critical */}
        <div className={`border rounded-xl p-4 shadow-xs transition-colors ${
          criticalServers.length > 0 
            ? 'bg-amber-50/50 border-amber-200' 
            : 'bg-white border-slate-200'
        }`}>
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Vulnerabilities</span>
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
              criticalServers.length > 0 ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'
            }`}>
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <span className={`text-2xl font-bold ${criticalServers.length > 0 ? 'text-amber-800' : 'text-slate-900'}`}>
              {criticalServers.length}
            </span>
            <span className="text-xs font-medium text-amber-700">CVE mitigation ready</span>
          </div>
          <p className="mt-1 text-xs text-slate-600">Spectre SMM & OpenSSL patches</p>
        </div>

        {/* Card 4: Total Updates Pending */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Updates Available</span>
            <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600">
              <ArrowUpCircle className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-slate-900">{updateAvailableServers.length}</span>
            <span className="text-xs font-medium text-indigo-600">
              {updateAvailableServers.length} servers behind
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-500">BIOS, iDRAC, Mellanox NIC, PERC</p>
        </div>
      </div>

      {/* Filter and Search Toolbar */}
      <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-xs">
        <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
          {/* Left: Search input */}
          <div className="relative flex-1 min-w-[240px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              id="input-search-servers"
              placeholder="Filter by hostname, model, IP, or rack (e.g. Rack B14, R750)..."
              value={searchQuery}
              onChange={e => onSearchChange(e.target.value)}
              className="w-full pl-9 pr-4 py-1.5 text-xs text-slate-800 bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all"
            />
          </div>

          {/* Right: Quick filter buttons & cluster dropdown */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Quick Status Pills */}
            <div className="inline-flex rounded-lg border border-slate-200 p-0.5 bg-slate-50 text-xs">
              <button
                type="button"
                id="filter-all"
                onClick={() => onStatusFilterChange('all')}
                className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                  statusFilter === 'all' 
                    ? 'bg-white text-slate-900 shadow-xs' 
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                All ({totalServers})
              </button>
              <button
                type="button"
                id="filter-critical"
                onClick={() => onStatusFilterChange('critical')}
                className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                  statusFilter === 'critical' 
                    ? 'bg-amber-100 text-amber-900 shadow-xs' 
                    : 'text-slate-600 hover:text-amber-800'
                }`}
              >
                Critical ({criticalServers.length})
              </button>
              <button
                type="button"
                id="filter-updates"
                onClick={() => onStatusFilterChange('updates')}
                className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                  statusFilter === 'updates' 
                    ? 'bg-white text-indigo-700 shadow-xs' 
                    : 'text-slate-600 hover:text-indigo-700'
                }`}
              >
                Updates Available ({updateAvailableServers.length})
              </button>
              <button
                type="button"
                id="filter-compliant"
                onClick={() => onStatusFilterChange('compliant')}
                className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                  statusFilter === 'compliant' 
                    ? 'bg-emerald-100 text-emerald-900 shadow-xs' 
                    : 'text-slate-600 hover:text-emerald-800'
                }`}
              >
                Compliant ({fullyCompliantServers.length})
              </button>
            </div>

            {/* Cluster dropdown */}
            <div className="relative">
              <select
                id="select-cluster-filter"
                value={clusterFilter}
                onChange={e => onClusterFilterChange(e.target.value)}
                className="pl-3 pr-8 py-1.5 text-xs text-slate-700 bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-indigo-500 font-medium cursor-pointer"
              >
                <option value="all">All Clusters & Datacenters</option>
                {clusters.map(cluster => (
                  <option key={cluster} value={cluster}>
                    {cluster}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Selected servers floating banner */}
        {selectedServerIds.length > 0 && (
          <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between bg-indigo-50/70 -mx-3 -mb-3 p-3 rounded-b-xl">
            <div className="flex items-center space-x-2 text-xs text-indigo-900 font-medium">
              <span className="w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center text-[10px] font-bold">
                {selectedServerIds.length}
              </span>
              <span>servers selected for targeted operation</span>
              <button
                type="button"
                onClick={onClearSelection}
                className="text-indigo-600 hover:text-indigo-800 underline text-xs ml-2 flex items-center gap-0.5"
              >
                <X className="w-3 h-3" /> Clear selection
              </button>
            </div>

            <div className="flex items-center space-x-2">
              <button
                type="button"
                id="btn-upgrade-selected-banner"
                onClick={onUpgradeSelected}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 active:bg-indigo-800 transition-colors shadow-xs"
              >
                <Play className="w-3 h-3 fill-current" />
                <span>Launch Firmware Campaign ({selectedServerIds.length})</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
