import React, { useState, useEffect } from 'react';
import {
  KeyRound,
  Database,
  Globe,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  Loader2,
  X,
  Lock,
  Server,
  RefreshCw,
  Sparkles,
  ExternalLink
} from 'lucide-react';
import { ServiceNowCredentials } from '../types';
import {
  fetchDatabaseServiceNowCredentials,
  saveDatabaseServiceNowCredentials
} from '../services/servicenowService';
import { logBaremetalOutput } from '../services/baremetalOutputLogger';

interface ServiceNowCredentialsPromptModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCredentialsSaved?: (creds: ServiceNowCredentials) => void;
  onShowToast?: (message: string, type?: 'success' | 'info' | 'warn') => void;
}

export const ServiceNowCredentialsPromptModal: React.FC<ServiceNowCredentialsPromptModalProps> = ({
  isOpen,
  onClose,
  onCredentialsSaved,
  onShowToast
}) => {
  const [instanceUrl, setInstanceUrl] = useState('https://generali.service-now.com');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [environment, setEnvironment] = useState('Production');
  const [showPassword, setShowPassword] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
    latencyMs?: number;
  } | null>(null);
  const [storedInDb, setStoredInDb] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  // Load existing credentials from database on open
  useEffect(() => {
    if (!isOpen) return;

    let mounted = true;
    setIsLoading(true);
    setTestResult(null);

    fetchDatabaseServiceNowCredentials()
      .then((creds) => {
        if (!mounted) return;
        if (creds) {
          setInstanceUrl(creds.instanceUrl || 'https://generali.service-now.com');
          setUsername(creds.username || '');
          if (creds.password) setPassword(creds.password);
          if (creds.environment) setEnvironment(creds.environment);
          setStoredInDb(Boolean(creds.storedInDb));
          if (creds.updatedAt) setLastUpdated(creds.updatedAt);
        }
      })
      .catch((err) => {
        console.warn('Error loading ServiceNow DB credentials:', err);
      })
      .finally(() => {
        if (mounted) setIsLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleTestConnection = async () => {
    setIsTesting(true);
    setTestResult(null);

    logBaremetalOutput(
      'SERVICENOW',
      'info',
      `Testing connectivity to ServiceNow instance (${instanceUrl}) for user "${username || '<anonymous>'}"...`
    );

    try {
      const res = await fetch('/api/servicenow/test-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          instanceUrl: instanceUrl.trim(),
          username: username.trim(),
          password
        })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setTestResult({
          success: true,
          message: data.message || 'ServiceNow API connection verified successfully!',
          latencyMs: data.latencyMs
        });
        logBaremetalOutput(
          'SERVICENOW',
          'success',
          `ServiceNow connection confirmed: ${instanceUrl} (${data.latencyMs || 25}ms)`,
          `Status: ${data.status} | Authenticated user: ${username}`
        );
        if (onShowToast) {
          onShowToast('ServiceNow API connection verified!', 'success');
        }
      } else {
        setTestResult({
          success: false,
          message: data.message || data.error || 'Authentication failed or instance unreachable'
        });
        logBaremetalOutput(
          'SERVICENOW',
          'warn',
          `ServiceNow connection test failed for ${instanceUrl}: ${data.message || data.error}`
        );
      }
    } catch (err: any) {
      setTestResult({
        success: false,
        message: err.message || 'Network error connecting to ServiceNow API proxy'
      });
      logBaremetalOutput('SERVICENOW', 'error', `ServiceNow connection test error: ${err.message}`);
    } finally {
      setIsTesting(false);
    }
  };

  const handleSaveToDatabase = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!instanceUrl.trim()) {
      if (onShowToast) onShowToast('Please specify a ServiceNow Instance URL', 'warn');
      return;
    }

    setIsSaving(true);
    logBaremetalOutput(
      'DATABASE',
      'info',
      `Saving ServiceNow access credentials to PostgreSQL database...`,
      `Target instance: ${instanceUrl.trim()} | Username: ${username.trim()}`
    );

    try {
      const result = await saveDatabaseServiceNowCredentials({
        instanceUrl: instanceUrl.trim(),
        username: username.trim(),
        password,
        environment,
        authType: 'basic',
        storedInDb: true,
        updatedAt: new Date().toISOString()
      });

      if (result.success) {
        setStoredInDb(true);
        setLastUpdated(new Date().toISOString());
        logBaremetalOutput(
          'DATABASE',
          'success',
          `ServiceNow credentials successfully stored in PostgreSQL database (table: app_settings, key: servicenow_credentials)`,
          `Instance URL: ${instanceUrl.trim()} | Service Account: ${username.trim()} | Auth: Stored encrypted`
        );

        if (onShowToast) {
          onShowToast('ServiceNow credentials successfully stored in database!', 'success');
        }

        if (onCredentialsSaved) {
          onCredentialsSaved({
            instanceUrl: instanceUrl.trim(),
            username: username.trim(),
            password,
            environment,
            storedInDb: true,
            updatedAt: new Date().toISOString()
          });
        }

        onClose();
      } else {
        logBaremetalOutput(
          'DATABASE',
          'error',
          `Failed to store ServiceNow credentials in database: ${result.message}`
        );
        if (onShowToast) {
          onShowToast(`Failed to store credentials: ${result.message}`, 'warn');
        }
      }
    } catch (err: any) {
      logBaremetalOutput('DATABASE', 'error', `Exception storing credentials: ${err.message}`);
      if (onShowToast) {
        onShowToast(`Database write error: ${err.message}`, 'warn');
      }
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs">
      <div
        id="servicenow-credentials-prompt-modal"
        className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-150 flex flex-col max-h-[92vh]"
      >
        {/* Modal Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-500/20 border border-indigo-400/40 flex items-center justify-center text-indigo-400">
              <KeyRound className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <span>Prompt ServiceNow Access Credentials</span>
              </h2>
              <p className="text-xs text-slate-400">
                Configure ServiceNow API credentials & store them in PostgreSQL database
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Database Status Strip */}
        <div className="px-6 py-2.5 bg-indigo-50/70 border-b border-indigo-100 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <Database className="w-4 h-4 text-indigo-600" />
            <span className="text-slate-700 font-medium">Target Storage:</span>
            <span className="font-semibold text-indigo-900">PostgreSQL Database (table: app_settings)</span>
          </div>
          {storedInDb ? (
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
              Stored in Database
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">
              <AlertCircle className="w-3 h-3 text-amber-600" />
              Not Stored Yet
            </span>
          )}
        </div>

        {/* Form Body */}
        <form onSubmit={handleSaveToDatabase} className="p-6 space-y-4 overflow-y-auto flex-1 text-sm">
          {isLoading ? (
            <div className="py-12 text-center text-slate-500 space-y-2">
              <Loader2 className="w-6 h-6 animate-spin mx-auto text-indigo-600" />
              <p className="text-xs">Loading stored credentials from database...</p>
            </div>
          ) : (
            <>
              {/* ServiceNow Instance URL */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                  ServiceNow Instance URL <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <Globe className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
                  <input
                    type="url"
                    required
                    value={instanceUrl}
                    onChange={(e) => setInstanceUrl(e.target.value)}
                    placeholder="https://generali.service-now.com"
                    className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-slate-900 font-mono text-xs"
                  />
                </div>
                <p className="text-[11px] text-slate-500">
                  Target ServiceNow instance FQDN for Table API and RITM ticket resolution.
                </p>
              </div>

              {/* Username / Service Account */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                  ServiceNow Username / Service Account
                </label>
                <div className="relative">
                  <Server className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="e.g. svc_vcenter_baremetal or john.doe"
                    className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-slate-900 font-mono text-xs"
                  />
                </div>
                <p className="text-[11px] text-slate-500">
                  Account must possess <code>itil</code> or <code>rest_api_explorer</code> read permissions for <code>sc_req_item</code>.
                </p>
              </div>

              {/* Password / API Token */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Password / API Secret Key
                  </label>
                  <span className="text-[11px] text-slate-500 flex items-center gap-1">
                    <Lock className="w-3 h-3 text-slate-400" />
                    Encrypted on save
                  </span>
                </div>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter ServiceNow user password or secret..."
                    className="w-full pl-9 pr-10 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-slate-900 font-mono text-xs"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 focus:outline-none"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Environment Selection */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Target ITSM Environment
                </label>
                <select
                  value={environment}
                  onChange={(e) => setEnvironment(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800 bg-white"
                >
                  <option value="Production">Production (generali.service-now.com)</option>
                  <option value="Staging">Staging / UAT (generali-uat.service-now.com)</option>
                  <option value="Sandbox">Development Sandbox (dev-sandbox.service-now.com)</option>
                </select>
              </div>

              {/* Test Connection Results Box */}
              {testResult && (
                <div
                  className={`p-3 rounded-xl border text-xs flex items-start gap-2.5 ${
                    testResult.success
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                      : 'bg-rose-50 border-rose-200 text-rose-900'
                  }`}
                >
                  {testResult.success ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  )}
                  <div className="flex-1">
                    <p className="font-semibold">{testResult.message}</p>
                    {testResult.latencyMs && (
                      <p className="text-[11px] opacity-80 mt-0.5">
                        Response latency: {testResult.latencyMs} ms
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Information Banner */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-600 space-y-1">
                <div className="flex items-center gap-1.5 font-semibold text-slate-800">
                  <ShieldCheck className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Database Persistence Workflow</span>
                </div>
                <p className="text-[11px] leading-relaxed">
                  Credentials are written to the PostgreSQL database table{' '}
                  <code className="bg-slate-200/80 px-1 py-0.2 rounded font-mono text-[10px]">app_settings</code>{' '}
                  under key{' '}
                  <code className="bg-slate-200/80 px-1 py-0.2 rounded font-mono text-[10px]">servicenow_credentials</code>.
                  They are immediately available for Step 1 RITM queries and ticket validation across all sessions.
                </p>
                {lastUpdated && (
                  <p className="text-[10px] text-slate-500 pt-1">
                    Last updated in database: {new Date(lastUpdated).toLocaleString()}
                  </p>
                )}
              </div>
            </>
          )}

          {/* Action Footer */}
          <div className="pt-2 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">
            <button
              type="button"
              disabled={isTesting || isLoading}
              onClick={handleTestConnection}
              className="w-full sm:w-auto flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-300 text-slate-700 bg-white hover:bg-slate-50 font-medium text-xs transition-colors disabled:opacity-50"
            >
              {isTesting ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-600" />
              ) : (
                <RefreshCw className="w-3.5 h-3.5 text-slate-600" />
              )}
              <span>{isTesting ? 'Testing Connection...' : 'Test Connection'}</span>
            </button>

            <div className="w-full sm:w-auto flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 sm:flex-none px-4 py-2 rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-50 font-medium text-xs transition-colors"
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={isSaving || isLoading}
                className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs shadow-md transition-all hover:shadow-indigo-500/20 disabled:opacity-50"
              >
                {isSaving ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Database className="w-3.5 h-3.5 text-indigo-200" />
                )}
                <span>{isSaving ? 'Storing in Database...' : 'Store into Database'}</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
