import React, { useState } from 'react';
import { X, Server as ServerIcon, Plus, Cpu } from 'lucide-react';
import { Server, ServerModel } from '../types';

interface AddServerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddServer: (server: Server) => void;
}

export const AddServerModal: React.FC<AddServerModalProps> = ({
  isOpen,
  onClose,
  onAddServer,
}) => {
  const [hostname, setHostname] = useState('');
  const [model, setModel] = useState<ServerModel>('Dell PowerEdge R750');
  const [cluster, setCluster] = useState('Production Kubernetes Cluster (US-East)');
  const [datacenter, setDatacenter] = useState('US-East (Ashburn DC2)');
  const [rack, setRack] = useState('Rack B14');
  const [unit, setUnit] = useState('U24-U25');
  const [ip, setIp] = useState('10.120.4.14');
  const [bmcIp, setBmcIp] = useState('10.120.250.14');
  const [bmcAffectedType, setBmcAffectedType] = useState<Server['bmcAffectedType']>('iDRAC9');
  const [tags, setTags] = useState('worker, newly-provisioned');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!hostname) return;

    const vendor = (model.startsWith('HPE') || model.startsWith('HP')) ? 'HP' : model.startsWith('Dell') ? 'DELL' : 'LENOVO';

    const newServer: Server = {
      id: `srv-${Date.now().toString().slice(-4)}`,
      hostname,
      cluster,
      datacenter,
      rack,
      unit,
      ip,
      bmcIp,
      bmcAffectedType,
      model,
      vendor,
      hypervisor: 'VMware ESXi',
      hypervisorVersion: 'ESXi 8.0 Update 2 (Build 22380479)',
      hypervisorMaintenanceMode: false,
      activeVmsCount: 12,
      architecture: 'x86_64',
      status: 'online',
      powerState: 'on',
      powerSupplyRedundancy: true,
      tags: tags.split(',').map(t => t.trim()).filter(Boolean),
      components: {
        BIOS: {
          type: 'BIOS',
          name: `${model.split(' ')[0]} UEFI BIOS`,
          vendor: model.startsWith('Dell') ? 'Dell Technologies' : model.startsWith('HPE') ? 'Hewlett Packard Enterprise' : 'Supermicro',
          currentVersion: '2.18.1',
          latestVersion: '2.20.0',
          status: 'critical_update',
          cveAlerts: ['CVE-2026-21340'],
          rebootRequired: true,
        },
        BMC: {
          type: 'BMC',
          name: `${bmcAffectedType} Controller`,
          vendor: model.startsWith('Dell') ? 'Dell Technologies' : 'HPE',
          currentVersion: '6.10.30.00',
          latestVersion: '7.00.00.00',
          status: 'critical_update',
          cveAlerts: ['CVE-2026-19401'],
          rebootRequired: false,
        },
        NIC: {
          type: 'NIC',
          name: 'NVIDIA ConnectX-6 Dx Dual 100GbE',
          vendor: 'NVIDIA Networking',
          currentVersion: '22.36.1010',
          latestVersion: '22.39.1002',
          status: 'update_available',
          rebootRequired: true,
        },
        RAID: {
          type: 'RAID',
          name: 'Enterprise SAS/NVMe RAID Controller',
          vendor: 'Broadcom',
          currentVersion: '52.14.0-3910',
          latestVersion: '52.16.1-4122',
          status: 'update_available',
          rebootRequired: true,
        },
        NVMe: {
          type: 'NVMe',
          name: 'Enterprise NVMe U.3 SSD',
          vendor: 'Kioxia',
          currentVersion: '1.2.4',
          latestVersion: '1.3.0',
          status: 'update_available',
          rebootRequired: false,
        },
      },
    };

    onAddServer(newServer);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="relative bg-white rounded-2xl shadow-2xl max-w-lg w-full border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <ServerIcon className="w-5 h-5 text-indigo-400" />
            <h3 className="text-base font-bold">Register Server Node</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-3.5 text-xs">
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Server Hostname</label>
            <input
              type="text"
              required
              placeholder="e.g. us-east-k8s-node-04"
              value={hostname}
              onChange={e => setHostname(e.target.value)}
              className="w-full p-2 font-mono border border-slate-200 rounded-lg bg-slate-50 focus:bg-white"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Server Model</label>
              <select
                value={model}
                onChange={e => {
                  const m = e.target.value as ServerModel;
                  setModel(m);
                  if (m.startsWith('HPE')) setBmcAffectedType('iLO 5');
                  else if (m.startsWith('Dell')) setBmcAffectedType('iDRAC9');
                  else if (m.startsWith('Supermicro')) setBmcAffectedType('Supermicro IPMI');
                  else if (m.startsWith('Lenovo')) setBmcAffectedType('Lenovo XClarity');
                  else setBmcAffectedType('Cisco IMC');
                }}
                className="w-full p-2 border border-slate-200 rounded-lg bg-slate-50 focus:bg-white"
              >
                <option value="Dell PowerEdge R750">Dell PowerEdge R750</option>
                <option value="Dell PowerEdge R650">Dell PowerEdge R650</option>
                <option value="HPE ProLiant DL380 Gen10">HPE ProLiant DL380 Gen10</option>
                <option value="Supermicro Hyper SuperServer">Supermicro Hyper SuperServer</option>
                <option value="Lenovo ThinkSystem SR650 V2">Lenovo ThinkSystem SR650 V2</option>
                <option value="Cisco UCS C240 M6">Cisco UCS C240 M6</option>
              </select>
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Out-of-Band BMC</label>
              <select
                value={bmcAffectedType}
                onChange={e => setBmcAffectedType(e.target.value as any)}
                className="w-full p-2 border border-slate-200 rounded-lg bg-slate-50 focus:bg-white font-mono"
              >
                <option value="iDRAC9">Dell iDRAC9</option>
                <option value="iLO 5">HPE iLO 5</option>
                <option value="Supermicro IPMI">Supermicro IPMI</option>
                <option value="Lenovo XClarity">Lenovo XClarity</option>
                <option value="Cisco IMC">Cisco IMC</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Host IP Address</label>
              <input
                type="text"
                required
                value={ip}
                onChange={e => setIp(e.target.value)}
                className="w-full p-2 font-mono border border-slate-200 rounded-lg bg-slate-50 focus:bg-white"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">BMC (OOB) IP Address</label>
              <input
                type="text"
                required
                value={bmcIp}
                onChange={e => setBmcIp(e.target.value)}
                className="w-full p-2 font-mono border border-slate-200 rounded-lg bg-slate-50 focus:bg-white"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Datacenter</label>
              <input
                type="text"
                value={datacenter}
                onChange={e => setDatacenter(e.target.value)}
                className="w-full p-2 border border-slate-200 rounded-lg bg-slate-50 focus:bg-white"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Rack & Unit Location</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Rack B14"
                  value={rack}
                  onChange={e => setRack(e.target.value)}
                  className="w-1/2 p-2 border border-slate-200 rounded-lg bg-slate-50 focus:bg-white"
                />
                <input
                  type="text"
                  placeholder="U24-U25"
                  value={unit}
                  onChange={e => setUnit(e.target.value)}
                  className="w-1/2 p-2 border border-slate-200 rounded-lg bg-slate-50 focus:bg-white"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Cluster Assignment</label>
            <input
              type="text"
              value={cluster}
              onChange={e => setCluster(e.target.value)}
              className="w-full p-2 border border-slate-200 rounded-lg bg-slate-50 focus:bg-white"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Tags (comma separated)</label>
            <input
              type="text"
              value={tags}
              onChange={e => setTags(e.target.value)}
              className="w-full p-2 border border-slate-200 rounded-lg bg-slate-50 focus:bg-white"
            />
          </div>

          <div className="pt-4 border-t border-slate-200 flex items-center justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-slate-600 hover:text-slate-900 font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-semibold"
            >
              Register & Probe Redfish
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
