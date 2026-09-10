import React, { useState } from 'react';
import { 
  FileCode, 
  Search, 
  Filter, 
  CheckCircle2, 
  AlertTriangle, 
  HardDrive, 
  Cpu, 
  Wifi, 
  Server as ServerIcon, 
  Layers, 
  Play, 
  Edit2, 
  Trash2, 
  Copy, 
  Check, 
  ExternalLink,
  ShieldCheck,
  Download
} from 'lucide-react';
import { FirmwarePackage, ComponentType } from '../types';

interface FirmwareListAvailableProps {
  packages: FirmwarePackage[];
  onSelectForEdit?: (pkg: FirmwarePackage) => void;
  onDeployPackage: (pkg: FirmwarePackage) => void;
  onInspectPackageFile?: (pkg: FirmwarePackage) => void;
  onDeletePackage?: (pkgId: string) => void;
}

export const FirmwareListAvailable: React.FC<FirmwareListAvailableProps> = ({
  packages,
  onSelectForEdit,
  onDeployPackage,
  onInspectPackageFile,
  onDeletePackage,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedComponentFilter, setSelectedComponentFilter] = useState<string>('all');
  const [copiedSha, setCopiedSha] = useState<string | null>(null);

  const handleCopySha = (sha: string) => {
    navigator.clipboard.writeText(sha);
    setCopiedSha(sha);
    setTimeout(() => setCopiedSha(null), 2000);
  };

  const getComponentIcon = (comp: ComponentType | string) => {
    switch (comp) {
      case 'BIOS': return <Cpu className="w-3.5 h-3.5 text-blue-600" />;
      case 'BMC': return <ServerIcon className="w-3.5 h-3.5 text-indigo-600" />;
      case 'NIC': return <Wifi className="w-3.5 h-3.5 text-emerald-600" />;
      case 'RAID': return <HardDrive className="w-3.5 h-3.5 text-purple-600" />;
      case 'NVMe': return <HardDrive className="w-3.5 h-3.5 text-cyan-600" />;
      case 'CPLD': return <Layers className="w-3.5 h-3.5 text-amber-600" />;
      case 'PSU': return <Layers className="w-3.5 h-3.5 text-slate-600" />;
      default: return <FileCode className="w-3.5 h-3.5 text-slate-600" />;
    }
  };

  const filteredPackages = packages.filter(pkg => {
    const matchesComponent = selectedComponentFilter === 'all' || pkg.component === selectedComponentFilter;
    const q = searchQuery.toLowerCase().trim();
    const matchesSearch = !q || 
      pkg.name.toLowerCase().includes(q) ||
      pkg.fileName.toLowerCase().includes(q) ||
      pkg.version.toLowerCase().includes(q) ||
      pkg.vendor.toLowerCase().includes(q) ||
      pkg.sha256.toLowerCase().includes(q);
    return matchesComponent && matchesSearch;
  });

  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
      {/* Header bar */}
      <div className="p-4 border-b border-slate-200 bg-slate-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center space-x-2.5">
          <div className="w-8 h-8 rounded-lg bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-600">
            <FileCode className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-slate-900">Firmware List Available</h3>
              <span className="px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800 text-[11px] font-bold">
                {packages.length} Packages Ready
              </span>
            </div>
            <p className="text-xs text-slate-500">
              Validated firmware binaries staged in server repository and ready for rollout execution.
            </p>
          </div>
        </div>

        {/* Search and Component Filter */}
        <div className="flex items-center flex-wrap gap-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search available firmwares..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="pl-8 pr-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 w-48 sm:w-56"
            />
          </div>

          <div className="inline-flex rounded-lg border border-slate-300 bg-white p-0.5">
            {['all', 'BIOS', 'BMC', 'NIC', 'RAID', 'NVMe', 'CPLD'].map(comp => (
              <button
                key={comp}
                type="button"
                onClick={() => setSelectedComponentFilter(comp)}
                className={`px-2 py-1 text-[11px] font-semibold rounded transition-colors ${
                  selectedComponentFilter === comp
                    ? 'bg-indigo-600 text-white'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {comp}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="bg-slate-100/70 border-b border-slate-200 text-slate-600 text-[11px] font-semibold uppercase tracking-wider">
              <th className="py-2.5 px-4">Component & Name</th>
              <th className="py-2.5 px-3">Target Version</th>
              <th className="py-2.5 px-3">Server Disk Location</th>
              <th className="py-2.5 px-3">SHA-256 Checksum</th>
              <th className="py-2.5 px-3">Severity & Models</th>
              <th className="py-2.5 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 text-slate-700">
            {filteredPackages.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-8 text-center text-slate-500">
                  <FileCode className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                  <p className="font-medium text-xs">No matching firmware packages available</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">Try adjusting search or upload a new binary</p>
                </td>
              </tr>
            ) : (
              filteredPackages.map(pkg => (
                <tr key={pkg.id} className="hover:bg-slate-50/80 transition-colors">
                  {/* Component & Name */}
                  <td className="py-3 px-4">
                    <div className="flex items-start space-x-2.5">
                      <div className="mt-0.5 p-1.5 rounded-md bg-slate-100 border border-slate-200 shrink-0">
                        {getComponentIcon(pkg.component)}
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-slate-900">{pkg.name}</span>
                          <span className="px-1.5 py-0.2 text-[10px] font-bold rounded bg-slate-100 text-slate-700 uppercase">
                            {pkg.component}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-500 font-mono mt-0.5 flex items-center gap-1">
                          <span>{pkg.fileName}</span>
                          <span>•</span>
                          <span>{pkg.vendor}</span>
                        </div>
                      </div>
                    </div>
                  </td>

                  {/* Version */}
                  <td className="py-3 px-3">
                    <span className="font-mono font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200 text-xs">
                      v{pkg.version}
                    </span>
                    <div className="text-[10px] text-slate-400 mt-1">
                      Release: {pkg.releaseDate}
                    </div>
                  </td>

                  {/* Server Disk Location */}
                  <td className="py-3 px-3">
                    <div className="flex items-center gap-1 text-[11px] font-mono text-emerald-700">
                      <HardDrive className="w-3 h-3 text-emerald-600 shrink-0" />
                      <span className="truncate max-w-[140px]" title={pkg.storedPathOnServer || `/uploads/firmware/${pkg.fileName}`}>
                        {pkg.storedPathOnServer || `/uploads/firmware/${pkg.fileName}`}
                      </span>
                    </div>
                    <div className="text-[10px] text-slate-500 mt-0.5 flex items-center gap-1.5">
                      <span>{pkg.fileSizeMb} MB</span>
                      <span>•</span>
                      <span className="text-emerald-600 font-semibold flex items-center gap-0.5">
                        <CheckCircle2 className="w-2.5 h-2.5" /> Ready
                      </span>
                    </div>
                  </td>

                  {/* SHA-256 */}
                  <td className="py-3 px-3">
                    <div className="flex items-center gap-1 font-mono text-[11px] text-slate-600">
                      <span className="truncate max-w-[120px]" title={pkg.sha256}>
                        {pkg.sha256.substring(0, 14)}...
                      </span>
                      <button
                        type="button"
                        onClick={() => handleCopySha(pkg.sha256)}
                        className="p-1 hover:bg-slate-200 rounded text-slate-500 hover:text-slate-800 transition-colors"
                        title="Copy SHA-256 Checksum"
                      >
                        {copiedSha === pkg.sha256 ? (
                          <Check className="w-3 h-3 text-emerald-600" />
                        ) : (
                          <Copy className="w-3 h-3" />
                        )}
                      </button>
                    </div>
                  </td>

                  {/* Severity & Models */}
                  <td className="py-3 px-3">
                    <div className="flex items-center gap-1.5">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${
                        pkg.severity === 'critical'
                          ? 'bg-red-100 text-red-700'
                          : pkg.severity === 'recommended'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-slate-100 text-slate-700'
                      }`}>
                        {pkg.severity}
                      </span>
                      {pkg.rebootRequired && (
                        <span className="text-[10px] text-slate-500">Reboot req.</span>
                      )}
                    </div>
                    <div className="text-[10px] text-slate-500 mt-1 truncate max-w-[150px]" title={pkg.supportedModels.join(', ')}>
                      {pkg.supportedModels.length} models supported
                    </div>
                  </td>

                  {/* Actions */}
                  <td className="py-3 px-4 text-right">
                    <div className="flex items-center justify-end space-x-1.5">
                      <button
                        type="button"
                        onClick={() => onDeployPackage(pkg)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-md text-xs font-semibold transition-colors"
                        title="Launch Rollout Campaign using this firmware"
                      >
                        <Play className="w-3 h-3 text-indigo-600 fill-indigo-600" />
                        <span>Rollout</span>
                      </button>

                      {onInspectPackageFile && (
                        <button
                          type="button"
                          onClick={() => onInspectPackageFile(pkg)}
                          className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-md transition-colors"
                          title="Inspect binary storage on physical server disk"
                        >
                          <HardDrive className="w-3.5 h-3.5 text-emerald-600" />
                        </button>
                      )}

                      {onSelectForEdit && (
                        <button
                          type="button"
                          onClick={() => onSelectForEdit(pkg)}
                          className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-md transition-colors"
                          title="Edit package parameters"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                      )}

                      {onDeletePackage && (
                        <button
                          type="button"
                          onClick={() => onDeletePackage(pkg.id)}
                          className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                          title="Delete firmware package"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
