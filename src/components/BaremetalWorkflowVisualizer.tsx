import React from 'react';
import {
  FileText,
  Network,
  Disc,
  Cpu,
  Rocket,
  Check,
  ChevronRight,
  ShieldCheck,
  Server,
  Zap,
  Radio
} from 'lucide-react';
import { BaremetalVendor } from '../types';

export interface WorkflowStepData {
  ritmNumber?: string;
  esxiName?: string;
  hostIp?: string;
  hostMask?: string;
  vmotionIp?: string;
  vmotionMask?: string;
  dnsIps?: string[];
  selectedIsoName?: string;
  isoFileName?: string;
  isoVersion?: string;
  selectedVendor?: BaremetalVendor;
  vendor?: BaremetalVendor;
  hardwareModel?: string;
  bmcIp?: string;
}

interface BaremetalWorkflowVisualizerProps {
  currentStep: 1 | 2 | 3 | 4 | 5;
  onSelectStep: (step: 1 | 2 | 3 | 4 | 5) => void;
  data: WorkflowStepData;
  isDeploying?: boolean;
}

export const BaremetalWorkflowVisualizer: React.FC<BaremetalWorkflowVisualizerProps> = ({
  currentStep,
  onSelectStep,
  data,
  isDeploying = false
}) => {
  const effectiveVendor = data.selectedVendor || data.vendor || 'DELL';
  const effectiveIsoName = data.selectedIsoName || data.isoFileName || '';
  const effectiveDns = Array.isArray(data.dnsIps) ? data.dnsIps : [];

  const steps = [
    {
      step: 1 as const,
      id: 'step-ritm',
      title: '1. RITM # Ticket',
      subtitle: 'Change Request Reference',
      icon: FileText,
      summary: data.ritmNumber ? (
        <div className="flex items-center gap-1 font-mono text-[11px] text-indigo-700 font-bold bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200/60 truncate">
          <span>{data.ritmNumber}</span>
        </div>
      ) : (
        <span className="text-[11px] text-amber-600 font-medium italic">Enter RITM #</span>
      ),
      isComplete: Boolean(data.ritmNumber && data.ritmNumber.trim().length > 2)
    },
    {
      step: 2 as const,
      id: 'step-form',
      title: '2. ESXi Network Form',
      subtitle: 'Host, IP, vMotion & DNS',
      icon: Network,
      summary: (
        <div className="space-y-1 text-[11px]">
          <div className="font-mono text-slate-800 font-semibold truncate" title={data.esxiName}>
            {data.esxiName || 'Pending Name'}
          </div>
          <div className="flex flex-wrap items-center gap-1 font-mono text-[10px] text-slate-600">
            <span className="bg-slate-100 px-1.5 py-0.5 rounded text-slate-700">
              IP: {data.hostIp || '---'}
            </span>
            <span className="bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded">
              vMotion: {data.vmotionIp || '---'}
            </span>
            <span className="bg-purple-50 text-purple-700 px-1.5 py-0.5 rounded">
              DNS: {effectiveDns.length > 0 ? effectiveDns.join(', ') : 'None'}
            </span>
          </div>
        </div>
      ),
      isComplete: Boolean(data.esxiName && data.hostIp && data.vmotionIp && effectiveDns.length > 0)
    },
    {
      step: 3 as const,
      id: 'step-version',
      title: '3. ESXi Version',
      subtitle: 'Stored App ISO Catalog',
      icon: Disc,
      summary: (
        <div className="text-[11px] font-mono text-slate-700 bg-slate-100 p-1.5 rounded border border-slate-200/60 truncate" title={effectiveIsoName || 'Pending ISO'}>
          {effectiveIsoName
            ? (effectiveIsoName.includes('8.0U3')
                ? 'ESXi 8.0U3 (GA Build)'
                : effectiveIsoName.includes('8.0U2')
                ? 'ESXi 8.0U2 (OEM Certified)'
                : effectiveIsoName.includes('7.0U3')
                ? 'ESXi 7.0U3 (Enterprise)'
                : effectiveIsoName)
            : 'Pending ISO Selection'}
        </div>
      ),
      isComplete: Boolean(effectiveIsoName)
    },
    {
      step: 4 as const,
      id: 'step-hardware',
      title: '4. Hardware Model',
      subtitle: effectiveVendor === 'DELL' ? 'DELL: deploy with DELL OME' : 'LENOVO: deploy with LXCA',
      icon: Cpu,
      summary: (
        <div className="space-y-1 text-[11px]">
          <div className="flex items-center gap-1.5">
            <span className={`px-1.5 py-0.2 rounded text-[10px] font-bold uppercase tracking-wider ${
              effectiveVendor === 'DELL' ? 'bg-blue-100 text-blue-800' : 'bg-emerald-100 text-emerald-800'
            }`}>
              {effectiveVendor === 'DELL' ? 'DELL OME' : 'LENOVO LXCA'}
            </span>
            <span className="font-semibold text-slate-800 truncate">{data.hardwareModel || 'Select Node'}</span>
          </div>
          <div className="text-[10px] font-mono text-slate-500">
            BMC: {data.bmcIp || '---'}
          </div>
        </div>
      ),
      isComplete: Boolean(data.hardwareModel && data.bmcIp)
    },
    {
      step: 5 as const,
      id: 'step-launch',
      title: '5. Launch & Output',
      subtitle: 'Preflight & Automation',
      icon: Rocket,
      summary: (
        <div className="flex items-center gap-1.5 text-[11px]">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
          <span className="font-semibold text-emerald-700">Preflight Gates Ready</span>
        </div>
      ),
      isComplete: currentStep === 5
    }
  ];

  return (
    <div className="bg-slate-50/80 rounded-xl border border-slate-200 p-4 space-y-4 shadow-xs">
      {/* Workflow Header */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-200">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-indigo-600 text-white flex items-center justify-center shadow-xs">
            <Zap className="w-3.5 h-3.5" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-slate-900 tracking-tight">JOB WORKFLOW</h3>
            <p className="text-[10px] text-slate-500">Visual Execution Pipeline</p>
          </div>
        </div>
        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800 font-mono">
          Step {currentStep} of 5
        </span>
      </div>

      {/* Visual Workflow Steps Column with Vertical Connectors */}
      <div className="space-y-2 relative">
        {steps.map((s, idx) => {
          const StepIcon = s.icon;
          const isActive = currentStep === s.step;
          const isPast = currentStep > s.step;
          const isClickable = true;

          return (
            <div key={s.id} className="relative">
              {/* Vertical connector track */}
              {idx < steps.length - 1 && (
                <div
                  className={`absolute left-4 top-8 -bottom-3 w-0.5 transition-colors z-0 ${
                    currentStep > s.step ? 'bg-emerald-500' : 'bg-slate-200'
                  }`}
                />
              )}

              {/* Step Card */}
              <button
                type="button"
                id={`workflow-nav-${s.step}`}
                onClick={() => isClickable && onSelectStep(s.step)}
                className={`w-full text-left p-2.5 rounded-xl border transition-all relative z-10 ${
                  isActive
                    ? 'bg-white border-indigo-600 shadow-sm ring-2 ring-indigo-500/20'
                    : isPast
                    ? 'bg-white/90 border-emerald-200/80 hover:border-slate-300'
                    : 'bg-white/60 border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="flex items-start gap-2.5">
                  {/* Step State Badge Icon */}
                  <div className="pt-0.5">
                    <span
                      className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                        isActive
                          ? 'bg-indigo-600 text-white shadow-xs ring-4 ring-indigo-100'
                          : isPast
                          ? 'bg-emerald-600 text-white'
                          : 'bg-slate-100 text-slate-600 border border-slate-300'
                      }`}
                    >
                      {isPast ? <Check className="w-4 h-4 stroke-[2.5]" /> : s.step}
                    </span>
                  </div>

                  {/* Step Text & Live Summary */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <span className={`text-xs font-bold truncate ${isActive ? 'text-indigo-900' : 'text-slate-800'}`}>
                        {s.title}
                      </span>
                      {isActive && (
                        <span className="w-2 h-2 rounded-full bg-indigo-600 animate-ping shrink-0" />
                      )}
                    </div>
                    <p className="text-[10px] text-slate-500 truncate mb-1.5">{s.subtitle}</p>

                    {/* Step Micro Summary */}
                    <div className="mt-1">{s.summary}</div>
                  </div>
                </div>
              </button>
            </div>
          );
        })}
      </div>

      {/* Orchestration Automation Footer Info */}
      <div className="pt-2 border-t border-slate-200 space-y-2 text-[11px]">
        <div className="flex items-center justify-between text-slate-600">
          <span className="font-medium">Orchestrator:</span>
          <span className="font-bold text-slate-800">
            {effectiveVendor === 'DELL' ? 'Dell OME v4.1' : 'Lenovo LXCA v4.0'}
          </span>
        </div>

        <div className="flex items-center justify-between text-slate-600">
          <span className="font-medium">Zero-Touch:</span>
          <span className="font-bold text-emerald-700 flex items-center gap-1">
            <Radio className="w-3 h-3 text-emerald-600 animate-pulse" />
            Unattended Redfish
          </span>
        </div>

        <div className="flex items-center justify-between text-slate-600 font-mono text-[10px]">
          <span>BMC Endpoint:</span>
          <span className="text-indigo-600 font-semibold">{data.bmcIp || '192.168.10.120'}:443</span>
        </div>
      </div>
    </div>
  );
};
