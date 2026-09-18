import React, { useState } from 'react';
import { 
  Globe, 
  Key, 
  Cookie, 
  FileText, 
  RefreshCw, 
  CheckCircle2, 
  AlertCircle, 
  X, 
  ExternalLink, 
  Copy, 
  Check, 
  Database,
  ArrowRight,
  Code,
  Terminal,
  Layers,
  Sparkles
} from 'lucide-react';
import { ServiceNowRitmData, ServiceNowExtractedFields } from '../types';
import { fetchServiceNowRitm } from '../services/servicenowService';

interface ServiceNowGrabModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApplyToWizard?: (data: ServiceNowRitmData) => void;
}

export const ServiceNowGrabModal: React.FC<ServiceNowGrabModalProps> = ({
  isOpen,
  onClose,
  onApplyToWizard
}) => {
  // 2 input fields requested by user: glide_user_route & JSESSIONID, plus RITM number
  const [ritmNumber, setRitmNumber] = useState('RITM001508091');
  const [glideUserRoute, setGlideUserRoute] = useState('glide.0252bc547e39018c2a7c640db5b70f85');
  const [jsessionId, setJsessionId] = useState('F64AD066A36B1C3C1217D715E1D35D8F');
  const [instanceUrl, setInstanceUrl] = useState('https://generali.service-now.com');
  const [apiMethod, setApiMethod] = useState<'jsonv2' | 'table_api'>('jsonv2');

  // Retrieval state
  const [isGrabbing, setIsGrabbing] = useState(false);
  const [grabError, setGrabError] = useState<string | null>(null);
  const [grabbedData, setGrabbedData] = useState<ServiceNowRitmData | null>(null);
  const [activeTab, setActiveTab] = useState<'extracted' | 'variables' | 'raw'>('extracted');
  const [copiedRaw, setCopiedRaw] = useState(false);

  if (!isOpen) return null;

  const handleGrab = async () => {
    const cleanRitm = ritmNumber.trim().toUpperCase() || 'RITM001508091';
    if (!glideUserRoute.trim() || !jsessionId.trim()) {
      setGrabError('Please provide both glide_user_route and JSESSIONID cookie values.');
      return;
    }

    setIsGrabbing(true);
    setGrabError(null);
    setGrabbedData(null);

    try {
      const data = await fetchServiceNowRitm(cleanRitm, {
        instanceUrl: instanceUrl.trim(),
        apiMethod,
        glideUserRoute: glideUserRoute.trim(),
        jsessionId: jsessionId.trim()
      });

      setGrabbedData(data);
    } catch (err: any) {
      setGrabError(err.message || 'Failed to grab content of RITM from ServiceNow.');
    } finally {
      setIsGrabbing(false);
    }
  };

  const copyRawContent = () => {
    if (!grabbedData) return;
    navigator.clipboard.writeText(JSON.stringify(grabbedData, null, 2));
    setCopiedRaw(true);
    setTimeout(() => setCopiedRaw(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/80 backdrop-blur-xs flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-150">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        
        {/* Modal Header */}
        <div className="px-6 py-4 bg-slate-800/80 border-b border-slate-700 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-md">
              <Sparkles className="w-5 h-5 text-indigo-200" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white tracking-tight">ServiceNow Grab</h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-emerald-950/80 text-emerald-300 border border-emerald-500/40">
                  Cookie Session Auth
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Retrieve live ticket content, variables, and network parameters using session cookies
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-700/60 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-5 text-xs text-slate-300">
          
          {/* Top Form: 2 Cookie inputs + RITM number */}
          <div className="p-4 rounded-xl bg-slate-800/60 border border-slate-700 space-y-3.5">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-indigo-400" />
                  RITM Ticket #
                </label>
                <input
                  type="text"
                  value={ritmNumber}
                  onChange={e => setRitmNumber(e.target.value)}
                  placeholder="RITM001508091"
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white font-mono text-xs focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 font-bold"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                  <Globe className="w-3.5 h-3.5 text-indigo-400" />
                  ServiceNow Instance URL
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={instanceUrl}
                    onChange={e => setInstanceUrl(e.target.value)}
                    placeholder="https://generali.service-now.com"
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 font-mono text-xs focus:ring-2 focus:ring-indigo-500"
                  />
                  <select
                    value={apiMethod}
                    onChange={e => setApiMethod(e.target.value as any)}
                    className="bg-slate-900 border border-slate-700 rounded-lg px-2 py-2 text-slate-300 font-mono text-xs focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                  >
                    <option value="jsonv2">Method 3 (.do?JSONv2)</option>
                    <option value="table_api">Method 1 (Table API)</option>
                  </select>
                </div>
              </div>
            </div>

            {/* The 2 requested inputs */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 border-t border-slate-700/60">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Cookie className="w-3.5 h-3.5 text-emerald-400" />
                    Input 1: glide_user_route
                  </label>
                  <span className="text-[10px] text-slate-400 font-mono">Load balancer route</span>
                </div>
                <input
                  type="text"
                  value={glideUserRoute}
                  onChange={e => setGlideUserRoute(e.target.value)}
                  placeholder="glide.0252bc547e39018c2a7c640db5b70f85"
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-emerald-300 font-mono text-[11px] focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[11px] font-bold text-indigo-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Key className="w-3.5 h-3.5 text-indigo-400" />
                    Input 2: JSESSIONID
                  </label>
                  <span className="text-[10px] text-slate-400 font-mono">Session identifier</span>
                </div>
                <input
                  type="text"
                  value={jsessionId}
                  onChange={e => setJsessionId(e.target.value)}
                  placeholder="F64AD066A36B1C3C1217D715E1D35D8F"
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-indigo-300 font-mono text-[11px] focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-between pt-2 border-t border-slate-700/60">
              <span className="text-[10px] text-slate-400">
                Transmits session cookies securely to query ServiceNow directly.
              </span>
              <button
                type="button"
                id="btn-execute-sn-grab"
                onClick={handleGrab}
                disabled={isGrabbing || !glideUserRoute.trim() || !jsessionId.trim()}
                className="px-5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white font-bold text-xs flex items-center gap-2 shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                {isGrabbing ? (
                  <RefreshCw className="w-4 h-4 animate-spin text-white" />
                ) : (
                  <Sparkles className="w-4 h-4 text-emerald-300" />
                )}
                <span>{isGrabbing ? 'Grabbing RITM Content...' : 'Grab RITM Content'}</span>
              </button>
            </div>
          </div>

          {/* Error Message if Grab Fails */}
          {grabError && (
            <div className="p-4 rounded-xl bg-red-950/70 border border-red-500/50 text-red-200 text-xs space-y-2 animate-in fade-in duration-150">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                <strong className="text-red-300 font-semibold">ServiceNow Response Alert:</strong>
              </div>
              <p className="font-mono text-[11px] break-all bg-red-900/40 p-2 rounded border border-red-800/60">
                {grabError}
              </p>
              <div className="text-[11px] text-red-200/80 pt-1">
                Note: If corporate SSO/F5 invalidated this token due to client IP binding, you can copy the ticket HTML/Text directly from your browser and use the built-in HTML parser button in the deployment wizard!
              </div>
            </div>
          )}

          {/* Grabbed Data Results */}
          {grabbedData && (
            <div className="p-4 rounded-xl bg-slate-800 border border-emerald-500/40 text-white space-y-4 animate-in fade-in duration-150">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-700 pb-3">
                <div className="flex items-center gap-2.5 flex-wrap">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                    Grabbed Ticket:
                  </span>
                  <span className="text-sm font-mono font-bold text-emerald-400 bg-emerald-950/80 px-2.5 py-0.5 rounded border border-emerald-500/30">
                    {grabbedData.number}
                  </span>
                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-700 text-slate-200 font-medium">
                    State: {grabbedData.state}
                  </span>
                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-indigo-900/60 text-indigo-300 border border-indigo-700/50">
                    Stage: {grabbedData.stage}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={copyRawContent}
                    className="px-2.5 py-1 rounded bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    {copiedRaw ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedRaw ? 'Copied JSON' : 'Copy JSON'}</span>
                  </button>
                  {onApplyToWizard && (
                    <button
                      type="button"
                      onClick={() => {
                        onApplyToWizard(grabbedData);
                        onClose();
                      }}
                      className="px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-md transition-colors cursor-pointer"
                    >
                      <span>Load into Deployator Wizard</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Sub-Tabs: Extracted Fields, All Variables, Raw Payload */}
              <div className="flex border-b border-slate-700 gap-4 text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => setActiveTab('extracted')}
                  className={`pb-2 transition-colors cursor-pointer ${
                    activeTab === 'extracted'
                      ? 'border-b-2 border-indigo-400 text-indigo-300 font-bold'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Extracted Deployment Parameters
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('variables')}
                  className={`pb-2 transition-colors cursor-pointer ${
                    activeTab === 'variables'
                      ? 'border-b-2 border-indigo-400 text-indigo-300 font-bold'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  All Catalog Variables ({Object.keys(grabbedData.allVariables || {}).length})
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('raw')}
                  className={`pb-2 transition-colors cursor-pointer ${
                    activeTab === 'raw'
                      ? 'border-b-2 border-indigo-400 text-indigo-300 font-bold'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Raw Response JSON
                </button>
              </div>

              {/* Tab 1: Extracted Parameters */}
              {activeTab === 'extracted' && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  <div className="p-2.5 rounded-lg bg-slate-900/90 border border-slate-700">
                    <span className="text-[10px] text-slate-400 block uppercase">Host FQDN</span>
                    <span className="font-mono font-bold text-emerald-300 text-xs truncate block">
                      {grabbedData.extractedFields.hostname || 'Not set'}
                    </span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-slate-900/90 border border-slate-700">
                    <span className="text-[10px] text-slate-400 block uppercase">Management IP</span>
                    <span className="font-mono font-bold text-emerald-300 text-xs truncate block">
                      {grabbedData.extractedFields.managementIp || 'Not set'}
                    </span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-slate-900/90 border border-slate-700">
                    <span className="text-[10px] text-slate-400 block uppercase">Subnet Mask</span>
                    <span className="font-mono text-slate-300 text-xs truncate block">
                      {grabbedData.extractedFields.managementMask || '255.255.255.0'}
                    </span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-slate-900/90 border border-slate-700">
                    <span className="text-[10px] text-slate-400 block uppercase">Default Gateway</span>
                    <span className="font-mono text-slate-300 text-xs truncate block">
                      {grabbedData.extractedFields.gatewayIp || 'Not set'}
                    </span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-slate-900/90 border border-slate-700">
                    <span className="text-[10px] text-slate-400 block uppercase">vMotion IP</span>
                    <span className="font-mono font-bold text-indigo-300 text-xs truncate block">
                      {grabbedData.extractedFields.vmotionIp || 'Not set'}
                    </span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-slate-900/90 border border-slate-700">
                    <span className="text-[10px] text-slate-400 block uppercase">IPMI / BMC IP</span>
                    <span className="font-mono font-bold text-amber-300 text-xs truncate block">
                      {grabbedData.extractedFields.ipmiAddress || 'Not set'}
                    </span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-slate-900/90 border border-slate-700">
                    <span className="text-[10px] text-slate-400 block uppercase">Hardware Vendor</span>
                    <span className="font-semibold text-slate-200 text-xs truncate block">
                      {grabbedData.extractedFields.hardwareVendor || 'Auto-detect'}
                    </span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-slate-900/90 border border-slate-700">
                    <span className="text-[10px] text-slate-400 block uppercase">Requester</span>
                    <span className="font-semibold text-slate-200 text-xs truncate block">
                      {grabbedData.requester || 'b305glp'}
                    </span>
                  </div>
                </div>
              )}

              {/* Tab 2: Catalog Variables */}
              {activeTab === 'variables' && (
                <div className="max-h-60 overflow-y-auto rounded-lg border border-slate-700 bg-slate-950 p-2 space-y-1 font-mono text-[11px]">
                  {Object.keys(grabbedData.allVariables || {}).length === 0 ? (
                    <div className="p-3 text-slate-500 italic text-center">
                      No direct catalog variables parsed in response.
                    </div>
                  ) : (
                    Object.entries(grabbedData.allVariables).map(([key, item]: [string, any]) => (
                      <div key={key} className="flex items-center justify-between p-1.5 hover:bg-slate-900 rounded">
                        <span className="text-slate-400">{key}:</span>
                        <span className="text-emerald-300 font-semibold">{String(item.value ?? item)}</span>
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* Tab 3: Raw JSON */}
              {activeTab === 'raw' && (
                <pre className="max-h-60 overflow-y-auto overflow-x-auto text-emerald-400 text-[10.5px] p-3 bg-slate-950 rounded-lg border border-slate-700 font-mono">
                  {JSON.stringify(grabbedData, null, 2)}
                </pre>
              )}
            </div>
          )}

        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3.5 bg-slate-800/80 border-t border-slate-700 flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>Top-Page ServiceNow Grab Engine</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-white font-medium cursor-pointer transition-colors"
          >
            Close
          </button>
        </div>

      </div>
    </div>
  );
};
