import { Server, FirmwarePackage, AuditRecord, BaselineConfig } from '../types';

export const INITIAL_FIRMWARE_PACKAGES: FirmwarePackage[] = [];
export const INITIAL_SERVERS: Server[] = [];
export const INITIAL_AUDIT_LOGS: AuditRecord[] = [];

export const DEFAULT_BASELINE: BaselineConfig = {
  id: 'baseline-default',
  name: 'Standard Compliance Baseline',
  description: 'Rules for server firmware compliance across registered server hardware.',
  rules: {},
  enforceSecurityPatches: true,
  updatedAt: new Date().toISOString(),
};
