import { UpgradeCampaign, UpgradeJobServerProgress, UpgradeStage, ComponentType, Server } from '../types';

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
  preflightChecksRequired: boolean = true
): UpgradeCampaign {
  const jobServers: UpgradeJobServerProgress[] = servers.map(srv => {
    let compType: ComponentType = 'BIOS';
    let fromVersion = 'Unknown';
    let toVersion = 'Latest';

    if (targetComponent === 'FULL_BASELINE') {
      // Pick the first component that needs update
      const candidate = (Object.keys(srv.components) as ComponentType[]).find(
        c => srv.components[c].status !== 'up_to_date'
      ) || 'BIOS';
      compType = candidate;
      fromVersion = srv.components[candidate].currentVersion;
      toVersion = srv.components[candidate].latestVersion;
    } else {
      compType = targetComponent;
      fromVersion = srv.components[targetComponent]?.currentVersion || '1.0.0';
      toVersion = srv.components[targetComponent]?.latestVersion || '2.0.0';
    }

    return {
      serverId: srv.id,
      hostname: srv.hostname,
      component: compType,
      fromVersion,
      toVersion,
      stage: 'pending',
      progressPercent: 0,
      currentStepMessage: 'Queued in rollout pipeline',
      logs: [
        {
          timestamp: new Date().toLocaleTimeString(),
          level: 'info',
          message: `Queued for ${compType} firmware upgrade (${fromVersion} → ${toVersion}).`,
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
    status: 'running',
    concurrencyLimit,
    autoReboot,
    stopOnFirstFailure,
    preflightChecksRequired,
    servers: jobServers,
  };
}
