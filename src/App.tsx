import React, { useState, useEffect, useRef } from 'react';
import { Header, NavTab } from './components/Header';
import { FleetOverview } from './components/FleetOverview';
import { ServerList } from './components/ServerList';
import { FirmwareCatalog } from './components/FirmwareCatalog';
import { ActiveCampaignView } from './components/ActiveCampaignView';
import { ComplianceBaselineView } from './components/ComplianceBaselineView';
import { AuditHistoryView } from './components/AuditHistoryModal';
import { ServerDetailModal } from './components/ServerDetailModal';
import { UpgradeWizardModal } from './components/UpgradeWizardModal';
import { DeviceModal } from './components/DeviceModal';
import { DeleteConfirmModal } from './components/DeleteConfirmModal';
import { DockerDbModal } from './components/DockerDbModal';
import { FlushConfirmModal } from './components/FlushConfirmModal';
import { VmwareIsoTesterModal } from './components/VmwareIsoTesterModal';

import { 
  Server, 
  FirmwarePackage, 
  AuditRecord, 
  BaselineConfig, 
  UpgradeCampaign, 
  ComponentType,
  ComponentFirmware,
  UpgradeStage
} from './types';

import { 
  loadServers, 
  saveServers, 
  loadFirmwarePackages, 
  saveFirmwarePackages, 
  loadAuditLogs, 
  saveAuditLogs, 
  loadBaseline, 
  saveBaseline, 
  loadActiveCampaign, 
  saveActiveCampaign, 
  resetToDemoFleet,
  flushAllStorage
} from './utils/storage';

import {
  getDbStatus,
  DatabaseStatus,
  reseedDb,
  flushDb,
  syncLoadServers,
  syncSaveServer,
  syncDeleteServer,
  syncLoadPackages,
  syncSavePackage,
  syncDeletePackage,
  syncLoadAuditLogs,
  syncSaveAuditLog,
  syncLoadBaseline,
  syncSaveBaseline,
  syncLoadCampaign,
  syncSaveCampaign
} from './services/api';

import { createCampaign } from './utils/orchestrator';
import { Plus, CheckCircle2, AlertTriangle, ShieldCheck } from 'lucide-react';

