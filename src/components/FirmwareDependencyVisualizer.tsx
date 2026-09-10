import React, { useState, useMemo } from 'react';
import { 
  Layers, 
  Cpu, 
  Server as ServerIcon, 
  Wifi, 
  HardDrive, 
  Activity, 
  AlertTriangle, 
  CheckCircle2, 
  XCircle, 
  Info, 
  ArrowRight, 
  ShieldAlert, 
  Zap, 
  Search, 
  Filter, 
  RefreshCw, 
  Check, 
  Play, 
  ChevronRight,
  Sparkles,
  HelpCircle,
  Clock
} from 'lucide-react';
import { 
  ComponentType, 
  FirmwarePackage, 
  Server, 
  ServerVendor, 
  ComponentDependencyRule 
} from '../types';
import { 
  FIRMWARE_DEPENDENCY_RULES, 
  evaluateUpgradeCompatibility,
  CompatibilityCheckResult 
} from '../data/firmwareDependencies';

interface FirmwareDependencyVisualizerProps {
  packages: FirmwarePackage[];
  servers: Server[];
  onDeployPackage?: (pkg: FirmwarePackage) => void;
  onSelectServer?: (server: Server) => void;
}

interface GraphNode {
  id: string;
  label: string;
  component: ComponentType | 'Hypervisor';
  vendor: ServerVendor | 'COMMON';
  version: string;
  x: number;
  y: number;
  description: string;
  icon: React.ReactNode;
}

interface GraphLink {
  id: string;
  sourceId: string;
  targetId: string;
  criticality: 'blocking' | 'required' | 'recommended';
  label: string;
  rule: ComponentDependencyRule;
}

