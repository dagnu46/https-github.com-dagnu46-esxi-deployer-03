import React, { useState } from 'react';
import { 
  X, 
  Database, 
  Terminal, 
  Layers, 
  Copy, 
  Check, 
  RefreshCw, 
  Download, 
  Server as ServerIcon,
  ShieldCheck,
  AlertCircle,
  ExternalLink,
  Code2,
  FileCode,
  CheckCircle2,
  HardDrive,
  Trash2
} from 'lucide-react';
import { DatabaseStatus, testDbConnection, reseedDb } from '../services/api';

interface DockerDbModalProps {
  isOpen: boolean;
  onClose: () => void;
  status: DatabaseStatus | null;
  onRefreshStatus: () => void;
  onDatabaseReseeded: () => void;
  onFlushAll?: () => void;
}

const DOCKER_COMPOSE_SNIPPET = `version: '3.8'

services:
  # PostgreSQL Database with Persistent Storage
  postgres:
    image: postgres:16-alpine
    container_name: firmware-hub-postgres
    restart: unless-stopped
    environment:
      POSTGRES_USER: Dagnu
      POSTGRES_PASSWORD: 'Dagnu0046!'
      POSTGRES_DB: firmware_hub
      POSTGRES_HOST_AUTH_METHOD: trust
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./init-db.sql:/docker-entrypoint-initdb.d/01-init.sql:ro
    ports:
      - "5432:5432"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U Dagnu -d firmware_hub"]
      interval: 10s
      timeout: 5s
      retries: 5
      start_period: 10s

  # Server Firmware Manager Web Application
  app:
    build:
      context: .
      dockerfile: Dockerfile
    container_name: firmware-hub-app
    restart: unless-stopped
    environment:
      - NODE_ENV=production
      - PORT=3000
      - DATABASE_URL=postgres://Dagnu:Dagnu0046%21@postgres:5432/firmware_hub
      - PGUSER=Dagnu
      - PGPASSWORD=Dagnu0046!
      - PGHOST=postgres
      - PGPORT=5432
      - PGDATABASE=firmware_hub
    ports:
      - "3000:3000"
    depends_on:
      postgres:
        condition: service_healthy

volumes:
  postgres_data:
    driver: local`;

const DOCKERFILE_SNIPPET = `# Stage 1: Build Frontend and Server Bundle
FROM node:22-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci
COPY . .
RUN npm run build

# Stage 2: Production Runtime Container
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/init-db.sql ./init-db.sql
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \\
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/health || exit 1
CMD ["node", "dist/server.cjs"]`;

