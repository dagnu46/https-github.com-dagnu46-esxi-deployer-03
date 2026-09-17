import { ServiceNowRitmData, ServiceNowConnectionConfig, ServiceNowCredentials } from '../types';

const SN_CONFIG_STORAGE_KEY = 'vcenter_servicenow_config';
const SN_RITM_CACHE_PREFIX = 'vcenter_sn_ritm_';

export function getStoredServiceNowConfig(): ServiceNowConnectionConfig {
  try {
    const raw = localStorage.getItem(SN_CONFIG_STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    // ignore
  }
  return {
    instanceUrl: 'https://generali.service-now.com',
    username: '',
    isConnected: false,
    storedInDb: false,
    lastChecked: new Date().toISOString()
  };
}

export function saveStoredServiceNowConfig(cfg: ServiceNowConnectionConfig): void {
  try {
    localStorage.setItem(SN_CONFIG_STORAGE_KEY, JSON.stringify(cfg));
  } catch {
    // ignore
  }
}

/**
 * Fetch credentials stored in PostgreSQL database
 */
export async function fetchDatabaseServiceNowCredentials(): Promise<ServiceNowCredentials | null> {
  try {
    const res = await fetch('/api/servicenow/credentials');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (data.success && data.credentials) {
      saveStoredServiceNowConfig({
        instanceUrl: data.credentials.instanceUrl,
        username: data.credentials.username,
        password: data.credentials.password,
        storedInDb: data.credentials.storedInDb,
        isConnected: data.credentials.isConnected,
        lastChecked: data.credentials.lastChecked,
        updatedAt: data.credentials.updatedAt
      });
      return data.credentials;
    }
  } catch (err) {
    console.warn('[ServiceNow Service] Could not fetch DB credentials:', err);
  }
  return null;
}

/**
 * Store credentials into PostgreSQL database
 */
export async function saveDatabaseServiceNowCredentials(
  credentials: Partial<ServiceNowCredentials>
): Promise<{ success: boolean; message: string; credentials?: ServiceNowCredentials; error?: string }> {
  try {
    const res = await fetch('/api/servicenow/credentials', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(credentials)
    });
    const data = await res.json();
    if (res.ok && data.success) {
      saveStoredServiceNowConfig({
        instanceUrl: credentials.instanceUrl || 'https://generali.service-now.com',
        username: credentials.username || '',
        password: credentials.password || '',
        storedInDb: true,
        lastChecked: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
      return data;
    }
    return { success: false, message: data.error || 'Failed to save credentials in database', error: data.error };
  } catch (err: any) {
    return { success: false, message: err.message || 'Network error saving credentials to database', error: err.message };
  }
}

/**
 * Fetch RITM details from ServiceNow via server proxy
 * ONLY REAL RESULTS - NO SANDBOX / NO MOCK FALLBACKS
 */
export async function fetchServiceNowRitm(
  ritmNumber: string,
  credentialsOverride?: { instanceUrl?: string; username?: string; password?: string }
): Promise<ServiceNowRitmData> {
  const cleanNumber = ritmNumber.trim().toUpperCase();
  if (!cleanNumber) {
    throw new Error('Please enter a valid RITM ticket number');
  }

  const storedCfg = getStoredServiceNowConfig();
  const instanceUrl = credentialsOverride?.instanceUrl || storedCfg.instanceUrl || 'https://generali.service-now.com';
  const username = credentialsOverride?.username || storedCfg.username || '';

  const res = await fetch(`/api/servicenow/ritm/${encodeURIComponent(cleanNumber)}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      instanceUrl,
      username,
      password: credentialsOverride?.password
    })
  });

  if (res.ok) {
    const data: ServiceNowRitmData = await res.json();
    try {
      localStorage.setItem(SN_RITM_CACHE_PREFIX + cleanNumber, JSON.stringify(data));
    } catch {
      // ignore
    }
    return data;
  }

  const errData = await res.json().catch(() => ({}));
  throw new Error(errData.error || `ServiceNow request failed with HTTP ${res.status}`);
}

/**
 * Test connectivity and auth to ServiceNow instance
 * Returns REAL connection status from ServiceNow API
 */
export async function testServiceNowConnection(
  config?: { instanceUrl?: string; username?: string; password?: string }
): Promise<{ success: boolean; message: string; instanceUrl: string; username: string; latencyMs?: number }> {
  try {
    const res = await fetch('/api/servicenow/test-connection', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config || {})
    });
    const data = await res.json();
    return {
      success: Boolean(data.success),
      message: data.message || (data.success ? 'Real connection verified' : 'Connection failed'),
      instanceUrl: data.instanceUrl || config?.instanceUrl || 'https://generali.service-now.com',
      username: data.username || config?.username || '',
      latencyMs: data.latencyMs
    };
  } catch (e: any) {
    return {
      success: false,
      message: e.message || 'Unable to connect to ServiceNow instance',
      instanceUrl: config?.instanceUrl || 'https://generali.service-now.com',
      username: config?.username || ''
    };
  }
}
