import React, { useState, useEffect } from 'react';
import { 
  Building2, 
  Search, 
  RefreshCw, 
  CheckCircle2, 
  AlertCircle, 
  ExternalLink, 
  Sparkles, 
  Key, 
  ShieldCheck, 
  Server as ServerIcon,
  Network,
  Check,
  ChevronDown,
  ChevronUp,
  Cpu,
  Database
} from 'lucide-react';
import { ServiceNowRitmData, ServiceNowExtractedFields, ServiceNowConnectionConfig } from '../types';
import { 
  fetchServiceNowRitm, 
  testServiceNowConnection, 
  getStoredServiceNowConfig, 
  saveStoredServiceNowConfig,
  fetchDatabaseServiceNowCredentials,
  saveDatabaseServiceNowCredentials
} from '../services/servicenowService';
import { logBaremetalOutput } from '../services/baremetalOutputLogger';

interface ServiceNowInspectorProps {
  currentRitm: string;
  onApplyFields: (extracted: ServiceNowExtractedFields, ritmData: ServiceNowRitmData) => void;
  onRitmChange: (ritm: string) => void;
}

export const ServiceNowInspector: React.FC<ServiceNowInspectorProps> = ({
  currentRitm,
  onApplyFields,
  onRitmChange
}) => {
  const [ticketInput, setTicketInput] = useState(currentRitm || 'RITM0049281');
  const [loading, setLoading] = useState(false);
  const [ritmData, setRitmData] = useState<ServiceNowRitmData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [appliedSuccess, setAppliedSuccess] = useState(false);

  // Settings popover
  const [showSettings, setShowSettings] = useState(false);
  const [config, setConfig] = useState<ServiceNowConnectionConfig>(getStoredServiceNowConfig());
  const [testingConn, setTestingConn] = useState(false);
  const [savingDb, setSavingDb] = useState(false);
  const [connMessage, setConnMessage] = useState<{ success: boolean; text: string } | null>(null);
  const [showAllVariables, setShowAllVariables] = useState(false);

  // Synchronize with database credentials on mount
  useEffect(() => {
    fetchDatabaseServiceNowCredentials().then((dbCreds) => {
      if (dbCreds) {
        setConfig((prev) => ({
          ...prev,
          instanceUrl: dbCreds.instanceUrl || prev.instanceUrl,
          username: dbCreds.username || prev.username,
          password: dbCreds.password || prev.password,
          storedInDb: Boolean(dbCreds.storedInDb),
          isConnected: dbCreds.isConnected
        }));
      }
    });
  }, []);

  useEffect(() => {
    if (currentRitm && currentRitm !== ticketInput) {
      setTicketInput(currentRitm);
    }
  }, [currentRitm]);

  const handleFetchTicket = async (numberToFetch?: string) => {
    const num = (numberToFetch || ticketInput).trim();
    if (!num) return;

    setLoading(true);
    setError(null);
    setAppliedSuccess(false);

    logBaremetalOutput(
      'SERVICENOW',
      'info',
      `Querying ServiceNow Table API for ticket: ${num}...`,
      `Target host: ${config.instanceUrl} | User: ${config.username || 'svc_account'}`
    );

    try {
      const data = await fetchServiceNowRitm(num, {
        instanceUrl: config.instanceUrl,
        username: config.username,
        password: config.password
      });
      setRitmData(data);
      onRitmChange(data.number);

      logBaremetalOutput(
        'SERVICENOW',
        'success',
        `Successfully retrieved ServiceNow ticket ${data.number}: ${data.shortDescription}`,
        `Requester: ${data.requester} | Env: ${data.environment} | Host: ${data.extractedFields?.hostname || 'pending'} | IPMI: ${data.extractedFields?.ipmiAddress || 'none'}`
      );
    } catch (err: any) {
      setError(err.message || 'Failed to fetch ServiceNow ticket');
      logBaremetalOutput('SERVICENOW', 'error', `Failed to fetch ticket ${num}: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleApply = () => {
    if (!ritmData) return;
    onApplyFields(ritmData.extractedFields, ritmData);
    setAppliedSuccess(true);
    logBaremetalOutput(
      'SERVICENOW',
      'stage',
      `Applied ServiceNow parameters from ${ritmData.number} to Baremetal Wizard`,
      `Host: ${ritmData.extractedFields?.hostname || 'N/A'}, Management IP: ${ritmData.extractedFields?.managementIp || 'N/A'}, IPMI: ${ritmData.extractedFields?.ipmiAddress || 'N/A'}`
    );
    setTimeout(() => setAppliedSuccess(false), 3500);
  };

  const handleTestConnection = async () => {
    setTestingConn(true);
    setConnMessage(null);
    logBaremetalOutput(
      'SERVICENOW',
      'info',
      `Testing connectivity to ${config.instanceUrl} (user: ${config.username})...`
    );
    try {
      const res = await testServiceNowConnection(config);
      saveStoredServiceNowConfig({
        ...config,
        isConnected: res.success,
        lastChecked: new Date().toISOString()
      });
      setConnMessage({
        success: res.success,
        text: res.message + (res.latencyMs ? ` (${res.latencyMs}ms)` : '')
      });
      logBaremetalOutput(
        'SERVICENOW',
        res.success ? 'success' : 'warn',
        res.message,
        `Latency: ${res.latencyMs || 0}ms`
      );
    } catch (err: any) {
      setConnMessage({
        success: false,
        text: err.message || 'Connection test failed'
      });
      logBaremetalOutput('SERVICENOW', 'error', `Connection test error: ${err.message}`);
    } finally {
      setTestingConn(false);
    }
  };

  const handleSaveToDatabase = async () => {
    setSavingDb(true);
    setConnMessage(null);
    try {
      const res = await saveDatabaseServiceNowCredentials({
        instanceUrl: config.instanceUrl,
        username: config.username,
        password: config.password,
        authType: 'basic',
        storedInDb: true
      });
      if (res.success) {
        setConfig((prev) => ({ ...prev, storedInDb: true }));
        setConnMessage({
          success: true,
          text: 'Credentials saved into PostgreSQL database (app_settings)!'
        });
        logBaremetalOutput(
          'DATABASE',
          'success',
          `ServiceNow credentials saved into database (app_settings table)`,
          `Instance: ${config.instanceUrl} | User: ${config.username}`
        );
      } else {
        setConnMessage({
          success: false,
          text: res.message || 'Failed to save into database'
        });
      }
    } catch (e: any) {
      setConnMessage({
        success: false,
        text: e.message || 'Error saving to database'
      });
    } finally {
      setSavingDb(false);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
      {/* Header bar */}
      <div className="p-4 bg-gradient-to-r from-slate-900 to-indigo-950 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-lg bg-indigo-500/20 border border-indigo-400/30 text-indigo-300">
            <Building2 className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm text-white">ServiceNow Enterprise Integration</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 font-medium">
                Instance: {config.instanceUrl.replace(/^https?:\/\//, '')}
              </span>
            </div>
            <p className="text-[11px] text-slate-300">
              Direct Table API resolver for Request Items (RITM)
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setShowSettings(!showSettings)}
          className="text-xs px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 flex items-center gap-1.5 transition-colors self-start sm:self-auto cursor-pointer"
        >
          <Key className="w-3.5 h-3.5 text-indigo-400" />
          <span>Connection Settings</span>
        </button>
      </div>

      {/* Settings Panel */}
      {showSettings && (
        <div className="p-4 bg-slate-50 border-b border-slate-200 text-xs space-y-3 animate-in fade-in duration-200">
          <div className="flex items-center justify-between">
            <h4 className="font-bold text-slate-900 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-indigo-600" />
              <span>ServiceNow Instance Credentials & Authentication</span>
            </h4>
            <span className="text-[11px] text-slate-500 font-mono">Table API / REST v2</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="block text-slate-600 font-medium mb-1">ServiceNow URL</label>
              <input
                type="text"
                value={config.instanceUrl}
                onChange={e => setConfig(prev => ({ ...prev, instanceUrl: e.target.value }))}
                className="w-full rounded border border-slate-300 p-2 font-mono text-xs bg-white"
                placeholder="https://generali.service-now.com"
              />
            </div>
            <div>
              <label className="block text-slate-600 font-medium mb-1">Login Username</label>
              <input
                type="text"
                value={config.username}
                onChange={e => setConfig(prev => ({ ...prev, username: e.target.value }))}
                className="w-full rounded border border-slate-300 p-2 font-mono text-xs bg-white"
                placeholder="ServiceNow username"
              />
            </div>
            <div>
              <label className="block text-slate-600 font-medium mb-1">Password</label>
              <input
                type="password"
                value={config.password || ''}
                onChange={e => setConfig(prev => ({ ...prev, password: e.target.value }))}
                className="w-full rounded border border-slate-300 p-2 font-mono text-xs bg-white"
                placeholder="Instance Password"
              />
            </div>
          </div>

          <div className="flex items-center justify-between pt-1">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleTestConnection}
                disabled={testingConn}
                className="px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {testingConn ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <ShieldCheck className="w-3.5 h-3.5" />
                )}
                <span>Test Connection</span>
              </button>
              <button
                type="button"
                disabled={savingDb}
                onClick={handleSaveToDatabase}
                className="px-3 py-1.5 rounded bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {savingDb ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Database className="w-3.5 h-3.5" />
                )}
                <span>Store into Database</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  saveStoredServiceNowConfig(config);
                  setShowSettings(false);
                }}
                className="px-3 py-1.5 rounded bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 font-medium text-xs cursor-pointer"
              >
                Close
              </button>
            </div>

            {connMessage && (
              <span className={`text-[11px] font-medium flex items-center gap-1 ${
                connMessage.success ? 'text-emerald-700' : 'text-amber-700'
              }`}>
                {connMessage.success ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />}
                {connMessage.text}
              </span>
            )}
          </div>
        </div>
      )}

      {/* RITM Input Bar */}
      <div className="p-4 bg-indigo-50/40 border-b border-slate-200">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
          <div className="relative flex-1">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
              <Search className="w-4 h-4" />
            </div>
            <input
              type="text"
              id="input-sn-ritm-fetch"
              value={ticketInput}
              onChange={e => setTicketInput(e.target.value.toUpperCase())}
              onKeyDown={e => e.key === 'Enter' && handleFetchTicket()}
              placeholder="Enter ServiceNow RITM # (e.g. RITM0049281, RITM0012345)"
              className="w-full pl-9 pr-4 py-2 text-xs font-mono font-bold uppercase rounded-lg border border-indigo-200 bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              id="btn-fetch-sn-ritm"
              onClick={() => handleFetchTicket()}
              disabled={loading || !ticketInput.trim()}
              className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 disabled:bg-slate-300 text-white font-semibold text-xs flex items-center gap-1.5 shadow-2xs transition-colors shrink-0 cursor-pointer"
            >
              {loading ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Retrieving Fields...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5 text-indigo-200" />
                  <span>Fetch from ServiceNow</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => {
                const sample = 'RITM0049281';
                setTicketInput(sample);
                handleFetchTicket(sample);
              }}
              className="px-2.5 py-2 rounded-lg bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 text-xs font-medium shrink-0 cursor-pointer"
              title="Load sample RITM request"
            >
              Load Sample RITM
            </button>
          </div>
        </div>

        {error && (
          <div className="mt-2.5 p-2.5 rounded-lg bg-red-50 border border-red-200 text-red-800 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
            <span>{error}</span>
          </div>
        )}
      </div>

      {/* Retrieved Data Display */}
      {ritmData && (
        <div className="p-4 space-y-4">
          {/* Ticket Header & Status */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono font-bold text-sm text-indigo-700">{ritmData.number}</span>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                  {ritmData.state}
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-100 text-indigo-800">
                  Stage: {ritmData.stage}
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-800">
                  Approval: {ritmData.approval}
                </span>
              </div>
              <h3 className="font-bold text-slate-900 text-xs mt-1">{ritmData.shortDescription}</h3>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Requester: <strong className="text-slate-700">{ritmData.requester}</strong> • Environment: <strong className="text-slate-700">{ritmData.environment}</strong> • Datacenter: <strong className="text-slate-700">{ritmData.datacenter}</strong>
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                id="btn-apply-sn-fields"
                onClick={handleApply}
                className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
              >
                {appliedSuccess ? (
                  <>
                    <Check className="w-3.5 h-3.5 stroke-[3]" />
                    <span>Applied to Wizard!</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Apply Retrieved Fields to Wizard</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Specific Fields Extracted Grid */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                <span>Specific Fields Retrieved from ServiceNow Request</span>
              </span>
              <span className="text-[11px] text-slate-500">Auto-mapped into Step 1, Step 2 & Step 4</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 text-xs">
              {/* Hostname */}
              <div className="p-2.5 rounded-lg bg-white border border-slate-200">
                <div className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-1">
                  <ServerIcon className="w-3 h-3 text-indigo-600" />
                  <span>ESXi Hostname</span>
                </div>
                <div className="font-mono font-bold text-slate-900 text-xs mt-1 truncate">
                  {ritmData.extractedFields.hostname || '<Not Specified>'}
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5">Step 2: Host Identity</div>
              </div>

              {/* Management IP */}
              <div className="p-2.5 rounded-lg bg-white border border-slate-200">
                <div className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-1">
                  <Network className="w-3 h-3 text-blue-600" />
                  <span>Management IP (vmk0)</span>
                </div>
                <div className="font-mono font-bold text-slate-900 text-xs mt-1">
                  {ritmData.extractedFields.managementIp || '<Not Specified>'}
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5">Mask: {ritmData.extractedFields.managementMask || '255.255.255.0'}</div>
              </div>

              {/* IPMI Address */}
              <div className="p-2.5 rounded-lg bg-indigo-50/70 border border-indigo-200">
                <div className="text-[10px] font-bold text-indigo-700 uppercase flex items-center gap-1">
                  <Key className="w-3 h-3 text-indigo-600" />
                  <span>IPMI / BMC Address</span>
                </div>
                <div className="font-mono font-bold text-indigo-950 text-xs mt-1">
                  {ritmData.extractedFields.ipmiAddress || '<Not Specified>'}
                </div>
                <div className="text-[10px] text-indigo-600 font-semibold mt-0.5">Step 2 & Step 4: Out-of-band</div>
              </div>

              {/* vMotion IP */}
              <div className="p-2.5 rounded-lg bg-white border border-slate-200">
                <div className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-1">
                  <Network className="w-3 h-3 text-indigo-600" />
                  <span>vMotion IP (vmk1)</span>
                </div>
                <div className="font-mono font-bold text-slate-900 text-xs mt-1">
                  {ritmData.extractedFields.vmotionIp || '<Not Specified>'}
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5">Dedicated interface</div>
              </div>

              {/* Hardware Model */}
              <div className="p-2.5 rounded-lg bg-white border border-slate-200">
                <div className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-1">
                  <Cpu className="w-3 h-3 text-emerald-600" />
                  <span>Hardware Model</span>
                </div>
                <div className="font-semibold text-slate-900 text-xs mt-1 truncate">
                  {ritmData.extractedFields.hardwareModel || '<Not Specified>'}
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5">Vendor: {ritmData.extractedFields.hardwareVendor}</div>
              </div>

              {/* Gateway & VLAN */}
              <div className="p-2.5 rounded-lg bg-white border border-slate-200">
                <div className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-1">
                  <Network className="w-3 h-3 text-amber-600" />
                  <span>Gateway & VLAN</span>
                </div>
                <div className="font-mono font-semibold text-slate-900 text-xs mt-1">
                  {ritmData.extractedFields.gatewayIp || 'Default'} (VLAN {ritmData.extractedFields.vlanId || 0})
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5">Network Route</div>
              </div>

              {/* Fixed DNS */}
              <div className="p-2.5 rounded-lg bg-white border border-slate-200">
                <div className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-1">
                  <ServerIcon className="w-3 h-3 text-slate-600" />
                  <span>DNS Resolvers</span>
                </div>
                <div className="font-mono font-semibold text-slate-900 text-xs mt-1">
                  {(ritmData.extractedFields.dnsServers || ['8.8.8.8', '10.100.1.1']).join(', ')}
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5">Step 2: DNS Profile</div>
              </div>

              {/* ESXi Target Version */}
              <div className="p-2.5 rounded-lg bg-white border border-slate-200">
                <div className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-indigo-600" />
                  <span>ESXi Release</span>
                </div>
                <div className="font-bold text-indigo-700 text-xs mt-1">
                  VMware ESXi {ritmData.extractedFields.esxiVersion || '8.0U2'}
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5">Custom OEM Image</div>
              </div>
            </div>
          </div>

          {/* Collapsible All ServiceNow Variables */}
          <div className="border border-slate-200 rounded-lg overflow-hidden">
            <button
              type="button"
              onClick={() => setShowAllVariables(!showAllVariables)}
              className="w-full p-2.5 bg-slate-50 hover:bg-slate-100 flex items-center justify-between text-xs font-semibold text-slate-800 transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <span>All Catalog Item Variables & ServiceNow Fields ({Object.keys(ritmData.allVariables || {}).length})</span>
                <span className="text-[10px] text-slate-500 font-mono">sc_item_option_mtom</span>
              </div>
              {showAllVariables ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
            </button>

            {showAllVariables && (
              <div className="p-3 bg-white divide-y divide-slate-100 max-h-56 overflow-y-auto text-xs">
                {Object.entries(ritmData.allVariables || {}).map(([k, item]) => {
                  const entry = item as { value?: any; displayValue?: any } | undefined;
                  const display = entry?.displayValue || (entry?.value !== undefined ? String(entry.value) : String(item));
                  return (
                    <div key={k} className="py-1.5 flex items-center justify-between gap-4">
                      <span className="font-mono text-slate-500 text-[11px]">{k}</span>
                      <span className="text-slate-800 font-medium text-right font-mono text-[11px]">
                        {display}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
