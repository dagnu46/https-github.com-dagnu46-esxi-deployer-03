import { UpgradeCampaign, UpgradeJobServerProgress, UpgradeStage, ComponentType, Server, CampaignFirmwareTask } from '../types';

export interface StageStepInfo {
  stage: UpgradeStage;
  progress: number;
  message: string;
  log: string;
  durationMs: number;
}

export function getStageSteps(component: ComponentType, toVersion: string, bmcType: string): StageStepInfo[] {
  return [
    {
      stage: 'preflight',
      progress: 10,
      message: 'Verifying BMC health & dual PSU redundancy...',
      log: `[Redfish] Target BMC (${bmcType}) reachable. Dual PSU AC redundancy verified. OS heartbeat nominal.`,
      durationMs: 1400,
    },
    {
      stage: 'bmc_staging',
      progress: 35,
      message: 'Uploading binary to BMC flash staging partition...',
      log: `[Redfish:UpdateService] POST /redfish/v1/UpdateService/Actions/SimpleUpdate payload staged.`,
      durationMs: 2200,
    },
    {
      stage: 'flashing',
      progress: 65,
      message: `Writing ${component} SPI EEPROM Bank & verifying CRC32...`,
      log: `[SPI-Flash] Flashing ${component} to version ${toVersion}. Target block 0x0000-0x3FFFFF verified.`,
      durationMs: 2800,
    },
    {
      stage: 'rebooting',
      progress: 85,
      message: 'Triggering scheduled chassis reboot to latch firmware...',
      log: `[Chassis] Graceful warm reset initiated. POST sequence executing, hardware re-enumeration in progress.`,
      durationMs: 2600,
    },
    {
      stage: 'postcheck',
      progress: 95,
      message: 'Performing post-POST handshake & version validation...',
      log: `[Verification] Redfish query confirmed active ${component} firmware is now ${toVersion}. Health status: OK.`,
      durationMs: 1200,
    },
    {
      stage: 'completed',
      progress: 100,
      message: `Firmware upgrade to ${toVersion} successfully applied!`,
      log: `[Success] Upgrade task completed without warnings. Server marked as fully compliant.`,
      durationMs: 600,
    },
  ];
}

export function createCampaign(
  title: string,
  targetComponent: ComponentType | 'FULL_BASELINE',
  targetFirmwareId: string | undefined,
  servers: Server[],
  concurrencyLimit: number = 2,
  autoReboot: boolean = true,
  stopOnFirstFailure: boolean = true,
  preflightChecksRequired: boolean = true,
  customTasks?: CampaignFirmwareTask[]
): UpgradeCampaign {
  // Derive default ranked firmware task if not provided
  let tasks: CampaignFirmwareTask[] = customTasks || [];
  if (tasks.length === 0) {
    if (targetComponent === 'FULL_BASELINE') {
      tasks = [
        { id: `task-${Date.now()}-1`, order: 1, component: 'BIOS', targetVersion: '2.18.1', rebootRequired: true, packageName: 'System BIOS Core ROM' },
        { id: `task-${Date.now()}-2`, order: 2, component: 'BMC', targetVersion: '6.10.00.00', rebootRequired: false, packageName: 'iDRAC9 / OpenBMC IPMI' },
        { id: `task-${Date.now()}-3`, order: 3, component: 'RAID', targetVersion: '52.16.1-4074', rebootRequired: false, packageName: 'PERC / MegaRAID SAS Controller' },
        { id: `task-${Date.now()}-4`, order: 4, component: 'NIC', targetVersion: '22.31.1014', rebootRequired: true, packageName: 'Intel/Mellanox 25GbE NVM' },
      ];
    } else {
      tasks = [
        {
          id: `task-${Date.now()}-1`,
          order: 1,
          component: targetComponent,
          targetFirmwareId,
          targetVersion: 'Latest',
          rebootRequired: autoReboot,
          packageName: `${targetComponent} Firmware Package`,
        },
      ];
    }
  }

  const firstTask = tasks[0];

  const jobServers: UpgradeJobServerProgress[] = servers.map(srv => {
    let compType: ComponentType = firstTask?.component || 'BIOS';
    let fromVersion = 'Unknown';
    let toVersion = firstTask?.targetVersion || 'Latest';

    if (targetComponent === 'FULL_BASELINE') {
      const candidate = (Object.keys(srv.components) as ComponentType[]).find(
        c => srv.components[c].status !== 'up_to_date'
      ) || firstTask?.component || 'BIOS';
      compType = candidate;
      fromVersion = srv.components[candidate]?.currentVersion || '1.0.0';
      toVersion = srv.components[candidate]?.latestVersion || firstTask?.targetVersion || 'Latest';
    } else {
      compType = firstTask?.component || targetComponent;
      fromVersion = srv.components[compType]?.currentVersion || '1.0.0';
      toVersion = firstTask?.targetVersion || srv.components[compType]?.latestVersion || '2.0.0';
    }

    return {
      serverId: srv.id,
      hostname: srv.hostname,
      component: compType,
      fromVersion,
      toVersion,
      currentTaskIndex: 0,
      completedTasksCount: 0,
      totalTasksCount: tasks.length,
      stage: 'pending',
      progressPercent: 0,
      currentStepMessage: `Queued for Task #1: ${compType} (v${toVersion})`,
      networkStatus: 'untested',
      ipmiStatus: 'untested',
      credentialsStatus: 'untested',
      logs: [
        {
          timestamp: new Date().toLocaleTimeString(),
          level: 'info',
          message: `Queued in rollout pipeline. Starting with Task #1 (${compType} ${fromVersion} → ${toVersion}). Total ranked tasks: ${tasks.length}.`,
        },
      ],
    };
  });

  return {
    id: `camp-${Date.now()}`,
    title,
    createdAt: new Date().toISOString(),
    targetComponent,
    targetFirmwareId,
    tasks,
    status: 'running',
    concurrencyLimit,
    autoReboot,
    stopOnFirstFailure,
    preflightChecksRequired,
    servers: jobServers,
  };
}
