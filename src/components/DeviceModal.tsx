import React, { useState, useEffect } from 'react';
import { 
  X, 
  Server as ServerIcon, 
  Plus, 
  Cpu, 
  HardDrive, 
  Wifi, 
  Layers, 
  MapPin, 
  Globe, 
  Check, 
  AlertCircle 
} from 'lucide-react';
import { Server, ServerModel, ComponentType, FirmwarePackage } from '../types';

interface DeviceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaveServer: (server: Server) => void;
  editingServer?: Server | null;
  firmwarePackages?: FirmwarePackage[];
}

export const DeviceModal: React.FC<DeviceModalProps> = ({
  isOpen,
  onClose,
  onSaveServer,
  editingServer,
  firmwarePackages = [],
}) => {
  const isEditing = !!editingServer;

  // Basic info
  const [hostname, setHostname] = useState('');
  const [model, setModel] = useState<ServerModel>('Dell PowerEdge R750');
  const [ip, setIp] = useState('');
  const [bmcIp, setBmcIp] = useState('');
  const [bmcAffectedType, setBmcAffectedType] = useState<Server['bmcAffectedType']>('iDRAC9');

  // Location fields
  const [datacenter, setDatacenter] = useState('US-East (Ashburn DC2)');
  const [rack, setRack] = useState('Rack B14');
  const [unit, setUnit] = useState('U24-U25');

  // Cluster & status
  const [cluster, setCluster] = useState('Production Kubernetes Cluster (US-East)');
  const [status, setStatus] = useState<Server['status']>('online');
  const [powerState, setPowerState] = useState<Server['powerState']>('on');
  const [powerSupplyRedundancy, setPowerSupplyRedundancy] = useState(true);
  const [tags, setTags] = useState('compute, primary');

  // Firmware versions
  const [biosVersion, setBiosVersion] = useState('2.18.1');
  const [bmcVersion, setBmcVersion] = useState('6.10.30.00');
  const [nicVersion, setNicVersion] = useState('22.36.1010');
  const [raidVersion, setRaidVersion] = useState('52.14.0-3910');
  const [nvmeVersion, setNvmeVersion] = useState('1.2.4');

  const [showAdvancedComponents, setShowAdvancedComponents] = useState(false);

  // Sync form when editingServer changes
  useEffect(() => {
    if (editingServer) {
      setHostname(editingServer.hostname);
      setModel(editingServer.model);
      setIp(editingServer.ip);
      setBmcIp(editingServer.bmcIp);
      setBmcAffectedType(editingServer.bmcAffectedType);
      setDatacenter(editingServer.datacenter);
      setRack(editingServer.rack);
      setUnit(editingServer.unit);
      setCluster(editingServer.cluster);
      setStatus(editingServer.status);
      setPowerState(editingServer.powerState);
      setPowerSupplyRedundancy(editingServer.powerSupplyRedundancy);
      setTags(editingServer.tags.join(', '));

      setBiosVersion(editingServer.components.BIOS?.currentVersion || '2.18.1');
      setBmcVersion(editingServer.components.BMC?.currentVersion || '6.10.30.00');
      setNicVersion(editingServer.components.NIC?.currentVersion || '22.36.1010');
      setRaidVersion(editingServer.components.RAID?.currentVersion || '52.14.0-3910');
      setNvmeVersion(editingServer.components.NVMe?.currentVersion || '1.2.4');
    } else {
      // Default new device values
      const randomNum = Math.floor(10 + Math.random() * 89);
      setHostname(`us-east-srv-${randomNum}`);
      setModel('Dell PowerEdge R750');
      setIp(`10.120.4.${randomNum}`);
      setBmcIp(`10.120.250.${randomNum}`);
      setBmcAffectedType('iDRAC9');
      setDatacenter('US-East (Ashburn DC2)');
      setRack('Rack B14');
      setUnit(`U${randomNum % 30 + 10}-U${randomNum % 30 + 11}`);
      setCluster('Production Kubernetes Cluster (US-East)');
      setStatus('online');
      setPowerState('on');
      setPowerSupplyRedundancy(true);
      setTags('worker, compute');
      setBiosVersion('2.18.1');
      setBmcVersion('6.10.30.00');
      setNicVersion('22.36.1010');
      setRaidVersion('52.14.0-3910');
      setNvmeVersion('1.2.4');
    }
  }, [editingServer, isOpen]);

  // When model changes, update default BMC type
  const handleModelChange = (m: ServerModel) => {
    setModel(m);
    if (m.startsWith('HPE')) setBmcAffectedType('iLO 5');
    else if (m.startsWith('Dell')) setBmcAffectedType('iDRAC9');
    else if (m.startsWith('Supermicro')) setBmcAffectedType('Supermicro IPMI');
    else if (m.startsWith('Lenovo')) setBmcAffectedType('Lenovo XClarity');
    else setBmcAffectedType('Cisco IMC');
  };

  // Helper to find latest package version for a component
  const getLatestPkgVersion = (comp: ComponentType, defaultVer: string): string => {
    const pkg = firmwarePackages.find(p => p.component === comp && p.supportedModels.includes(model));
    return pkg ? pkg.version : defaultVer;
  };

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!hostname.trim() || !ip.trim()) return;

    const latestBios = getLatestPkgVersion('BIOS', '2.20.0');
    const latestBmc = getLatestPkgVersion('BMC', '7.00.00.00');
    const latestNic = getLatestPkgVersion('NIC', '22.39.1002');
    const latestRaid = getLatestPkgVersion('RAID', '52.16.1-4122');
    const latestNvme = getLatestPkgVersion('NVMe', '1.3.0');

    const getStatusFor = (curr: string, lat: string): 'up_to_date' | 'update_available' | 'critical_update' => {
      if (curr === lat) return 'up_to_date';
      // If version is notably older or matches known CVE version
      if (curr.startsWith('2.18') || curr.startsWith('6.10')) return 'critical_update';
      return 'update_available';
    };

    const serverData: Server = {
      id: editingServer ? editingServer.id : `srv-${Date.now().toString().slice(-6)}`,
      hostname: hostname.trim(),
      model,
      ip: ip.trim(),
      bmcIp: bmcIp.trim() || ip.trim(),
      bmcAffectedType,
      datacenter: datacenter.trim(),
      rack: rack.trim(),
      unit: unit.trim(),
      cluster: cluster.trim(),
      architecture: editingServer?.architecture || 'x86_64',
      status,
      powerState,
      powerSupplyRedundancy,
      tags: tags.split(',').map(t => t.trim()).filter(Boolean),
      lastUpgradeDate: editingServer?.lastUpgradeDate || new Date().toISOString().split('T')[0],
      components: {
        BIOS: {
          type: 'BIOS',
          name: `${model.split(' ')[0]} UEFI BIOS`,
          vendor: model.startsWith('Dell') ? 'Dell Technologies' : model.startsWith('HPE') ? 'HPE' : 'Supermicro',
          currentVersion: biosVersion.trim(),
          latestVersion: latestBios,
          status: getStatusFor(biosVersion.trim(), latestBios),
          cveAlerts: biosVersion.trim() !== latestBios && biosVersion.startsWith('2.18') ? ['CVE-2026-21340'] : [],
          rebootRequired: true,
        },
        BMC: {
          type: 'BMC',
          name: `${bmcAffectedType} Controller`,
          vendor: model.startsWith('Dell') ? 'Dell Technologies' : model.startsWith('HPE') ? 'HPE' : 'Broadcom',
          currentVersion: bmcVersion.trim(),
          latestVersion: latestBmc,
          status: getStatusFor(bmcVersion.trim(), latestBmc),
          cveAlerts: bmcVersion.trim() !== latestBmc && bmcVersion.startsWith('6.10') ? ['CVE-2026-19401'] : [],
          rebootRequired: false,
        },
        NIC: {
          type: 'NIC',
          name: 'NVIDIA ConnectX-6 Dx Dual 100GbE',
          vendor: 'NVIDIA Networking',
          currentVersion: nicVersion.trim(),
          latestVersion: latestNic,
          status: getStatusFor(nicVersion.trim(), latestNic),
          rebootRequired: true,
        },
        RAID: {
          type: 'RAID',
          name: 'Enterprise SAS/NVMe RAID Controller',
          vendor: 'Broadcom',
          currentVersion: raidVersion.trim(),
          latestVersion: latestRaid,
          status: getStatusFor(raidVersion.trim(), latestRaid),
          rebootRequired: true,
        },
        NVMe: {
          type: 'NVMe',
          name: 'Enterprise NVMe U.3 SSD',
          vendor: 'Kioxia',
          currentVersion: nvmeVersion.trim(),
          latestVersion: latestNvme,
          status: getStatusFor(nvmeVersion.trim(), latestNvme),
          rebootRequired: false,
        },
      },
    };

    onSaveServer(serverData);
    onClose();
  };

  // Find available firmware packages matching this model
  const matchingBiosPackages = firmwarePackages.filter(p => p.component === 'BIOS' && p.supportedModels.includes(model));
  const matchingBmcPackages = firmwarePackages.filter(p => p.component === 'BMC' && p.supportedModels.includes(model));

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="relative bg-white rounded-2xl shadow-2xl max-w-2xl w-full border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-600/30 border border-indigo-500/40 flex items-center justify-center">
              <ServerIcon className="w-4 h-4 text-indigo-400" />
            </div>
            <div>
              <h3 className="text-base font-bold">
                {isEditing ? `Edit Device: ${editingServer.hostname}` : 'Add New Inventory Device'}
              </h3>
              <p className="text-xs text-slate-400">
                {isEditing ? 'Modify device network, physical location, and installed firmware versions' : 'Register a physical server node with location and current firmware baseline'}
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

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5 overflow-y-auto flex-1 text-xs">
          {/* Section 1: Device Identification & Model */}
          <div>
            <h4 className="text-[11px] font-bold text-slate-900 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <ServerIcon className="w-3.5 h-3.5 text-indigo-600" />
              <span>Device Identification & Hardware Model</span>
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Device Hostname <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. us-east-k8s-node-04"
                  value={hostname}
                  onChange={e => setHostname(e.target.value)}
                  className="w-full p-2.5 font-mono text-xs border border-slate-200 rounded-lg bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Hardware Model <span className="text-red-500">*</span>
                </label>
                <select
                  value={model}
                  onChange={e => handleModelChange(e.target.value as ServerModel)}
                  className="w-full p-2.5 text-xs border border-slate-200 rounded-lg bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-hidden font-medium"
                >
                  <option value="Dell PowerEdge R750">Dell PowerEdge R750 (2U)</option>
                  <option value="Dell PowerEdge R650">Dell PowerEdge R650 (1U)</option>
                  <option value="HPE ProLiant DL380 Gen10">HPE ProLiant DL380 Gen10 (2U)</option>
                  <option value="HPE ProLiant DL360 Gen10">HPE ProLiant DL360 Gen10 (1U)</option>
                  <option value="Supermicro Hyper SuperServer">Supermicro Hyper SuperServer (2U)</option>
                  <option value="Lenovo ThinkSystem SR650 V2">Lenovo ThinkSystem SR650 V2 (2U)</option>
                  <option value="Cisco UCS C240 M6">Cisco UCS C240 M6 (2U)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Section 2: IP Address & Network Settings */}
          <div>
            <h4 className="text-[11px] font-bold text-slate-900 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Globe className="w-3.5 h-3.5 text-indigo-600" />
              <span>Network & Out-of-Band BMC (IPMI / Redfish)</span>
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Host IP Address <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="10.120.4.15"
                  value={ip}
                  onChange={e => setIp(e.target.value)}
                  className="w-full p-2.5 font-mono text-xs border border-slate-200 rounded-lg bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  BMC (OOB) IP Address
                </label>
                <input
                  type="text"
                  placeholder="10.120.250.15"
                  value={bmcIp}
                  onChange={e => setBmcIp(e.target.value)}
                  className="w-full p-2.5 font-mono text-xs border border-slate-200 rounded-lg bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">BMC Controller Type</label>
                <select
                  value={bmcAffectedType}
                  onChange={e => setBmcAffectedType(e.target.value as any)}
                  className="w-full p-2.5 text-xs border border-slate-200 rounded-lg bg-slate-50 focus:bg-white font-mono"
                >
                  <option value="iDRAC9">Dell iDRAC9</option>
                  <option value="iLO 5">HPE iLO 5</option>
                  <option value="Supermicro IPMI">Supermicro IPMI</option>
                  <option value="Lenovo XClarity">Lenovo XClarity</option>
                  <option value="Cisco IMC">Cisco IMC</option>
                </select>
              </div>
            </div>
          </div>

          {/* Section 3: Physical Location */}
          <div>
            <h4 className="text-[11px] font-bold text-slate-900 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-indigo-600" />
              <span>Physical Datacenter Location</span>
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Datacenter</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. US-East (Ashburn DC2)"
                  value={datacenter}
                  onChange={e => setDatacenter(e.target.value)}
                  className="w-full p-2.5 text-xs border border-slate-200 rounded-lg bg-slate-50 focus:bg-white"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Rack Identifier</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Rack B14"
                  value={rack}
                  onChange={e => setRack(e.target.value)}
                  className="w-full p-2.5 text-xs border border-slate-200 rounded-lg bg-slate-50 focus:bg-white"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Rack Unit (U-Slot)</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. U24-U25"
                  value={unit}
                  onChange={e => setUnit(e.target.value)}
                  className="w-full p-2.5 text-xs border border-slate-200 rounded-lg bg-slate-50 focus:bg-white"
                />
              </div>
            </div>
          </div>

          {/* Section 4: Current Firmware Version Tracking (CRUCIAL REQUIREMENT) */}
          <div className="p-4 bg-indigo-50/50 border border-indigo-200/80 rounded-xl space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-xs font-bold text-indigo-950 uppercase tracking-wider flex items-center gap-1.5">
                  <Cpu className="w-4 h-4 text-indigo-700" />
                  <span>Current Installed Firmware Versions</span>
                </h4>
                <p className="text-[11px] text-slate-600 mt-0.5">
                  Specify the currently active firmware flashed on this server's primary controllers.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowAdvancedComponents(!showAdvancedComponents)}
                className="text-[11px] text-indigo-700 hover:text-indigo-900 font-semibold underline"
              >
                {showAdvancedComponents ? 'Hide Peripheral Components' : 'Show All 5 Components'}
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-1">
              {/* Primary BIOS / UEFI Version */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block font-semibold text-slate-800">
                    System ROM (UEFI BIOS) Version <span className="text-red-500">*</span>
                  </label>
                  {matchingBiosPackages.length > 0 && (
                    <span className="text-[10px] text-slate-500">
                      Latest catalog: <strong>{matchingBiosPackages[0].version}</strong>
                    </span>
                  )}
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    required
                    placeholder="e.g. 2.18.1 or 2.20.0"
                    value={biosVersion}
                    onChange={e => setBiosVersion(e.target.value)}
                    className="w-full p-2.5 font-mono text-xs border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                  />
                  {matchingBiosPackages.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setBiosVersion(matchingBiosPackages[0].version)}
                      className="px-2.5 py-1 text-[10px] font-semibold bg-white border border-indigo-200 text-indigo-700 rounded-lg hover:bg-indigo-50 whitespace-nowrap"
                      title="Set to latest verified catalog version"
                    >
                      Set Latest
                    </button>
                  )}
                </div>
              </div>

              {/* BMC / Out-of-Band Controller Version */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block font-semibold text-slate-800">
                    BMC Controller Version ({bmcAffectedType}) <span className="text-red-500">*</span>
                  </label>
                  {matchingBmcPackages.length > 0 && (
                    <span className="text-[10px] text-slate-500">
                      Latest catalog: <strong>{matchingBmcPackages[0].version}</strong>
                    </span>
                  )}
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    required
                    placeholder="e.g. 6.10.30.00 or 7.00.00.00"
                    value={bmcVersion}
                    onChange={e => setBmcVersion(e.target.value)}
                    className="w-full p-2.5 font-mono text-xs border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                  />
                  {matchingBmcPackages.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setBmcVersion(matchingBmcPackages[0].version)}
                      className="px-2.5 py-1 text-[10px] font-semibold bg-white border border-indigo-200 text-indigo-700 rounded-lg hover:bg-indigo-50 whitespace-nowrap"
                      title="Set to latest verified catalog version"
                    >
                      Set Latest
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Advanced Peripheral Components (NIC, RAID, NVMe) */}
            {showAdvancedComponents && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-indigo-100">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1 flex items-center gap-1">
                    <Wifi className="w-3 h-3 text-sky-600" /> NIC Controller Version
                  </label>
                  <input
                    type="text"
                    value={nicVersion}
                    onChange={e => setNicVersion(e.target.value)}
                    className="w-full p-2 font-mono text-xs border border-slate-300 rounded-lg bg-white"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1 flex items-center gap-1">
                    <Layers className="w-3 h-3 text-amber-600" /> RAID Controller Version
                  </label>
                  <input
                    type="text"
                    value={raidVersion}
                    onChange={e => setRaidVersion(e.target.value)}
                    className="w-full p-2 font-mono text-xs border border-slate-300 rounded-lg bg-white"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1 flex items-center gap-1">
                    <HardDrive className="w-3 h-3 text-emerald-600" /> NVMe SSD Firmware
                  </label>
                  <input
                    type="text"
                    value={nvmeVersion}
                    onChange={e => setNvmeVersion(e.target.value)}
                    className="w-full p-2 font-mono text-xs border border-slate-300 rounded-lg bg-white"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Section 5: Cluster & Operational Status */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Cluster Assignment</label>
              <input
                type="text"
                value={cluster}
                onChange={e => setCluster(e.target.value)}
                className="w-full p-2.5 text-xs border border-slate-200 rounded-lg bg-slate-50 focus:bg-white"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Lifecycle Status</label>
              <select
                value={status}
                onChange={e => setStatus(e.target.value as any)}
                className="w-full p-2.5 text-xs border border-slate-200 rounded-lg bg-slate-50 focus:bg-white capitalize font-medium"
              >
                <option value="online">Online (Serving Traffic)</option>
                <option value="maintenance">Maintenance Mode (Drained)</option>
                <option value="degraded">Degraded</option>
                <option value="offline">Offline / Unreachable</option>
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Power Redundancy</label>
              <div className="flex items-center gap-3 pt-2">
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={powerSupplyRedundancy}
                    onChange={e => setPowerSupplyRedundancy(e.target.checked)}
                    className="rounded-sm border-slate-300 text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer"
                  />
                  <span className="text-xs text-slate-700 font-medium">Dual Redundant PSU</span>
                </label>
              </div>
            </div>
          </div>

          {/* Tags */}
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Inventory Tags (comma separated)</label>
            <input
              type="text"
              placeholder="worker, compute, tier-1"
              value={tags}
              onChange={e => setTags(e.target.value)}
              className="w-full p-2.5 text-xs border border-slate-200 rounded-lg bg-slate-50 focus:bg-white"
            />
          </div>

          {/* Form Actions */}
          <div className="pt-4 border-t border-slate-200 flex items-center justify-end space-x-3 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-slate-600 hover:text-slate-900 font-semibold"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-semibold shadow-xs flex items-center gap-1.5 transition-colors"
            >
              <Check className="w-4 h-4" />
              <span>{isEditing ? 'Save Device Changes' : 'Register Device in Inventory'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
