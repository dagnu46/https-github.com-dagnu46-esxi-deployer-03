import { Pool, PoolConfig } from 'pg';
import dotenv from 'dotenv';
import { Server, FirmwarePackage, AuditRecord, BaselineConfig, UpgradeCampaign } from '../types';
import { DEFAULT_BASELINE } from '../data/mockFleet';

dotenv.config();

let pool: Pool | null = null;
let isConnected = false;
let connectionError: string | null = null;
let lastPingTime = 0;
let lastLatencyMs: number | null = null;

// In-memory data store for fallback when PostgreSQL is offline
const memServers = new Map<string, Server>();
const memPackages = new Map<string, FirmwarePackage>();
let memAuditLogs: AuditRecord[] = [];
let memBaseline: BaselineConfig = { ...DEFAULT_BASELINE };
const memCampaigns = new Map<string, UpgradeCampaign>();

export function getDatabaseConfig(): { connectionString?: string; config: PoolConfig } {
  const user = process.env.PGUSER || 'Dagnu';
  const password = process.env.PGPASSWORD || 'Dagnu0046!';
  const host = process.env.PGHOST || 'localhost';
  const port = parseInt(process.env.PGPORT || '5432', 10);
  const database = process.env.PGDATABASE || 'firmware_hub';

  if (process.env.DATABASE_URL) {
    return {
      connectionString: process.env.DATABASE_URL,
      config: {
        connectionString: process.env.DATABASE_URL,
        connectionTimeoutMillis: 3000,
        idleTimeoutMillis: 10000,
        max: 10,
      }
    };
  }

  // Construct connection URL with encoded password for safety
  const defaultUrl = `postgres://${user}:${encodeURIComponent(password)}@${host}:${port}/${database}`;
  return {
    connectionString: defaultUrl,
    config: {
      user,
      password,
      host,
      port,
      database,
      connectionTimeoutMillis: 2000,
      idleTimeoutMillis: 10000,
      max: 10,
    }
  };
}

export function initPool(): Pool {
  if (pool) return pool;
  const { config } = getDatabaseConfig();
  pool = new Pool(config);

  pool.on('error', (err) => {
    console.error('[PostgreSQL] Unexpected pool error:', err.message);
    isConnected = false;
    connectionError = err.message;
  });

  return pool;
}

export async function checkConnection(): Promise<{ connected: boolean; latencyMs?: number; error?: string; host?: string; database?: string }> {
  try {
    const currentPool = initPool();
    const start = Date.now();
    const result = await currentPool.query('SELECT NOW() as now, current_database() as db, inet_server_addr() as host');
    const latency = Date.now() - start;
    
    isConnected = true;
    connectionError = null;
    lastPingTime = Date.now();
    lastLatencyMs = latency;

    return {
      connected: true,
      latencyMs: latency,
      database: result.rows[0]?.db,
      host: result.rows[0]?.host || 'localhost',
    };
  } catch (err: any) {
    isConnected = false;
    connectionError = err.message || 'Unable to reach PostgreSQL server';
    return {
      connected: false,
      error: connectionError || undefined,
    };
  }
}

