import { ComponentDependencyRule, ComponentType, Server, FirmwarePackage, ServerVendor } from '../types';

export const FIRMWARE_DEPENDENCY_RULES: ComponentDependencyRule[] = [
  // --- DELL TECHNOLOGIES RULES ---
  {
    id: 'dep-dell-bios-bmc',
    vendor: 'DELL',
    sourceComponent: 'BIOS',
    sourceVersionMin: '2.20.0',
    targetComponent: 'BMC',
    targetMinVersion: '6.10.30.00',
    targetRecommendedVersion: '7.00.00.00',
    criticality: 'blocking',
    reason: 'Dell UEFI BIOS 2.20.0 utilizes updated SMM Redfish API communication protocols with iDRAC9.',
    incompatibleConsequence: 'Flashing BIOS 2.20.0 with iDRAC9 < 6.10 causes POST failure, fan tachometer throttling to 100%, and "UEFI0036 iDRAC Communication Failure" strike-by error.',
    resolutionGuidance: 'Upgrade iDRAC9 to 6.10.30.00 (or recommended 7.00.00.00) first before staging the BIOS 2.20.0 package.'
  },
  {
    id: 'dep-dell-nic-bios',
    vendor: 'DELL',
    sourceComponent: 'NIC',
    sourceVersionMin: '22.39.1002',
    targetComponent: 'BIOS',
    targetMinVersion: '2.18.0',
    targetRecommendedVersion: '2.20.0',
    criticality: 'blocking',
    reason: 'PCIe Gen4 link training, bifurcation allocation, and Secure Boot signature key verification.',
    incompatibleConsequence: 'NIC link down or PCIe slot enumeration failure during hypervisor boot if BIOS is older than 2.18.0.',
    resolutionGuidance: 'Ensure Dell PowerEdge BIOS is at least 2.18.0 prior to flashing 100GbE ConnectX-6 NIC firmware.'
  },
  {
    id: 'dep-dell-raid-bmc',
    vendor: 'DELL',
    sourceComponent: 'RAID',
    sourceVersionMin: '52.16.1',
    targetComponent: 'BMC',
    targetMinVersion: '6.00.00.00',
    targetRecommendedVersion: '7.00.00.00',
    criticality: 'required',
    reason: 'PERC H755/H755N out-of-band telemetry and drive health telemetry reporting to iDRAC Lifecycle Controller.',
    incompatibleConsequence: 'RAID status shows "Unknown / Communication Fault" in iDRAC Redfish inventory.',
    resolutionGuidance: 'Update iDRAC9 to 6.00.00.00+ before applying PERC 52.16.1 controller firmware.'
  },
  {
    id: 'dep-dell-nvme-raid',
    vendor: 'DELL',
    sourceComponent: 'NVMe',
    sourceVersionMin: '1.3.0',
    targetComponent: 'RAID',
    targetMinVersion: '52.14.0',
    targetRecommendedVersion: '52.16.1',
    criticality: 'recommended',
    reason: 'Direct-attached NVMe U.3 drive namespace routing and patrol read synchronization.',
    incompatibleConsequence: 'NVMe drive hot-plug detection delays and background rebuild latency spikes.',
    resolutionGuidance: 'Update PERC RAID controller to 52.14.0+ for optimal NVMe U.3 write throughput.'
  },
  {
    id: 'dep-dell-bios-hypervisor',
    vendor: 'DELL',
    sourceComponent: 'BIOS',
    sourceVersionMin: '2.18.0',
    targetComponent: 'Hypervisor',
    targetMinVersion: 'ESXi 7.0 Update 3 / Nutanix AOS 6.5',
    criticality: 'recommended',
    reason: 'Intel TXT / SGX microcode CPU scheduling and ACPI power management compatibility.',
    incompatibleConsequence: 'Hypervisor power governor warnings and sub-optimal core frequency scaling.',
    resolutionGuidance: 'Ensure ESXi host is running ESXi 7.0u3+ or Nutanix AOS 6.5+.'
  },

  // --- HP (HEWLETT PACKARD ENTERPRISE) RULES ---
  {
    id: 'dep-hp-bios-bmc',
    vendor: 'HP',
    sourceComponent: 'BIOS',
    sourceVersionMin: '2.92',
    targetComponent: 'BMC',
    targetMinVersion: '2.90',
    targetRecommendedVersion: '2.98',
    criticality: 'blocking',
    reason: 'HPE Silicon Root of Trust & TPM 2.0 endorsement key handshake between System ROM and iLO 5.',
    incompatibleConsequence: 'Firmware staging aborts with error code 0x8004 "iLO Security Rejection". If forced, host hangs at early UEFI POST.',
    resolutionGuidance: 'Flash HPE iLO 5 to version 2.90 (or recommended 2.98) prior to deploying System ROM 2.92.'
  },
  {
    id: 'dep-hp-nic-bios',
    vendor: 'HP',
    sourceComponent: 'NIC',
    sourceVersionMin: '22.36',
    targetComponent: 'BIOS',
    targetMinVersion: '2.80',
    targetRecommendedVersion: '2.92',
    criticality: 'blocking',
    reason: 'HPE UEFI Option ROM execution table and SR-IOV virtual function allocation.',
    incompatibleConsequence: '100GbE network adapters fail to initialize in VMware ESXi or XenServer host vSwitch.',
    resolutionGuidance: 'Update HPE System ROM to 2.80+ before upgrading adapter firmware.'
  },
  {
    id: 'dep-hp-raid-bmc',
    vendor: 'HP',
    sourceComponent: 'RAID',
    sourceVersionMin: '5.10',
    targetComponent: 'BMC',
    targetMinVersion: '2.70',
    targetRecommendedVersion: '2.98',
    criticality: 'required',
    reason: 'Smart Array P408i battery-backed write cache status sync with iLO RESTful engine.',
    incompatibleConsequence: 'False positive "Battery Failed" or "Cache Disabled" alarms reported in iLO and hypervisor storage monitors.',
    resolutionGuidance: 'Verify iLO 5 is at 2.70+ before flashing Smart Array 5.10.'
  },

  // --- LENOVO THINKSYSTEM RULES ---
  {
    id: 'dep-lenovo-bios-bmc',
    vendor: 'LENOVO',
    sourceComponent: 'BIOS',
    sourceVersionMin: '3.40',
    targetComponent: 'BMC',
    targetMinVersion: '4.20',
    targetRecommendedVersion: '4.40',
    criticality: 'blocking',
    reason: 'Lenovo XClarity Controller (XCC) secure UEFI payload authorization and core voltage register calibration.',
    incompatibleConsequence: 'Server triggers IMM Recovery Mode with blinking Amber fault LED; requires manual recovery flash via XCC web UI.',
    resolutionGuidance: 'Update Lenovo XCC to 4.20+ before upgrading UEFI BIOS to 3.40.'
  },
  {
    id: 'dep-lenovo-nic-bios',
    vendor: 'LENOVO',
    sourceComponent: 'NIC',
    sourceVersionMin: '22.30',
    targetComponent: 'BIOS',
    targetMinVersion: '3.10',
    targetRecommendedVersion: '3.40',
    criticality: 'blocking',
    reason: 'PCIe bus mastering and RoCE v2 low-latency memory map reservation.',
    incompatibleConsequence: 'Network card dropped from PCI bus; hypervisor cannot detect host physical vmnic adapters.',
    resolutionGuidance: 'Stage ThinkSystem BIOS 3.10+ first, then proceed with NIC firmware.'
  },
  {
    id: 'dep-lenovo-raid-bios',
    vendor: 'LENOVO',
    sourceComponent: 'RAID',
    sourceVersionMin: '52.16',
    targetComponent: 'BIOS',
    targetMinVersion: '3.00',
    targetRecommendedVersion: '3.40',
    criticality: 'required',
    reason: 'ThinkSystem RAID 930/940 MegaRAID HII configuration menu integration in UEFI setup.',
    incompatibleConsequence: 'Cannot access RAID configuration during boot; disk arrays might not import foreign configurations.',
    resolutionGuidance: 'Ensure Lenovo UEFI BIOS is at least 3.00 prior to RAID adapter update.'
  }
];

