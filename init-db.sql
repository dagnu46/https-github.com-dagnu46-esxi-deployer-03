-- Server Firmware Manager PostgreSQL Initialization Schema
-- This script runs automatically when the PostgreSQL container is first created

-- Ensure role 'Dagnu' exists with superuser and login privileges
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'Dagnu') THEN
    CREATE ROLE "Dagnu" WITH LOGIN SUPERUSER PASSWORD 'Dagnu0046!';
  ELSE
    ALTER ROLE "Dagnu" WITH LOGIN SUPERUSER PASSWORD 'Dagnu0046!';
  END IF;
END
$$;

-- Grant database permissions
GRANT ALL PRIVILEGES ON DATABASE firmware_hub TO "Dagnu";
ALTER DATABASE firmware_hub OWNER TO "Dagnu";

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

-- Create Indexes for performance
CREATE INDEX IF NOT EXISTS idx_servers_cluster ON servers(cluster);
CREATE INDEX IF NOT EXISTS idx_servers_datacenter ON servers(datacenter);
CREATE INDEX IF NOT EXISTS idx_servers_status ON servers(status);
CREATE INDEX IF NOT EXISTS idx_firmware_component ON firmware_packages(component);
CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON audit_records(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_campaigns_status ON campaigns(status);

-- Grant privileges on all tables and sequences to user Dagnu
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO "Dagnu";
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO "Dagnu";
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO "Dagnu";
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO "Dagnu";
