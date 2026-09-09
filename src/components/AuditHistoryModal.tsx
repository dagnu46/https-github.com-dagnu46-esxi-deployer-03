import React, { useState } from 'react';
import { 
  History, 
  Download, 
  Search, 
  CheckCircle2, 
  AlertTriangle, 
  RotateCcw, 
  Filter,
  ArrowRight,
  Clock,
  User,
  FileSpreadsheet,
  FileCode,
  SlidersHorizontal
} from 'lucide-react';
import { AuditRecord, ComponentType } from '../types';
import { exportAuditLogsToCsv, exportAuditLogsToJson } from '../utils/exportUtils';

interface AuditHistoryViewProps {
  auditLogs: AuditRecord[];
  onOpenExportModal?: (initialDataset: 'audit') => void;
  onShowToast?: (message: string, type?: 'success' | 'info' | 'warn') => void;
}

export const AuditHistoryView: React.FC<AuditHistoryViewProps> = ({ 
  auditLogs,
  onOpenExportModal,
  onShowToast
}) => {
  const [search, setSearch] = useState('');
  const [componentFilter, setComponentFilter] = useState('all');

  const filteredLogs = auditLogs.filter(log => {
    const matchesSearch = 
      log.serverHostname.toLowerCase().includes(search.toLowerCase()) ||
      log.operator.toLowerCase().includes(search.toLowerCase()) ||
      log.firmwarePackageName.toLowerCase().includes(search.toLowerCase());
    const matchesComp = componentFilter === 'all' || log.component === componentFilter;
    return matchesSearch && matchesComp;
  });

  const handleExportCsv = () => {
    const dateStr = new Date().toISOString().split('T')[0];
    exportAuditLogsToCsv(filteredLogs, `firmware_audit_logs_${dateStr}.csv`);
    if (onShowToast) {
      onShowToast(`Exported ${filteredLogs.length} audit records to CSV`, 'success');
    }
  };

  const handleExportJson = () => {
    const dateStr = new Date().toISOString().split('T')[0];
    exportAuditLogsToJson(filteredLogs, `firmware_audit_logs_${dateStr}.json`);
    if (onShowToast) {
      onShowToast(`Exported ${filteredLogs.length} audit records to JSON`, 'success');
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2.5">
            <History className="w-5 h-5 text-indigo-600" />
            <h2 className="text-base font-bold text-slate-900">Firmware Lifecycle Audit Trail</h2>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Immutable log of all Redfish payload dispatches, chassis reboots, and flash completions for compliance auditing.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            id="btn-export-audit-csv"
            onClick={handleExportCsv}
            title="Download audit logs as CSV spreadsheet"
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 rounded-lg text-xs font-semibold shadow-xs transition-colors"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
            <span>Export CSV</span>
          </button>

          <button
            type="button"
            id="btn-export-audit-json"
            onClick={handleExportJson}
            title="Download audit logs as JSON dataset"
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 rounded-lg text-xs font-semibold shadow-xs transition-colors"
          >
            <FileCode className="w-3.5 h-3.5 text-indigo-600" />
            <span>Export JSON</span>
          </button>

          {onOpenExportModal && (
            <button
              type="button"
              id="btn-open-export-modal-audit"
              onClick={() => onOpenExportModal('audit')}
              title="Open full reporting and compliance export dialog"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export Report...</span>
            </button>
          )}
        </div>
      </div>

      {/* Filter toolbar */}
      <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
        <div className="relative flex-1 w-full sm:max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by server hostname, operator, or package..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-1.5 text-xs text-slate-800 bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-indigo-500 focus:bg-white"
          />
        </div>

        <div className="flex items-center space-x-2 w-full sm:w-auto">
          <label className="text-slate-500 font-medium">Component:</label>
          <select
            value={componentFilter}
            onChange={e => setComponentFilter(e.target.value)}
            className="p-1.5 border border-slate-200 rounded-lg bg-slate-50 text-slate-700 font-medium"
          >
            <option value="all">All Components</option>
            <option value="BIOS">BIOS</option>
            <option value="BMC">BMC</option>
            <option value="NIC">NIC</option>
            <option value="RAID">RAID</option>
            <option value="NVMe">NVMe</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-left text-xs">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                  Timestamp
                </th>
                <th className="px-4 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                  Target Server
                </th>
                <th className="px-4 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                  Component & Version Change
                </th>
                <th className="px-4 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                  Firmware Package
                </th>
                <th className="px-4 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                  Operator
                </th>
                <th className="px-4 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                  Duration
                </th>
                <th className="px-4 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider text-right">
                  Outcome
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white">
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-slate-500">
                    <History className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                    <p className="text-xs font-semibold text-slate-700">No audit records found</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">All audit log entries have been flushed.</p>
                  </td>
                </tr>
              ) : (
                filteredLogs.map(log => (
                <tr key={log.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="px-4 py-3.5 font-mono text-slate-600 whitespace-nowrap">
                    {log.timestamp}
                  </td>
                  <td className="px-4 py-3.5 font-mono font-bold text-slate-900">
                    {log.serverHostname}
                  </td>
                  <td className="px-4 py-3.5 font-mono">
                    <div className="flex items-center space-x-1.5">
                      <span className="px-1.5 py-0.2 bg-slate-100 rounded-sm font-semibold text-slate-700 text-[10px]">
                        {log.component}
                      </span>
                      <span className="text-slate-500">{log.fromVersion}</span>
                      <ArrowRight className="w-3 h-3 text-slate-400" />
                      <span className="font-bold text-indigo-700">{log.toVersion}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3.5 text-slate-700 max-w-xs truncate" title={log.firmwarePackageName}>
                    {log.firmwarePackageName}
                  </td>
                  <td className="px-4 py-3.5 text-slate-600 font-mono text-[11px]">
                    <div className="flex items-center gap-1">
                      <User className="w-3 h-3 text-slate-400" />
                      <span>{log.operator}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3.5 text-slate-500 font-mono">
                    {formatDuration(log.durationSeconds)}
                  </td>
                  <td className="px-4 py-3.5 text-right whitespace-nowrap">
                    {log.status === 'success' ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[11px] font-semibold">
                        <CheckCircle2 className="w-3 h-3" /> Success
                      </span>
                    ) : log.status === 'rolled_back' ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[11px] font-semibold">
                        <RotateCcw className="w-3 h-3" /> Rolled Back
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-100 text-red-800 text-[11px] font-bold">
                        <AlertTriangle className="w-3 h-3" /> Failed
                      </span>
                    )}
                  </td>
                </tr>
              ))
            )}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="px-4 py-3 bg-slate-50 border-t border-slate-200 text-xs text-slate-500">
          Showing <strong>{filteredLogs.length}</strong> recorded audit events
        </div>
      </div>
    </div>
  );
};
