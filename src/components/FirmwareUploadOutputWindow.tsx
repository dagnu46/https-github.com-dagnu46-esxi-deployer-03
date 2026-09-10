import React, { useRef, useEffect } from 'react';
import { 
  Terminal, 
  Copy, 
  Trash2, 
  CheckCircle2, 
  AlertTriangle, 
  Info, 
  RefreshCw, 
  HardDrive, 
  ShieldCheck, 
  FileCode,
  Check
} from 'lucide-react';
import { DiskVerificationResult } from '../types';

export interface UploadLogEntry {
  id: string;
  timestamp: string;
  level: 'info' | 'success' | 'warn' | 'error';
  stage?: string;
  message: string;
}

interface FirmwareUploadOutputWindowProps {
  logs: UploadLogEntry[];
  isProcessing: boolean;
  uploadedFileName: string;
  verificationResult: DiskVerificationResult | null;
  onClearLogs: () => void;
  onReverify?: () => void;
}

export const FirmwareUploadOutputWindow: React.FC<FirmwareUploadOutputWindowProps> = ({
  logs,
  isProcessing,
  uploadedFileName,
  verificationResult,
  onClearLogs,
  onReverify,
}) => {
  const terminalEndRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = React.useState(false);

  useEffect(() => {
    terminalEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  const handleCopyLogs = () => {
    const text = logs.map(l => `[${l.timestamp}] [${l.level.toUpperCase()}] ${l.stage ? `[${l.stage}] ` : ''}${l.message}`).join('\n');
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-slate-950 text-slate-100 rounded-xl border border-slate-800 flex flex-col h-full shadow-lg overflow-hidden font-mono text-xs">
      {/* Terminal Title Bar */}
      <div className="px-4 py-3 bg-slate-900 border-b border-slate-800 flex items-center justify-between shrink-0">
        <div className="flex items-center space-x-2.5">
          <div className="flex space-x-1.5">
            <div className="w-3 h-3 rounded-full bg-red-500/80" />
            <div className="w-3 h-3 rounded-full bg-amber-500/80" />
            <div className="w-3 h-3 rounded-full bg-emerald-500/80" />
          </div>
          <span className="text-slate-400 text-xs font-semibold pl-1 flex items-center gap-1.5 font-sans">
            <Terminal className="w-3.5 h-3.5 text-indigo-400" />
            Output Window — File Upload & Binary Processing
          </span>
        </div>

        <div className="flex items-center space-x-2">
          {isProcessing ? (
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-indigo-900/60 text-indigo-300 border border-indigo-700/50 text-[10px] font-semibold animate-pulse font-sans">
              <RefreshCw className="w-3 h-3 animate-spin" />
              Processing File Stream...
            </span>
          ) : verificationResult?.exists ? (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-950/80 text-emerald-300 border border-emerald-700/50 text-[10px] font-semibold font-sans">
              <CheckCircle2 className="w-3 h-3" />
              Verified on Server Disk
            </span>
          ) : (
            <span className="text-[10px] text-slate-500 font-sans">Ready for Payload</span>
          )}

          <button
            type="button"
            onClick={handleCopyLogs}
            disabled={logs.length === 0}
            className="p-1.5 text-slate-400 hover:text-white rounded hover:bg-slate-800 transition-colors disabled:opacity-40"
            title="Copy Output Logs"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
          </button>

          <button
            type="button"
            onClick={onClearLogs}
            disabled={logs.length === 0}
            className="p-1.5 text-slate-400 hover:text-white rounded hover:bg-slate-800 transition-colors disabled:opacity-40"
            title="Clear Console"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Storage & Checksum Banner (when file is processed) */}
      {verificationResult && verificationResult.exists && (
        <div className="px-4 py-2.5 bg-slate-900/90 border-b border-slate-800/80 text-[11px] grid grid-cols-1 sm:grid-cols-2 gap-2 text-slate-300 font-mono">
          <div className="flex items-center gap-2 truncate">
            <HardDrive className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span className="text-slate-400">Path:</span>
            <span className="text-emerald-300 truncate" title={verificationResult.storedPathOnServer}>
              {verificationResult.storedPathOnServer}
            </span>
          </div>
          <div className="flex items-center gap-2 truncate">
            <ShieldCheck className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
            <span className="text-slate-400">SHA-256:</span>
            <span className="text-indigo-300 truncate" title={verificationResult.sha256}>
              {verificationResult.sha256?.substring(0, 18)}...
            </span>
            {verificationResult.fileSizeMb && (
              <span className="text-slate-500 ml-auto font-sans text-[10px]">
                {verificationResult.fileSizeMb} MB
              </span>
            )}
          </div>
        </div>
      )}

      {/* Log Output Stream */}
      <div className="p-4 flex-1 overflow-y-auto space-y-1.5 min-h-[220px] max-h-[380px] select-text">
        {logs.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-slate-500 py-8 text-center space-y-2">
            <FileCode className="w-8 h-8 text-slate-600 stroke-[1.5]" />
            <p className="text-xs font-sans">No file processing operations yet.</p>
            <p className="text-[11px] text-slate-600 max-w-xs font-sans">
              Drag & drop or browse a firmware binary file (.bin, .exe, .fwpkg, .iso) to view real-time file upload, checksum calculation, and server filesystem staging.
            </p>
          </div>
        ) : (
          logs.map(log => {
            let textColor = 'text-slate-300';
            let badgeBg = 'bg-slate-800 text-slate-400';
            if (log.level === 'success') {
              textColor = 'text-emerald-300';
              badgeBg = 'bg-emerald-950 text-emerald-400 border border-emerald-800/50';
            } else if (log.level === 'warn') {
              textColor = 'text-amber-300';
              badgeBg = 'bg-amber-950 text-amber-400 border border-amber-800/50';
            } else if (log.level === 'error') {
              textColor = 'text-red-300';
              badgeBg = 'bg-red-950 text-red-400 border border-red-800/50';
            }

            return (
              <div key={log.id} className="leading-relaxed flex items-start gap-2 hover:bg-slate-900/50 px-1 py-0.5 rounded">
                <span className="text-slate-500 text-[10px] select-none shrink-0 font-mono">
                  [{log.timestamp}]
                </span>
                {log.stage && (
                  <span className={`text-[9px] uppercase px-1.5 py-0.2 rounded font-semibold shrink-0 ${badgeBg}`}>
                    {log.stage}
                  </span>
                )}
                <span className={`break-all ${textColor}`}>
                  {log.message}
                </span>
              </div>
            );
          })
        )}
        <div ref={terminalEndRef} />
      </div>

      {/* Footer Info Bar */}
      <div className="px-4 py-2 bg-slate-900/60 border-t border-slate-800 text-[11px] flex items-center justify-between text-slate-500 font-sans shrink-0">
        <div className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
          <span>Local Storage Target: <code className="text-slate-400 font-mono">/uploads/firmware/</code></span>
        </div>
        {onReverify && verificationResult?.fileName && (
          <button
            type="button"
            onClick={onReverify}
            className="text-xs text-indigo-400 hover:text-indigo-300 underline font-mono flex items-center gap-1"
          >
            <RefreshCw className="w-3 h-3" /> Re-verify Server Disk
          </button>
        )}
      </div>
    </div>
  );
};
