import React, { useState } from 'react';
import { 
  X, 
  Download, 
  FileSpreadsheet, 
  FileCode, 
  Server as ServerIcon, 
  History, 
  ShieldCheck, 
  CheckCircle2, 
  Layers,
  Database,
  Info
} from 'lucide-react';
import { Server, AuditRecord } from '../types';
import { 
  exportFleetToCsv, 
  exportFleetToJson, 
  exportAuditLogsToCsv, 
  exportAuditLogsToJson, 
  exportCombinedComplianceReport 
} from '../utils/exportUtils';

export type ExportDataset = 'fleet' | 'audit' | 'combined';
export type ExportFormat = 'csv' | 'json';

interface ExportReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  allServers: Server[];
  filteredServers?: Server[];
  selectedServerIds?: string[];
  allAuditLogs: AuditRecord[];
  filteredAuditLogs?: AuditRecord[];
  initialDataset?: ExportDataset;
  onShowToast?: (message: string, type?: 'success' | 'info' | 'warn') => void;
}

export const ExportReportModal: React.FC<ExportReportModalProps> = ({
  isOpen,
  onClose,
  allServers,
  filteredServers,
  selectedServerIds = [],
  allAuditLogs,
  filteredAuditLogs,
  initialDataset = 'fleet',
  onShowToast,
}) => {
  const [dataset, setDataset] = useState<ExportDataset>(initialDataset);
  const [format, setFormat] = useState<ExportFormat>('csv');
  const [useFilteredScope, setUseFilteredScope] = useState<boolean>(false);
  const [isExporting, setIsExporting] = useState<boolean>(false);

  if (!isOpen) return null;

  // Compute targeted servers
  const effectiveFilteredServers = filteredServers || allServers;
  const serversToExport = useFilteredScope ? effectiveFilteredServers : allServers;

  // Compute targeted logs
  const effectiveFilteredLogs = filteredAuditLogs || allAuditLogs;
  const logsToExport = useFilteredScope ? effectiveFilteredLogs : allAuditLogs;

  const handleExecuteExport = () => {
    setIsExporting(true);
    const dateStr = new Date().toISOString().split('T')[0];

    try {
      if (dataset === 'fleet') {
        if (format === 'csv') {
          exportFleetToCsv(serversToExport, `fleet_inventory_${dateStr}.csv`);
        } else {
          exportFleetToJson(serversToExport, `fleet_inventory_${dateStr}.json`);
        }
        if (onShowToast) {
          onShowToast(`Exported ${serversToExport.length} server nodes to ${format.toUpperCase()}`, 'success');
        }
      } else if (dataset === 'audit') {
        if (format === 'csv') {
          exportAuditLogsToCsv(logsToExport, `firmware_audit_trail_${dateStr}.csv`);
        } else {
          exportAuditLogsToJson(logsToExport, `firmware_audit_trail_${dateStr}.json`);
        }
        if (onShowToast) {
          onShowToast(`Exported ${logsToExport.length} audit records to ${format.toUpperCase()}`, 'success');
        }
      } else if (dataset === 'combined') {
        exportCombinedComplianceReport(
          serversToExport,
          logsToExport,
          format,
          `compliance_master_report_${dateStr}.${format}`
        );
        if (onShowToast) {
          onShowToast(
            `Exported combined compliance report (${serversToExport.length} servers, ${logsToExport.length} logs) to ${format.toUpperCase()}`,
            'success'
          );
        }
      }

      setTimeout(() => {
        setIsExporting(false);
        onClose();
      }, 400);
    } catch (err: any) {
      setIsExporting(false);
      if (onShowToast) {
        onShowToast(`Export failed: ${err.message}`, 'warn');
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-150">
      <div 
        id="export-reports-modal"
        className="relative w-full max-w-2xl bg-white border border-slate-200 rounded-2xl shadow-2xl text-slate-800 overflow-hidden"
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-200 bg-slate-50/70">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-50 border border-indigo-200 rounded-xl text-indigo-600">
              <Download className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Export Fleet & Audit Reports
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Generate offline reporting archives in standard CSV or structured JSON format.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
          
          {/* Step 1: Select Dataset */}
          <div className="space-y-2.5">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">
              1. Select Data Collection
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Fleet Option */}
              <button
                type="button"
                id="btn-select-dataset-fleet"
                onClick={() => setDataset('fleet')}
                className={`p-3.5 rounded-xl border text-left transition-all flex flex-col justify-between ${
                  dataset === 'fleet'
                    ? 'border-indigo-600 bg-indigo-50/50 ring-2 ring-indigo-500/20'
                    : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <ServerIcon className={`w-4 h-4 ${dataset === 'fleet' ? 'text-indigo-600' : 'text-slate-500'}`} />
                    <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 font-semibold">
                      {serversToExport.length} nodes
                    </span>
                  </div>
                  <h4 className="text-xs font-bold text-slate-900">Fleet Inventory</h4>
                  <p className="text-[11px] text-slate-500 mt-1 leading-snug">
                    Server models, OOB IPs, hypervisors, and BIOS/BMC/NIC/RAID firmware states.
                  </p>
                </div>
              </button>

              {/* Audit Option */}
              <button
                type="button"
                id="btn-select-dataset-audit"
                onClick={() => setDataset('audit')}
                className={`p-3.5 rounded-xl border text-left transition-all flex flex-col justify-between ${
                  dataset === 'audit'
                    ? 'border-indigo-600 bg-indigo-50/50 ring-2 ring-indigo-500/20'
                    : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <History className={`w-4 h-4 ${dataset === 'audit' ? 'text-indigo-600' : 'text-slate-500'}`} />
                    <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 font-semibold">
                      {logsToExport.length} logs
                    </span>
                  </div>
                  <h4 className="text-xs font-bold text-slate-900">Audit Trail Logs</h4>
                  <p className="text-[11px] text-slate-500 mt-1 leading-snug">
                    Immutable execution history, operator logs, version deltas, and durations.
                  </p>
                </div>
              </button>

              {/* Combined Option */}
              <button
                type="button"
                id="btn-select-dataset-combined"
                onClick={() => setDataset('combined')}
                className={`p-3.5 rounded-xl border text-left transition-all flex flex-col justify-between ${
                  dataset === 'combined'
                    ? 'border-indigo-600 bg-indigo-50/50 ring-2 ring-indigo-500/20'
                    : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <ShieldCheck className={`w-4 h-4 ${dataset === 'combined' ? 'text-indigo-600' : 'text-slate-500'}`} />
                    <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 font-semibold">
                      Master Bundle
                    </span>
                  </div>
                  <h4 className="text-xs font-bold text-slate-900">Combined Compliance</h4>
                  <p className="text-[11px] text-slate-500 mt-1 leading-snug">
                    Full datacenter bundle containing both inventory matrix and audit records.
                  </p>
                </div>
              </button>
            </div>
          </div>

          {/* Step 2: Select File Format */}
          <div className="space-y-2.5">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">
              2. File Format
            </label>
            <div className="grid grid-cols-2 gap-3">
              {/* CSV Format */}
              <button
                type="button"
                id="btn-format-csv"
                onClick={() => setFormat('csv')}
                className={`p-3 rounded-xl border text-left transition-all flex items-center gap-3 ${
                  format === 'csv'
                    ? 'border-indigo-600 bg-indigo-50/50 ring-2 ring-indigo-500/20'
                    : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                }`}
              >
                <div className={`p-2 rounded-lg ${format === 'csv' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600'}`}>
                  <FileSpreadsheet className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-900">CSV (.csv)</span>
                    <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-medium">Excel / Sheets</span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Comma-delimited with UTF-8 BOM for spreadsheet analysis and audits.
                  </p>
                </div>
              </button>

              {/* JSON Format */}
              <button
                type="button"
                id="btn-format-json"
                onClick={() => setFormat('json')}
                className={`p-3 rounded-xl border text-left transition-all flex items-center gap-3 ${
                  format === 'json'
                    ? 'border-indigo-600 bg-indigo-50/50 ring-2 ring-indigo-500/20'
                    : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                }`}
              >
                <div className={`p-2 rounded-lg ${format === 'json' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600'}`}>
                  <FileCode className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-900">JSON (.json)</span>
                    <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-medium">Structured</span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Structured objects with full metadata for SIEM, CMDB, or script ingestion.
                  </p>
                </div>
              </button>
            </div>
          </div>

          {/* Scope selection if filters exist */}
          {((filteredServers && filteredServers.length !== allServers.length) || (filteredAuditLogs && filteredAuditLogs.length !== allAuditLogs.length)) && (
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2">
              <label className="block text-xs font-semibold text-slate-700">
                Data Scope Filter
              </label>
              <div className="flex items-center gap-4 text-xs">
                <label className="inline-flex items-center gap-2 cursor-pointer text-slate-700">
                  <input
                    type="radio"
                    name="scope-filter"
                    checked={!useFilteredScope}
                    onChange={() => setUseFilteredScope(false)}
                    className="text-indigo-600 focus:ring-indigo-500"
                  />
                  <span>Complete Fleet & Full History (Unfiltered)</span>
                </label>
                <label className="inline-flex items-center gap-2 cursor-pointer text-slate-700">
                  <input
                    type="radio"
                    name="scope-filter"
                    checked={useFilteredScope}
                    onChange={() => setUseFilteredScope(true)}
                    className="text-indigo-600 focus:ring-indigo-500"
                  />
                  <span>
                    Currently Filtered Items Only (
                    {dataset === 'fleet' ? serversToExport.length : logsToExport.length} entries)
                  </span>
                </label>
              </div>
            </div>
          )}

          {/* Summary / Preview Box */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-xs space-y-2">
            <div className="flex items-center justify-between text-slate-600 font-medium">
              <div className="flex items-center gap-1.5">
                <Info className="w-4 h-4 text-indigo-500" />
                <span>Export Package Summary</span>
              </div>
              <span className="font-mono text-slate-500">
                Target: {dataset === 'combined' ? `${serversToExport.length} nodes + ${logsToExport.length} logs` : dataset === 'fleet' ? `${serversToExport.length} nodes` : `${logsToExport.length} logs`}
              </span>
            </div>

            <div className="text-[11px] text-slate-500 space-y-1 pt-1 border-t border-slate-200/80">
              {dataset === 'fleet' && (
                <p>
                  Includes: Server Hostname, Cluster, Datacenter, Vendor, Model, Architecture, Management & BMC IP, Power State, Hypervisor, and all Component versions (BIOS, BMC, NIC, RAID, NVMe).
                </p>
              )}
              {dataset === 'audit' && (
                <p>
                  Includes: Record ID, Timestamp, Target Server Hostname, Component Updated, From/To Versions, Operation Status, Operator Name, Duration, and Firmware Package Name.
                </p>
              )}
              {dataset === 'combined' && (
                <p>
                  Includes: Complete Datacenter Fleet Inventory combined with the Firmware Lifecycle Audit Trail and system metadata for comprehensive compliance audits.
                </p>
              )}
            </div>
          </div>

        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-200 bg-slate-50/70">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-200/60 rounded-lg transition-colors"
          >
            Cancel
          </button>

          <button
            type="button"
            id="btn-download-export-file"
            onClick={handleExecuteExport}
            disabled={isExporting}
            className="inline-flex items-center gap-2 px-5 py-2 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white rounded-lg text-xs font-bold shadow-xs transition-colors disabled:opacity-50"
          >
            <Download className="w-4 h-4" />
            <span>
              {isExporting 
                ? 'Generating File...' 
                : `Download ${dataset === 'fleet' ? 'Fleet' : dataset === 'audit' ? 'Audit Logs' : 'Compliance Bundle'} (${format.toUpperCase()})`}
            </span>
          </button>
        </div>

      </div>
    </div>
  );
};
