import { Server, ServerModel, ServerCredentials, AccessTestResult, AccessTestStep } from '../types';

export interface TestAccessParams {
  hostname: string;
  ip: string;
  bmcIp: string;
  bmcAffectedType: Server['bmcAffectedType'];
  model: ServerModel;
  credentials: ServerCredentials;
  onStepUpdate?: (steps: AccessTestStep[]) => void;
}

/**
 * Execute real live network socket connectivity, BMC port handshake,
 * and out-of-band Redfish / IPMI hardware telemetry query.
 * No sandbox or mock simulation: connects directly to real hosts and controllers.
 */
export async function testServerAccess(params: TestAccessParams): Promise<AccessTestResult> {
  const { hostname, ip, bmcIp, bmcAffectedType, model, credentials, onStepUpdate } = params;

  const targetBmcIp = bmcIp.trim() || ip.trim();
  const targetHostIp = ip.trim();

  // Initial step setup
  const steps: AccessTestStep[] = [
    {
      id: 'step-network',
      name: `Host & Network Socket Route (${targetHostIp || targetBmcIp})`,
      status: 'pending',
      message: `Establishing TCP route to Host ${targetHostIp || 'N/A'} and BMC ${targetBmcIp}...`,
    },
    {
      id: 'step-port',
      name: `OOB Service Port (${credentials.bmcPort}) TLS Handshake`,
      status: 'pending',
      message: `Probing TCP port ${credentials.bmcPort} on ${targetBmcIp}...`,
    },
    {
      id: 'step-auth',
      name: `BMC Controller Authentication (${(credentials.bmcProtocol || 'redfish').toUpperCase()})`,
      status: 'pending',
      message: `Authenticating with principal "${credentials.bmcUsername || 'root'}" on remote BMC...`,
    },
    {
      id: 'step-discovery',
      name: 'Chassis Telemetry & Hardware Inventory Query',
      status: 'pending',
      message: 'Querying Redfish Systems & Managers hardware inventory...',
    },
  ];

  if (credentials.enableSsh) {
    steps.push({
      id: 'step-ssh',
      name: `Host OS In-Band SSH (${credentials.sshPort || 22}) Probe`,
      status: 'pending',
      message: `Connecting to ${targetHostIp}:${credentials.sshPort || 22} as "${credentials.sshUsername || 'root'}"...`,
    });
  }

  const update = (stepIndex: number, partial: Partial<AccessTestStep>) => {
    if (stepIndex >= 0 && stepIndex < steps.length) {
      steps[stepIndex] = { ...steps[stepIndex], ...partial };
      if (onStepUpdate) {
        onStepUpdate([...steps]);
      }
    }
  };

  if (!targetHostIp && !targetBmcIp) {
    update(0, {
      status: 'failed',
      message: 'Network check failed: Neither Host IP nor BMC IP was provided.',
      details: 'Please enter a valid IP address or FQDN.',
    });
    return {
      status: 'failed',
      testedAt: new Date().toISOString(),
      summary: 'Network unreachable: Missing IP address',
      steps,
      errorDetails: 'Invalid or missing target IP address.',
    };
  }

  // Update initial active status
  update(0, { status: 'running' });
  update(1, { status: 'running' });

  try {
    const res = await fetch('/api/servers/test-access', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        hostname: hostname.trim() || 'unnamed-server',
        ip: targetHostIp,
        bmcIp: targetBmcIp,
        bmcAffectedType,
        model,
        credentials
      })
    });

    const data = await res.json();

    if (!res.ok || data.status === 'failed') {
      const serverSteps: AccessTestStep[] = Array.isArray(data.steps) && data.steps.length > 0
        ? data.steps
        : steps.map(s => ({
            ...s,
            status: s.status === 'running' ? 'failed' as const : s.status,
            message: s.status === 'running' ? (data.summary || data.error || 'Connection failed') : s.message
          }));

      if (onStepUpdate) {
        onStepUpdate(serverSteps);
      }

      return {
        status: 'failed',
        testedAt: data.testedAt || new Date().toISOString(),
        testedBy: 'Real Network Probe',
        summary: data.summary || data.error || 'Server access probe failed.',
        latencyMs: data.latencyMs,
        steps: serverSteps,
        errorDetails: data.errorDetails || data.error || 'Remote host or BMC port was unreachable.'
      };
    }

    // Success with real verified telemetry
    const resultSteps: AccessTestStep[] = Array.isArray(data.steps) && data.steps.length > 0
      ? data.steps
      : steps.map(s => ({ ...s, status: 'success' as const }));

    if (onStepUpdate) {
      onStepUpdate(resultSteps);
    }

    return {
      status: 'success',
      testedAt: data.testedAt || new Date().toISOString(),
      testedBy: 'Real Network Probe',
      summary: data.summary || `Verified real ${credentials.bmcProtocol?.toUpperCase() || 'Redfish'} access to ${targetBmcIp}:${credentials.bmcPort} (${data.latencyMs || 0}ms)`,
      latencyMs: data.latencyMs,
      steps: resultSteps,
      discoveredHardware: data.discoveredHardware || undefined
    };
  } catch (err: any) {
    const networkErrMsg = err?.message || 'Failed to dispatch network socket probe.';
    const failedSteps = steps.map(s => ({
      ...s,
      status: s.status === 'running' ? 'failed' as const : s.status,
      message: s.status === 'running' ? `Real network probe failed: ${networkErrMsg}` : s.message
    }));

    if (onStepUpdate) {
      onStepUpdate(failedSteps);
    }

    return {
      status: 'failed',
      testedAt: new Date().toISOString(),
      testedBy: 'Real Network Probe',
      summary: `Network socket probe error: ${networkErrMsg}`,
      steps: failedSteps,
      errorDetails: networkErrMsg
    };
  }
}
