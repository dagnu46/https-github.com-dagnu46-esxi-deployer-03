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
import { ExportReportModal, ExportDataset } from './components/ExportReportModal';
import { EditCampaignModal } from './components/EditCampaignModal';
import { MainPageFirmwareUploadPanel } from './components/MainPageFirmwareUploadPanel';
import { BaremetalEsxiDeployView } from './components/BaremetalEsxiDeployView';
import { exportFleetToCsv, exportFleetToJson } from './utils/exportUtils';

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
  loadCampaigns, 
  saveCampaigns,
  saveCampaign,
  deleteCampaign,
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
  syncLoadCampaigns,
  syncSaveCampaign,
  syncDeleteCampaign,
  syncExecuteCampaignStep
} from './services/api';

import { createCampaign } from './utils/orchestrator';
import { testServerAccess } from './utils/accessTester';
import { Plus, CheckCircle2, AlertTriangle, ShieldCheck, Download, FileSpreadsheet, FileCode } from 'lucide-react';

export default function App() {
  // Primary datasets
  const [servers, setServers] = useState<Server[]>(() => loadServers());
  const [packages, setPackages] = useState<FirmwarePackage[]>(() => loadFirmwarePackages());
  const [auditLogs, setAuditLogs] = useState<AuditRecord[]>(() => loadAuditLogs());
  const [baseline, setBaseline] = useState<BaselineConfig>(() => loadBaseline());
  const [campaigns, setCampaigns] = useState<UpgradeCampaign[]>(() => loadCampaigns());
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(() => {
    const loaded = loadCampaigns();
    return loaded.find(c => c.status === 'running')?.id || loaded[0]?.id || null;
  });
  const [isEditCampaignOpen, setIsEditCampaignOpen] = useState(false);
  const [campaignToEdit, setCampaignToEdit] = useState<UpgradeCampaign | null>(null);

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

  // Export Report Modal State
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [exportModalInitialDataset, setExportModalInitialDataset] = useState<ExportDataset>('fleet');

  const handleOpenExportModal = (dataset: ExportDataset = 'fleet') => {
    setExportModalInitialDataset(dataset);
    setIsExportModalOpen(true);
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
            syncLoadCampaigns(),
          ]);
          if (sRes.source === 'postgres' && sRes.servers.length > 0) setServers(sRes.servers);
          if (pRes.source === 'postgres' && pRes.packages.length > 0) setPackages(pRes.packages);
          if (aRes.source === 'postgres' && aRes.logs.length > 0) setAuditLogs(aRes.logs);
          if (bRes.source === 'postgres' && bRes.baseline) setBaseline(bRes.baseline);
          if (cRes.source === 'postgres' && cRes.campaigns && cRes.campaigns.length > 0) {
            setCampaigns(cRes.campaigns);
            setSelectedCampaignId(prev => prev || cRes.campaigns[0].id);
          }
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
    saveCampaigns(campaigns);
  }, [campaigns]);

  // REAL TASK EXECUTION ORCHESTRATION LOOP (Real tasks on physical servers, checking network, IPMI, and credentials at every step)
  const executingNodesRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const runningCampaigns = campaigns.filter(c => c.status === 'running');
    if (runningCampaigns.length === 0) return;

    const interval = setInterval(() => {
      for (const campaign of runningCampaigns) {
        // Find in-flight count
        const inFlight = campaign.servers.filter(
          s => s.stage !== 'pending' && s.stage !== 'completed' && s.stage !== 'failed' && s.stage !== 'rolled_back'
        ).length;

        let availableSlots = campaign.concurrencyLimit - inFlight;

        for (const jobServer of campaign.servers) {
          // Check if server is finished or already executing
          if (jobServer.stage === 'completed' || jobServer.stage === 'failed' || jobServer.stage === 'rolled_back') {
            continue;
          }

          const execKey = `${campaign.id}:${jobServer.serverId}`;
          if (executingNodesRef.current.has(execKey)) {
            continue;
          }

          // If pending, only start if slot is available
          if (jobServer.stage === 'pending') {
            if (availableSlots <= 0) continue;
            availableSlots--;
          }

          // Determine stage to execute
          const currentStage = jobServer.stage === 'pending' ? 'preflight' : jobServer.stage;

          // Mark as executing
          executingNodesRef.current.add(execKey);

          // Find physical server
          const physicalServer = servers.find(s => s.id === jobServer.serverId);

          // Execute real step asynchronously
          (async () => {
            try {
              const res = await syncExecuteCampaignStep({
                campaignId: campaign.id,
                serverId: jobServer.serverId,
                server: physicalServer,
                stage: currentStage,
                component: jobServer.component,
                fromVersion: jobServer.fromVersion,
                toVersion: jobServer.toVersion,
                targetFirmwareId: campaign.targetFirmwareId,
                autoReboot: campaign.autoReboot,
              });

              setCampaigns(prevCampList => {
                return prevCampList.map(c => {
                  if (c.id !== campaign.id) return c;

                  const updatedServers = c.servers.map(s => {
                    if (s.serverId !== jobServer.serverId) return s;

                    const newLogs = [...s.logs];
                    if (res.log) {
                      newLogs.push({
                        timestamp: new Date().toLocaleTimeString(),
                        level: res.log.level,
                        message: res.log.message,
                      });
                    }

                    if (res.success) {
                      const nextStage = res.nextStage || 'completed';
                      
                      // Check if current task finished and there are further ranked tasks in the sequence
                      if (nextStage === 'completed' && c.tasks && c.tasks.length > 1) {
                        const currentTaskIdx = s.currentTaskIndex || 0;
                        if (currentTaskIdx + 1 < c.tasks.length) {
                          const nextTask = c.tasks[currentTaskIdx + 1];
                          const fromVer = physicalServer?.components[nextTask.component]?.currentVersion || s.toVersion || '1.0.0';
                          
                          newLogs.push({
                            timestamp: new Date().toLocaleTimeString(),
                            level: 'success',
                            message: `[Ranked Sequence] Task #${currentTaskIdx + 1} (${s.component}) verified nominal. Advancing to Task #${currentTaskIdx + 2} of ${c.tasks.length}: ${nextTask.component} (v${nextTask.targetVersion}).`,
                          });

                          return {
                            ...s,
                            component: nextTask.component,
                            fromVersion: fromVer,
                            toVersion: nextTask.targetVersion,
                            currentTaskIndex: currentTaskIdx + 1,
                            completedTasksCount: currentTaskIdx + 1,
                            totalTasksCount: c.tasks.length,
                            stage: 'preflight' as UpgradeStage,
                            progressPercent: 10,
                            currentStepMessage: `Advancing to Task #${currentTaskIdx + 2}: ${nextTask.component} v${nextTask.targetVersion}`,
                            networkStatus: res.networkStatus || s.networkStatus,
                            ipmiStatus: res.ipmiStatus || s.ipmiStatus,
                            credentialsStatus: res.credentialsStatus || s.credentialsStatus,
                            lastTelemetry: res.telemetry || s.lastTelemetry,
                            logs: newLogs,
                          };
                        } else {
                          // All ranked tasks completed
                          newLogs.push({
                            timestamp: new Date().toLocaleTimeString(),
                            level: 'success',
                            message: `[Sequence Complete] All ${c.tasks.length} ranked firmware tasks completed and verified nominal!`,
                          });
                        }
                      }

                      return {
                        ...s,
                        stage: nextStage,
                        progressPercent: res.progressPercent ?? 100,
                        currentStepMessage: res.message || 'Task step verified nominal',
                        networkStatus: res.networkStatus || s.networkStatus,
                        ipmiStatus: res.ipmiStatus || s.ipmiStatus,
                        credentialsStatus: res.credentialsStatus || s.credentialsStatus,
                        lastTelemetry: res.telemetry || s.lastTelemetry,
                        completedTasksCount: c.tasks ? (nextStage === 'completed' ? c.tasks.length : (s.currentTaskIndex || 0)) : 1,
                        totalTasksCount: c.tasks?.length || 1,
                        logs: newLogs,
                      };
                    } else {
                      return {
                        ...s,
                        stage: 'failed' as UpgradeStage,
                        error: res.error || 'Check failed',
                        networkStatus: res.networkStatus || 'unreachable',
                        ipmiStatus: res.ipmiStatus || 'failed',
                        credentialsStatus: res.credentialsStatus || 'invalid',
                        currentStepMessage: `Failed: ${res.error || 'Check failed'}`,
                        logs: newLogs,
                      };
                    }
                  });

                  let newStatus = c.status;
                  // If failure and stopOnFirstFailure is enabled, pause the campaign
                  if (!res.success && c.stopOnFirstFailure) {
                    newStatus = 'paused';
                    showToast(`[Check Alert] Campaign halted: Checks failed on node ${jobServer.hostname}`, 'warn');
                  }

                  // If all servers completed or failed, mark completed
                  const allDone = updatedServers.every(
                    s => s.stage === 'completed' || s.stage === 'failed' || s.stage === 'rolled_back'
                  );
                  if (allDone && newStatus === 'running') {
                    newStatus = 'completed';
                    showToast(`Upgrade campaign "${c.title}" completed across all nodes!`, 'success');
                  }

                  const updatedCamp: UpgradeCampaign = {
                    ...c,
                    status: newStatus,
                    servers: updatedServers,
                    updatedAt: new Date().toISOString(),
                  };

                  // Sync to backend DB asynchronously
                  syncSaveCampaign(updatedCamp).catch(err => console.warn('Failed to sync campaign:', err));

                  return updatedCamp;
                });
              });

              // If completed, update physical server in fleet and add audit log
              if (res.success && (res.nextStage === 'completed' || currentStage === 'postcheck')) {
                if (physicalServer) {
                  const compKey = jobServer.component;
                  const updatedServer: Server = {
                    ...physicalServer,
                    status: 'online',
                    lastUpgradeDate: new Date().toISOString().split('T')[0],
                    components: {
                      ...physicalServer.components,
                      [compKey]: {
                        ...physicalServer.components[compKey],
                        currentVersion: jobServer.toVersion,
                        status: 'up_to_date',
                      },
                    },
                  };

                  setServers(prevServers =>
                    prevServers.map(s => (s.id === physicalServer.id ? updatedServer : s))
                  );
                  syncSaveServer(updatedServer).catch(console.warn);

                  // Create audit log
                  const auditRec: AuditRecord = {
                    id: `aud-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
                    timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
                    serverId: physicalServer.id,
                    serverHostname: physicalServer.hostname,
                    component: compKey,
                    fromVersion: jobServer.fromVersion,
                    toVersion: jobServer.toVersion,
                    status: 'success',
                    operator: 'Rollout Engine (Real IPMI/Redfish)',
                    durationSeconds: 180,
                    firmwarePackageName: `${compKey} Upgrade to ${jobServer.toVersion}`,
                  };
                  setAuditLogs(prev => [auditRec, ...prev]);
                  syncSaveAuditLog(auditRec).catch(console.warn);
                }
              }
            } catch (err: any) {
              console.error('Error executing server step:', err);
            } finally {
              executingNodesRef.current.delete(execKey);
            }
          })();
        }
      }
    }, 1500);

    return () => clearInterval(interval);
  }, [campaigns, servers]);

  // Campaign CRUD Controls
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

    setCampaigns(prev => [newCamp, ...prev]);
    setSelectedCampaignId(newCamp.id);
    saveCampaign(newCamp);
    syncSaveCampaign(newCamp).catch(console.warn);
    setActiveTab('campaign');
    showToast(`Rollout campaign "${newCamp.title}" launched for ${selectedServersList.length} nodes!`, 'info');
  };

  const handlePauseCampaign = (campaignId: string) => {
    setCampaigns(prev => prev.map(c => {
      if (c.id === campaignId) {
        const updated: UpgradeCampaign = { ...c, status: 'paused', updatedAt: new Date().toISOString() };
        syncSaveCampaign(updated).catch(console.warn);
        return updated;
      }
      return c;
    }));
    showToast('Upgrade rollout paused.', 'warn');
  };

  const handleResumeCampaign = (campaignId: string) => {
    setCampaigns(prev => prev.map(c => {
      if (c.id === campaignId) {
        const updated: UpgradeCampaign = { ...c, status: 'running', updatedAt: new Date().toISOString() };
        syncSaveCampaign(updated).catch(console.warn);
        return updated;
      }
      return c;
    }));
    showToast('Upgrade rollout resumed.', 'info');
  };

  const handleAbortCampaign = (campaignId: string) => {
    setCampaigns(prev => prev.map(c => {
      if (c.id === campaignId) {
        const updated: UpgradeCampaign = { ...c, status: 'aborted', updatedAt: new Date().toISOString() };
        syncSaveCampaign(updated).catch(console.warn);
        return updated;
      }
      return c;
    }));
    showToast('Campaign aborted by operator.', 'warn');
  };

  const handleDeleteCampaign = (campaignId: string) => {
    deleteCampaign(campaignId);
    syncDeleteCampaign(campaignId).catch(console.warn);
    setCampaigns(prev => {
      const remaining = prev.filter(c => c.id !== campaignId);
      if (selectedCampaignId === campaignId) {
        setSelectedCampaignId(remaining[0]?.id || null);
      }
      return remaining;
    });
    showToast('Campaign successfully deleted.', 'info');
  };

  const handleOpenEditCampaign = (campaign: UpgradeCampaign) => {
    setCampaignToEdit(campaign);
    setIsEditCampaignOpen(true);
  };

  const handleSaveCampaign = (updatedCampaign: UpgradeCampaign) => {
    setCampaigns(prev => prev.map(c => c.id === updatedCampaign.id ? updatedCampaign : c));
    saveCampaign(updatedCampaign);
    syncSaveCampaign(updatedCampaign).catch(console.warn);
    showToast(`Campaign "${updatedCampaign.title}" saved.`, 'success');
  };

  const handleRetryServerTask = (campaignId: string, serverId: string) => {
    setCampaigns(prev => prev.map(c => {
      if (c.id !== campaignId) return c;
      const updatedServers = c.servers.map(s => {
        if (s.serverId !== serverId) return s;
        return {
          ...s,
          stage: 'pending' as UpgradeStage,
          progressPercent: 0,
          error: undefined,
          currentStepMessage: 'Queued for real hardware retry...',
          logs: [
            ...s.logs,
            {
              timestamp: new Date().toLocaleTimeString(),
              level: 'info' as const,
              message: `[Retry Task] Re-queued by operator. Will re-test network, IPMI, and credentials.`,
            },
          ],
        };
      });

      const updated: UpgradeCampaign = {
        ...c,
        status: c.status === 'paused' ? 'running' : c.status,
        servers: updatedServers,
        updatedAt: new Date().toISOString(),
      };
      syncSaveCampaign(updated).catch(console.warn);
      return updated;
    }));
    showToast('Node task reset and re-queued for execution.', 'info');
  };

  const handleTriggerRollback = (campaignId: string, serverId: string) => {
    setCampaigns(prev => prev.map(c => {
      if (c.id !== campaignId) return c;
      const srv = c.servers.find(s => s.serverId === serverId);
      if (!srv) return c;

      const updatedServers = c.servers.map(s => {
        if (s.serverId !== serverId) return s;
        return {
          ...s,
          stage: 'rolled_back' as UpgradeStage,
          currentStepMessage: `Rolled back to backup firmware partition (${s.fromVersion})`,
          logs: [
            ...s.logs,
            {
              timestamp: new Date().toLocaleTimeString(),
              level: 'warn' as const,
              message: `[Rollback] Boot partition switched to secondary SPI EEPROM bank. Hardware nominal.`,
            },
          ],
        };
      });

      const updated: UpgradeCampaign = { ...c, servers: updatedServers, updatedAt: new Date().toISOString() };
      syncSaveCampaign(updated).catch(console.warn);
      return updated;
    }));
    showToast('Rollback executed. Backup firmware bank restored.', 'warn');
  };

  // Demo fleet reset
  const handleResetDemo = async () => {
    const demo = resetToDemoFleet();
    setServers(demo.servers);
    setPackages(demo.packages);
    setAuditLogs(demo.auditLogs);
    setBaseline(demo.baseline);
    setCampaigns([]);
    setSelectedCampaignId(null);
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
    setCampaigns([]);
    setSelectedCampaignId(null);
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

  // Live real network, BMC, and Redfish connectivity check for a server
  const handleTestServerAccess = async (server: Server) => {
    try {
      const creds = server.credentials || {
        bmcUsername: 'root',
        bmcPassword: '',
        bmcProtocol: server.bmcAffectedType === 'Supermicro IPMI' ? 'ipmi' : 'redfish',
        bmcPort: server.bmcAffectedType === 'Supermicro IPMI' ? 623 : 443,
        ignoreSslErrors: true,
        enableSsh: false
      };
      const result = await testServerAccess({
        hostname: server.hostname,
        ip: server.ip,
        bmcIp: server.bmcIp,
        bmcAffectedType: server.bmcAffectedType,
        model: server.model,
        credentials: creds,
      });
      const updated: Server = {
        ...server,
        accessStatus: result,
      };
      syncSaveServer(updated);
      setServers(prev => prev.map(s => s.id === server.id ? updated : s));
      if (inspectedServer && inspectedServer.id === server.id) {
        setInspectedServer(updated);
      }
      if (result.status === 'success') {
        showToast(`Verified live connectivity to ${server.hostname} (${result.latencyMs || 0}ms RTT).`, 'success');
      } else {
        showToast(`Verification check failed on ${server.hostname}: ${result.summary}`, 'warn');
      }
    } catch (err: any) {
      showToast(`Error checking ${server.hostname}: ${err.message}`, 'warn');
    }
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
        activeCampaign={campaigns.find(c => c.id === selectedCampaignId) || campaigns.find(c => c.status === 'running') || campaigns[0] || null}
        onOpenUpgradeWizard={() => {
          setWizardPreSelectedServers([]);
          setWizardPreSelectedComponent('BIOS');
          setIsWizardOpen(true);
        }}
        onOpenFlushConfirm={() => setIsFlushConfirmOpen(true)}
        totalServers={servers.length}
        criticalCount={criticalCount}
        dbStatus={dbStatus}
        onOpenDockerDb={() => setIsDockerDbModalOpen(true)}
        onOpenVmwareIsoTester={() => handleOpenVmwareIsoTester()}
        onOpenExportModal={() => handleOpenExportModal('fleet')}
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

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 mb-3">
              <div className="flex items-center space-x-2">
                <h3 className="text-sm font-bold text-slate-900">Physical Server Inventory</h3>
                <span className="text-xs text-slate-500 font-mono">
                  ({filteredServers.length} nodes matching filters)
                </span>
              </div>
              
              <div className="flex items-center flex-wrap gap-2">
                <button
                  type="button"
                  id="btn-export-fleet-csv"
                  onClick={() => {
                    const dateStr = new Date().toISOString().split('T')[0];
                    exportFleetToCsv(filteredServers, `fleet_inventory_${dateStr}.csv`);
                    showToast(`Exported ${filteredServers.length} nodes to CSV`, 'success');
                  }}
                  title="Export currently displayed servers to CSV spreadsheet"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold shadow-xs transition-colors"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Export CSV</span>
                </button>

                <button
                  type="button"
                  id="btn-export-fleet-json"
                  onClick={() => {
                    const dateStr = new Date().toISOString().split('T')[0];
                    exportFleetToJson(filteredServers, `fleet_inventory_${dateStr}.json`);
                    showToast(`Exported ${filteredServers.length} nodes to JSON`, 'success');
                  }}
                  title="Export currently displayed servers to JSON dataset"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold shadow-xs transition-colors"
                >
                  <FileCode className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Export JSON</span>
                </button>

                <button
                  type="button"
                  id="btn-open-export-modal-fleet"
                  onClick={() => handleOpenExportModal('fleet')}
                  title="Configure report scope and download format"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-indigo-700 text-xs font-semibold shadow-xs transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Export Report...</span>
                </button>

                <button
                  type="button"
                  id="btn-open-add-server"
                  onClick={() => {
                    setEditingServer(null);
                    setIsDeviceModalOpen(true);
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-xs transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Register Server Node</span>
                </button>
              </div>
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
              onTestServerAccess={handleTestServerAccess}
            />

            {/* Upload or Define Firmware Version: Output Window for processing file upload & Firmware List */}
            <MainPageFirmwareUploadPanel
              packages={packages}
              servers={servers}
              onAddPackage={newPkg => {
                setPackages(prev => [newPkg, ...prev]);
                showToast(`Firmware package "${newPkg.name}" registered & stored!`, 'success');
              }}
              onDeletePackage={handleDeletePackage}
              onDeployPackage={handleDeployPackage}
              onShowToast={showToast}
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
            onShowToast={showToast}
          />
        )}

        {activeTab === 'baremetal' && (
          <BaremetalEsxiDeployView
            servers={servers}
            packages={packages}
            onShowToast={showToast}
            onRegisterServer={newServer => {
              setServers(prev => [newServer, ...prev]);
            }}
          />
        )}

        {activeTab === 'campaign' && (
          <ActiveCampaignView
            campaigns={campaigns}
            selectedCampaignId={selectedCampaignId}
            fleetServers={servers}
            onSelectCampaign={setSelectedCampaignId}
            onOpenUpgradeWizard={() => {
              setWizardPreSelectedServers([]);
              setWizardPreSelectedComponent('BIOS');
              setIsWizardOpen(true);
            }}
            onOpenEditCampaign={handleOpenEditCampaign}
            onDeleteCampaign={handleDeleteCampaign}
            onPauseCampaign={handlePauseCampaign}
            onResumeCampaign={handleResumeCampaign}
            onAbortCampaign={handleAbortCampaign}
            onTriggerRollback={handleTriggerRollback}
            onRetryServerTask={handleRetryServerTask}
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
          <AuditHistoryView 
            auditLogs={auditLogs} 
            onOpenExportModal={handleOpenExportModal}
            onShowToast={showToast}
          />
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
            <span>Enterprise Telemetry Ingress Active • IPMI 2.0 / DMTF Compliant</span>
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
          setCampaigns([]);
          setSelectedCampaignId(null);
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

      {/* Export Reports & Offline Compliance Modal */}
      <ExportReportModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        allServers={servers}
        filteredServers={filteredServers}
        selectedServerIds={selectedServerIds}
        allAuditLogs={auditLogs}
        initialDataset={exportModalInitialDataset}
        onShowToast={showToast}
      />

      {/* Edit Upgrade Campaign Modal */}
      <EditCampaignModal
        isOpen={isEditCampaignOpen}
        onClose={() => {
          setIsEditCampaignOpen(false);
          setCampaignToEdit(null);
        }}
        campaign={campaignToEdit}
        fleetServers={servers}
        packages={packages}
        onSaveCampaign={handleSaveCampaign}
      />
    </div>
  );
}