export const DockerDbModal: React.FC<DockerDbModalProps> = ({
  isOpen,
  onClose,
  status,
  onRefreshStatus,
  onDatabaseReseeded,
  onFlushAll,
}) => {
  const [activeTab, setActiveTab] = useState<'status' | 'compose' | 'dockerfile' | 'sql'>('status');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [isTesting, setIsTesting] = useState(false);
  const [isReseeding, setIsReseeding] = useState(false);
  const [actionMessage, setActionMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  if (!isOpen) return null;

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleTestConnection = async () => {
    setIsTesting(true);
    setActionMessage(null);
    try {
      const res = await testDbConnection();
      onRefreshStatus();
      if (res.connected) {
        setActionMessage({ text: `Connection successful (${res.latencyMs || 0}ms latency). All tables verified.`, type: 'success' });
      } else {
        setActionMessage({ text: `Could not reach PostgreSQL: ${res.error || 'Check that container is running.'}`, type: 'error' });
      }
    } catch (e: any) {
      setActionMessage({ text: e.message, type: 'error' });
    } finally {
      setIsTesting(false);
    }
  };

  const handleReseed = async () => {
    if (!confirm('Re-seed the PostgreSQL database with the default datacenter server fleet? Any custom changes in tables will be reset.')) {
      return;
    }
    setIsReseeding(true);
    setActionMessage(null);
    try {
      const res = await reseedDb();
      if (res.success) {
        setActionMessage({ text: 'PostgreSQL database successfully re-seeded with clean fleet inventory.', type: 'success' });
        onDatabaseReseeded();
        onRefreshStatus();
      } else {
        setActionMessage({ text: res.error || 'Failed to re-seed database', type: 'error' });
      }
    } catch (e: any) {
      setActionMessage({ text: e.message, type: 'error' });
    } finally {
      setIsReseeding(false);
    }
  };

  const isConnected = status?.connected ?? false;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="relative bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[92vh] flex flex-col border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600/30 border border-indigo-500/40 flex items-center justify-center text-indigo-400">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-base font-bold">Local Docker & PostgreSQL Setup</h2>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                  isConnected 
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                    : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                }`}>
                  {isConnected ? 'PostgreSQL Active' : 'Docker Compose Ready'}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Run fully self-contained on your local server with zero cloud dependencies.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="px-6 bg-slate-50 border-b border-slate-200 flex items-center space-x-6 text-xs font-semibold text-slate-600 overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab('status')}
            className={`py-3 border-b-2 transition-colors flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'status' ? 'border-indigo-600 text-indigo-600' : 'border-transparent hover:text-slate-900'
            }`}
          >
            <HardDrive className="w-4 h-4" />
            <span>Database Status & Tables</span>
            {isConnected && <span className="w-2 h-2 rounded-full bg-emerald-500" />}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('compose')}
            className={`py-3 border-b-2 transition-colors flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'compose' ? 'border-indigo-600 text-indigo-600' : 'border-transparent hover:text-slate-900'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>docker-compose.yml</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('dockerfile')}
            className={`py-3 border-b-2 transition-colors flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'dockerfile' ? 'border-indigo-600 text-indigo-600' : 'border-transparent hover:text-slate-900'
            }`}
          >
            <FileCode className="w-4 h-4" />
            <span>Dockerfile (Multi-Stage)</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('sql')}
            className={`py-3 border-b-2 transition-colors flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'sql' ? 'border-indigo-600 text-indigo-600' : 'border-transparent hover:text-slate-900'
            }`}
          >
            <Code2 className="w-4 h-4" />
            <span>init-db.sql Schema</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {actionMessage && (
            <div className={`p-3 rounded-lg border text-xs flex items-center gap-2 ${
              actionMessage.type === 'success' 
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200' 
                : 'bg-amber-50 text-amber-800 border-amber-200'
            }`}>
              {actionMessage.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
              )}
              <span>{actionMessage.text}</span>
            </div>
          )}

          {/* TAB 1: STATUS & CONTROLS */}
          {activeTab === 'status' && (
            <div className="space-y-6">
              {/* Quick Launch Banner */}
              <div className="p-4 bg-slate-950 text-white rounded-xl space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                      <Terminal className="w-4 h-4 text-indigo-400" />
                      One-Command Local Docker Launch
                    </h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Starts PostgreSQL 16 on port 5432 and the Web App on port 3000 with volume persistence.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => copyToClipboard('docker compose up --build -d', 'cmd-up')}
                    className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors self-start sm:self-auto shrink-0 shadow-xs"
                  >
                    {copiedKey === 'cmd-up' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedKey === 'cmd-up' ? 'Copied Command!' : 'Copy Launch Command'}</span>
                  </button>
                </div>

                <div className="p-2.5 rounded-lg bg-slate-900 font-mono text-xs text-emerald-400 border border-slate-800 flex items-center justify-between">
                  <span>$ docker compose up --build -d</span>
                </div>
              </div>

              {/* Status Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Connection Box */}
                <div className="border border-slate-200 rounded-xl p-4 bg-white space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                    <span className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                      <Database className="w-3.5 h-3.5 text-indigo-600" />
                      PostgreSQL Connection
                    </span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-sm ${
                      isConnected 
                        ? 'bg-emerald-100 text-emerald-800' 
                        : 'bg-amber-100 text-amber-800'
                    }`}>
                      {isConnected ? `Online (${status?.latencyMs || 0}ms)` : 'Local Docker Host'}
                    </span>
                  </div>

                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between py-1 border-b border-slate-50">
                      <span className="text-slate-500">Database Name:</span>
                      <span className="font-mono font-medium text-slate-900">{status?.databaseName || 'firmware_hub'}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-50">
                      <span className="text-slate-500">PostgreSQL Host:</span>
                      <span className="font-mono text-slate-900">{isConnected ? 'Local Container / Localhost' : 'localhost:5432'}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-50">
                      <span className="text-slate-500">Connection String:</span>
                      <span className="font-mono text-[11px] text-slate-600 truncate max-w-[200px]" title={status?.connectionStringSanitized}>
                        {status?.connectionStringSanitized || 'postgres://Dagnu:••••@localhost:5432/firmware_hub'}
                      </span>
                    </div>
                    <div className="flex justify-between py-1">
                      <span className="text-slate-500">Postgres Engine:</span>
                      <span className="text-slate-700 font-medium">{status?.serverVersion || 'PostgreSQL 16 (Alpine)'}</span>
                    </div>
                  </div>

                  <div className="pt-2 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleTestConnection}
                      disabled={isTesting}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 flex items-center gap-1.5 transition-colors flex-1 justify-center"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isTesting ? 'animate-spin' : ''}`} />
                      <span>{isTesting ? 'Testing...' : 'Test Connection'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleReseed}
                      disabled={isReseeding}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 flex items-center gap-1.5 transition-colors"
                      title="Reset database to initial datacenter servers"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isReseeding ? 'animate-spin' : ''}`} />
                      <span>Re-seed Fleet</span>
                    </button>
                    {onFlushAll && (
                      <button
                        type="button"
                        onClick={() => {
                          onClose();
                          onFlushAll();
                        }}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 flex items-center gap-1.5 transition-colors"
                        title="Purge all tables in database"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Flush Tables</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Table Storage Metrics */}
                <div className="border border-slate-200 rounded-xl p-4 bg-white space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                    <span className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                      <Layers className="w-3.5 h-3.5 text-indigo-600" />
                      Relational Tables & Records
                    </span>
                    <span className="text-[10px] text-slate-500">Live counts</span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-100">
                      <div className="text-slate-500 text-[11px]">Servers Inventory</div>
                      <div className="text-lg font-bold font-mono text-slate-900">
                        {status?.tableCounts?.servers ?? 5}
                      </div>
                    </div>
                    <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-100">
                      <div className="text-slate-500 text-[11px]">Firmware Packages</div>
                      <div className="text-lg font-bold font-mono text-slate-900">
                        {status?.tableCounts?.firmware_packages ?? 6}
                      </div>
                    </div>
                    <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-100">
                      <div className="text-slate-500 text-[11px]">Audit History Logs</div>
                      <div className="text-lg font-bold font-mono text-slate-900">
                        {status?.tableCounts?.audit_records ?? 4}
                      </div>
                    </div>
                    <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-100">
                      <div className="text-slate-500 text-[11px]">Upgrade Campaigns</div>
                      <div className="text-lg font-bold font-mono text-slate-900">
                        {status?.tableCounts?.campaigns ?? 1}
                      </div>
                    </div>
                  </div>

                  <div className="pt-1">
                    <a
                      href="/api/db/export"
                      download="firmware-hub-database-backup.json"
                      className="w-full py-1.5 px-3 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-800 flex items-center justify-center gap-1.5 transition-colors"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Export Full Database Backup (JSON)</span>
                    </a>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: DOCKER COMPOSE */}
          {activeTab === 'compose' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-slate-900">docker-compose.yml</h4>
                  <p className="text-[11px] text-slate-500">
                    Defines the persistent PostgreSQL database and the production web application container.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => copyToClipboard(DOCKER_COMPOSE_SNIPPET, 'compose')}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-800 flex items-center gap-1.5 transition-colors"
                >
                  {copiedKey === 'compose' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedKey === 'compose' ? 'Copied!' : 'Copy YAML'}</span>
                </button>
              </div>

              <pre className="p-4 rounded-xl bg-slate-950 text-slate-200 font-mono text-xs overflow-x-auto border border-slate-800 max-h-[380px]">
                {DOCKER_COMPOSE_SNIPPET}
              </pre>
            </div>
          )}

          {/* TAB 3: DOCKERFILE */}
          {activeTab === 'dockerfile' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-slate-900">Dockerfile</h4>
                  <p className="text-[11px] text-slate-500">
                    Multi-stage production build: compiles React frontend with Vite, bundles Express backend with esbuild, and outputs lightweight Alpine container.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => copyToClipboard(DOCKERFILE_SNIPPET, 'dockerfile')}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-800 flex items-center gap-1.5 transition-colors"
                >
                  {copiedKey === 'dockerfile' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedKey === 'dockerfile' ? 'Copied!' : 'Copy Dockerfile'}</span>
                </button>
              </div>

              <pre className="p-4 rounded-xl bg-slate-950 text-slate-200 font-mono text-xs overflow-x-auto border border-slate-800 max-h-[380px]">
                {DOCKERFILE_SNIPPET}
              </pre>
            </div>
          )}

          {/* TAB 4: SQL SCHEMA */}
          {activeTab === 'sql' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-slate-900">init-db.sql Schema</h4>
                  <p className="text-[11px] text-slate-500">
                    Auto-executed when PostgreSQL container first starts; creates tables and indexes.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => copyToClipboard(`CREATE TABLE servers (...); CREATE TABLE firmware_packages (...);`, 'sql')}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-800 flex items-center gap-1.5 transition-colors"
                >
                  {copiedKey === 'sql' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedKey === 'sql' ? 'Copied!' : 'Copy Schema'}</span>
                </button>
              </div>

              <div className="p-4 rounded-xl bg-slate-950 text-slate-300 font-mono text-xs overflow-x-auto border border-slate-800 max-h-[380px] space-y-2">
                <p className="text-slate-500">-- Core tables created in database 'firmware_hub':</p>
                <p className="text-emerald-400">1. servers (id, hostname, cluster, datacenter, rack, unit, ip, bmc_ip, bmc_type, model, components, credentials, access_status...)</p>
                <p className="text-emerald-400">2. firmware_packages (id, name, component, version, severity, supported_models, sha256, cves...)</p>
                <p className="text-emerald-400">3. audit_records (id, timestamp, server_hostname, component, from_version, to_version, status, operator...)</p>
                <p className="text-emerald-400">4. campaigns (id, title, target_component, status, concurrency_limit, servers...)</p>
                <p className="text-emerald-400">5. baselines (id, name, description, rules, enforce_security_patches...)</p>
                <p className="text-slate-500">-- Indexes created on cluster, datacenter, status, component, and timestamp</p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span>Local Database Architecture • Multi-Stage Alpine Container</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg font-medium transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
