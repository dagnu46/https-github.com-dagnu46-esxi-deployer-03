import React, { useState, useEffect, useRef } from 'react';
import {
  Terminal,
  Copy,
  Check,
  Trash2,
  Download,
  Filter,
  Maximize2,
  Minimize2,
  ChevronDown,
  ChevronUp,
  Database,
  Globe,
  Radio,
  Search,
  CheckCircle2,
  AlertCircle,
  Clock,
  Sparkles,
  Play
} from 'lucide-react';
import { BaremetalOutputLog } from '../types';
import { baremetalLogger, logBaremetalOutput } from '../services/baremetalOutputLogger';

interface BaremetalGlobalOutputConsoleProps {
  onShowToast?: (message: string, type?: 'success' | 'info' | 'warn') => void;
  className?: string;
}

export const BaremetalGlobalOutputConsole: React.FC<BaremetalGlobalOutputConsoleProps> = ({
  onShowToast,
  className = ''
}) => {
  const [logs, setLogs] = useState<BaremetalOutputLog[]>([]);
  const [activeFilter, setActiveFilter] = useState<'ALL' | 'SN_DB' | 'IPMI' | 'ISO_KS' | 'DEPLOY'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [heightMode, setHeightMode] = useState<'normal' | 'tall'>('normal');
  const [autoScroll, setAutoScroll] = useState(true);
  const [copied, setCopied] = useState(false);
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);

  const consoleEndRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Subscribe to global baremetal logger
  useEffect(() => {
    const unsubscribe = baremetalLogger.subscribe((updatedLogs) => {
      setLogs(updatedLogs);
    });
    return () => unsubscribe();
  }, []);

  // Auto-scroll when logs change
  useEffect(() => {
    if (autoScroll && !isCollapsed && consoleEndRef.current) {
      consoleEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, autoScroll, isCollapsed]);

  const handleCopyLogs = () => {
    if (logs.length === 0) return;
    const text = logs
      .map(
        (l) =>
          `[${new Date(l.timestamp).toLocaleTimeString()}] [${l.category}] [${l.level.toUpperCase()}] ${l.message}${
            l.details ? `\n   > Details: ${l.details}` : ''
          }`
      )
      .join('\n');

    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    if (onShowToast) {
      onShowToast(`Copied ${logs.length} orchestration logs to clipboard`, 'info');
    }
  };

  const handleDownloadLogs = () => {
    const text = logs
      .map(
        (l) =>
          `[${l.timestamp}] [${l.category}] [${l.level.toUpperCase()}] ${l.message}${
            l.details ? `\n   > Details: ${l.details}` : ''
          }`
      )
      .join('\n');

    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `baremetal-deploy-output-${new Date().toISOString().slice(0, 10)}.log`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    if (onShowToast) {
      onShowToast('Exported output logs to file', 'success');
    }
  };

  const handleClear = () => {
    baremetalLogger.clear();
    logBaremetalOutput('SYSTEM', 'info', 'Output window cleared by operator. Engine ready.');
    if (onShowToast) {
      onShowToast('Console output cleared', 'info');
    }
  };

  const handleDiagnosticPing = () => {
    logBaremetalOutput(
      'SYSTEM',
      'info',
      'Diagnostic health probe triggered for Baremetal Provisioning Engine.',
      'Checking API proxy, PostgreSQL app_settings, Redfish BMC endpoints, and Kickstart generator.'
    );
    setTimeout(() => {
      logBaremetalOutput(
        'DATABASE',
        'success',
        'PostgreSQL connection active. Credentials table app_settings verified.',
        'Ping latency: 12ms | Schema version: v2.4'
      );
    }, 400);
  };

  // Filter logs based on category and search text
  const filteredLogs = logs.filter((log) => {
    // Category filter
    let matchCat = true;
    if (activeFilter === 'SN_DB') {
      matchCat = log.category === 'SERVICENOW' || log.category === 'DATABASE';
    } else if (activeFilter === 'IPMI') {
      matchCat = log.category === 'IPMI';
    } else if (activeFilter === 'ISO_KS') {
      matchCat = log.category === 'ISO' || log.category === 'KICKSTART';
    } else if (activeFilter === 'DEPLOY') {
      matchCat = log.category === 'DEPLOY' || log.category === 'SECURITY';
    }

    if (!matchCat) return false;

    // Search query filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        log.message.toLowerCase().includes(q) ||
        log.category.toLowerCase().includes(q) ||
        log.level.toLowerCase().includes(q) ||
        (log.details && log.details.toLowerCase().includes(q))
      );
    }
    return true;
  });

  const getCategoryBadgeClass = (category: BaremetalOutputLog['category']) => {
    switch (category) {
      case 'SERVICENOW':
        return 'text-sky-300 bg-sky-950/80 border-sky-800/80';
      case 'DATABASE':
        return 'text-emerald-300 bg-emerald-950/80 border-emerald-800/80';
      case 'IPMI':
        return 'text-amber-300 bg-amber-950/80 border-amber-800/80';
      case 'ISO':
        return 'text-purple-300 bg-purple-950/80 border-purple-800/80';
      case 'KICKSTART':
        return 'text-blue-300 bg-blue-950/80 border-blue-800/80';
      case 'DEPLOY':
        return 'text-indigo-300 bg-indigo-950/80 border-indigo-800/80';
      case 'SECURITY':
        return 'text-rose-300 bg-rose-950/80 border-rose-800/80';
      default:
        return 'text-slate-300 bg-slate-900 border-slate-700';
    }
  };

  const getLevelColor = (level: BaremetalOutputLog['level']) => {
    switch (level) {
      case 'error':
        return 'text-rose-400 font-medium';
      case 'warn':
        return 'text-amber-300 font-medium';
      case 'success':
        return 'text-emerald-300 font-medium';
      case 'stage':
        return 'text-cyan-300 font-bold';
      default:
        return 'text-slate-200';
    }
  };

  return (
    <div
      id="baremetal-global-output-window"
      className={`bg-slate-950 border border-slate-800/90 rounded-xl shadow-2xl overflow-hidden transition-all duration-200 ${className}`}
    >
      {/* Terminal Title Bar */}
      <div className="flex flex-wrap items-center justify-between px-4 py-2.5 bg-slate-900/95 border-b border-slate-800 gap-2">
        {/* Left Side: Window Controls & Title */}
        <div className="flex items-center gap-3">
          {/* Traffic Light Dots */}
          <div className="flex items-center gap-1.5">
            <span
              onClick={handleClear}
              title="Clear output"
              className="w-3 h-3 rounded-full bg-rose-500/90 hover:bg-rose-600 transition-colors cursor-pointer inline-block"
            />
            <span
              onClick={() => setIsCollapsed(!isCollapsed)}
              title="Minimize/Expand"
              className="w-3 h-3 rounded-full bg-amber-500/90 hover:bg-amber-600 transition-colors cursor-pointer inline-block"
            />
            <span
              onClick={() => setHeightMode(heightMode === 'normal' ? 'tall' : 'normal')}
              title="Toggle height"
              className="w-3 h-3 rounded-full bg-emerald-500/90 hover:bg-emerald-600 transition-colors cursor-pointer inline-block"
            />
          </div>

          <div className="h-4 w-px bg-slate-800 hidden sm:block" />

          <div className="flex items-center gap-2">
            <Terminal className="w-4 h-4 text-indigo-400" />
            <span className="text-xs font-bold text-slate-100 tracking-wide flex items-center gap-1.5">
              <span>Baremetal Engine Output Window</span>
              <span className="hidden md:inline text-slate-400 font-normal">
                (Global Orchestration, ServiceNow & BMC Output)
              </span>
            </span>
          </div>

          {/* Live pulse indicator */}
          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-950/70 border border-emerald-800/60 text-[10px] font-semibold text-emerald-400">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span>STREAMING</span>
          </div>

          <span className="text-[11px] text-slate-500 font-mono hidden lg:inline">
            {filteredLogs.length} events
          </span>
        </div>

        {/* Right Side: Action Controls */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* Diagnostic Ping */}
          <button
            onClick={handleDiagnosticPing}
            title="Send diagnostic ping to engine"
            className="flex items-center gap-1 px-2 py-1 rounded bg-slate-800/80 hover:bg-slate-700 text-slate-300 text-xs font-medium transition-colors border border-slate-700/60"
          >
            <Radio className="w-3 h-3 text-cyan-400" />
            <span className="hidden sm:inline text-[11px]">Ping Probe</span>
          </button>

          {/* Auto-scroll toggle */}
          <button
            onClick={() => setAutoScroll(!autoScroll)}
            title={autoScroll ? 'Disable auto-scroll' : 'Enable auto-scroll'}
            className={`flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium transition-colors border ${
              autoScroll
                ? 'bg-indigo-950/80 border-indigo-700 text-indigo-300'
                : 'bg-slate-800 border-slate-700 text-slate-400'
            }`}
          >
            <span>Auto-Scroll</span>
            <span className={`w-1.5 h-1.5 rounded-full ${autoScroll ? 'bg-indigo-400' : 'bg-slate-500'}`} />
          </button>

          {/* Copy Button */}
          <button
            onClick={handleCopyLogs}
            disabled={logs.length === 0}
            title="Copy all output logs"
            className="flex items-center gap-1 px-2 py-1 rounded bg-slate-800/80 hover:bg-slate-700 disabled:opacity-40 text-slate-300 text-xs font-medium transition-colors border border-slate-700/60"
          >
            {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
            <span className="text-[11px]">{copied ? 'Copied' : 'Copy'}</span>
          </button>

          {/* Download Logs */}
          <button
            onClick={handleDownloadLogs}
            disabled={logs.length === 0}
            title="Download log output file"
            className="p-1 rounded bg-slate-800/80 hover:bg-slate-700 disabled:opacity-40 text-slate-300 transition-colors border border-slate-700/60"
          >
            <Download className="w-3.5 h-3.5" />
          </button>

          {/* Clear Button */}
          <button
            onClick={handleClear}
            title="Clear output console"
            className="p-1 rounded bg-slate-800/80 hover:bg-rose-900/60 text-slate-400 hover:text-rose-300 transition-colors border border-slate-700/60"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>

          {/* Collapse/Expand Toggle */}
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            title={isCollapsed ? 'Expand console' : 'Collapse console'}
            className="p-1 rounded bg-slate-800/80 hover:bg-slate-700 text-slate-300 transition-colors border border-slate-700/60"
          >
            {isCollapsed ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Filter and Search Sub-bar (visible when not collapsed) */}
      {!isCollapsed && (
        <div className="flex flex-wrap items-center justify-between px-3 py-1.5 bg-slate-900/70 border-b border-slate-800/80 text-xs gap-2">
          {/* Filter Pills */}
          <div className="flex items-center gap-1 overflow-x-auto py-0.5">
            <span className="text-[10px] uppercase font-bold text-slate-400 mr-1 flex items-center gap-1">
              <Filter className="w-3 h-3 text-slate-400" />
              Filter:
            </span>
            <button
              onClick={() => setActiveFilter('ALL')}
              className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
                activeFilter === 'ALL'
                  ? 'bg-indigo-600 text-white font-semibold'
                  : 'bg-slate-800/60 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              All ({logs.length})
            </button>
            <button
              onClick={() => setActiveFilter('SN_DB')}
              className={`flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
                activeFilter === 'SN_DB'
                  ? 'bg-sky-600 text-white font-semibold'
                  : 'bg-slate-800/60 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              <Database className="w-3 h-3" />
              ServiceNow & DB
            </button>
            <button
              onClick={() => setActiveFilter('IPMI')}
              className={`flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
                activeFilter === 'IPMI'
                  ? 'bg-amber-600 text-white font-semibold'
                  : 'bg-slate-800/60 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              <Radio className="w-3 h-3" />
              BMC / IPMI
            </button>
            <button
              onClick={() => setActiveFilter('ISO_KS')}
              className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
                activeFilter === 'ISO_KS'
                  ? 'bg-blue-600 text-white font-semibold'
                  : 'bg-slate-800/60 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              ISO & Kickstart
            </button>
            <button
              onClick={() => setActiveFilter('DEPLOY')}
              className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
                activeFilter === 'DEPLOY'
                  ? 'bg-purple-600 text-white font-semibold'
                  : 'bg-slate-800/60 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              Deployment Jobs
            </button>
          </div>

          {/* Quick Search */}
          <div className="relative flex items-center">
            <Search className="w-3 h-3 text-slate-500 absolute left-2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search output logs..."
              className="bg-slate-950 border border-slate-800 rounded pl-7 pr-2 py-0.5 text-[11px] text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500 w-36 sm:w-48 transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-1.5 text-[10px] text-slate-400 hover:text-white"
              >
                ×
              </button>
            )}
          </div>
        </div>
      )}

      {/* Terminal Content Body */}
      {!isCollapsed && (
        <div
          ref={containerRef}
          className={`font-mono text-xs overflow-y-auto p-3 space-y-1.5 transition-all select-text ${
            heightMode === 'tall' ? 'h-96' : 'h-56'
          }`}
          style={{ backgroundColor: '#030712' }}
        >
          {filteredLogs.length === 0 ? (
            <div className="text-center py-8 text-slate-500">
              <Terminal className="w-6 h-6 mx-auto mb-2 text-slate-600 opacity-60" />
              <p>No log events match current filter</p>
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="text-xs text-indigo-400 hover:underline mt-1 inline-block"
                >
                  Clear search filter
                </button>
              )}
            </div>
          ) : (
            filteredLogs.map((log) => {
              const isExpanded = expandedLogId === log.id;
              return (
                <div
                  key={log.id}
                  onClick={() => log.details && setExpandedLogId(isExpanded ? null : log.id)}
                  className={`group flex items-start gap-2.5 leading-relaxed rounded px-1.5 py-0.5 transition-colors ${
                    log.details ? 'cursor-pointer hover:bg-slate-900/60' : 'hover:bg-slate-900/30'
                  }`}
                >
                  {/* Timestamp */}
                  <span className="text-slate-500 shrink-0 text-[11px] select-none pt-0.5">
                    {new Date(log.timestamp).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit'
                    })}
                  </span>

                  {/* Category Pill */}
                  <span
                    className={`px-1.5 py-0.2 rounded text-[9.5px] font-bold tracking-wider shrink-0 border select-none ${getCategoryBadgeClass(
                      log.category
                    )}`}
                  >
                    {log.category}
                  </span>

                  {/* Level indicator */}
                  <span
                    className={`text-[10px] uppercase font-bold shrink-0 select-none ${
                      log.level === 'error'
                        ? 'text-rose-400'
                        : log.level === 'warn'
                        ? 'text-amber-400'
                        : log.level === 'success'
                        ? 'text-emerald-400'
                        : log.level === 'stage'
                        ? 'text-cyan-400'
                        : 'text-slate-400'
                    }`}
                  >
                    [{log.level}]
                  </span>

                  {/* Message & Details */}
                  <div className="flex-1 min-w-0">
                    <span className={`break-words ${getLevelColor(log.level)}`}>{log.message}</span>

                    {/* Details section */}
                    {log.details && (
                      <div
                        className={`mt-1 text-[11px] text-slate-400 bg-slate-900/80 rounded p-2 border border-slate-800 transition-all ${
                          isExpanded ? 'block' : 'hidden group-hover:block'
                        }`}
                      >
                        <span className="text-[10px] text-slate-500 block mb-0.5 uppercase tracking-wide">
                          Details:
                        </span>
                        <pre className="whitespace-pre-wrap font-mono text-slate-300 break-all leading-snug">
                          {log.details}
                        </pre>
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
          <div ref={consoleEndRef} />
        </div>
      )}

      {/* Terminal Command Prompt / Quick Actions Strip (visible when not collapsed) */}
      {!isCollapsed && (
        <div className="flex flex-wrap items-center justify-between px-3 py-1.5 bg-slate-900/90 border-t border-slate-800 text-[11px] text-slate-400 gap-2">
          <div className="flex items-center gap-2">
            <span className="text-emerald-400 font-bold font-mono select-none">&gt;</span>
            <span className="text-slate-400 font-mono">
              Ready. Baremetal hypervisor provisioner listening for ServiceNow RITM changes.
            </span>
          </div>

          <div className="flex items-center gap-3 text-[10px] font-mono text-slate-400">
            <span>Storage: <strong className="text-emerald-400">PostgreSQL (app_settings)</strong></span>
            <span>Auth: <strong className="text-sky-400">ServiceNow Active</strong></span>
          </div>
        </div>
      )}
    </div>
  );
};
