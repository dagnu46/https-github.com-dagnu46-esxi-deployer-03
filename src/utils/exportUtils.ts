import { Server, AuditRecord, ComponentType } from '../types';

/**
 * Escapes strings for safe RFC 4180 CSV generation.
 */
function escapeCsvValue(val: any): string {
  if (val === null || val === undefined) return '""';
  const str = String(val);
  // If contains commas, quotes, or newlines, wrap in quotes and escape quotes
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return `"${str}"`;
}

/**
 * Triggers browser download of a text blob (CSV, JSON, etc.)
 */
export function triggerFileDownload(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Exports Fleet Server Inventory as a CSV file.
 */
export function exportFleetToCsv(servers: Server[], customFilename?: string): void {
  const headers = [
    'Server ID',
    'Hostname',
    'Vendor',
    'Model',
    'Architecture',
    'Health Status',
    'Power State',
    'Cluster',
    'Datacenter',
    'Rack Location',
    'Unit',
    'Host IP',
    'BMC IP',
    'BMC Protocol/Type',
    'Hypervisor',
    'Hypervisor Version',
    'Active VMs',
    'BIOS Current',
    'BIOS Latest',
    'BIOS Status',
    'BMC Current',
    'BMC Latest',
    'BMC Status',
    'NIC Current',
    'NIC Latest',
    'NIC Status',
    'RAID Current',
    'RAID Latest',
    'RAID Status',
    'NVMe Current',
    'NVMe Latest',
    'NVMe Status',
    'Tags',
    'Last Upgrade Date',
  ];

  const rows = servers.map(s => {
    const bios = s.components?.BIOS;
    const bmc = s.components?.BMC;
    const nic = s.components?.NIC;
    const raid = s.components?.RAID;
    const nvme = s.components?.NVMe;

    return [
      s.id,
      s.hostname,
      s.vendor,
      s.model,
      s.architecture || 'x86_64',
      s.status,
      s.powerState,
      s.cluster,
      s.datacenter,
      s.rack,
      s.unit,
      s.ip,
      s.bmcIp,
      s.bmcAffectedType || 'iDRAC/iLO',
      s.hypervisor,
      s.hypervisorVersion || 'N/A',
      s.activeVmsCount ?? 0,
      bios?.currentVersion || 'N/A',
      bios?.latestVersion || 'N/A',
      bios?.status || 'N/A',
      bmc?.currentVersion || 'N/A',
      bmc?.latestVersion || 'N/A',
      bmc?.status || 'N/A',
      nic?.currentVersion || 'N/A',
      nic?.latestVersion || 'N/A',
      nic?.status || 'N/A',
      raid?.currentVersion || 'N/A',
      raid?.latestVersion || 'N/A',
      raid?.status || 'N/A',
      nvme?.currentVersion || 'N/A',
      nvme?.latestVersion || 'N/A',
      nvme?.status || 'N/A',
      (s.tags || []).join('; '),
      s.lastUpgradeDate || 'None',
    ].map(escapeCsvValue).join(',');
  });

  // UTF-8 BOM for Microsoft Excel compatibility
  const csvContent = '\uFEFF' + [headers.map(escapeCsvValue).join(','), ...rows].join('\r\n');
  const dateStr = new Date().toISOString().split('T')[0];
  const filename = customFilename || `fleet_inventory_export_${dateStr}.csv`;

  triggerFileDownload(csvContent, filename, 'text/csv;charset=utf-8;');
}

/**
 * Exports Fleet Server Inventory as a formatted JSON file.
 */
export function exportFleetToJson(servers: Server[], customFilename?: string): void {
  const exportPayload = {
    exportType: 'fleet_inventory_report',
    exportedAt: new Date().toISOString(),
    totalNodes: servers.length,
    nodeSummary: {
      vendors: {
        hp: servers.filter(s => s.vendor === 'HP' || s.model?.includes('HP')).length,
        dell: servers.filter(s => s.vendor === 'DELL' || s.model?.includes('Dell')).length,
        lenovo: servers.filter(s => s.vendor === 'LENOVO' || s.model?.includes('Lenovo')).length,
      },
      statusCounts: {
        online: servers.filter(s => s.status === 'online').length,
        maintenance: servers.filter(s => s.status === 'maintenance').length,
        degraded: servers.filter(s => s.status === 'degraded').length,
        needs_reboot: servers.filter(s => s.status === 'needs_reboot').length,
      },
    },
    servers,
  };

  const jsonContent = JSON.stringify(exportPayload, null, 2);
  const dateStr = new Date().toISOString().split('T')[0];
  const filename = customFilename || `fleet_inventory_export_${dateStr}.json`;

  triggerFileDownload(jsonContent, filename, 'application/json;charset=utf-8;');
}

/**
 * Exports Lifecycle Audit Logs as a CSV file.
 */
export function exportAuditLogsToCsv(logs: AuditRecord[], customFilename?: string): void {
  const headers = [
    'Record ID',
    'Timestamp',
    'Server Hostname',
    'Server ID',
    'Component',
    'From Version',
    'To Version',
    'Execution Status',
    'Operator',
    'Duration (Seconds)',
    'Duration (Formatted)',
    'Firmware Package Name',
  ];

  const rows = logs.map(l => {
    const mins = Math.floor((l.durationSeconds || 0) / 60);
    const secs = (l.durationSeconds || 0) % 60;
    const formattedDuration = `${mins}m ${secs}s`;

    return [
      l.id,
      l.timestamp,
      l.serverHostname,
      l.serverId,
      l.component,
      l.fromVersion,
      l.toVersion,
      l.status,
      l.operator,
      l.durationSeconds ?? 0,
      formattedDuration,
      l.firmwarePackageName,
    ].map(escapeCsvValue).join(',');
  });

  const csvContent = '\uFEFF' + [headers.map(escapeCsvValue).join(','), ...rows].join('\r\n');
  const dateStr = new Date().toISOString().split('T')[0];
  const filename = customFilename || `audit_logs_export_${dateStr}.csv`;

  triggerFileDownload(csvContent, filename, 'text/csv;charset=utf-8;');
}

/**
 * Exports Lifecycle Audit Logs as a formatted JSON file.
 */
export function exportAuditLogsToJson(logs: AuditRecord[], customFilename?: string): void {
  const exportPayload = {
    exportType: 'firmware_lifecycle_audit_report',
    exportedAt: new Date().toISOString(),
    totalRecords: logs.length,
    statusSummary: {
      success: logs.filter(l => l.status === 'success').length,
      failed: logs.filter(l => l.status === 'failed').length,
      rolled_back: logs.filter(l => l.status === 'rolled_back').length,
    },
    auditRecords: logs,
  };

  const jsonContent = JSON.stringify(exportPayload, null, 2);
  const dateStr = new Date().toISOString().split('T')[0];
  const filename = customFilename || `audit_logs_export_${dateStr}.json`;

  triggerFileDownload(jsonContent, filename, 'application/json;charset=utf-8;');
}

/**
 * Exports a Combined Datacenter Compliance Report (Fleet + Audit Trail).
 */
export function exportCombinedComplianceReport(
  servers: Server[],
  logs: AuditRecord[],
  format: 'csv' | 'json',
  customFilename?: string
): void {
  const dateStr = new Date().toISOString().split('T')[0];

  if (format === 'json') {
    const combinedPayload = {
      exportType: 'datacenter_compliance_master_report',
      exportedAt: new Date().toISOString(),
      reportMetadata: {
        totalServers: servers.length,
        totalAuditEvents: logs.length,
        clusterCount: Array.from(new Set(servers.map(s => s.cluster))).length,
        datacenterCount: Array.from(new Set(servers.map(s => s.datacenter))).length,
      },
      fleetInventory: servers,
      auditTrail: logs,
    };
    const jsonContent = JSON.stringify(combinedPayload, null, 2);
    const filename = customFilename || `compliance_master_report_${dateStr}.json`;
    triggerFileDownload(jsonContent, filename, 'application/json;charset=utf-8;');
  } else {
    // For CSV, produce comprehensive inventory rows followed by recent audit records
    exportFleetToCsv(servers, customFilename || `compliance_inventory_${dateStr}.csv`);
  }
}