export default function App() {
  // Primary datasets
  const [servers, setServers] = useState<Server[]>(() => loadServers());
  const [packages, setPackages] = useState<FirmwarePackage[]>(() => loadFirmwarePackages());
  const [auditLogs, setAuditLogs] = useState<AuditRecord[]>(() => loadAuditLogs());
  const [baseline, setBaseline] = useState<BaselineConfig>(() => loadBaseline());
  const [activeCampaign, setActiveCampaign] = useState<UpgradeCampaign | null>(() => loadActiveCampaign());

  // PostgreSQL Database & Docker State
  const [dbStatus, setDbStatus] = useState<DatabaseStatus | null>(null);
  const [isDockerDbModalOpen, setIsDockerDbModalOpen] = useState(false);

  // Navigation
  const [activeTab, setActiveTab] = useState<NavTab>('fleet');

  // Search and filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [clusterFilter, setClusterFilter] = useState('all');
  const [vendorFilter, setVendorFilter] = useState('all');
  const [hypervisorFilter, setHypervisorFilter] = useState('all');
  const [selectedServerIds, setSelectedServerIds] = useState<string[]>([]);

  // Modals
  const [inspectedServer, setInspectedServer] = useState<Server | null>(null);
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [isDeviceModalOpen, setIsDeviceModalOpen] = useState(false);
  const [editingServer, setEditingServer] = useState<Server | null>(null);
  const [deletingServer, setDeletingServer] = useState<Server | null>(null);
  const [isFlushConfirmOpen, setIsFlushConfirmOpen] = useState(false);

  // VMware ISO Tester Modal State
  const [isVmwareIsoTesterOpen, setIsVmwareIsoTesterOpen] = useState(false);
  const [vmwareTesterInitialPackage, setVmwareTesterInitialPackage] = useState<FirmwarePackage | null>(null);

  const handleOpenVmwareIsoTester = (pkg?: FirmwarePackage) => {
    setVmwareTesterInitialPackage(pkg || null);
    setIsVmwareIsoTesterOpen(true);
  };

  // Wizard pre-fills
  const [wizardPreSelectedServers, setWizardPreSelectedServers] = useState<string[]>([]);
  const [wizardPreSelectedComponent, setWizardPreSelectedComponent] = useState<ComponentType | undefined>(undefined);

  // Notification toast
  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'info' | 'warn'; text: string } | null>(null);

  const showToast = (text: string, type: 'success' | 'info' | 'warn' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => {
      setToastMessage(null);
    }, 4500);
  };

  // Connect to backend PostgreSQL database on boot and load fleet data
  const refreshDbStatus = async () => {
    const status = await getDbStatus();
    setDbStatus(status);
    return status;
  };

  useEffect(() => {
    const initDatabaseFleet = async () => {
      const status = await refreshDbStatus();
      if (status.connected) {
        try {
          const [sRes, pRes, aRes, bRes, cRes] = await Promise.all([
            syncLoadServers(),
            syncLoadPackages(),
            syncLoadAuditLogs(),
            syncLoadBaseline(),
            syncLoadCampaign(),
          ]);
          if (sRes.source === 'postgres' && sRes.servers.length > 0) setServers(sRes.servers);
          if (pRes.source === 'postgres' && pRes.packages.length > 0) setPackages(pRes.packages);
          if (aRes.source === 'postgres' && aRes.logs.length > 0) setAuditLogs(aRes.logs);
          if (bRes.source === 'postgres' && bRes.baseline) setBaseline(bRes.baseline);
          if (cRes.source === 'postgres' && cRes.campaign) setActiveCampaign(cRes.campaign);
        } catch (e) {
          console.warn('[PostgreSQL] Initial sync error:', e);
        }
      }
    };

    initDatabaseFleet();
    const interval = setInterval(refreshDbStatus, 20000);
    return () => clearInterval(interval);
  }, []);

  // Sync datasets to localStorage when changed
  useEffect(() => {
    saveServers(servers);
  }, [servers]);

  useEffect(() => {
    saveFirmwarePackages(packages);
  }, [packages]);

  useEffect(() => {
    saveAuditLogs(auditLogs);
  }, [auditLogs]);

  useEffect(() => {
    saveBaseline(baseline);
  }, [baseline]);

  useEffect(() => {
    saveActiveCampaign(activeCampaign);
  }, [activeCampaign]);

  // LIVE ORCHESTRATOR SIMULATION LOOP
  useEffect(() => {
    if (!activeCampaign || activeCampaign.status !== 'running') return;

    const timer = setInterval(() => {
      setActiveCampaign(prevCamp => {
        if (!prevCamp || prevCamp.status !== 'running') return prevCamp;

        const updatedServers = [...prevCamp.servers];
        const concurrencyLimit = prevCamp.concurrencyLimit;

        // Count how many are currently in-flight
        const inFlightCount = updatedServers.filter(
          s => s.stage !== 'pending' && s.stage !== 'completed' && s.stage !== 'failed' && s.stage !== 'rolled_back'
        ).length;

        // How many slots available to start pending servers
        let availableSlots = concurrencyLimit - inFlightCount;

        let anyUpdated = false;

        for (let i = 0; i < updatedServers.length; i++) {
          const s = { ...updatedServers[i], logs: [...updatedServers[i].logs] };

          // Start pending servers if slot available
          if (s.stage === 'pending' && availableSlots > 0) {
            s.stage = 'preflight';
            s.progressPercent = 10;
            s.currentStepMessage = 'Executing pre-flight checks (Dual PSU redundancy & BMC link)';
            s.logs.push({
              timestamp: new Date().toLocaleTimeString(),
              level: 'info',
              message: `[Pre-flight] Redfish ping nominal. Checking dual PSU redundancy on ${s.hostname}...`,
            });
            availableSlots--;
            updatedServers[i] = s;
            anyUpdated = true;
            continue;
          }

          // Progress currently active jobs
          if (
            s.stage !== 'pending' &&
            s.stage !== 'completed' &&
            s.stage !== 'failed' &&
            s.stage !== 'rolled_back'
          ) {
            const nextProgress = Math.min(100, s.progressPercent + Math.floor(Math.random() * 8) + 8);
            s.progressPercent = nextProgress;

            if (nextProgress >= 99) {
              s.stage = 'completed';
              s.progressPercent = 100;
              s.currentStepMessage = `Upgrade successfully verified (${s.toVersion} active)`;
              s.logs.push({
                timestamp: new Date().toLocaleTimeString(),
                level: 'success',
                message: `[Success] Verification confirmed: ${s.component} firmware active version is now ${s.toVersion}.`,
              });

              // Also update the physical server in the server fleet state!
              setServers(prevFleet =>
                prevFleet.map(srv => {
                  if (srv.id === s.serverId) {
                    const compKey = s.component;
                    const existingComp = srv.components[compKey];
                    return {
                      ...srv,
                      status: 'online',
                      lastUpgradeDate: new Date().toISOString().split('T')[0],
                      components: {
                        ...srv.components,
                        [compKey]: {
                          ...existingComp,
                          currentVersion: s.toVersion,
                          status: 'up_to_date',
                          cveAlerts: [],
                        },
                      },
                    };
                  }
                  return srv;
                })
              );

              // Record in audit log
              setAuditLogs(prevLogs => [
                {
                  id: `aud-${Date.now()}-${s.serverId}`,
                  timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
                  serverHostname: s.hostname,
                  serverId: s.serverId,
                  component: s.component,
                  fromVersion: s.fromVersion,
                  toVersion: s.toVersion,
                  status: 'success',
                  operator: 'admin@ops.internal',
                  durationSeconds: 210,
                  firmwarePackageName: `${s.component} Upgrade to ${s.toVersion}`,
                },
                ...prevLogs,
              ]);

            } else if (nextProgress >= 85 && s.stage !== 'postcheck') {
              s.stage = 'postcheck';
              s.currentStepMessage = 'Verifying POST status code & BMC handshake...';
              s.logs.push({
                timestamp: new Date().toLocaleTimeString(),
                level: 'info',
                message: `[POST-Check] OS reboot completed. Querying /redfish/v1/Systems/1 for firmware latching...`,
              });
            } else if (nextProgress >= 65 && s.stage !== 'rebooting') {
              s.stage = 'rebooting';
              s.currentStepMessage = prevCamp.autoReboot
                ? 'Warm rebooting chassis via Redfish GracefulRestart...'
                : 'Firmware staged in pending bank. Ready for next reboot.';
              s.logs.push({
                timestamp: new Date().toLocaleTimeString(),
                level: 'info',
                message: prevCamp.autoReboot
                  ? `[Chassis] Sending ACPI graceful restart signal to host...`
                  : `[Staging] Staged in pending bank. Will latch during next maintenance cycle.`,
              });
            } else if (nextProgress >= 40 && s.stage !== 'flashing') {
              s.stage = 'flashing';
              s.currentStepMessage = `Writing ${s.component} SPI EEPROM & verifying checksum...`;
              s.logs.push({
                timestamp: new Date().toLocaleTimeString(),
                level: 'info',
                message: `[SPI-Flash] Flashing EEPROM partition 0x000000. Checksum CRC32 validated.`,
              });
            } else if (nextProgress >= 20 && s.stage !== 'bmc_staging') {
              s.stage = 'bmc_staging';
              s.currentStepMessage = 'Streaming signed binary payload to BMC staging memory...';
              s.logs.push({
                timestamp: new Date().toLocaleTimeString(),
                level: 'info',
                message: `[Redfish:UpdateService] SimpleUpdate POST dispatched. Image uploaded.`,
              });
            }

            updatedServers[i] = s;
            anyUpdated = true;
          }
        }

        // Check if all servers in campaign completed
        const allDone = updatedServers.every(
          s => s.stage === 'completed' || s.stage === 'failed' || s.stage === 'rolled_back'
        );

        if (allDone && prevCamp.status === 'running') {
          showToast(`Upgrade campaign "${prevCamp.title}" completed successfully across all nodes!`, 'success');
          return {
            ...prevCamp,
            status: 'completed',
            servers: updatedServers,
          };
        }

        if (anyUpdated) {
          return {
            ...prevCamp,
            servers: updatedServers,
          };
        }

        return prevCamp;
      });
    }, 900);

    return () => clearInterval(timer);
  }, [activeCampaign]);

  // Campaign controls
  const handleStartCampaign = (
    title: string,
    targetComponent: ComponentType | 'FULL_BASELINE',
    targetFirmwareId: string | undefined,
    selectedServersList: Server[],
    concurrency: number,
    autoReboot: boolean,
    stopOnFailure: boolean,
    preflight: boolean
  ) => {
    const newCamp = createCampaign(
      title,
      targetComponent,
      targetFirmwareId,
      selectedServersList,
      concurrency,
      autoReboot,
      stopOnFailure,
      preflight
    );

    setActiveCampaign(newCamp);
    setActiveTab('campaign');
    showToast(`Rollout launched for ${selectedServersList.length} server nodes!`, 'info');
  };

  const handlePauseCampaign = () => {
    if (!activeCampaign) return;
    setActiveCampaign({ ...activeCampaign, status: 'paused' });
    showToast('Upgrade rollout paused.', 'warn');
  };

  const handleResumeCampaign = () => {
    if (!activeCampaign) return;
    setActiveCampaign({ ...activeCampaign, status: 'running' });
    showToast('Upgrade rollout resumed.', 'info');
  };

  const handleAbortCampaign = () => {
    if (!activeCampaign) return;
    setActiveCampaign({ ...activeCampaign, status: 'aborted' });
    showToast('Campaign aborted by operator.', 'warn');
  };

  const handleTriggerRollback = (serverId: string) => {
    if (!activeCampaign) return;
    const srv = activeCampaign.servers.find(s => s.serverId === serverId);
    if (!srv) return;

    setActiveCampaign({
      ...activeCampaign,
      servers: activeCampaign.servers.map(s => {
        if (s.serverId === serverId) {
          return {
            ...s,
            stage: 'rolled_back',
            currentStepMessage: `Rolled back to backup firmware partition (${s.fromVersion})`,
            logs: [
              ...s.logs,
              {
                timestamp: new Date().toLocaleTimeString(),
                level: 'warn',
                message: `[Rollback] Reverted to backup firmware bank (${s.fromVersion}). Redfish status restored to OK.`,
              },
            ],
          };
        }
        return s;
      }),
    });

    showToast(`Rollback executed for server node ${srv.hostname}.`, 'info');
  };

  // Demo fleet reset
  const handleResetDemo = async () => {
    const demo = resetToDemoFleet();
    setServers(demo.servers);
    setPackages(demo.packages);
    setAuditLogs(demo.auditLogs);
    setBaseline(demo.baseline);
    setActiveCampaign(null);
    setSelectedServerIds([]);
    showToast('Fleet inventory reset to initial demo configuration.', 'info');
    if (dbStatus?.connected) {
      await reseedDb();
      refreshDbStatus();
    }
  };

  // Flush all entries across fleet, packages, audit logs, and campaigns
  const handleFlushAll = async () => {
    flushAllStorage();
    setServers([]);
    setPackages([]);
    setAuditLogs([]);
    setActiveCampaign(null);
    setSelectedServerIds([]);
    setInspectedServer(null);

    if (dbStatus?.connected) {
      try {
        await flushDb();
        await refreshDbStatus();
      } catch (err) {
        console.warn('Backend flush warning:', err);
      }
    }
    showToast('All server inventory, firmware packages, and audit entries have been flushed.', 'info');
  };

  // Quick upgrade from server list
  const handleQuickUpgrade = (server: Server, component: ComponentType) => {
    setWizardPreSelectedServers([server.id]);
    setWizardPreSelectedComponent(component);
    setIsWizardOpen(true);
  };

  // Launch upgrade for selected servers
  const handleUpgradeSelected = () => {
    if (selectedServerIds.length === 0) return;
    setWizardPreSelectedServers(selectedServerIds);
    setWizardPreSelectedComponent('BIOS');
    setIsWizardOpen(true);
  };

  // Deploy package from catalog
  const handleDeployPackage = (pkg: FirmwarePackage) => {
    // Find servers that match supported models
    const eligible = servers.filter(s => pkg.supportedModels.includes(s.model)).map(s => s.id);
    setWizardPreSelectedServers(eligible.length > 0 ? eligible : servers.map(s => s.id));
    setWizardPreSelectedComponent(pkg.component);
    setIsWizardOpen(true);
  };

  // One-click remediation of all vulnerable nodes
  const handleRemediateAllVulnerable = () => {
    const vulnerableIds = Array.from(
      new Set(
        servers
          .filter(s => (Object.values(s.components) as ComponentFirmware[]).some(c => c.status === 'critical_update'))
          .map(s => s.id)
      )
    );
    setWizardPreSelectedServers(vulnerableIds);
    setWizardPreSelectedComponent('FULL_BASELINE');
    setIsWizardOpen(true);
  };

  // One-click remediation of a specific component drift
  const handleRemediateComponentDrift = (compType: ComponentType) => {
    const targetVersion = baseline.rules[compType];
    const driftingIds = servers
      .filter(s => s.components[compType]?.currentVersion !== targetVersion)
      .map(s => s.id);
    setWizardPreSelectedServers(driftingIds.length > 0 ? driftingIds : servers.map(s => s.id));
    setWizardPreSelectedComponent(compType);
    setIsWizardOpen(true);
  };

  // Add or edit server in inventory
  const handleSaveServer = (serverData: Server) => {
    syncSaveServer(serverData);
    if (editingServer) {
      setServers(prev => prev.map(s => s.id === serverData.id ? serverData : s));
      if (inspectedServer && inspectedServer.id === serverData.id) {
        setInspectedServer(serverData);
      }
      showToast(`Device "${serverData.hostname}" inventory record saved to database!`, 'success');
    } else {
      setServers(prev => [serverData, ...prev]);
      showToast(`Device "${serverData.hostname}" registered into inventory!`, 'success');
    }
    setEditingServer(null);
    setIsDeviceModalOpen(false);
  };

  // Decommission and delete device
  const handleDeleteServer = (serverId: string) => {
    const target = servers.find(s => s.id === serverId);
    syncDeleteServer(serverId);
    setServers(prev => prev.filter(s => s.id !== serverId));
    setSelectedServerIds(prev => prev.filter(id => id !== serverId));
    if (inspectedServer && inspectedServer.id === serverId) {
      setInspectedServer(null);
    }
    showToast(`Device "${target?.hostname || serverId}" decommissioned and deleted from database.`, 'warn');
  };

  // Update firmware package
  const handleUpdatePackage = (updatedPkg: FirmwarePackage) => {
    syncSavePackage(updatedPkg);
    setPackages(prev => prev.map(p => p.id === updatedPkg.id ? updatedPkg : p));
    showToast(`Firmware package "${updatedPkg.name}" updated!`, 'success');
  };

  // Delete firmware package
  const handleDeletePackage = (pkgId: string) => {
    const target = packages.find(p => p.id === pkgId);
    syncDeletePackage(pkgId);
    setPackages(prev => prev.filter(p => p.id !== pkgId));
    showToast(`Firmware package "${target?.name || pkgId}" removed from repository.`, 'warn');
  };

  // Update server status (maintenance mode, etc.)
  const handleUpdateServerStatus = (serverId: string, newStatus: Server['status']) => {
    setServers(prev =>
      prev.map(s => {
        if (s.id === serverId) {
          const updated = { ...s, status: newStatus };
          syncSaveServer(updated);
          return updated;
        }
        return s;
      })
    );
    if (inspectedServer && inspectedServer.id === serverId) {
      setInspectedServer({ ...inspectedServer, status: newStatus });
    }
  };

  // Filter servers for the list view
  const filteredServers = servers.filter(server => {
    // Search query
    const q = searchQuery.toLowerCase();
    const matchesSearch = 
      server.hostname.toLowerCase().includes(q) ||
      server.model.toLowerCase().includes(q) ||
      (server.vendor && server.vendor.toLowerCase().includes(q)) ||
      (server.hypervisor && server.hypervisor.toLowerCase().includes(q)) ||
      (server.hypervisorVersion && server.hypervisorVersion.toLowerCase().includes(q)) ||
      server.ip.includes(q) ||
      server.bmcIp.includes(q) ||
      server.rack.toLowerCase().includes(q);

    if (!matchesSearch) return false;

    // Cluster filter
    if (clusterFilter !== 'all' && server.cluster !== clusterFilter) {
      return false;
    }

    // Vendor filter (HP, DELL, LENOVO)
    if (vendorFilter !== 'all') {
      const v = server.vendor || (server.model.includes('HPE') || server.model.includes('HP') ? 'HP' : server.model.includes('Dell') ? 'DELL' : 'LENOVO');
      if (v !== vendorFilter) return false;
    }

    // Hypervisor filter (VMware ESXi, VMware ESXi on Nutanix, Xen Server)
    if (hypervisorFilter !== 'all') {
      if (server.hypervisor !== hypervisorFilter) return false;
    }

    const compValues = Object.values(server.components) as ComponentFirmware[];

    // Status filter
    if (statusFilter === 'critical') {
      return compValues.some(c => c.status === 'critical_update');
    }
    if (statusFilter === 'updates') {
      return compValues.some(c => c.status !== 'up_to_date');
    }
    if (statusFilter === 'compliant') {
      return compValues.every(c => c.status === 'up_to_date');
    }

    return true;
  });

  const criticalCount = servers.filter(s =>
    (Object.values(s.components) as ComponentFirmware[]).some(c => c.status === 'critical_update')
  ).length;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col selection:bg-indigo-500 selection:text-white">
      {/* Top Header */}
      <Header
        activeTab={activeTab}
        onTabChange={setActiveTab}
        activeCampaign={activeCampaign}
        onOpenUpgradeWizard={() => {
          setWizardPreSelectedServers([]);
          setWizardPreSelectedComponent('BIOS');
          setIsWizardOpen(true);
        }}
        onResetDemo={handleResetDemo}
        onOpenFlushConfirm={() => setIsFlushConfirmOpen(true)}
        totalServers={servers.length}
        criticalCount={criticalCount}
        dbStatus={dbStatus}
        onOpenDockerDb={() => setIsDockerDbModalOpen(true)}
        onOpenVmwareIsoTester={() => handleOpenVmwareIsoTester()}
      />

      {/* Toast Banner */}
      {toastMessage && (
        <div className="fixed bottom-5 right-5 z-50 animate-bounce">
          <div className={`px-4 py-3 rounded-xl shadow-lg border text-xs font-semibold flex items-center space-x-2.5 ${
            toastMessage.type === 'success' ? 'bg-emerald-900 text-white border-emerald-700' :
            toastMessage.type === 'warn' ? 'bg-amber-900 text-white border-amber-700' :
            'bg-slate-900 text-white border-slate-700'
          }`}>
            {toastMessage.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
            )}
            <span>{toastMessage.text}</span>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {activeTab === 'fleet' && (
          <div>
            <FleetOverview
              servers={servers}
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              statusFilter={statusFilter}
              onStatusFilterChange={setStatusFilter}
              clusterFilter={clusterFilter}
              onClusterFilterChange={setClusterFilter}
              vendorFilter={vendorFilter}
              onVendorFilterChange={setVendorFilter}
              hypervisorFilter={hypervisorFilter}
              onHypervisorFilterChange={setHypervisorFilter}
              selectedServerIds={selectedServerIds}
              onClearSelection={() => setSelectedServerIds([])}
              onUpgradeSelected={handleUpgradeSelected}
              onSelectAllVisible={setSelectedServerIds}
            />

            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center space-x-2">
                <h3 className="text-sm font-bold text-slate-900">Physical Server Inventory</h3>
                <span className="text-xs text-slate-500 font-mono">
                  ({filteredServers.length} nodes matching filters)
                </span>
              </div>
              <button
                type="button"
                id="btn-open-add-server"
                onClick={() => {
                  setEditingServer(null);
                  setIsDeviceModalOpen(true);
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold shadow-xs transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Register Server Node</span>
              </button>
            </div>

            <ServerList
              servers={filteredServers}
              selectedServerIds={selectedServerIds}
              onToggleServer={id => {
                if (selectedServerIds.includes(id)) {
                  setSelectedServerIds(selectedServerIds.filter(x => x !== id));
                } else {
                  setSelectedServerIds([...selectedServerIds, id]);
                }
              }}
              onSelectAllVisible={setSelectedServerIds}
              onViewDetails={server => setInspectedServer(server)}
              onQuickUpgrade={handleQuickUpgrade}
              onEditServer={server => {
                setEditingServer(server);
                setIsDeviceModalOpen(true);
              }}
              onDeleteServer={server => setDeletingServer(server)}
              onEnrollNewServer={() => {
                setEditingServer(null);
                setIsDeviceModalOpen(true);
              }}
              onResetDemo={handleResetDemo}
            />
          </div>
        )}

        {activeTab === 'catalog' && (
          <FirmwareCatalog
            packages={packages}
            servers={servers}
            onAddPackage={newPkg => {
              setPackages(prev => [newPkg, ...prev]);
              showToast(`Firmware package "${newPkg.name}" registered!`, 'success');
            }}
            onUpdatePackage={handleUpdatePackage}
            onDeletePackage={handleDeletePackage}
            onDeployPackage={handleDeployPackage}
            onQuickUpgradeServer={handleQuickUpgrade}
            onOpenVmwareIsoTester={handleOpenVmwareIsoTester}
          />
        )}

        {activeTab === 'campaign' && (
          <ActiveCampaignView
            campaign={activeCampaign}
            onPauseCampaign={handlePauseCampaign}
            onResumeCampaign={handleResumeCampaign}
            onAbortCampaign={handleAbortCampaign}
            onTriggerRollback={handleTriggerRollback}
            onOpenUpgradeWizard={() => {
              setWizardPreSelectedServers([]);
              setWizardPreSelectedComponent('BIOS');
              setIsWizardOpen(true);
            }}
          />
        )}

        {activeTab === 'compliance' && (
          <ComplianceBaselineView
            servers={servers}
            baseline={baseline}
            onUpdateBaseline={newBaseline => {
              setBaseline(newBaseline);
              showToast('Security baseline rules updated.', 'success');
            }}
            onRemediateAllVulnerable={handleRemediateAllVulnerable}
            onRemediateComponentDrift={handleRemediateComponentDrift}
          />
        )}

        {activeTab === 'audit' && (
          <AuditHistoryView auditLogs={auditLogs} />
        )}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-4 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 gap-2">
          <div className="flex items-center space-x-3">
            <button
              type="button"
              id="btn-footer-db-status"
              onClick={() => setIsDockerDbModalOpen(true)}
              className="flex items-center space-x-1.5 px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors font-medium cursor-pointer"
              title="Click to view PostgreSQL Docker connection & tables"
            >
              <span className={`w-2 h-2 rounded-full ${dbStatus?.connected ? 'bg-emerald-500' : 'bg-amber-400'}`} />
              <span>{dbStatus?.connected ? `PostgreSQL Database Active (${dbStatus.latencyMs ?? 0}ms)` : 'Docker & Local PostgreSQL'}</span>
            </button>
            <span>•</span>
            <span>Redfish Telemetry Ingress Active • IPMI 2.0 / DMTF Compliant</span>
          </div>
          <div className="font-mono text-[11px] text-slate-400">
            Cluster Fleet Engine v2.4 • Datacenter Health Nominal
          </div>
        </div>
      </footer>

      {/* Docker & PostgreSQL Modal */}
      <DockerDbModal
        isOpen={isDockerDbModalOpen}
        onClose={() => setIsDockerDbModalOpen(false)}
        status={dbStatus}
        onRefreshStatus={refreshDbStatus}
        onFlushAll={() => setIsFlushConfirmOpen(true)}
        onDatabaseReseeded={async () => {
          const [sRes, pRes, aRes, bRes] = await Promise.all([
            syncLoadServers(),
            syncLoadPackages(),
            syncLoadAuditLogs(),
            syncLoadBaseline(),
          ]);
          setServers(sRes.servers);
          setPackages(pRes.packages);
          setAuditLogs(aRes.logs);
          setBaseline(bRes.baseline);
          setActiveCampaign(null);
          showToast('Fleet inventory reloaded from PostgreSQL.', 'success');
        }}
      />

      {/* Server Detail Modal */}
      {inspectedServer && (
        <ServerDetailModal
          server={inspectedServer}
          onClose={() => setInspectedServer(null)}
          onSaveServer={handleSaveServer}
          onUpgradeComponent={(srv, comp) => {
            setInspectedServer(null);
            handleQuickUpgrade(srv, comp);
          }}
          onUpdateServerStatus={handleUpdateServerStatus}
          onEditServer={server => {
            setEditingServer(server);
            setIsDeviceModalOpen(true);
          }}
          onDeleteServer={server => setDeletingServer(server)}
        />
      )}

      {/* Multi-Server Upgrade Wizard Modal */}
      <UpgradeWizardModal
        isOpen={isWizardOpen}
        onClose={() => setIsWizardOpen(false)}
        servers={servers}
        packages={packages}
        preSelectedServerIds={wizardPreSelectedServers}
        preSelectedComponent={wizardPreSelectedComponent}
        onStartCampaign={handleStartCampaign}
      />

      {/* Device Inventory Modal (Add & Edit Device) */}
      <DeviceModal
        isOpen={isDeviceModalOpen}
        onClose={() => {
          setIsDeviceModalOpen(false);
          setEditingServer(null);
        }}
        onSaveServer={handleSaveServer}
        editingServer={editingServer}
        firmwarePackages={packages}
      />

      {/* Delete Device Confirmation Modal */}
      <DeleteConfirmModal
        isOpen={!!deletingServer}
        server={deletingServer}
        onClose={() => setDeletingServer(null)}
        onConfirmDelete={handleDeleteServer}
      />

      {/* Flush All Data Confirmation Modal */}
      <FlushConfirmModal
        isOpen={isFlushConfirmOpen}
        onClose={() => setIsFlushConfirmOpen(false)}
        onConfirmFlush={handleFlushAll}
        isDbConnected={dbStatus?.connected}
      />

      {/* VMware Virtual Machine Firmware ISO Package Tester Modal */}
      <VmwareIsoTesterModal
        isOpen={isVmwareIsoTesterOpen}
        onClose={() => {
          setIsVmwareIsoTesterOpen(false);
          setVmwareTesterInitialPackage(null);
        }}
        packages={packages}
        initialPackage={vmwareTesterInitialPackage}
        onShowToast={showToast}
      />
    </div>
  );
}