export interface CompatibilityCheckResult {
  isCompatible: boolean;
  hasBlockingIssue: boolean;
  hasWarning: boolean;
  status: 'compatible' | 'warning' | 'incompatible';
  ruleViolations: {
    rule: ComponentDependencyRule;
    currentVersion: string;
    requiredVersion: string;
    component: ComponentType | 'Hypervisor';
    isBlocking: boolean;
  }[];
  recommendedSequence: {
    step: number;
    component: ComponentType;
    action: string;
    targetVersion?: string;
  }[];
}

// Compare semantic or firmware versions: e.g. "2.20.0" vs "2.14.0", "6.10.30.00" vs "6.00.00.00"
export function compareFirmwareVersions(v1: string, v2: string): number {
  if (!v1 || !v2) return 0;
  // Strip non-numeric prefixes/suffixes like "(IVE182M)", "_07-2026"
  const clean1 = v1.replace(/[^0-9.]/g, '');
  const clean2 = v2.replace(/[^0-9.]/g, '');
  
  const p1 = clean1.split('.').map(n => parseInt(n, 10) || 0);
  const p2 = clean2.split('.').map(n => parseInt(n, 10) || 0);
  
  const maxLen = Math.max(p1.length, p2.length);
  for (let i = 0; i < maxLen; i++) {
    const num1 = p1[i] || 0;
    const num2 = p2[i] || 0;
    if (num1 > num2) return 1;
    if (num1 < num2) return -1;
  }
  return 0;
}

