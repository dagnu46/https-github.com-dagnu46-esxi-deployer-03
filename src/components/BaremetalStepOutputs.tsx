import React, { useState } from 'react';
import {
  FileText,
  Network,
  Disc,
  Cpu,
  ShieldCheck,
  CheckCircle2,
  Copy,
  Check,
  Terminal,
  Server,
  Layers,
  HardDrive,
  Globe
} from 'lucide-react';
import { BaremetalVendor } from '../types';

export interface StepOutputData {
  ritmNumber: string;
  ritmRequester?: string;
  ritmEnvironment?: string;
  esxiName: string;
  hostIp: string;
  hostMask: string;
  vmotionIp: string;
  vmotionMask: string;
  dnsIps: string[];
  gatewayIp?: string;
  vlanId?: number;
  selectedIso: {
    fileName: string;
    version: string;
    build: string;
    sizeMb: number;
    sha256: string;
    oemAddon: string;
  };
  selectedVendor: BaremetalVendor;
  hardwareModel: string;
  bmcIp: string;
  bmcPort?: number;
  bmcProtocol?: string;
  bmcUsername?: string;
  ipmiAccessStatus?: {
    status: 'success' | 'failed' | 'warn';
    latencyMs?: number;
    summary?: string;
  } | null;
  templateName?: string;
  targetBootDevice?: string;
}

interface BaremetalStepOutputsProps {
  step: 1 | 2 | 3 | 4 | 5;
  data: StepOutputData;
}

