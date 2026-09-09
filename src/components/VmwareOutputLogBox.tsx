import React, { useState, useEffect, useRef } from 'react';
import { Terminal, Copy, Check, Trash2, Shield, ArrowDown } from 'lucide-react';
import { VmwareLogEntry } from '../types';

interface VmwareOutputLogBoxProps {
  logs: VmwareLogEntry[];
  onClear: () => void;
  onShowToast?: (message: string, type?: 'success' | 'info' | 'warn') => void;
}

export const VmwareOutputLogBox: React.FC<VmwareOutputLogBoxProps> = ({
  logs,
  onClear,
  onShowToast,
}) => {
  const [autoScroll, setAutoScroll] = useState(true);
  const [filter, setFilter] = useState<string>('ALL');
  const [copied, setCopied] = useState(false);
  const logContainerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new logs arrive
  useEffect(() => {
    if (autoScroll && logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logs, autoScroll]);

  const handleCopyLogs = () => {
    if (logs.length === 0) return;
    const text = logs
      .map(
        (l) =>
          `[${l.timestamp}] [${l.category}] [${l.level.toUpperCase()}] ${l.message}${
            l.details ? `\n   > ${l.details}` : ''
          }`
      )
      .join('\n');

    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    if (onShowToast) {
      onShowToast(`Copied ${logs.length} log lines to clipboard`, 'info');
    }
  };

  const filteredLogs = filter === 'ALL' ? logs : logs.filter((l) => l.category === filter);

  const getCategoryBadgeClass = (category: VmwareLogEntry['category']) => {
    switch (category) {
      case 'VCENTER':
        return 'text-cyan-300 bg-cyan-950/80 border-cyan-800/80';
      case 'DATASTORE':
        return 'text-purple-300 bg-purple-950/80 border-purple-800/80';
      case 'UPLOAD':
        return 'text-amber-300 bg-amber-950/80 border-amber-800/80';
      case 'VERIFY':
        return 'text-emerald-300 bg-emerald-950/80 border-emerald-800/80';
      case 'CONNECT':
        return 'text-blue-300 bg-blue-950/80 border-blue-800/80';
      case 'POWER':
        return 'text-teal-300 bg-teal-950/80 border-teal-800/80';
      default:
        return 'text-slate-300 bg-slate-900 border-slate-700';
    }
  };

  const getLevelColor = (level: VmwareLogEntry['level']) => {
    switch (level) {
      case 'error':
        return 'text-rose-400';
      case 'warn':
        return 'text-amber-300';
      case 'success':
        return 'text-emerald-300';
      default:
        return 'text-slate-200';
    }
  };

  return (
    <div className="bg-slate-950 border border-slate-800 rounded-xl overflow-hidden shadow-2xl flex flex-col">
      {/* Terminal Top Bar */}
      <div className="flex flex-wrap items-center justify-between px-4 py-2.5 bg-slate-900/90 border-b border-slate-800 gap-2">
        <div className="flex items-center gap-2.5">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500/80 inline-block" />
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500/80 inline-block" />
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/80 inline-block" />
          </div>

          <div className="h-4 w-px bg-slate-800" />

          <div className="flex items-center gap-2">
            <Terminal className="w-4 h-4 text-cyan-400" />
            <span className="text-xs font-bold text-slate-200 tracking-wide">
              Live Operations & Execution Output Log
            </span>
          </div>

          <span className="flex items-center gap-1.5 text-[10px] font-mono font-medium px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            STREAMING ({logs.length})
          </span>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Category Filter */}
          <div className="flex items-center gap-1 bg-slate-950 p-0.5 rounded-lg border border-slate-800 text-[10px]">
            {['ALL', 'DATASTORE', 'UPLOAD', 'VERIFY', 'CONNECT', 'POWER'].map((cat) => (
              <button
                key={cat}
                onClick={() => setFilter(cat)}
                className={`px-2 py-0.5 rounded transition-colors ${
                  filter === cat
                    ? 'bg-cyan-600/40 text-cyan-200 font-semibold border border-cyan-500/30'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Auto-Scroll Toggle */}
          <label className="flex items-center gap-1.5 text-[11px] text-slate-300 cursor-pointer select-none px-2 py-1 bg-slate-800/60 rounded hover:bg-slate-800 transition-colors">
            <input
              type="checkbox"
              checked={autoScroll}
              onChange={(e) => setAutoScroll(e.target.checked)}
              className="rounded bg-slate-900 border-slate-700 text-cyan-500 focus:ring-0 w-3 h-3"
            />
            <ArrowDown className="w-3 h-3 text-slate-400" />
            <span>Auto-Scroll</span>
          </label>

          {/* Copy Button */}
          <button
            onClick={handleCopyLogs}
            disabled={logs.length === 0}
            className="flex items-center gap-1 text-[11px] px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors disabled:opacity-40"
            title="Copy all output logs to clipboard"
          >
            {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
            <span>{copied ? 'Copied' : 'Copy'}</span>
          </button>

          {/* Clear Button */}
          <button
            onClick={onClear}
            disabled={logs.length === 0}
            className="flex items-center gap-1 text-[11px] px-2.5 py-1 rounded bg-slate-800 hover:bg-rose-900/40 hover:text-rose-200 text-slate-400 border border-slate-700 transition-colors disabled:opacity-40"
            title="Clear current log output"
          >
            <Trash2 className="w-3 h-3" />
            <span>Clear</span>
          </button>
        </div>
      </div>

      {/* Terminal Body */}
      <div
        ref={logContainerRef}
        className="p-3.5 font-mono text-[11px] leading-relaxed overflow-y-auto max-h-72 min-h-48 space-y-1.5 bg-slate-950 select-text"
      >
        {filteredLogs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-slate-500 text-xs gap-2 select-none">
            <Terminal className="w-6 h-6 text-slate-600" />
            <p>No log events captured yet for this session.</p>
            <p className="text-[10px] text-slate-600">
              Operations in Datastores, File Upload, VM Connection, and Power Controls will stream here in real time.
            </p>
          </div>
        ) : (
          filteredLogs.map((log) => (
            <div
              key={log.id}
              className="flex items-start gap-2 hover:bg-slate-900/60 px-1.5 py-0.5 rounded transition-colors group"
            >
              <span className="text-slate-500 shrink-0 select-none text-[10px] pt-0.5">
                [{log.timestamp}]
              </span>

              <span
                className={`text-[9px] uppercase px-1.5 py-0.2 rounded border font-semibold shrink-0 select-none ${getCategoryBadgeClass(
                  log.category
                )}`}
              >
                {log.category}
              </span>

              <div className="flex-1 break-words min-w-0">
                <span className={`${getLevelColor(log.level)}`}>{log.message}</span>
                {log.details && (
                  <div className="mt-1 pl-2 border-l-2 border-slate-700/80 text-[10px] text-slate-400/90 font-mono bg-slate-900/80 p-1.5 rounded-r">
                    {log.details}
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Terminal Footer */}
      <div className="px-4 py-1.5 bg-slate-900/60 border-t border-slate-800 text-[10px] text-slate-400 flex items-center justify-between font-mono">
        <span>Channel: /dev/vcenter-audit-stream</span>
        <span>
          Showing {filteredLogs.length} of {logs.length} events
        </span>
      </div>
    </div>
  );
};