// Check whether upgrading a specific server to a target firmware package is safe
export function evaluateUpgradeCompatibility(
  server: Server,
  targetPackage: FirmwarePackage
): CompatibilityCheckResult {
  const violations: CompatibilityCheckResult['ruleViolations'] = [];
  const serverVendor = server.vendor || (
    server.model?.includes('Dell') ? 'DELL' :
    server.model?.includes('HPE') || server.model?.includes('HP') ? 'HP' : 'LENOVO'
  );

  // Find all rules matching this vendor (or ALL) and source component
  const relevantRules = FIRMWARE_DEPENDENCY_RULES.filter(rule => {
    const vendorMatches = rule.vendor === 'ALL' || rule.vendor === serverVendor;
    const compMatches = rule.sourceComponent === targetPackage.component;
    return vendorMatches && compMatches;
  });

  for (const rule of relevantRules) {
    // Check if target package version meets or exceeds sourceVersionMin
    const qualifiesForRule = compareFirmwareVersions(targetPackage.version, rule.sourceVersionMin) >= 0;
    if (!qualifiesForRule) continue;

    if (rule.targetComponent === 'Hypervisor') {
      // Check hypervisor version if available
      continue;
    }

    const currentComponent = server.components[rule.targetComponent as ComponentType];
    if (!currentComponent) continue;

    const currentVer = currentComponent.currentVersion;
    const meetsMin = compareFirmwareVersions(currentVer, rule.targetMinVersion) >= 0;

    if (!meetsMin) {
      violations.push({
        rule,
        component: rule.targetComponent,
        currentVersion: currentVer,
        requiredVersion: rule.targetMinVersion,
        isBlocking: rule.criticality === 'blocking'
      });
    }
  }

  // Also check minPrerequisiteVersion on the package itself
  if (targetPackage.minPrerequisiteVersion) {
    const currentVer = server.components[targetPackage.component]?.currentVersion;
    if (currentVer && compareFirmwareVersions(currentVer, targetPackage.minPrerequisiteVersion) < 0) {
      violations.push({
        rule: {
          id: 'min-prereq-stepping',
          vendor: serverVendor,
          sourceComponent: targetPackage.component,
          sourceVersionMin: targetPackage.version,
          targetComponent: targetPackage.component,
          targetMinVersion: targetPackage.minPrerequisiteVersion,
          criticality: 'blocking',
          reason: 'Intermediate stepping version required by vendor firmware updater engine.',
          incompatibleConsequence: 'Updater payload aborts with "Unsupported Base Version" error to prevent EEPROM flash bricking.',
          resolutionGuidance: `Upgrade ${targetPackage.component} to stepping version ${targetPackage.minPrerequisiteVersion} first before flashing ${targetPackage.version}.`
        },
        component: targetPackage.component,
        currentVersion: currentVer,
        requiredVersion: targetPackage.minPrerequisiteVersion,
        isBlocking: true
      });
    }
  }

  const hasBlockingIssue = violations.some(v => v.isBlocking);
  const hasWarning = violations.length > 0 && !hasBlockingIssue;

  // Build recommended sequence
  const sequence: CompatibilityCheckResult['recommendedSequence'] = [
    { step: 1, component: 'BMC', action: 'Update Out-of-Band Controller (No Host Reboot Required)' },
    { step: 2, component: 'BIOS', action: 'Update System ROM / UEFI (Requires Host Warm Reboot)' },
    { step: 3, component: 'RAID', action: 'Update Storage Controllers & NVMe HBAs' },
    { step: 4, component: 'NIC', action: 'Update Network Interface Adapters & Option ROMs' },
    { step: 5, component: 'NVMe', action: 'Update Drive Firmware on active flash media' }
  ];

  return {
    isCompatible: violations.length === 0,
    hasBlockingIssue,
    hasWarning,
    status: hasBlockingIssue ? 'incompatible' : hasWarning ? 'warning' : 'compatible',
    ruleViolations: violations,
    recommendedSequence: sequence
  };
}
