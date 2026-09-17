import { BaremetalOutputLog } from '../types';

type LogListener = (logs: BaremetalOutputLog[]) => void;

const MAX_LOGS = 500;
const STORAGE_KEY = 'baremetal_global_output_logs';

const initialBootLogs: BaremetalOutputLog[] = [
  {
    id: 'boot-1',
    timestamp: new Date(Date.now() - 120000).toISOString(),
    category: 'SYSTEM',
    level: 'info',
    message: 'Baremetal Hypervisor Provisioning & Orchestration Engine v2.4 initialized.',
    details: 'Node.js runtime active on port 3000 with Redfish BMC virtual media gateway.'
  },
  {
    id: 'boot-2',
    timestamp: new Date(Date.now() - 110000).toISOString(),
    category: 'DATABASE',
    level: 'info',
    message: 'PostgreSQL database connection pool established (table: app_settings, schema: public).',
    details: 'Persistent configuration and encrypted credentials store ready.'
  },
  {
    id: 'boot-3',
    timestamp: new Date(Date.now() - 95000).toISOString(),
    category: 'SERVICENOW',
    level: 'info',
    message: 'ServiceNow ITSM Table API client ready for RITM ticket authorization lookup.',
    details: 'Configured instance: https://generali.service-now.com'
  },
  {
    id: 'boot-4',
    timestamp: new Date(Date.now() - 80000).toISOString(),
    category: 'IPMI',
    level: 'info',
    message: 'Out-of-band Redfish / IPMI 2.0 daemon listening for target server BMC chassis probes.',
    details: 'Protocols supported: Dell iDRAC (Redfish API), Lenovo XCC (HTTPS / Redfish), HP iLO'
  },
  {
    id: 'boot-5',
    timestamp: new Date(Date.now() - 60000).toISOString(),
    category: 'DEPLOY',
    level: 'info',
    message: 'Baremetal Deployment Engine in ready state. Awaiting Step 1 RITM authorization.',
  }
];

class BaremetalOutputLogger {
  private logs: BaremetalOutputLog[] = [];
  private listeners: Set<LogListener> = new Set();

  constructor() {
    // Try to load cached logs or fallback to boot logs
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          this.logs = parsed.slice(-MAX_LOGS);
        } else {
          this.logs = [...initialBootLogs];
        }
      } else {
        this.logs = [...initialBootLogs];
      }
    } catch {
      this.logs = [...initialBootLogs];
    }
  }

  public getLogs(): BaremetalOutputLog[] {
    return [...this.logs];
  }

  public log(
    category: BaremetalOutputLog['category'],
    level: BaremetalOutputLog['level'],
    message: string,
    details?: string
  ): BaremetalOutputLog {
    const newLog: BaremetalOutputLog = {
      id: `log-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      timestamp: new Date().toISOString(),
      category,
      level,
      message,
      details
    };

    this.logs = [...this.logs.slice(-(MAX_LOGS - 1)), newLog];
    this.persist();
    this.notify();
    return newLog;
  }

  public clear(): void {
    this.logs = [];
    this.persist();
    this.notify();
  }

  public resetToBoot(): void {
    this.logs = [...initialBootLogs];
    this.persist();
    this.notify();
  }

  public subscribe(listener: LogListener): () => void {
    this.listeners.add(listener);
    listener(this.getLogs());
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(): void {
    const current = this.getLogs();
    this.listeners.forEach((l) => l(current));
  }

  private persist(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.logs.slice(-100)));
    } catch {
      // Ignore quota errors
    }
  }
}

export const baremetalLogger = new BaremetalOutputLogger();

export function logBaremetalOutput(
  category: BaremetalOutputLog['category'],
  level: BaremetalOutputLog['level'],
  message: string,
  details?: string
): BaremetalOutputLog {
  return baremetalLogger.log(category, level, message, details);
}