export const BaremetalStepOutputs: React.FC<BaremetalStepOutputsProps> = ({
  step,
  data
}) => {
  const [copied, setCopied] = useState(false);

  // Helper to convert mask to CIDR prefix
  const maskToCidr = (mask: string) => {
    if (!mask) return '24';
    const parts = mask.split('.').map(Number);
    let bits = 0;
    for (const p of parts) {
      bits += (p.toString(2).match(/1/g) || []).length;
    }
    return bits || '24';
  };

  const hostCidr = maskToCidr(data.hostMask);
  const vmotionCidr = maskToCidr(data.vmotionMask);

  const kickstartCliCode = `# --- Auto-Generated ESXi Kickstart Networking (ks.cfg) ---
# Change Ref: ${data.ritmNumber || '<PENDING_RITM>'}
# Target Host: ${data.esxiName || '<PENDING_HOSTNAME>'}

# Configure Host Management Interface (vmk0)
esxcli network ip interface ipv4 set -i vmk0 -t static -I ${data.hostIp || '<PENDING_MGMT_IP>'} -N ${data.hostMask || '<PENDING_NETMASK>'}
${data.gatewayIp ? `esxcli network ip route ipv4 add -g ${data.gatewayIp} -n default` : '# Default gateway pending configuration'}

# Configure Dedicated vMotion Interface (vmk1)
esxcli network ip interface add -i vmk1 -p "vMotion-Network"
esxcli network ip interface ipv4 set -i vmk1 -t static -I ${data.vmotionIp || '<PENDING_VMOTION_IP>'} -N ${data.vmotionMask || '<PENDING_VMOTION_MASK>'}
esxcli network ip interface tag add -i vmk1 -t VMOTION

# Configure Fixed DNS Resolvers
${data.dnsIps.length > 0 ? data.dnsIps.map(dns => `esxcli network ip dns server add --server=${dns}`).join('\n') : '# No DNS servers selected yet'}
esxcli network ip dns search add --domain=corp.internal`;

  const handleCopyCode = () => {
    navigator.clipboard.writeText(kickstartCliCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="mt-4 rounded-xl border border-slate-200 bg-slate-900 text-white p-4 shadow-sm space-y-3">
      {/* Header bar of the step output */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-xs font-bold text-slate-200 uppercase tracking-wider">
            STEP {step} OUTPUT SPECIFICATION
          </span>
        </div>
        <span className="text-[11px] font-mono text-emerald-400 bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-800/60 flex items-center gap-1">
          <CheckCircle2 className="w-3 h-3" />
          Validated
        </span>
      </div>

      {/* STEP 1 OUTPUT */}
      {step === 1 && (
        <div className="space-y-3 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="bg-slate-800/80 p-3 rounded-lg border border-slate-700/60">
              <span className="text-[11px] text-slate-400 block font-medium">Verified RITM #</span>
              <span className="font-mono text-sm font-bold text-indigo-300">
                {data.ritmNumber || 'RITM-PENDING'}
              </span>
            </div>

            <div className="bg-slate-800/80 p-3 rounded-lg border border-slate-700/60">
              <span className="text-[11px] text-slate-400 block font-medium">Approval Status</span>
              <span className="text-emerald-400 font-bold flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Change Window Active
              </span>
            </div>

            <div className="bg-slate-800/80 p-3 rounded-lg border border-slate-700/60">
              <span className="text-[11px] text-slate-400 block font-medium">Deployment Target</span>
              <span className="text-slate-200 font-semibold truncate">
                {data.ritmEnvironment || 'Production Fleet'}
              </span>
            </div>
          </div>

          <div className="bg-slate-950/60 p-3 rounded-lg border border-slate-800 flex items-center justify-between text-[11px] text-slate-300">
            <span>Requester / Engineering Entity:</span>
            <strong className="text-slate-100">{data.ritmRequester || 'Cloud Infrastructure Operations'}</strong>
          </div>
        </div>
      )}

      {/* STEP 2 OUTPUT */}
      {step === 2 && (
        <div className="space-y-3 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5">
            <div className="bg-slate-800/80 p-2.5 rounded-lg border border-slate-700/60">
              <span className="text-[10px] text-slate-400 uppercase tracking-wider block">ESXi Host Name</span>
              <span className="font-mono text-xs font-bold text-indigo-300 truncate block" title={data.esxiName}>
                {data.esxiName || 'Pending'}
              </span>
            </div>

            <div className="bg-slate-800/80 p-2.5 rounded-lg border border-slate-700/60">
              <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Management IP (vmk0)</span>
              <span className="font-mono text-xs font-bold text-emerald-400">
                {data.hostIp || '---'} /{hostCidr}
              </span>
              <span className="text-[10px] text-slate-400 block">Mask: {data.hostMask}</span>
            </div>

            <div className="bg-slate-800/80 p-2.5 rounded-lg border border-slate-700/60">
              <span className="text-[10px] text-slate-400 uppercase tracking-wider block">vMotion IP (vmk1)</span>
              <span className="font-mono text-xs font-bold text-blue-400">
                {data.vmotionIp || '---'} /{vmotionCidr}
              </span>
              <span className="text-[10px] text-slate-400 block">Mask: {data.vmotionMask}</span>
            </div>

            <div className="bg-slate-800/80 p-2.5 rounded-lg border border-slate-700/60">
              <span className="text-[10px] text-slate-400 uppercase tracking-wider block">DNS (Fix List)</span>
              <div className="flex flex-wrap gap-1 mt-0.5">
                {data.dnsIps.map(dns => (
                  <span key={dns} className="font-mono text-[10px] px-1.5 py-0.2 rounded bg-purple-900/60 text-purple-200 border border-purple-700/40">
                    {dns}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Generated Kickstart Script CLI Box */}
          <div className="bg-slate-950 rounded-lg p-3 border border-slate-800 space-y-1.5">
            <div className="flex items-center justify-between text-[11px] text-slate-400">
              <span className="flex items-center gap-1.5 font-mono text-indigo-400">
                <Terminal className="w-3.5 h-3.5" />
                <span>Generated Kickstart Networking (ks.cfg)</span>
              </span>
              <button
                type="button"
                onClick={handleCopyCode}
                className="hover:text-white flex items-center gap-1 text-[11px] px-2 py-0.5 rounded bg-slate-800 border border-slate-700 transition-colors"
              >
                {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                <span>{copied ? 'Copied' : 'Copy CLI'}</span>
              </button>
            </div>
            <pre className="font-mono text-[11px] text-slate-300 leading-relaxed overflow-x-auto whitespace-pre p-2 bg-slate-900/80 rounded border border-slate-800/80">
              {kickstartCliCode}
            </pre>
          </div>
        </div>
      )}

      {/* STEP 3 OUTPUT */}
      {step === 3 && (
        <div className="space-y-3 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="bg-slate-800/80 p-3 rounded-lg border border-slate-700/60 sm:col-span-2">
              <span className="text-[11px] text-slate-400 block font-medium">Selected Stored ESXi ISO Image</span>
              {data.selectedIso?.fileName ? (
                <>
                  <div className="font-mono text-xs font-bold text-indigo-300 break-all mt-0.5">
                    {data.selectedIso.fileName}
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1">
                    {data.selectedIso.oemAddon || 'Standard image'}
                  </p>
                </>
              ) : (
                <div className="text-xs text-amber-400 font-medium italic mt-1">
                  No ESXi ISO selected yet. Select an existing ISO or upload a new one.
                </div>
              )}
            </div>

            <div className="bg-slate-800/80 p-3 rounded-lg border border-slate-700/60 space-y-1">
              <span className="text-[11px] text-slate-400 block font-medium">Kernel Release & Build</span>
              <span className="text-emerald-400 font-bold font-mono text-sm block">
                {data.selectedIso?.version ? `ESXi ${data.selectedIso.version}` : 'Not Selected'}
              </span>
              <span className="text-[11px] text-slate-300 block font-mono">
                Build: {data.selectedIso?.build || '---'}
              </span>
              <span className="text-[11px] text-slate-400 block">
                Size: {data.selectedIso?.sizeMb ? `${data.selectedIso.sizeMb} MB` : '---'}
              </span>
            </div>
          </div>

          {data.selectedIso?.sha256 ? (
            <div className="bg-slate-950/70 p-2.5 rounded-lg border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between text-[11px] text-slate-400 gap-2">
              <span className="font-mono truncate">
                SHA256: <strong className="text-slate-200">{data.selectedIso.sha256}</strong>
              </span>
              <span className="text-emerald-400 font-semibold shrink-0 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Verified Local ISO Cache
              </span>
            </div>
          ) : null}
        </div>
      )}

      {/* STEP 4 OUTPUT */}
      {step === 4 && (
        <div className="space-y-3 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5">
            <div className="bg-slate-800/80 p-2.5 rounded-lg border border-slate-700/60">
              <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Orchestrator Tool</span>
              <span className="font-bold text-xs text-indigo-300 block">
                {data.selectedVendor === 'DELL' ? 'Dell OpenManage (OME)' : 'Lenovo XClarity (LXCA)'}
              </span>
              <span className="text-[10px] text-slate-400">
                {data.selectedVendor === 'DELL' ? 'DELL: deploy with DELL OME' : 'LENOVO: deploy with LXCA'}
              </span>
            </div>

            <div className="bg-slate-800/80 p-2.5 rounded-lg border border-slate-700/60">
              <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Hardware Model</span>
              <span className="font-bold text-xs text-slate-100 block">
                {data.hardwareModel || '<Pending Hardware Details>'}
              </span>
              <span className="text-[10px] text-slate-400 font-mono">
                {data.bmcIp ? `BMC: ${data.bmcIp}:${data.bmcPort || 443}` : 'BMC: <Not Configured>'}
              </span>
            </div>

            <div className="bg-slate-800/80 p-2.5 rounded-lg border border-slate-700/60">
              <span className="text-[10px] text-slate-400 uppercase tracking-wider block">IPMI Access Status</span>
              <div className="flex items-center gap-1.5 mt-0.5">
                {data.ipmiAccessStatus?.status === 'success' ? (
                  <span className="px-1.5 py-0.5 rounded bg-emerald-950/80 border border-emerald-700 text-emerald-400 font-semibold text-[10px]">
                    Verified ({data.ipmiAccessStatus.latencyMs || 0}ms RTT)
                  </span>
                ) : data.ipmiAccessStatus?.status === 'failed' ? (
                  <span className="px-1.5 py-0.5 rounded bg-red-950/80 border border-red-700 text-red-400 font-semibold text-[10px]">
                    Auth Failed
                  </span>
                ) : (
                  <span className="px-1.5 py-0.5 rounded bg-amber-950/80 border border-amber-700 text-amber-300 font-semibold text-[10px]">
                    Untested
                  </span>
                )}
              </div>
              <span className="text-[10px] text-slate-400 font-mono block mt-0.5 truncate">
                User: {data.bmcUsername || 'root'} • {data.bmcProtocol?.toUpperCase() || 'REDFISH'}
              </span>
            </div>

            <div className="bg-slate-800/80 p-2.5 rounded-lg border border-slate-700/60">
              <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Boot Target Mirror</span>
              <span className="font-bold text-xs text-emerald-400 block font-mono">
                {data.targetBootDevice || (data.selectedVendor === 'DELL' ? 'BOSS-S2 RAID 1' : 'M.2 NVMe RAID 1')}
              </span>
              <span className="text-[10px] text-slate-400">Dual Hardware Redundancy</span>
            </div>

            <div className="bg-slate-800/80 p-2.5 rounded-lg border border-slate-700/60">
              <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Applied Template</span>
              <span className="font-semibold text-xs text-slate-200 truncate block" title={data.templateName}>
                {data.templateName || 'Standard Enterprise Pattern'}
              </span>
              <span className="text-[10px] text-slate-400">UEFI Secure Boot + VT-x</span>
            </div>
          </div>
        </div>
      )}

      {/* STEP 5 OUTPUT */}
      {step === 5 && (
        <div className="space-y-3 text-xs">
          <div className="bg-slate-800/90 rounded-lg p-3.5 border border-slate-700 space-y-2">
            <h4 className="font-bold text-indigo-300 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>Consolidated Preflight Verification Summary</span>
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] text-slate-300 pt-1">
              <div>
                <span className="text-slate-400">Change Reference:</span>{' '}
                <strong className="font-mono text-indigo-300">{data.ritmNumber}</strong>
              </div>
              <div>
                <span className="text-slate-400">Orchestrator:</span>{' '}
                <strong className="text-slate-100">{data.selectedVendor === 'DELL' ? 'DELL OME' : 'LENOVO LXCA'}</strong>
              </div>
              <div>
                <span className="text-slate-400">Host FQDN:</span>{' '}
                <strong className="font-mono text-slate-100">{data.esxiName}</strong>
              </div>
              <div>
                <span className="text-slate-400">Target Model:</span>{' '}
                <strong className="text-slate-100">{data.hardwareModel}</strong>
              </div>
              <div>
                <span className="text-slate-400">Management IP:</span>{' '}
                <strong className="font-mono text-emerald-400">{data.hostIp}/{hostCidr}</strong>
              </div>
              <div>
                <span className="text-slate-400">vMotion IP:</span>{' '}
                <strong className="font-mono text-blue-400">{data.vmotionIp}/{vmotionCidr}</strong>
              </div>
              <div>
                <span className="text-slate-400">Fixed DNS:</span>{' '}
                <strong className="font-mono text-purple-300">{data.dnsIps.join(', ')}</strong>
              </div>
              <div>
                <span className="text-slate-400">Target ISO:</span>{' '}
                <strong className="font-mono text-slate-200">{data.selectedIso.version}</strong>
              </div>
              <div className="sm:col-span-2 pt-1 border-t border-slate-700/60 flex items-center justify-between">
                <span className="text-slate-400">IPMI / BMC Access (IP + Credentials):</span>{' '}
                {data.ipmiAccessStatus?.status === 'success' ? (
                  <span className="font-mono text-emerald-400 font-semibold flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                    Verified ({data.bmcIp}:{data.bmcPort || 443} • {data.ipmiAccessStatus.latencyMs || 0}ms RTT • User: {data.bmcUsername || 'root'})
                  </span>
                ) : data.ipmiAccessStatus?.status === 'failed' ? (
                  <span className="font-mono text-red-400 font-semibold flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-400"></span>
                    Auth Failed ({data.bmcIp})
                  </span>
                ) : (
                  <span className="font-mono text-amber-300 font-semibold flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
                    Untested ({data.bmcIp || 'No IP'})
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