export const FirmwareDependencyVisualizer: React.FC<FirmwareDependencyVisualizerProps> = ({
  packages,
  servers,
  onDeployPackage,
  onSelectServer
}) => {
  const [selectedVendor, setSelectedVendor] = useState<ServerVendor | 'ALL'>('ALL');
  const [selectedComponent, setSelectedComponent] = useState<ComponentType | 'ALL'>('ALL');
  const [activeTab, setActiveTab] = useState<'graph' | 'matrix' | 'simulator' | 'sequence'>('graph');
  
  // Graph interaction state
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>('node-dell-bios');
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [selectedRuleId, setSelectedRuleId] = useState<string | null>(null);

  // Simulator state
  const [simServerId, setSimServerId] = useState<string>(servers[0]?.id || '');
  const [simPackageId, setSimPackageId] = useState<string>(packages[0]?.id || '');

  // Filter rules based on vendor & component
  const filteredRules = useMemo(() => {
    return FIRMWARE_DEPENDENCY_RULES.filter(rule => {
      const matchVendor = selectedVendor === 'ALL' || rule.vendor === 'ALL' || rule.vendor === selectedVendor;
      const matchComp = selectedComponent === 'ALL' || rule.sourceComponent === selectedComponent || rule.targetComponent === selectedComponent;
      return matchVendor && matchComp;
    });
  }, [selectedVendor, selectedComponent]);

  // Define standard layout nodes for graph
  const nodes: GraphNode[] = useMemo(() => {
    // 3 vendor tracks or unified view
    const list: GraphNode[] = [
      // Dell Nodes
      {
        id: 'node-dell-bmc',
        label: 'iDRAC9 Controller',
        component: 'BMC',
        vendor: 'DELL',
        version: 'v7.00.00 / min 6.10',
        x: 140,
        y: 80,
        description: 'Out-of-Band Baseboard Management Controller managing chassis power and SMM telemetry.',
        icon: <ServerIcon className="w-5 h-5 text-purple-600" />
      },
      {
        id: 'node-dell-bios',
        label: 'PowerEdge UEFI BIOS',
        component: 'BIOS',
        vendor: 'DELL',
        version: 'v2.20.0',
        x: 400,
        y: 80,
        description: 'System ROM / UEFI initialization engine. Dispatches microcode and configures PCIe buses.',
        icon: <Cpu className="w-5 h-5 text-indigo-600" />
      },
      {
        id: 'node-dell-raid',
        label: 'PERC H755 / H755N RAID',
        component: 'RAID',
        vendor: 'DELL',
        version: 'v52.16.1',
        x: 680,
        y: 50,
        description: 'Tri-Mode SAS/NVMe enterprise hardware RAID and storage controller.',
        icon: <HardDrive className="w-5 h-5 text-amber-600" />
      },
      {
        id: 'node-dell-nic',
        label: 'ConnectX-6 Dx Dual 100GbE',
        component: 'NIC',
        vendor: 'DELL',
        version: 'v22.39.1002',
        x: 680,
        y: 160,
        description: 'High-speed network interface card providing RoCE v2 and SR-IOV offloads.',
        icon: <Wifi className="w-5 h-5 text-sky-600" />
      },
      {
        id: 'node-dell-nvme',
        label: 'Kioxia / Solidigm U.3 SSD',
        component: 'NVMe',
        vendor: 'DELL',
        version: 'v1.3.0',
        x: 940,
        y: 50,
        description: 'Enterprise NVMe U.3 Solid State Drive media firmware.',
        icon: <HardDrive className="w-5 h-5 text-emerald-600" />
      },

      // HP Nodes
      {
        id: 'node-hp-bmc',
        label: 'HPE iLO 5',
        component: 'BMC',
        vendor: 'HP',
        version: 'v2.98 / min 2.90',
        x: 140,
        y: 290,
        description: 'HPE Integrated Lights-Out 5 with Silicon Root of Trust and RESTful API.',
        icon: <ServerIcon className="w-5 h-5 text-purple-600" />
      },
      {
        id: 'node-hp-bios',
        label: 'HPE System ROM (UEFI)',
        component: 'BIOS',
        vendor: 'HP',
        version: 'v2.92',
        x: 400,
        y: 290,
        description: 'ProLiant Gen10/Gen11 UEFI firmware engine for memory and security init.',
        icon: <Cpu className="w-5 h-5 text-indigo-600" />
      },
      {
        id: 'node-hp-raid',
        label: 'Smart Array P408i-a',
        component: 'RAID',
        vendor: 'HP',
        version: 'v5.10',
        x: 680,
        y: 260,
        description: 'Enterprise modular storage controller with battery-backed cache.',
        icon: <HardDrive className="w-5 h-5 text-amber-600" />
      },
      {
        id: 'node-hp-nic',
        label: 'HPE 100GbE 2-port Adapter',
        component: 'NIC',
        vendor: 'HP',
        version: 'v22.36.1010',
        x: 680,
        y: 370,
        description: 'Dual-port 100GbE PCIe Gen4 network adapter.',
        icon: <Wifi className="w-5 h-5 text-sky-600" />
      },

      // Lenovo Nodes
      {
        id: 'node-lenovo-bmc',
        label: 'Lenovo XClarity (XCC)',
        component: 'BMC',
        vendor: 'LENOVO',
        version: 'v4.40 / min 4.20',
        x: 140,
        y: 500,
        description: 'Lenovo ThinkSystem BMC providing out-of-band management and secure boot authentication.',
        icon: <ServerIcon className="w-5 h-5 text-purple-600" />
      },
      {
        id: 'node-lenovo-bios',
        label: 'ThinkSystem UEFI BIOS',
        component: 'BIOS',
        vendor: 'LENOVO',
        version: 'v3.40 (IVE182M)',
        x: 400,
        y: 500,
        description: 'Lenovo system firmware with Intel TXT and TPM 2.0 measurement.',
        icon: <Cpu className="w-5 h-5 text-indigo-600" />
      },
      {
        id: 'node-lenovo-raid',
        label: 'ThinkSystem RAID 930-8i',
        component: 'RAID',
        vendor: 'LENOVO',
        version: 'v52.16.0',
        x: 680,
        y: 470,
        description: 'MegaRAID based 12Gb SAS/SATA/NVMe controller.',
        icon: <HardDrive className="w-5 h-5 text-amber-600" />
      },
      {
        id: 'node-lenovo-nic',
        label: 'ThinkSystem 25G/100G NIC',
        component: 'NIC',
        vendor: 'LENOVO',
        version: 'v22.30.1000',
        x: 680,
        y: 580,
        description: 'PCIe low latency network adapter.',
        icon: <Wifi className="w-5 h-5 text-sky-600" />
      },

      // Hypervisors Column
      {
        id: 'node-hypervisor-esxi',
        label: 'VMware ESXi 8.0u2',
        component: 'Hypervisor',
        vendor: 'COMMON',
        version: 'Build 22380479',
        x: 940,
        y: 200,
        description: 'Type-1 bare metal hypervisor running guest VM workloads.',
        icon: <Activity className="w-5 h-5 text-emerald-600" />
      },
      {
        id: 'node-hypervisor-nutanix',
        label: 'VMware ESXi on Nutanix',
        component: 'Hypervisor',
        vendor: 'COMMON',
        version: 'AOS 6.5.5 LTS',
        x: 940,
        y: 330,
        description: 'Hyperconverged storage clustering running VMware ESXi over Nutanix CVM pass-through.',
        icon: <Activity className="w-5 h-5 text-indigo-600" />
      },
      {
        id: 'node-hypervisor-xen',
        label: 'Xen Server 8.2',
        component: 'Hypervisor',
        vendor: 'COMMON',
        version: 'Release 8.2 CU1',
        x: 940,
        y: 470,
        description: 'Citrix / XCP-ng enterprise hypervisor pool.',
        icon: <Activity className="w-5 h-5 text-sky-600" />
      }
    ];

    if (selectedVendor === 'ALL') return list;
    return list.filter(n => n.vendor === 'COMMON' || n.vendor === selectedVendor);
  }, [selectedVendor]);

  // Links connecting the nodes
  const links: GraphLink[] = useMemo(() => {
    const list: GraphLink[] = [
      // Dell links
      {
        id: 'link-dell-bios-bmc',
        sourceId: 'node-dell-bios',
        targetId: 'node-dell-bmc',
        criticality: 'blocking',
        label: 'requires iDRAC9 ≥ 6.10',
        rule: FIRMWARE_DEPENDENCY_RULES[0]
      },
      {
        id: 'link-dell-nic-bios',
        sourceId: 'node-dell-nic',
        targetId: 'node-dell-bios',
        criticality: 'blocking',
        label: 'requires BIOS ≥ 2.18.0',
        rule: FIRMWARE_DEPENDENCY_RULES[1]
      },
      {
        id: 'link-dell-raid-bmc',
        sourceId: 'node-dell-raid',
        targetId: 'node-dell-bmc',
        criticality: 'required',
        label: 'requires iDRAC9 ≥ 6.00',
        rule: FIRMWARE_DEPENDENCY_RULES[2]
      },
      {
        id: 'link-dell-nvme-raid',
        sourceId: 'node-dell-nvme',
        targetId: 'node-dell-raid',
        criticality: 'recommended',
        label: 'requires PERC ≥ 52.14',
        rule: FIRMWARE_DEPENDENCY_RULES[3]
      },

      // HP links
      {
        id: 'link-hp-bios-bmc',
        sourceId: 'node-hp-bios',
        targetId: 'node-hp-bmc',
        criticality: 'blocking',
        label: 'requires iLO 5 ≥ 2.90',
        rule: FIRMWARE_DEPENDENCY_RULES[5]
      },
      {
        id: 'link-hp-nic-bios',
        sourceId: 'node-hp-nic',
        targetId: 'node-hp-bios',
        criticality: 'blocking',
        label: 'requires ROM ≥ 2.80',
        rule: FIRMWARE_DEPENDENCY_RULES[6]
      },
      {
        id: 'link-hp-raid-bmc',
        sourceId: 'node-hp-raid',
        targetId: 'node-hp-bmc',
        criticality: 'required',
        label: 'requires iLO 5 ≥ 2.70',
        rule: FIRMWARE_DEPENDENCY_RULES[7]
      },

      // Lenovo links
      {
        id: 'link-lenovo-bios-bmc',
        sourceId: 'node-lenovo-bios',
        targetId: 'node-lenovo-bmc',
        criticality: 'blocking',
        label: 'requires XCC ≥ 4.20',
        rule: FIRMWARE_DEPENDENCY_RULES[8]
      },
      {
        id: 'link-lenovo-nic-bios',
        sourceId: 'node-lenovo-nic',
        targetId: 'node-lenovo-bios',
        criticality: 'blocking',
        label: 'requires BIOS ≥ 3.10',
        rule: FIRMWARE_DEPENDENCY_RULES[9]
      },
      {
        id: 'link-lenovo-raid-bios',
        sourceId: 'node-lenovo-raid',
        targetId: 'node-lenovo-bios',
        criticality: 'required',
        label: 'requires BIOS ≥ 3.00',
        rule: FIRMWARE_DEPENDENCY_RULES[10]
      },

      // Hypervisor links
      {
        id: 'link-dell-bios-esxi',
        sourceId: 'node-dell-bios',
        targetId: 'node-hypervisor-esxi',
        criticality: 'recommended',
        label: 'ESXi 8.0 certified',
        rule: FIRMWARE_DEPENDENCY_RULES[4]
      },
      {
        id: 'link-hp-bios-nutanix',
        sourceId: 'node-hp-bios',
        targetId: 'node-hypervisor-nutanix',
        criticality: 'recommended',
        label: 'Nutanix AOS 6.5 certified',
        rule: FIRMWARE_DEPENDENCY_RULES[4]
      }
    ];

    const activeNodeIds = new Set(nodes.map(n => n.id));
    return list.filter(l => activeNodeIds.has(l.sourceId) && activeNodeIds.has(l.targetId));
  }, [nodes]);

  // Selected server and package for simulation
  const selectedSimServer = useMemo(() => {
    return servers.find(s => s.id === simServerId) || servers[0];
  }, [servers, simServerId]);

  const selectedSimPackage = useMemo(() => {
    return packages.find(p => p.id === simPackageId) || packages[0];
  }, [packages, simPackageId]);

  // Live simulation compatibility check
  const simulationResult: CompatibilityCheckResult | null = useMemo(() => {
    if (!selectedSimServer || !selectedSimPackage) return null;
    return evaluateUpgradeCompatibility(selectedSimServer, selectedSimPackage);
  }, [selectedSimServer, selectedSimPackage]);

  // Active inspected node details
  const activeNode = useMemo(() => {
    return nodes.find(n => n.id === selectedNodeId) || nodes[0];
  }, [nodes, selectedNodeId]);

  // Related links for the active node
  const activeNodeIncoming = useMemo(() => {
    if (!activeNode) return [];
    return links.filter(l => l.targetId === activeNode.id);
  }, [links, activeNode]);

  const activeNodeOutgoing = useMemo(() => {
    if (!activeNode) return [];
    return links.filter(l => l.sourceId === activeNode.id);
  }, [links, activeNode]);

  return (
    <div className="space-y-6">
      {/* Top Banner / Explanation */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-2xl p-6 border border-slate-800 shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 bottom-0 w-96 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-indigo-500/10 via-transparent to-transparent pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5 max-w-2xl">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-indigo-500/30 text-indigo-300 border border-indigo-500/40 uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                Incompatibility Prevention Engine
              </span>
              <span className="text-xs text-slate-400">
                • Multi-Vendor Rule Validation
              </span>
            </div>
            <h2 className="text-xl font-extrabold tracking-tight text-white">
              Component Version Dependency & Incompatibility Map
            </h2>
            <p className="text-xs text-slate-300 leading-relaxed">
              Datacenter firmware components operate in strict hierarchical dependency chains. Upgrading BIOS without a compatible BMC version, or flashing high-speed NICs before configuring UEFI Option ROM tables, can trigger host boot loops, POST lockouts, or fan throttling.
            </p>
          </div>

          {/* Quick Stats Bar */}
          <div className="flex items-center gap-3 shrink-0">
            <div className="bg-slate-800/80 backdrop-blur-xs border border-slate-700/60 rounded-xl px-4 py-2.5 text-center min-w-[100px]">
              <div className="text-xs text-slate-400 font-medium">Active Rules</div>
              <div className="text-lg font-bold font-mono text-indigo-400">{FIRMWARE_DEPENDENCY_RULES.length}</div>
            </div>
            <div className="bg-slate-800/80 backdrop-blur-xs border border-slate-700/60 rounded-xl px-4 py-2.5 text-center min-w-[100px]">
              <div className="text-xs text-slate-400 font-medium">Blocking Pre-reqs</div>
              <div className="text-lg font-bold font-mono text-red-400">
                {FIRMWARE_DEPENDENCY_RULES.filter(r => r.criticality === 'blocking').length}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Control Bar: Vendor Filter, Component Filter & View Mode Tabs */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        {/* View Mode Tabs */}
        <div className="flex items-center space-x-1 p-1 bg-slate-100 rounded-lg text-xs font-semibold">
          <button
            type="button"
            onClick={() => setActiveTab('graph')}
            className={`px-3 py-1.5 rounded-md flex items-center gap-1.5 transition-all ${
              activeTab === 'graph'
                ? 'bg-white text-indigo-600 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Interactive Dependency Graph</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('simulator')}
            className={`px-3 py-1.5 rounded-md flex items-center gap-1.5 transition-all ${
              activeTab === 'simulator'
                ? 'bg-white text-indigo-600 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Zap className="w-3.5 h-3.5" />
            <span>Pre-Upgrade Compatibility Check</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('matrix')}
            className={`px-3 py-1.5 rounded-md flex items-center gap-1.5 transition-all ${
              activeTab === 'matrix'
                ? 'bg-white text-indigo-600 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <ShieldAlert className="w-3.5 h-3.5" />
            <span>Compatibility Rule Matrix</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('sequence')}
            className={`px-3 py-1.5 rounded-md flex items-center gap-1.5 transition-all ${
              activeTab === 'sequence'
                ? 'bg-white text-indigo-600 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <ChevronRight className="w-3.5 h-3.5" />
            <span>Safe Upgrade Sequence Order</span>
          </button>
        </div>

        {/* Vendor & Component Filters */}
        <div className="flex items-center space-x-3 text-xs">
          {/* Vendor Filter */}
          <div className="flex items-center space-x-1.5">
            <span className="text-slate-500 font-medium">Vendor:</span>
            <select
              value={selectedVendor}
              onChange={(e) => setSelectedVendor(e.target.value as ServerVendor | 'ALL')}
              className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
            >
              <option value="ALL">All Hardware Vendors</option>
              <option value="DELL">Dell Technologies (PowerEdge)</option>
              <option value="HP">Hewlett Packard Enterprise (ProLiant)</option>
              <option value="LENOVO">Lenovo (ThinkSystem)</option>
            </select>
          </div>

          {/* Component Filter */}
          <div className="flex items-center space-x-1.5">
            <span className="text-slate-500 font-medium">Component:</span>
            <select
              value={selectedComponent}
              onChange={(e) => setSelectedComponent(e.target.value as ComponentType | 'ALL')}
              className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
            >
              <option value="ALL">All Components</option>
              <option value="BIOS">System BIOS / UEFI</option>
              <option value="BMC">BMC / Out-of-Band</option>
              <option value="NIC">Network Adapters (NIC)</option>
              <option value="RAID">Storage RAID Controllers</option>
              <option value="NVMe">NVMe SSD Drives</option>
            </select>
          </div>
        </div>
      </div>

      {/* VIEW 1: INTERACTIVE DEPENDENCY GRAPH */}
      {activeTab === 'graph' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* SVG Graph Canvas (2 Columns on large screen) */}
          <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <span>Visual Component Dependency Hierarchy</span>
                  <span className="text-[10px] text-slate-400 font-mono font-normal">
                    (Arrows point: Source ➔ Requires ➔ Target)
                  </span>
                </h3>
                <p className="text-xs text-slate-500">
                  Click any node to inspect its prerequisite requirements and downstream dependents.
                </p>
              </div>

              {/* Legend */}
              <div className="flex items-center gap-3 text-[11px] font-mono">
                <span className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-full bg-red-500" />
                  <span className="text-slate-600">Blocking (Hard Stop)</span>
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                  <span className="text-slate-600">Required</span>
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-full bg-indigo-500" />
                  <span className="text-slate-600">Recommended</span>
                </span>
              </div>
            </div>

            {/* SVG Visual Stage */}
            <div className="relative border border-slate-100 rounded-xl bg-slate-950/2 overflow-x-auto min-h-[500px]">
              <svg 
                viewBox="0 0 1100 680" 
                className="w-full h-auto min-w-[900px] select-none"
              >
                <defs>
                  {/* Arrowhead Markers */}
                  <marker
                    id="arrow-blocking"
                    viewBox="0 0 10 10"
                    refX="9"
                    refY="5"
                    markerWidth="6"
                    markerHeight="6"
                    orient="auto-start-reverse"
                  >
                    <path d="M 0 1 L 10 5 L 0 9 z" fill="#ef4444" />
                  </marker>
                  <marker
                    id="arrow-required"
                    viewBox="0 0 10 10"
                    refX="9"
                    refY="5"
                    markerWidth="6"
                    markerHeight="6"
                    orient="auto-start-reverse"
                  >
                    <path d="M 0 1 L 10 5 L 0 9 z" fill="#f59e0b" />
                  </marker>
                  <marker
                    id="arrow-recommended"
                    viewBox="0 0 10 10"
                    refX="9"
                    refY="5"
                    markerWidth="6"
                    markerHeight="6"
                    orient="auto-start-reverse"
                  >
                    <path d="M 0 1 L 10 5 L 0 9 z" fill="#6366f1" />
                  </marker>

                  {/* Node shadows */}
                  <filter id="node-shadow" x="-10%" y="-10%" width="125%" height="125%">
                    <feDropShadow dx="0" dy="4" stdDeviation="6" floodOpacity="0.08" />
                  </filter>
                  <filter id="active-glow" x="-20%" y="-20%" width="140%" height="140%">
                    <feDropShadow dx="0" dy="0" stdDeviation="8" floodColor="#6366f1" floodOpacity="0.4" />
                  </filter>
                </defs>

                {/* Column Headers in Background */}
                <g className="font-mono text-[11px] font-bold fill-slate-400">
                  <text x="140" y="28" textAnchor="middle">OUT-OF-BAND BMC (TIER 1)</text>
                  <text x="400" y="28" textAnchor="middle">SYSTEM BIOS / UEFI (TIER 2)</text>
                  <text x="680" y="28" textAnchor="middle">PCIE ADAPTERS (TIER 3)</text>
                  <text x="940" y="28" textAnchor="middle">STORAGE & HYPERVISOR</text>
                </g>

                {/* Vertical Guidelines */}
                <line x1="140" y1="36" x2="140" y2="660" stroke="#f1f5f9" strokeWidth="2" strokeDasharray="4 4" />
                <line x1="400" y1="36" x2="400" y2="660" stroke="#f1f5f9" strokeWidth="2" strokeDasharray="4 4" />
                <line x1="680" y1="36" x2="680" y2="660" stroke="#f1f5f9" strokeWidth="2" strokeDasharray="4 4" />
                <line x1="940" y1="36" x2="940" y2="660" stroke="#f1f5f9" strokeWidth="2" strokeDasharray="4 4" />

                {/* Render Connective Links */}
                {links.map((link) => {
                  const sourceNode = nodes.find(n => n.id === link.sourceId);
                  const targetNode = nodes.find(n => n.id === link.targetId);
                  if (!sourceNode || !targetNode) return null;

                  const isHighlighted = 
                    selectedNodeId === link.sourceId || 
                    selectedNodeId === link.targetId ||
                    hoveredNodeId === link.sourceId ||
                    hoveredNodeId === link.targetId;

                  // Compute bezier path
                  const x1 = sourceNode.x;
                  const y1 = sourceNode.y + 20;
                  const x2 = targetNode.x;
                  const y2 = targetNode.y + 20;

                  // Smooth horizontal curvature
                  const dx = (x2 - x1) * 0.5;
                  const pathData = `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`;

                  const strokeColor = 
                    link.criticality === 'blocking' ? '#ef4444' :
                    link.criticality === 'required' ? '#f59e0b' : '#6366f1';

                  const markerId = 
                    link.criticality === 'blocking' ? 'url(#arrow-blocking)' :
                    link.criticality === 'required' ? 'url(#arrow-required)' : 'url(#arrow-recommended)';

                  return (
                    <g key={link.id} className="transition-all duration-200">
                      {/* Background wide hit area for hover */}
                      <path
                        d={pathData}
                        fill="none"
                        stroke="transparent"
                        strokeWidth={16}
                        className="cursor-pointer"
                        onMouseEnter={() => setSelectedRuleId(link.rule.id)}
                        onClick={() => setSelectedRuleId(link.rule.id)}
                      />
                      {/* Actual curved line */}
                      <path
                        d={pathData}
                        fill="none"
                        stroke={strokeColor}
                        strokeWidth={isHighlighted ? 3 : 1.75}
                        strokeDasharray={link.criticality === 'recommended' ? '5 4' : undefined}
                        markerEnd={markerId}
                        opacity={isHighlighted ? 1 : 0.45}
                        className="transition-all duration-200"
                      />
                      {/* Text badge along path */}
                      {isHighlighted && (
                        <text
                          x={(x1 + x2) / 2}
                          y={(y1 + y2) / 2 - 8}
                          textAnchor="middle"
                          fill={strokeColor}
                          className="text-[10px] font-mono font-bold bg-white"
                        >
                          {link.label}
                        </text>
                      )}
                    </g>
                  );
                })}

                {/* Render Nodes */}
                {nodes.map((node) => {
                  const isSelected = selectedNodeId === node.id;
                  const isHovered = hoveredNodeId === node.id;

                  const vendorBadgeColor = 
                    node.vendor === 'DELL' ? '#2563eb' :
                    node.vendor === 'HP' ? '#059669' :
                    node.vendor === 'LENOVO' ? '#dc2626' : '#475569';

                  return (
                    <g
                      key={node.id}
                      transform={`translate(${node.x - 90}, ${node.y})`}
                      className="cursor-pointer transition-all duration-200"
                      onClick={() => setSelectedNodeId(node.id)}
                      onMouseEnter={() => setHoveredNodeId(node.id)}
                      onMouseLeave={() => setHoveredNodeId(null)}
                      filter={isSelected ? 'url(#active-glow)' : 'url(#node-shadow)'}
                    >
                      {/* Node Box */}
                      <rect
                        width={180}
                        height={68}
                        rx={10}
                        fill="#ffffff"
                        stroke={isSelected ? '#6366f1' : isHovered ? '#94a3b8' : '#e2e8f0'}
                        strokeWidth={isSelected ? 2.5 : 1}
                      />

                      {/* Top vendor stripe */}
                      <rect
                        width={180}
                        height={4}
                        rx={2}
                        fill={vendorBadgeColor}
                      />

                      {/* Node Label & Component */}
                      <text
                        x={12}
                        y={24}
                        className="text-[11px] font-bold fill-slate-900"
                      >
                        {node.label.length > 20 ? `${node.label.slice(0, 19)}…` : node.label}
                      </text>

                      {/* Version text */}
                      <text
                        x={12}
                        y={42}
                        className="text-[10px] font-mono font-semibold fill-slate-600"
                      >
                        {node.version}
                      </text>

                      {/* Vendor tag */}
                      <rect
                        x={12}
                        y={49}
                        width={node.vendor === 'COMMON' ? 52 : 36}
                        height={13}
                        rx={3}
                        fill="#f1f5f9"
                      />
                      <text
                        x={15}
                        y={59}
                        className="text-[8px] font-bold fill-slate-600"
                      >
                        {node.vendor}
                      </text>

                      {/* Component type tag */}
                      <text
                        x={170}
                        y={59}
                        textAnchor="end"
                        className="text-[9px] font-mono font-bold fill-indigo-600"
                      >
                        {node.component}
                      </text>
                    </g>
                  );
                })}
              </svg>
            </div>

            {/* Bottom quick tip */}
            <div className="mt-3 flex items-center justify-between text-xs text-slate-500 font-mono">
              <span className="flex items-center gap-1.5">
                <Info className="w-3.5 h-3.5 text-indigo-500" />
                Solid red arrow = Upgrade is strictly blocked until target version is installed.
              </span>
              <span>Showing {nodes.length} nodes & {links.length} dependency paths</span>
            </div>
          </div>

          {/* Right Panel: Selected Component / Dependency Inspector */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-5 flex flex-col justify-between">
            <div className="space-y-4">
              <div className="border-b border-slate-200 pb-3">
                <span className="text-[10px] font-mono font-bold text-indigo-600 uppercase tracking-wider">
                  Component Inspector
                </span>
                <h3 className="text-base font-extrabold text-slate-900 mt-0.5 flex items-center gap-2">
                  {activeNode.icon}
                  <span>{activeNode.label}</span>
                </h3>
                <div className="flex items-center gap-2 text-xs text-slate-500 mt-1">
                  <span className="font-semibold text-slate-700">{activeNode.vendor}</span>
                  <span>•</span>
                  <span className="font-mono text-indigo-600 font-medium">{activeNode.component}</span>
                  <span>•</span>
                  <span className="font-mono text-slate-800">{activeNode.version}</span>
                </div>
              </div>

              <p className="text-xs text-slate-600 leading-relaxed">
                {activeNode.description}
              </p>

              {/* Upstream Prerequisites (What must be updated before this) */}
              <div className="space-y-2">
                <div className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                  <ShieldAlert className="w-3.5 h-3.5 text-red-500" />
                  <span>Prerequisites (Update BEFORE this)</span>
                </div>

                {activeNodeOutgoing.length === 0 ? (
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-500 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                    <span>Independent root component. Can be flashed directly without prior firmware dependencies.</span>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {activeNodeOutgoing.map((link) => {
                      const target = nodes.find(n => n.id === link.targetId);
                      return (
                        <div
                          key={link.id}
                          className={`p-3 rounded-xl border text-xs space-y-1.5 ${
                            link.criticality === 'blocking'
                              ? 'bg-red-50/50 border-red-200 text-red-950'
                              : link.criticality === 'required'
                                ? 'bg-amber-50/50 border-amber-200 text-amber-950'
                                : 'bg-indigo-50/50 border-indigo-200 text-indigo-950'
                          }`}
                        >
                          <div className="flex items-center justify-between font-bold">
                            <div className="flex items-center gap-1.5">
                              <span className={`px-1.5 py-0.2 rounded text-[9px] uppercase font-bold ${
                                link.criticality === 'blocking' ? 'bg-red-200 text-red-900' :
                                link.criticality === 'required' ? 'bg-amber-200 text-amber-900' : 'bg-indigo-200 text-indigo-900'
                              }`}>
                                {link.criticality}
                              </span>
                              <span>Target: {target?.label || link.targetId}</span>
                            </div>
                            <span className="font-mono text-[11px]">{link.label}</span>
                          </div>
                          <p className="text-[11px] text-slate-600 leading-snug">
                            {link.rule.reason}
                          </p>
                          <p className="text-[11px] text-red-700 font-medium">
                            ⚠️ Danger if skipped: {link.rule.incompatibleConsequence}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Downstream Dependents (What relies on this component) */}
              <div className="space-y-2">
                <div className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                  <Activity className="w-3.5 h-3.5 text-indigo-500" />
                  <span>Downstream Dependents</span>
                </div>

                {activeNodeIncoming.length === 0 ? (
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-500">
                    No downstream components rely on this tier.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {activeNodeIncoming.map((link) => {
                      const source = nodes.find(n => n.id === link.sourceId);
                      return (
                        <div key={link.id} className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 text-xs flex items-center justify-between">
                          <span className="font-semibold text-slate-800">{source?.label || link.sourceId}</span>
                          <span className="font-mono text-[10px] text-slate-500">{link.label}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Quick action button */}
            <div className="pt-3 border-t border-slate-200">
              <button
                type="button"
                onClick={() => {
                  setActiveTab('simulator');
                }}
                className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-colors shadow-xs"
              >
                <Zap className="w-4 h-4" />
                <span>Evaluate Compatibility on Fleet Inventory</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* VIEW 2: INCOMPATIBILITY VALIDATOR & PRE-UPGRADE ADVISOR */}
      {activeTab === 'simulator' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-6">
          <div className="border-b border-slate-200 pb-4">
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Zap className="w-5 h-5 text-indigo-600" />
              <span>Pre-Upgrade Incompatibility Validator & Safety Advisor</span>
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Select any server in your fleet and a candidate firmware package to verify prerequisite compatibility before executing an update.
            </p>
          </div>

          {/* Form Selectors */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Server Selector */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700">Target Server Node to Validate</label>
              <select
                value={simServerId}
                onChange={(e) => setSimServerId(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs font-semibold text-slate-900 focus:ring-2 focus:ring-indigo-500"
              >
                {servers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.hostname} — {s.vendor} ({s.model}) • Current BIOS {s.components.BIOS?.currentVersion} • BMC {s.components.BMC?.currentVersion}
                  </option>
                ))}
              </select>
            </div>

            {/* Firmware Package Selector */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700">Candidate Firmware Package</label>
              <select
                value={simPackageId}
                onChange={(e) => setSimPackageId(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs font-semibold text-slate-900 focus:ring-2 focus:ring-indigo-500"
              >
                {packages.map((p) => (
                  <option key={p.id} value={p.id}>
                    [{p.component}] {p.name} (v{p.version}) — {p.vendor}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Result Card */}
          {simulationResult && selectedSimServer && selectedSimPackage && (
            <div className="space-y-6 pt-2">
              {/* Status Banner */}
              <div className={`p-5 rounded-2xl border flex items-start gap-4 ${
                simulationResult.status === 'incompatible'
                  ? 'bg-red-50/70 border-red-300 text-red-950'
                  : simulationResult.status === 'warning'
                    ? 'bg-amber-50/70 border-amber-300 text-amber-950'
                    : 'bg-emerald-50/70 border-emerald-300 text-emerald-950'
              }`}>
                {simulationResult.status === 'incompatible' ? (
                  <XCircle className="w-7 h-7 text-red-600 shrink-0 mt-0.5" />
                ) : simulationResult.status === 'warning' ? (
                  <AlertTriangle className="w-7 h-7 text-amber-600 shrink-0 mt-0.5" />
                ) : (
                  <CheckCircle2 className="w-7 h-7 text-emerald-600 shrink-0 mt-0.5" />
                )}

                <div className="space-y-1.5 flex-1">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-extrabold uppercase tracking-wide">
                      {simulationResult.status === 'incompatible'
                        ? '⛔ INCOMPATIBLE UPGRADE BLOCKED — MISSING PREREQUISITES'
                        : simulationResult.status === 'warning'
                          ? '⚠️ UPGRADE ALLOWED WITH WARNINGS — RECOMMENDED STEPS ADVISABLE'
                          : '✅ VERIFIED SAFE FOR UPGRADE — ALL PREREQUISITES SATISFIED'}
                    </h4>
                    <span className="font-mono text-xs font-bold px-2 py-0.5 rounded-md bg-white/60">
                      Target: {selectedSimServer.hostname}
                    </span>
                  </div>
                  <p className="text-xs leading-relaxed opacity-90">
                    {simulationResult.status === 'incompatible'
                      ? `Flashing ${selectedSimPackage.name} (${selectedSimPackage.version}) directly to this host is blocked because one or more critical component dependencies do not meet the minimum certified baseline.`
                      : simulationResult.status === 'warning'
                        ? `The update can proceed, but performance or telemetry might be degraded until secondary components are updated.`
                        : `All hardware firmware baselines, stepping versions, and hypervisor drivers on this node are fully compatible. No post-flash boot hazards detected.`}
                  </p>
                </div>
              </div>

              {/* Detailed Breakdown of Violations if any */}
              {simulationResult.ruleViolations.length > 0 && (
                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                    Identified Incompatibility Hazards ({simulationResult.ruleViolations.length})
                  </h4>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {simulationResult.ruleViolations.map((v, idx) => (
                      <div
                        key={idx}
                        className={`p-4 rounded-xl border space-y-2 ${
                          v.isBlocking
                            ? 'bg-red-50/40 border-red-200'
                            : 'bg-amber-50/40 border-amber-200'
                        }`}
                      >
                        <div className="flex items-center justify-between text-xs">
                          <span className={`px-2 py-0.5 rounded-sm font-bold text-[10px] uppercase ${
                            v.isBlocking ? 'bg-red-200 text-red-900' : 'bg-amber-200 text-amber-900'
                          }`}>
                            {v.isBlocking ? 'BLOCKING HAZARD' : 'WARNING'}
                          </span>
                          <span className="font-mono font-bold text-slate-700">
                            Required: {v.component} ≥ {v.requiredVersion}
                          </span>
                        </div>

                        <div className="text-xs">
                          <div className="flex justify-between py-1 border-b border-slate-200/60 font-mono text-[11px]">
                            <span className="text-slate-500">Currently Installed on Host:</span>
                            <span className="font-bold text-red-600">{v.currentVersion || 'Not Installed / Unknown'}</span>
                          </div>
                          <div className="flex justify-between py-1 font-mono text-[11px]">
                            <span className="text-slate-500">Minimum Certified:</span>
                            <span className="font-bold text-emerald-600">{v.requiredVersion}</span>
                          </div>
                        </div>

                        <p className="text-xs text-slate-700">
                          <strong>Consequence:</strong> {v.rule.incompatibleConsequence}
                        </p>

                        <div className="p-2.5 rounded-lg bg-white/80 border border-slate-200 text-[11px] text-slate-800">
                          <strong>Recommended Resolution:</strong> {v.rule.resolutionGuidance}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Recommended Multi-Stage Execution Sequence */}
              <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/60 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                    Automated Staging Order to Guarantee Zero Downtime
                  </h4>
                  <span className="text-[11px] text-indigo-600 font-mono font-medium">
                    Order ensures BMC ➔ BIOS ➔ Option ROM consistency
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-5 gap-2">
                  {simulationResult.recommendedSequence.map((step) => (
                    <div key={step.step} className="p-3 rounded-lg bg-white border border-slate-200 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-800 flex items-center justify-center font-bold text-[10px]">
                          {step.step}
                        </span>
                        <span className="font-mono text-[10px] font-bold text-slate-500">{step.component}</span>
                      </div>
                      <p className="text-[11px] text-slate-700 font-medium leading-tight pt-1">
                        {step.action}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end space-x-3 pt-2 border-t border-slate-200">
                {simulationResult.status === 'incompatible' ? (
                  <div className="text-xs text-red-600 font-medium flex items-center gap-1.5">
                    <ShieldAlert className="w-4 h-4" />
                    Direct deployment blocked by dependency safety gate. Update prerequisites first.
                  </div>
                ) : (
                  onDeployPackage && (
                    <button
                      type="button"
                      onClick={() => onDeployPackage(selectedSimPackage)}
                      className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold flex items-center gap-2 shadow-xs transition-colors"
                    >
                      <Play className="w-4 h-4" />
                      <span>Stage Verified Upgrade Campaign</span>
                    </button>
                  )
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* VIEW 3: COMPATIBILITY RULE MATRIX */}
      {activeTab === 'matrix' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-200 pb-4">
            <div>
              <h3 className="text-base font-bold text-slate-900">Enterprise Hardware Compatibility Matrix</h3>
              <p className="text-xs text-slate-500">Official vendor inter-component compatibility baselines and prerequisite rules.</p>
            </div>
            <span className="font-mono text-xs text-slate-500">
              Showing {filteredRules.length} certified rules
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="py-3 px-4">Vendor</th>
                  <th className="py-3 px-4">Source Component</th>
                  <th className="py-3 px-4">Min Source Version</th>
                  <th className="py-3 px-4">Required Dependency</th>
                  <th className="py-3 px-4">Min Target Version</th>
                  <th className="py-3 px-4">Criticality</th>
                  <th className="py-3 px-4">Hazard If Incompatible</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filteredRules.map((rule) => (
                  <tr key={rule.id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-3 px-4">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        rule.vendor === 'DELL' ? 'bg-blue-100 text-blue-800' :
                        rule.vendor === 'HP' ? 'bg-emerald-100 text-emerald-800' :
                        rule.vendor === 'LENOVO' ? 'bg-red-100 text-red-800' : 'bg-slate-100 text-slate-800'
                      }`}>
                        {rule.vendor}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-bold text-slate-900 font-mono">
                      {rule.sourceComponent}
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-600">
                      ≥ {rule.sourceVersionMin}
                    </td>
                    <td className="py-3 px-4 font-bold text-indigo-700 font-mono">
                      {rule.targetComponent}
                    </td>
                    <td className="py-3 px-4 font-mono font-bold text-slate-900">
                      ≥ {rule.targetMinVersion}
                    </td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold ${
                        rule.criticality === 'blocking' ? 'bg-red-100 text-red-800' :
                        rule.criticality === 'required' ? 'bg-amber-100 text-amber-800' : 'bg-indigo-100 text-indigo-800'
                      }`}>
                        {rule.criticality}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-600 max-w-xs truncate" title={rule.incompatibleConsequence}>
                      {rule.incompatibleConsequence}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* VIEW 4: SAFE UPGRADE SEQUENCE ORDER */}
      {activeTab === 'sequence' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-6">
          <div className="border-b border-slate-200 pb-4">
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Clock className="w-5 h-5 text-indigo-600" />
              <span>Recommended Zero-Outage Upgrade Rollout Sequence</span>
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Following this standard 5-phase sequencing ensures management links stay alive, UEFI registers are recognized, and storage arrays never drop offline.
            </p>
          </div>

          <div className="space-y-4">
            {/* Phase 1 */}
            <div className="p-4 rounded-xl border border-purple-200 bg-purple-50/40 flex items-start gap-4">
              <div className="w-8 h-8 rounded-lg bg-purple-600 text-white font-bold flex items-center justify-center text-sm shrink-0">
                1
              </div>
              <div className="space-y-1 text-xs">
                <div className="flex items-center gap-2 font-bold text-slate-900">
                  <span>Phase 1: Out-of-Band BMC Firmware (iDRAC / iLO / XCC)</span>
                  <span className="px-2 py-0.5 rounded bg-purple-100 text-purple-800 text-[10px]">No Host OS Reboot Required</span>
                </div>
                <p className="text-slate-600 leading-relaxed">
                  Always flash the management processor first. The BMC operates on independent auxiliary power (+3.3V Aux) and manages power cycling, SMM telemetry, and remote media. Upgrading BMC first provides modern Redfish and security verification APIs needed by upcoming BIOS payloads.
                </p>
              </div>
            </div>

            {/* Phase 2 */}
            <div className="p-4 rounded-xl border border-indigo-200 bg-indigo-50/40 flex items-start gap-4">
              <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white font-bold flex items-center justify-center text-sm shrink-0">
                2
              </div>
              <div className="space-y-1 text-xs">
                <div className="flex items-center gap-2 font-bold text-slate-900">
                  <span>Phase 2: System ROM / UEFI BIOS Firmware</span>
                  <span className="px-2 py-0.5 rounded bg-indigo-100 text-indigo-800 text-[10px]">Host Warm Reboot Required</span>
                </div>
                <p className="text-slate-600 leading-relaxed">
                  Stage the UEFI BIOS payload through the updated BMC. Evacuate guest VMs from the hypervisor host before initiating the reboot. The updated BIOS loads updated Intel/AMD CPU microcode patches, PCIe lane bifurcation definitions, and TPM 2.0 endorsement hashes.
                </p>
              </div>
            </div>

            {/* Phase 3 */}
            <div className="p-4 rounded-xl border border-amber-200 bg-amber-50/40 flex items-start gap-4">
              <div className="w-8 h-8 rounded-lg bg-amber-600 text-white font-bold flex items-center justify-center text-sm shrink-0">
                3
              </div>
              <div className="space-y-1 text-xs">
                <div className="flex items-center gap-2 font-bold text-slate-900">
                  <span>Phase 3: Storage RAID & HBA Controllers (PERC / Smart Array)</span>
                  <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-800 text-[10px]">Reboot / Driver Reload</span>
                </div>
                <p className="text-slate-600 leading-relaxed">
                  Once the BIOS has boot support for Gen4/Gen5 PCIe lanes, flash the RAID and host bus adapters. This avoids silent patrol read hangs or drive enclosure backplane communication drops.
                </p>
              </div>
            </div>

            {/* Phase 4 */}
            <div className="p-4 rounded-xl border border-sky-200 bg-sky-50/40 flex items-start gap-4">
              <div className="w-8 h-8 rounded-lg bg-sky-600 text-white font-bold flex items-center justify-center text-sm shrink-0">
                4
              </div>
              <div className="space-y-1 text-xs">
                <div className="flex items-center gap-2 font-bold text-slate-900">
                  <span>Phase 4: Network Adapters & Option ROMs (ConnectX-6 / Broadcom)</span>
                  <span className="px-2 py-0.5 rounded bg-sky-100 text-sky-800 text-[10px]">Hypervisor vSwitch Sync</span>
                </div>
                <p className="text-slate-600 leading-relaxed">
                  Update 100GbE / 25GbE adapters and firmware. BIOS Gen4 training ensures PCIe link speed is renegotiated cleanly without dropping host link aggregation (LACP/vDS) trunks.
                </p>
              </div>
            </div>

            {/* Phase 5 */}
            <div className="p-4 rounded-xl border border-emerald-200 bg-emerald-50/40 flex items-start gap-4">
              <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white font-bold flex items-center justify-center text-sm shrink-0">
                5
              </div>
              <div className="space-y-1 text-xs">
                <div className="flex items-center gap-2 font-bold text-slate-900">
                  <span>Phase 5: Flash Media & NVMe U.3 Solid State Drives</span>
                  <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[10px]">Online or Maintenance</span>
                </div>
                <p className="text-slate-600 leading-relaxed">
                  Finally, apply vendor firmware updates to underlying NVMe/SSD physical drives. The upgraded RAID controller and BIOS ensure clean dual-port NVMe multipath failover.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
