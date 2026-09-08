import React from 'react';
import { 
  Server as ServerIcon, 
  ExternalLink, 
  ShieldAlert, 
  Cpu, 
  HardDrive, 
  Wifi, 
  Database, 
  Check, 
  ChevronRight,
  Sparkles,
  Power,
  Edit,
  Trash2,
  MapPin,
  Globe
} from 'lucide-react';
import { Server, ComponentType, ComponentFirmware } from '../types';

interface ServerListProps {
  servers: Server[];
  selectedServerIds: string[];
  onToggleServer: (id: string) => void;
  onSelectAllVisible: (ids: string[]) => void;
  onViewDetails: (server: Server) => void;
  onQuickUpgrade: (server: Server, component: ComponentType) => void;
  onEditServer?: (server: Server) => void;
  onDeleteServer?: (server: Server) => void;
}

export const ServerList: React.FC<ServerListProps> = ({
  servers,
  selectedServerIds,
  onToggleServer,
  onSelectAllVisible,
  onViewDetails,
  onQuickUpgrade,
  onEditServer,
  onDeleteServer,
}) => {
  const allVisibleSelected = servers.length > 0 && servers.every(s => selectedServerIds.includes(s.id));
  const someVisibleSelected = servers.some(s => selectedServerIds.includes(s.id)) && !allVisibleSelected;

  const handleMasterCheckbox = () => {
    if (allVisibleSelected) {
      onSelectAllVisible([]);
    } else {
      onSelectAllVisible(servers.map(s => s.id));
    }
  };

  const getComponentBadge = (server: Server, compType: ComponentType) => {
    const comp = server.components[compType];
    if (!comp) return null;

    if (comp.status === 'critical_update') {
      return (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onQuickUpgrade(server, compType);
          }}
          title={`${comp.name}: Critical security update to ${comp.latestVersion} (${comp.cveAlerts?.join(', ') || 'Security Fix'}) - Click to upgrade`}
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-100/90 text-amber-900 border border-amber-300 text-[11px] font-mono hover:bg-amber-200 transition-colors cursor-pointer group"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-amber-600 animate-pulse" />
          <span className="font-semibold">{compType}:</span>
          <span className="text-amber-800 font-bold">{comp.currentVersion}</span>
          <span className="text-amber-950 font-bold">→ {comp.latestVersion}</span>
        </button>
      );
    }

    if (comp.status === 'update_available') {
      return (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onQuickUpgrade(server, compType);
          }}
          title={`${comp.name}: Recommended update to ${comp.latestVersion} available - Click to upgrade`}
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200 text-[11px] font-mono hover:bg-indigo-100 transition-colors cursor-pointer"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
          <span className="font-semibold">{compType}:</span>
          <span className="text-slate-600">{comp.currentVersion}</span>
          <span className="font-bold text-indigo-900">→ {comp.latestVersion}</span>
        </button>
      );
    }

    // Up to date
    return (
      <span
        title={`${comp.name} is on baseline version ${comp.currentVersion}`}
        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 border border-slate-200 text-[11px] font-mono"
      >
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
        <span>{compType}: {comp.currentVersion}</span>
      </span>
    );
  };

  if (servers.length === 0) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-12 text-center shadow-xs">
        <ServerIcon className="w-12 h-12 text-slate-300 mx-auto mb-3" />
        <h3 className="text-base font-semibold text-slate-800">No servers found matching filters</h3>
        <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
          Try clearing your search query or selecting "All" in the cluster and status filter bars.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200 text-left">
          <thead className="bg-slate-50">
            <tr>
              {/* Checkbox */}
              <th scope="col" className="w-10 px-4 py-3">
                <input
                  type="checkbox"
                  id="checkbox-select-all"
                  checked={allVisibleSelected}
                  ref={el => {
                    if (el) el.indeterminate = someVisibleSelected;
                  }}
                  onChange={handleMasterCheckbox}
                  className="rounded-sm border-slate-300 text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer"
                />
              </th>
              <th scope="col" className="px-4 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                Device & Vendor
              </th>
              <th scope="col" className="px-4 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                Hypervisor & Workload
              </th>
              <th scope="col" className="px-4 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                IP Address & BMC (OOB)
              </th>
              <th scope="col" className="px-4 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                Location
              </th>
              <th scope="col" className="px-4 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                Installed Firmware Version Matrix
              </th>
              <th scope="col" className="px-4 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                Health & Power
              </th>
              <th scope="col" className="px-4 py-3 text-right text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 bg-white">
            {servers.map(server => {
              const isSelected = selectedServerIds.includes(server.id);

              const componentList = Object.values(server.components) as ComponentFirmware[];
              const hasCritical = componentList.some(c => c.status === 'critical_update');
              const hasAnyUpdate = componentList.some(c => c.status !== 'up_to_date');

              const vendor = server.vendor || (
                server.model?.includes('HPE') || server.model?.includes('HP') ? 'HP' :
                server.model?.includes('Dell') ? 'DELL' : 'LENOVO'
              );

              const hypervisor = server.hypervisor || (
                server.cluster?.includes('Nutanix') ? 'VMware ESXi on Nutanix' :
                server.cluster?.includes('Xen') ? 'Xen Server' : 'VMware ESXi'
              );

              return (
                <tr
                  key={server.id}
                  onClick={() => onViewDetails(server)}
                  className={`hover:bg-slate-50/80 transition-colors cursor-pointer text-xs ${
                    isSelected ? 'bg-indigo-50/40' : ''
                  }`}
                >
                  {/* Row Checkbox */}
                  <td
                    className="w-10 px-4 py-3.5"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <input
                      type="checkbox"
                      id={`checkbox-server-${server.id}`}
                      checked={isSelected}
                      onChange={() => onToggleServer(server.id)}
                      className="rounded-sm border-slate-300 text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer"
                    />
                  </td>

                  {/* Server, Vendor & Model */}
                  <td className="px-4 py-3.5">
                    <div className="flex items-center space-x-2">
                      <span className="font-mono font-bold text-slate-900 text-xs">
                        {server.hostname}
                      </span>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider ${
                        server.status === 'online' ? 'bg-emerald-100 text-emerald-800' :
                        server.status === 'maintenance' ? 'bg-amber-100 text-amber-800' :
                        'bg-indigo-100 text-indigo-800'
                      }`}>
                        {server.status}
                      </span>
                    </div>
                    <div className="text-slate-500 text-[11px] mt-1 flex items-center gap-1.5 flex-wrap">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold tracking-wider ${
                        vendor === 'HP' ? 'bg-emerald-100 text-emerald-900 border border-emerald-200' :
                        vendor === 'DELL' ? 'bg-blue-100 text-blue-900 border border-blue-200' :
                        'bg-red-100 text-red-900 border border-red-200'
                      }`}>
                        {vendor}
                      </span>
                      <span className="font-medium text-slate-700">{server.model}</span>
                      <span className="text-slate-300">•</span>
                      <span className="truncate max-w-[140px] text-slate-500">{server.cluster}</span>
                    </div>
                  </td>

                  {/* Hypervisor & Virtualization Workload */}
                  <td className="px-4 py-3.5">
                    <div className="flex flex-col gap-1">
                      <div>
                        {hypervisor === 'VMware ESXi' && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200 text-[10px] font-semibold">
                            <span className="w-1.5 h-1.5 rounded-full bg-indigo-600" />
                            <span>VMware ESXi</span>
                          </span>
                        )}
                        {hypervisor === 'VMware ESXi on Nutanix' && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-teal-50 text-teal-800 border border-teal-200 text-[10px] font-semibold">
                            <span className="w-1.5 h-1.5 rounded-full bg-teal-600" />
                            <span>ESXi on Nutanix</span>
                          </span>
                        )}
                        {hypervisor === 'Xen Server' && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 border border-amber-200 text-[10px] font-semibold">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-600" />
                            <span>Xen Server</span>
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-slate-500 font-mono truncate max-w-[170px]" title={server.hypervisorVersion || 'Base Hypervisor'}>
                        {server.hypervisorVersion || 'ESXi 8.0u2'}
                      </div>
                      <div>
                        {server.hypervisorMaintenanceMode ? (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded-sm bg-amber-100 text-amber-800 text-[9px] font-semibold">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-600" />
                            <span>Maintenance (Evacuated)</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] text-slate-600 font-medium">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                            <span className="font-mono font-semibold text-slate-800">{server.activeVmsCount ?? 0}</span>
                            <span>active VMs</span>
                          </span>
                        )}
                      </div>
                    </div>
                  </td>

                  {/* Network & BMC */}
                  <td className="px-4 py-3.5 font-mono text-[11px]">
                    <div className="text-slate-900 flex items-center gap-1">
                      <span className="text-slate-400 font-sans text-[10px]">Host:</span>
                      <span className="font-medium">{server.ip}</span>
                    </div>
                    <div className="text-slate-500 flex items-center gap-1 mt-0.5">
                      <span className="text-slate-400 font-sans text-[10px]">{server.bmcAffectedType}:</span>
                      <span>{server.bmcIp}</span>
                    </div>
                    <div className="mt-1 flex items-center gap-1.5">
                      {server.accessStatus?.status === 'success' ? (
                        <span 
                          className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-sm bg-emerald-50 text-emerald-700 border border-emerald-200 text-[9px] font-sans font-medium"
                          title={`Access verified via ${server.credentials?.bmcProtocol?.toUpperCase() || 'Redfish'} (${server.accessStatus.latencyMs || 16}ms RTT). Username: ${server.credentials?.bmcUsername || 'root'}`}
                        >
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                          <span>{server.credentials?.bmcProtocol?.toUpperCase() || 'Redfish'} ({server.accessStatus.latencyMs || 16}ms)</span>
                        </span>
                      ) : server.accessStatus?.status === 'failed' ? (
                        <span 
                          className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-sm bg-red-50 text-red-700 border border-red-200 text-[9px] font-sans font-medium"
                          title={server.accessStatus?.summary || 'Authentication or network probe failed'}
                        >
                          <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                          <span>Auth Failed</span>
                        </span>
                      ) : (
                        <span 
                          className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-sm bg-slate-100 text-slate-600 border border-slate-200 text-[9px] font-sans font-medium"
                          title="Credentials pending verification"
                        >
                          <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                          <span>Unverified</span>
                        </span>
                      )}
                    </div>
                  </td>

                  {/* Location */}
                  <td className="px-4 py-3.5">
                    <div className="text-slate-900 font-medium">{server.datacenter}</div>
                    <div className="text-slate-500 text-[11px] font-mono mt-0.5">
                      {server.rack} • {server.unit}
                    </div>
                  </td>

                  {/* Installed Firmware Version Matrix */}
                  <td className="px-4 py-3.5">
                    <div className="flex flex-wrap gap-1.5 max-w-md">
                      {getComponentBadge(server, 'BIOS')}
                      {getComponentBadge(server, 'BMC')}
                      {getComponentBadge(server, 'NIC')}
                      {getComponentBadge(server, 'RAID')}
                      {getComponentBadge(server, 'NVMe')}
                    </div>
                  </td>

                  {/* Power & Health */}
                  <td className="px-4 py-3.5">
                    <div className="flex items-center space-x-1.5">
                      <Power className={`w-3.5 h-3.5 ${server.powerState === 'on' ? 'text-emerald-600' : 'text-slate-400'}`} />
                      <span className="text-slate-800 font-medium capitalize">{server.powerState}</span>
                    </div>
                    <div className="text-[10px] text-slate-500 mt-0.5 flex items-center gap-1">
                      <span className={`w-1.5 h-1.5 rounded-full ${server.powerSupplyRedundancy ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                      <span>Dual PSU {server.powerSupplyRedundancy ? 'Redundant' : 'Degraded'}</span>
                    </div>
                  </td>

                  {/* Actions: Upgrade, Edit, Delete, Details */}
                  <td className="px-4 py-3.5 text-right whitespace-nowrap">
                    <div className="flex items-center justify-end space-x-1.5" onClick={e => e.stopPropagation()}>
                      {hasAnyUpdate && (
                        <button
                          type="button"
                          id={`btn-flash-server-${server.id}`}
                          onClick={() => {
                            // If has critical, pick that component, else first available
                            const target = (Object.keys(server.components) as ComponentType[]).find(
                              c => server.components[c].status === 'critical_update'
                            ) || (Object.keys(server.components) as ComponentType[]).find(
                              c => server.components[c].status === 'update_available'
                            ) || 'BIOS';
                            onQuickUpgrade(server, target);
                          }}
                          className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors ${
                            hasCritical 
                              ? 'bg-amber-600 hover:bg-amber-700 text-white shadow-xs' 
                              : 'bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200'
                          }`}
                        >
                          <Sparkles className="w-3 h-3" />
                          <span>Upgrade</span>
                        </button>
                      )}

                      {/* Edit Device Button */}
                      {onEditServer && (
                        <button
                          type="button"
                          id={`btn-edit-server-${server.id}`}
                          onClick={() => onEditServer(server)}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors"
                          title="Edit device network, location, and installed firmware versions"
                        >
                          <Edit className="w-3.5 h-3.5" />
                        </button>
                      )}

                      {/* Delete Device Button */}
                      {onDeleteServer && (
                        <button
                          type="button"
                          id={`btn-delete-server-${server.id}`}
                          onClick={() => onDeleteServer(server)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                          title="Decommission and remove device from inventory"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}

                      {/* View Details Button */}
                      <button
                        type="button"
                        onClick={() => onViewDetails(server)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                        title="View device diagnostics and hardware telemetry"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Table Footer */}
      <div className="px-4 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
        <div>
          Showing <strong>{servers.length}</strong> server nodes in inventory
        </div>
        <div className="flex items-center space-x-4 font-mono text-[11px]">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            Up to date
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-indigo-500" />
            Update Available
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-amber-500" />
            Critical Errata (CVE)
          </span>
        </div>
      </div>
    </div>
  );
};