export async function initializeSchema(): Promise<boolean> {
  const currentPool = initPool();
  try {
    // Create tables
    await currentPool.query(`
      CREATE TABLE IF NOT EXISTS servers (
        id VARCHAR(100) PRIMARY KEY,
        hostname VARCHAR(255) NOT NULL,
        vendor VARCHAR(50) NOT NULL DEFAULT 'DELL',
        hypervisor VARCHAR(100) NOT NULL DEFAULT 'VMware ESXi',
        hypervisor_version VARCHAR(100) DEFAULT 'ESXi 8.0 Update 2',
        hypervisor_maintenance_mode BOOLEAN DEFAULT FALSE,
        active_vms_count INT DEFAULT 0,
        cluster VARCHAR(100) NOT NULL,
        datacenter VARCHAR(100) NOT NULL,
        rack VARCHAR(50) NOT NULL,
        unit VARCHAR(50) NOT NULL,
        ip VARCHAR(64) NOT NULL,
        bmc_ip VARCHAR(64) NOT NULL,
        bmc_type VARCHAR(100) NOT NULL,
        model VARCHAR(100) NOT NULL,
        architecture VARCHAR(50) DEFAULT 'x86_64',
        status VARCHAR(50) DEFAULT 'online',
        power_state VARCHAR(50) DEFAULT 'on',
        power_supply_redundancy BOOLEAN DEFAULT TRUE,
        components JSONB NOT NULL DEFAULT '{}'::jsonb,
        credentials JSONB DEFAULT '{}'::jsonb,
        access_status JSONB DEFAULT '{}'::jsonb,
        tags JSONB DEFAULT '[]'::jsonb,
        notes TEXT,
        last_upgrade_date TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );

      -- Migration: ensure vendor and hypervisor columns exist on existing databases
      ALTER TABLE servers ADD COLUMN IF NOT EXISTS vendor VARCHAR(50) DEFAULT 'DELL';
      ALTER TABLE servers ADD COLUMN IF NOT EXISTS hypervisor VARCHAR(100) DEFAULT 'VMware ESXi';
      ALTER TABLE servers ADD COLUMN IF NOT EXISTS hypervisor_version VARCHAR(100) DEFAULT 'ESXi 8.0 Update 2';
      ALTER TABLE servers ADD COLUMN IF NOT EXISTS hypervisor_maintenance_mode BOOLEAN DEFAULT FALSE;
      ALTER TABLE servers ADD COLUMN IF NOT EXISTS active_vms_count INT DEFAULT 0;

      CREATE TABLE IF NOT EXISTS firmware_packages (
        id VARCHAR(100) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        component VARCHAR(50) NOT NULL,
        version VARCHAR(100) NOT NULL,
        release_date VARCHAR(50),
        severity VARCHAR(50) DEFAULT 'recommended',
        supported_models JSONB DEFAULT '[]'::jsonb,
        min_prerequisite_version VARCHAR(100),
        file_size_mb NUMERIC DEFAULT 0,
        sha256 VARCHAR(128),
        cves JSONB DEFAULT '[]'::jsonb,
        release_notes TEXT,
        reboot_required BOOLEAN DEFAULT FALSE,
        vendor VARCHAR(100),
        file_name VARCHAR(255),
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS audit_records (
        id VARCHAR(100) PRIMARY KEY,
        timestamp TIMESTAMPTZ DEFAULT NOW(),
        server_hostname VARCHAR(255) NOT NULL,
        server_id VARCHAR(100) NOT NULL,
        component VARCHAR(50) NOT NULL,
        from_version VARCHAR(100) NOT NULL,
        to_version VARCHAR(100) NOT NULL,
        status VARCHAR(50) NOT NULL,
        operator VARCHAR(100) DEFAULT 'sysadmin',
        duration_seconds INT DEFAULT 0,
        firmware_package_name VARCHAR(255)
      );

      CREATE TABLE IF NOT EXISTS baselines (
        id VARCHAR(100) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        rules JSONB NOT NULL DEFAULT '{}'::jsonb,
        enforce_security_patches BOOLEAN DEFAULT TRUE,
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS campaigns (
        id VARCHAR(100) PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        target_component VARCHAR(50) NOT NULL,
        target_firmware_id VARCHAR(100),
        status VARCHAR(50) DEFAULT 'running',
        concurrency_limit INT DEFAULT 2,
        auto_reboot BOOLEAN DEFAULT FALSE,
        stop_on_first_failure BOOLEAN DEFAULT TRUE,
        preflight_checks_required BOOLEAN DEFAULT TRUE,
        servers JSONB DEFAULT '[]'::jsonb,
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS app_settings (
        key VARCHAR(100) PRIMARY KEY,
        value JSONB NOT NULL,
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // Purge any historical mock/sample data if present
    try {
      await currentPool.query(`DELETE FROM servers WHERE id IN ('srv-01','srv-02','srv-03','srv-04','srv-05','srv-06','srv-07','srv-08','srv-09','srv-10','srv-11','srv-12')`);
      await currentPool.query(`DELETE FROM firmware_packages WHERE id IN ('fw-iso-hpe-spp-2026.08', 'fw-iso-dell-suu-26.08', 'fw-bios-dell-2.20.0', 'fw-bmc-dell-7.00.00.00', 'fw-nic-mellanox-22.39', 'fw-raid-broadcom-52.16', 'fw-nvme-kioxia-1.3.0', 'fw-bios-hpe-2.92', 'fw-bmc-hpe-ilo5-2.98', 'fw-bios-lenovo-3.40', 'fw-bmc-lenovo-xcc-4.80')`);
      await currentPool.query(`DELETE FROM audit_records WHERE id IN ('aud-101', 'aud-102', 'aud-103', 'aud-104')`);
    } catch {
      // Ignored if tables were just initialized
    }

    isConnected = true;
    console.log('[PostgreSQL] Schema successfully initialized (Real Data Only mode).');
    return true;
  } catch (err: any) {
    console.error('[PostgreSQL] Schema initialization failed:', err.message);
    isConnected = false;
    connectionError = err.message;
    return false;
  }
}

export async function seedInitialData(): Promise<void> {
  memBaseline = { ...DEFAULT_BASELINE };
  if (isConnected) {
    try {
      const currentPool = initPool();
      // Only ensure standard baseline template exists; no mock servers, packages, or logs
      await currentPool.query(`
        INSERT INTO baselines (id, name, description, rules, enforce_security_patches)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (id) DO NOTHING
      `, [
        DEFAULT_BASELINE.id,
        DEFAULT_BASELINE.name,
        DEFAULT_BASELINE.description,
        JSON.stringify(DEFAULT_BASELINE.rules),
        DEFAULT_BASELINE.enforceSecurityPatches,
      ]);

      console.log('[PostgreSQL] Seed completed: Real Data Only mode active (0 mock objects).');
    } catch (err: any) {
      console.error('[PostgreSQL] seedInitialData error:', err.message);
    }
  }
}

export async function flushAllData(): Promise<void> {
  memServers.clear();
  memPackages.clear();
  memAuditLogs = [];
  memCampaigns.clear();
  memBaseline = { ...DEFAULT_BASELINE };

  if (isConnected) {
    try {
      const currentPool = initPool();
      await currentPool.query(`
        DELETE FROM servers;
        DELETE FROM firmware_packages;
        DELETE FROM audit_records;
        DELETE FROM campaigns;
        INSERT INTO app_settings (key, value)
        VALUES ('fleet_flushed', 'true'::jsonb)
        ON CONFLICT (key) DO UPDATE SET value = 'true'::jsonb, updated_at = NOW();
      `);
      console.log('[PostgreSQL] All database entries successfully flushed.');
    } catch (err: any) {
      console.error('[PostgreSQL] Failed to flush database:', err.message);
      throw err;
    }
  }
}

// -------------------------------------------------------------
// Model Query Handlers (with In-Memory Fallback when PostgreSQL is Offline)
// -------------------------------------------------------------

export async function getAllServers(): Promise<Server[]> {
  if (isConnected) {
    try {
      const currentPool = initPool();
      const res = await currentPool.query('SELECT * FROM servers ORDER BY hostname ASC');
      const servers = res.rows.map(row => ({
        id: row.id,
        hostname: row.hostname,
        vendor: (row.vendor as any) || (row.model?.includes('HP') ? 'HP' : row.model?.includes('Lenovo') ? 'LENOVO' : 'DELL'),
        hypervisor: (row.hypervisor as any) || 'VMware ESXi',
        hypervisorVersion: row.hypervisor_version || 'ESXi 8.0 Update 2',
        hypervisorMaintenanceMode: Boolean(row.hypervisor_maintenance_mode),
        activeVmsCount: row.active_vms_count ?? 0,
        cluster: row.cluster,
        datacenter: row.datacenter,
        rack: row.rack,
        unit: row.unit,
        ip: row.ip,
        bmcIp: row.bmc_ip,
        bmcAffectedType: row.bmc_type,
        model: row.model,
        architecture: row.architecture,
        status: row.status,
        powerState: row.power_state,
        powerSupplyRedundancy: row.power_supply_redundancy,
        components: row.components,
        credentials: row.credentials,
        accessStatus: row.access_status,
        tags: row.tags || [],
        notes: row.notes,
        lastUpgradeDate: row.last_upgrade_date,
      }));
      for (const s of servers) memServers.set(s.id, s);
      return servers;
    } catch (e: any) {
      console.warn('[PostgreSQL] Error loading servers, using in-memory store:', e.message);
    }
  }
  return Array.from(memServers.values());
}

export async function upsertServer(server: Server): Promise<void> {
  memServers.set(server.id, server);
  if (isConnected) {
    try {
      const currentPool = initPool();
      await currentPool.query(`
        INSERT INTO servers (
          id, hostname, vendor, hypervisor, hypervisor_version, hypervisor_maintenance_mode, active_vms_count,
          cluster, datacenter, rack, unit, ip, bmc_ip, bmc_type, 
          model, architecture, status, power_state, power_supply_redundancy, 
          components, credentials, access_status, tags, notes, last_upgrade_date
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25)
        ON CONFLICT (id) DO UPDATE SET
          hostname = EXCLUDED.hostname,
          vendor = EXCLUDED.vendor,
          hypervisor = EXCLUDED.hypervisor,
          hypervisor_version = EXCLUDED.hypervisor_version,
          hypervisor_maintenance_mode = EXCLUDED.hypervisor_maintenance_mode,
          active_vms_count = EXCLUDED.active_vms_count,
          cluster = EXCLUDED.cluster,
          datacenter = EXCLUDED.datacenter,
          rack = EXCLUDED.rack,
          unit = EXCLUDED.unit,
          ip = EXCLUDED.ip,
          bmc_ip = EXCLUDED.bmc_ip,
          bmc_type = EXCLUDED.bmc_type,
          model = EXCLUDED.model,
          architecture = EXCLUDED.architecture,
          status = EXCLUDED.status,
          power_state = EXCLUDED.power_state,
          power_supply_redundancy = EXCLUDED.power_supply_redundancy,
          components = EXCLUDED.components,
          credentials = EXCLUDED.credentials,
          access_status = EXCLUDED.access_status,
          tags = EXCLUDED.tags,
          notes = EXCLUDED.notes,
          last_upgrade_date = EXCLUDED.last_upgrade_date,
          updated_at = NOW()
      `, [
        server.id,
        server.hostname,
        server.vendor || 'DELL',
        server.hypervisor || 'VMware ESXi',
        server.hypervisorVersion || 'ESXi 8.0 Update 2',
        server.hypervisorMaintenanceMode || false,
        server.activeVmsCount || 0,
        server.cluster,
        server.datacenter,
        server.rack,
        server.unit,
        server.ip,
        server.bmcIp,
        server.bmcAffectedType,
        server.model,
        server.architecture,
        server.status,
        server.powerState,
        server.powerSupplyRedundancy,
        JSON.stringify(server.components),
        JSON.stringify(server.credentials || {}),
        JSON.stringify(server.accessStatus || {}),
        JSON.stringify(server.tags || []),
        server.notes || null,
        server.lastUpgradeDate || null,
      ]);
    } catch (e: any) {
      console.warn('[PostgreSQL] Sync upsert server failed, kept in memory:', e.message);
    }
  }
}

export async function deleteServerById(id: string): Promise<void> {
  memServers.delete(id);
  if (isConnected) {
    try {
      const currentPool = initPool();
      await currentPool.query('DELETE FROM servers WHERE id = $1', [id]);
    } catch (e: any) {
      console.warn('[PostgreSQL] Delete server failed:', e.message);
    }
  }
}

export async function getAllPackages(): Promise<FirmwarePackage[]> {
  if (isConnected) {
    try {
      const currentPool = initPool();
      const res = await currentPool.query('SELECT * FROM firmware_packages ORDER BY name ASC');
      const packages = res.rows.map(row => ({
        id: row.id,
        name: row.name,
        component: row.component,
        version: row.version,
        releaseDate: row.release_date,
        severity: row.severity,
        supportedModels: row.supported_models || [],
        minPrerequisiteVersion: row.min_prerequisite_version,
        fileSizeMb: parseFloat(row.file_size_mb || '0'),
        sha256: row.sha256,
        cves: row.cves || [],
        releaseNotes: row.release_notes,
        rebootRequired: row.reboot_required,
        vendor: row.vendor,
        fileName: row.file_name,
      }));
      for (const p of packages) memPackages.set(p.id, p);
      return packages;
    } catch (e: any) {
      console.warn('[PostgreSQL] Error loading packages, using in-memory store:', e.message);
    }
  }
  return Array.from(memPackages.values());
}

export async function upsertPackage(pkg: FirmwarePackage): Promise<void> {
  memPackages.set(pkg.id, pkg);
  if (isConnected) {
    try {
      const currentPool = initPool();
      await currentPool.query(`
        INSERT INTO firmware_packages (
          id, name, component, version, release_date, severity, supported_models,
          min_prerequisite_version, file_size_mb, sha256, cves, release_notes,
          reboot_required, vendor, file_name
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
        ON CONFLICT (id) DO UPDATE SET
          name = EXCLUDED.name,
          component = EXCLUDED.component,
          version = EXCLUDED.version,
          release_date = EXCLUDED.release_date,
          severity = EXCLUDED.severity,
          supported_models = EXCLUDED.supported_models,
          min_prerequisite_version = EXCLUDED.min_prerequisite_version,
          file_size_mb = EXCLUDED.file_size_mb,
          sha256 = EXCLUDED.sha256,
          cves = EXCLUDED.cves,
          release_notes = EXCLUDED.release_notes,
          reboot_required = EXCLUDED.reboot_required,
          vendor = EXCLUDED.vendor,
          file_name = EXCLUDED.file_name,
          updated_at = NOW()
      `, [
        pkg.id,
        pkg.name,
        pkg.component,
        pkg.version,
        pkg.releaseDate,
        pkg.severity,
        JSON.stringify(pkg.supportedModels || []),
        pkg.minPrerequisiteVersion || null,
        pkg.fileSizeMb,
        pkg.sha256,
        JSON.stringify(pkg.cves || []),
        pkg.releaseNotes,
        pkg.rebootRequired,
        pkg.vendor,
        pkg.fileName,
      ]);
    } catch (e: any) {
      console.warn('[PostgreSQL] Sync upsert package failed, kept in memory:', e.message);
    }
  }
}

export async function deletePackageById(id: string): Promise<void> {
  memPackages.delete(id);
  if (isConnected) {
    try {
      const currentPool = initPool();
      await currentPool.query('DELETE FROM firmware_packages WHERE id = $1', [id]);
    } catch (e: any) {
      console.warn('[PostgreSQL] Delete package failed:', e.message);
    }
  }
}

export async function getAllAuditLogs(): Promise<AuditRecord[]> {
  if (isConnected) {
    try {
      const currentPool = initPool();
      const res = await currentPool.query('SELECT * FROM audit_records ORDER BY timestamp DESC LIMIT 500');
      const logs = res.rows.map(row => ({
        id: row.id,
        timestamp: row.timestamp,
        serverHostname: row.server_hostname,
        serverId: row.server_id,
        component: row.component,
        fromVersion: row.from_version,
        toVersion: row.to_version,
        status: row.status,
        operator: row.operator,
        durationSeconds: row.duration_seconds,
        firmwarePackageName: row.firmware_package_name,
      }));
      memAuditLogs = logs;
      return logs;
    } catch (e: any) {
      console.warn('[PostgreSQL] Error loading audit logs, using in-memory store:', e.message);
    }
  }
  return [...memAuditLogs];
}

export async function insertAuditLog(record: AuditRecord): Promise<void> {
  memAuditLogs.unshift(record);
  if (isConnected) {
    try {
      const currentPool = initPool();
      await currentPool.query(`
        INSERT INTO audit_records (
          id, timestamp, server_hostname, server_id, component, from_version,
          to_version, status, operator, duration_seconds, firmware_package_name
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        ON CONFLICT (id) DO NOTHING
      `, [
        record.id,
        record.timestamp,
        record.serverHostname,
        record.serverId,
        record.component,
        record.fromVersion,
        record.toVersion,
        record.status,
        record.operator,
        record.durationSeconds,
        record.firmwarePackageName,
      ]);
    } catch (e: any) {
      console.warn('[PostgreSQL] Sync insert audit log failed, kept in memory:', e.message);
    }
  }
}

export async function getActiveBaseline(): Promise<BaselineConfig> {
  if (isConnected) {
    try {
      const currentPool = initPool();
      const res = await currentPool.query('SELECT * FROM baselines LIMIT 1');
      if (res.rows.length > 0) {
        const row = res.rows[0];
        memBaseline = {
          id: row.id,
          name: row.name,
          description: row.description,
          rules: row.rules || {},
          enforceSecurityPatches: row.enforce_security_patches,
        };
      }
    } catch (e: any) {
      console.warn('[PostgreSQL] Error loading baseline, using in-memory store:', e.message);
    }
  }
  return memBaseline;
}

export async function saveActiveBaseline(baseline: BaselineConfig): Promise<void> {
  memBaseline = baseline;
  if (isConnected) {
    try {
      const currentPool = initPool();
      await currentPool.query(`
        INSERT INTO baselines (id, name, description, rules, enforce_security_patches)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (id) DO UPDATE SET
          name = EXCLUDED.name,
          description = EXCLUDED.description,
          rules = EXCLUDED.rules,
          enforce_security_patches = EXCLUDED.enforce_security_patches,
          updated_at = NOW()
      `, [
        baseline.id,
        baseline.name,
        baseline.description,
        JSON.stringify(baseline.rules),
        baseline.enforceSecurityPatches,
      ]);
    } catch (e: any) {
      console.warn('[PostgreSQL] Sync save baseline failed, kept in memory:', e.message);
    }
  }
}

export async function getCampaigns(): Promise<UpgradeCampaign[]> {
  if (isConnected) {
    try {
      const currentPool = initPool();
      const res = await currentPool.query('SELECT * FROM campaigns ORDER BY created_at DESC');
      const camps = res.rows.map(row => ({
        id: row.id,
        title: row.title,
        createdAt: row.created_at,
        targetComponent: row.target_component,
        targetFirmwareId: row.target_firmware_id,
        status: row.status,
        concurrencyLimit: row.concurrency_limit,
        autoReboot: row.auto_reboot,
        stopOnFirstFailure: row.stop_on_first_failure,
        preflightChecksRequired: row.preflight_checks_required,
        servers: row.servers || [],
      }));
      for (const c of camps) memCampaigns.set(c.id, c);
      return camps;
    } catch (e: any) {
      console.warn('[PostgreSQL] Error loading campaigns, using in-memory store:', e.message);
    }
  }
  return Array.from(memCampaigns.values());
}

export async function upsertCampaign(campaign: UpgradeCampaign): Promise<void> {
  memCampaigns.set(campaign.id, campaign);
  if (isConnected) {
    try {
      const currentPool = initPool();
      await currentPool.query(`
        INSERT INTO campaigns (
          id, title, created_at, target_component, target_firmware_id, status,
          concurrency_limit, auto_reboot, stop_on_first_failure, preflight_checks_required, servers
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        ON CONFLICT (id) DO UPDATE SET
          title = EXCLUDED.title,
          target_component = EXCLUDED.target_component,
          target_firmware_id = EXCLUDED.target_firmware_id,
          status = EXCLUDED.status,
          concurrency_limit = EXCLUDED.concurrency_limit,
          auto_reboot = EXCLUDED.auto_reboot,
          stop_on_first_failure = EXCLUDED.stop_on_first_failure,
          preflight_checks_required = EXCLUDED.preflight_checks_required,
          servers = EXCLUDED.servers,
          updated_at = NOW()
      `, [
        campaign.id,
        campaign.title,
        campaign.createdAt,
        campaign.targetComponent,
        campaign.targetFirmwareId || null,
        campaign.status,
        campaign.concurrencyLimit,
        campaign.autoReboot,
        campaign.stopOnFirstFailure,
        campaign.preflightChecksRequired,
        JSON.stringify(campaign.servers || []),
      ]);
    } catch (e: any) {
      console.warn('[PostgreSQL] Sync upsert campaign failed, kept in memory:', e.message);
    }
  }
}

export async function deleteCampaignById(id: string): Promise<void> {
  memCampaigns.delete(id);
  if (isConnected) {
    try {
      const currentPool = initPool();
      await currentPool.query('DELETE FROM campaigns WHERE id = $1', [id]);
    } catch (e: any) {
      console.warn('[PostgreSQL] Sync delete campaign failed:', e.message);
    }
  }
}

export async function getDetailedStats(): Promise<{
  connected: boolean;
  tableCounts: Record<string, number>;
  databaseName?: string;
  serverVersion?: string;
  latencyMs?: number;
  error?: string;
}> {
  if (isConnected) {
    try {
      const currentPool = initPool();
      const start = Date.now();
      const verRes = await currentPool.query('SELECT version(), current_database() as db');
      const latency = Date.now() - start;

      const [srvCount, pkgCount, audCount, cmpCount] = await Promise.all([
        currentPool.query('SELECT count(*) as count FROM servers'),
        currentPool.query('SELECT count(*) as count FROM firmware_packages'),
        currentPool.query('SELECT count(*) as count FROM audit_records'),
        currentPool.query('SELECT count(*) as count FROM campaigns'),
      ]);

      return {
        connected: true,
        latencyMs: latency,
        databaseName: verRes.rows[0]?.db,
        serverVersion: verRes.rows[0]?.version?.split(' on ')[0],
        tableCounts: {
          servers: parseInt(srvCount.rows[0]?.count || '0', 10),
          firmware_packages: parseInt(pkgCount.rows[0]?.count || '0', 10),
          audit_records: parseInt(audCount.rows[0]?.count || '0', 10),
          campaigns: parseInt(cmpCount.rows[0]?.count || '0', 10),
        },
      };
    } catch (err: any) {
      isConnected = false;
      connectionError = err.message;
    }
  }

  return {
    connected: false,
    databaseName: 'In-Memory Store (PostgreSQL offline)',
    serverVersion: 'In-Memory Store',
    latencyMs: 0,
    tableCounts: {
      servers: memServers.size,
      firmware_packages: memPackages.size,
      audit_records: memAuditLogs.length,
      campaigns: memCampaigns.size,
    },
    error: connectionError || 'PostgreSQL not connected — in-memory store active',
  };
}
