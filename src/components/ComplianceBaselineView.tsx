import React, { useState } from 'react';
import { 
  ShieldAlert, 
  ShieldCheck, 
  CheckCircle2, 
  AlertTriangle, 
  ArrowRight, 
  Play, 
  Sliders, 
  Cpu, 
  Server as ServerIcon, 
  Layers, 
  HardDrive, 
  Wifi,
  FileCheck
} from 'lucide-react';
import { Server, BaselineConfig, ComponentType, ComponentFirmware } from '../types';

interface ComplianceBaselineViewProps {
  servers: Server[];
  baseline: BaselineConfig;
  onUpdateBaseline: (newBaseline: BaselineConfig) => void;
  onRemediateAllVulnerable: () => void;
  onRemediateComponentDrift: (compType: ComponentType) => void;
}

export const ComplianceBaselineView: React.FC<ComplianceBaselineViewProps> = ({
  servers,
  baseline,
  onUpdateBaseline,
  onRemediateAllVulnerable,
  onRemediateComponentDrift,
}) => {
  const [isEditingBaseline, setIsEditingBaseline] = useState(false);
  const [editedRules, setEditedRules] = useState(baseline.rules);

  const totalServers = servers.length;

  // Calculate drift per component
  const componentsList: ComponentType[] = ['BIOS', 'BMC', 'NIC', 'RAID', 'NVMe'];

  const driftStats = componentsList.map(comp => {
    const requiredVersion = baseline.rules[comp];
    const driftingServers = servers.filter(s => {
      const current = s.components[comp]?.currentVersion;
      return current !== requiredVersion;
    });
    const criticalServers = servers.filter(s => {
      return s.components[comp]?.status === 'critical_update';
    });

    return {
      component: comp,
      requiredVersion,
      driftingCount: driftingServers.length,
      criticalCount: criticalServers.length,
      compliantCount: totalServers - driftingServers.length,
      servers: driftingServers,
    };
  });

  const totalVulnerableNodes = Array.from(
    new Set(
      servers
        .filter(s => (Object.values(s.components) as ComponentFirmware[]).some(c => c.status === 'critical_update'))
        .map(s => s.id)
    )
  ).length;

  const handleSaveBaseline = () => {
    onUpdateBaseline({
      ...baseline,
      rules: editedRules,
    });
    setIsEditingBaseline(false);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner: Fleet Security Posture */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-lg bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-700">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-900">{baseline.name}</h2>
                <p className="text-xs text-slate-500 mt-0.5">{baseline.description}</p>
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <button
              type="button"
              onClick={() => setIsEditingBaseline(!isEditingBaseline)}
              className="px-3.5 py-1.5 rounded-lg border border-slate-300 hover:bg-slate-50 text-xs font-semibold text-slate-700 transition-colors flex items-center gap-1.5"
            >
              <Sliders className="w-3.5 h-3.5" />
              <span>{isEditingBaseline ? 'Cancel Editing' : 'Configure Baseline Targets'}</span>
            </button>

            {totalVulnerableNodes > 0 && (
              <button
                type="button"
                id="btn-remediate-all"
                onClick={onRemediateAllVulnerable}
                className="inline-flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Remediate All {totalVulnerableNodes} Vulnerable Nodes</span>
              </button>
            )}
          </div>
        </div>

        {/* Baseline Target Editor */}
        {isEditingBaseline && (
          <div className="mt-5 pt-4 border-t border-slate-200">
            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-3">
              Edit Target Version Matrix
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              {componentsList.map(comp => (
                <div key={comp}>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">{comp} Target</label>
                  <input
                    type="text"
                    value={editedRules[comp] || ''}
                    onChange={e => setEditedRules({ ...editedRules, [comp]: e.target.value })}
                    className="w-full text-xs font-mono p-2 border border-slate-200 rounded-lg bg-slate-50"
                  />
                </div>
              ))}
            </div>
            <div className="mt-4 flex justify-end">
              <button
                type="button"
                onClick={handleSaveBaseline}
                className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold"
              >
                Save Baseline Rules
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Component Drift Matrix */}
      <div>
        <h3 className="text-sm font-bold text-slate-900 mb-3">Component Drift & Compliance Breakdown</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {driftStats.map(stat => {
            const compliancePct = Math.round((stat.compliantCount / totalServers) * 100);

            return (
              <div
                key={stat.component}
                className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <span className="w-7 h-7 rounded-md bg-slate-100 flex items-center justify-center font-bold text-xs font-mono text-slate-700">
                        {stat.component}
                      </span>
                      <div>
                        <h4 className="text-xs font-bold text-slate-900">
                          {stat.component === 'BIOS' ? 'System ROM (UEFI)' :
                           stat.component === 'BMC' ? 'Out-of-Band Controller' :
                           stat.component === 'NIC' ? 'Network Adapters' :
                           stat.component === 'RAID' ? 'Storage Controllers' : 'NVMe Flash Storage'}
                        </h4>
                        <span className="text-[11px] font-mono text-slate-500">
                          Target: <strong>{stat.requiredVersion}</strong>
                        </span>
                      </div>
                    </div>
                    <span className={`text-xs font-mono font-bold ${
                      compliancePct === 100 ? 'text-emerald-600' : 'text-slate-800'
                    }`}>
                      {compliancePct}%
                    </span>
                  </div>

                  {/* Visual Progress Bar */}
                  <div className="mt-3 w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        compliancePct === 100 ? 'bg-emerald-500' :
                        stat.criticalCount > 0 ? 'bg-amber-500' : 'bg-indigo-600'
                      }`}
                      style={{ width: `${compliancePct}%` }}
                    />
                  </div>

                  {/* Metrics */}
                  <div className="mt-3 space-y-1 text-xs">
                    <div className="flex justify-between text-slate-600">
                      <span>Compliant Nodes:</span>
                      <span className="font-mono font-semibold text-emerald-600">{stat.compliantCount}</span>
                    </div>
                    <div className="flex justify-between text-slate-600">
                      <span>Drifting Behind Target:</span>
                      <span className="font-mono font-semibold text-slate-900">{stat.driftingCount}</span>
                    </div>
                    {stat.criticalCount > 0 && (
                      <div className="flex justify-between text-amber-800 font-semibold bg-amber-50 p-1.5 rounded-md mt-1">
                        <span className="flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3 text-amber-600" /> Critical Security Errata:
                        </span>
                        <span className="font-mono">{stat.criticalCount}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Remediate Button */}
                <div className="mt-4 pt-3 border-t border-slate-100">
                  {stat.driftingCount > 0 ? (
                    <button
                      type="button"
                      onClick={() => onRemediateComponentDrift(stat.component)}
                      className="w-full py-2 px-3 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
                    >
                      <Play className="w-3 h-3 fill-current" />
                      <span>Deploy {stat.component} to {stat.driftingCount} Drifting Nodes</span>
                    </button>
                  ) : (
                    <div className="py-2 text-center text-xs text-emerald-600 font-medium flex items-center justify-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>All Nodes On Baseline</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Security Advisory Center */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs space-y-4">
        <div className="flex items-center space-x-3">
          <ShieldAlert className="w-5 h-5 text-amber-600" />
          <div>
            <h3 className="text-sm font-bold text-slate-900">Security Advisory CVE Mitigation Matrix</h3>
            <p className="text-xs text-slate-500">
              Hardware microcode and firmware errata tracked against current fleet inventory.
            </p>
          </div>
        </div>

        <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden text-xs">
          <div className="p-4 bg-slate-50/70 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-bold text-red-800 font-mono text-[12px]">CVE-2026-21340</span>
                <span className="px-2 py-0.2 rounded-full bg-red-100 text-red-800 text-[10px] font-bold">
                  CVSS 8.8 High
                </span>
                <span className="text-slate-500">Intel SMM Microcode Memory Corruption</span>
              </div>
              <p className="text-slate-600 mt-1">
                Affects Dell R750 / HPE DL380 systems running BIOS prior to v2.20.0 / v2.92. Allows privilege escalation to System Management Mode.
              </p>
            </div>
            <button
              type="button"
              onClick={() => onRemediateComponentDrift('BIOS')}
              className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg font-semibold shrink-0"
            >
              Remediate via BIOS 2.20.0
            </button>
          </div>

          <div className="p-4 bg-slate-50/70 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-bold text-amber-800 font-mono text-[12px]">CVE-2026-19401</span>
                <span className="px-2 py-0.2 rounded-full bg-amber-100 text-amber-800 text-[10px] font-bold">
                  CVSS 7.5 Medium
                </span>
                <span className="text-slate-500">Redfish REST API OpenSSL Buffer Overflow</span>
              </div>
              <p className="text-slate-600 mt-1">
                Affects Dell iDRAC9 prior to v7.00.00.00. Resolves remote unauthenticated crash of Out-of-Band management controller.
              </p>
            </div>
            <button
              type="button"
              onClick={() => onRemediateComponentDrift('BMC')}
              className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-semibold shrink-0"
            >
              Remediate via iDRAC 7.00.00
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
