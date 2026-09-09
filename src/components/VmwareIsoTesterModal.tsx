import React, { useState, useEffect } from 'react';
import { 
  X, 
  Disc, 
  Server, 
  ShieldCheck, 
  CheckCircle2, 
  AlertTriangle, 
  Loader2, 
  Play, 
  RefreshCw, 
  Key, 
  HardDrive, 
  FileCode, 
  Activity, 
  Power,
  XCircle,
  ExternalLink,
  Info,
  Upload,
  FileCheck,
  Check,
  Database,
  ArrowRight,
  Radio,
  FileUp,
  Cpu,
  FolderDown,
  Layers,
  Plus,
  Trash2
} from 'lucide-react';
import { 
  FirmwarePackage, 
  VmwareVcenterConfig, 
  VmwareVmInfo, 
  VmwareIsoMountResult, 
  VmwareMountStep,
  VmwareDatastoreInfo,
  VmwareFileUploadResult,
  VmwarePowerStateResult,
  VmwareLogEntry,
  VmwareLiveVerificationResult
} from '../types';
import { 
  testVcenterConnection, 
  mountIsoOnVmwareVm, 
  unmountIsoFromVmwareVm,
  fetchVmwareDatastores,
  addCustomDatastore,
  deleteCustomDatastore,
  uploadFileToDatastore,
  verifyDatastoreFile,
  manageVmPowerState,
  verifyLiveVmwareCdrom
} from '../services/api';
import { VmwareOutputLogBox } from './VmwareOutputLogBox';

interface VmwareIsoTesterModalProps {
  isOpen: boolean;
  onClose: () => void;
  packages: FirmwarePackage[];
  initialPackage?: FirmwarePackage | null;
  onShowToast?: (message: string, type?: 'success' | 'info' | 'warn') => void;
}

export const VmwareIsoTesterModal: React.FC<VmwareIsoTesterModalProps> = ({
  isOpen,
  onClose,
  packages,
  initialPackage,
  onShowToast,
}) => {
  // vCenter Connection Form State
  const [vcenterHost, setVcenterHost] = useState<string>(() => {
    return localStorage.getItem('vmware_vcenter_host') || '';
  });
  const [vcenterPort, setVcenterPort] = useState<number>(443);
  const [vcenterUsername, setVcenterUsername] = useState<string>(() => {
    return localStorage.getItem('vmware_vcenter_username') || 'administrator@vsphere.local';
  });
  const [vcenterPassword, setVcenterPassword] = useState<string>(() => {
    return localStorage.getItem('vmware_vcenter_password') || '';
  });
  const [vcenterDatacenter, setVcenterDatacenter] = useState<string>('Datacenter-01');
  const [vcenterDatastore, setVcenterDatastore] = useState<string>('datastore1');
  const [ignoreSsl, setIgnoreSsl] = useState<boolean>(true);

  // Connection State
  const [isTestingConn, setIsTestingConn] = useState(false);
  const [connStatus, setConnStatus] = useState<{
    connected: boolean;
    testedAt?: string;
    latencyMs?: number;
    error?: string;
  } | null>(null);

  // Step 2: Target VMs
  const [availableVms, setAvailableVms] = useState<VmwareVmInfo[]>([]);
  const [selectedVmId, setSelectedVmId] = useState<string>('');
  const [customVmName, setCustomVmName] = useState<string>('');

  // Additional Step 1: Datastores
  const [datastores, setDatastores] = useState<VmwareDatastoreInfo[]>([]);
  const [isFetchingDatastores, setIsFetchingDatastores] = useState(false);
  const [selectedDatastore, setSelectedDatastore] = useState<string>('datastore1');
  const [showAddDatastore, setShowAddDatastore] = useState<boolean>(false);
  const [newDsName, setNewDsName] = useState<string>('');
  const [newDsType, setNewDsType] = useState<string>('VMFS-6');
  const [newDsCapacityGb, setNewDsCapacityGb] = useState<string>('1000');

  // Additional Step 2: File Upload & Server-side Verification
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [uploadFileName, setUploadFileName] = useState<string>('');
  const [isUploading, setIsUploading] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [uploadResult, setUploadResult] = useState<VmwareFileUploadResult | null>(null);

  // Additional Step 3: Connect File to Selected VM
  const [selectedPkgId, setSelectedPkgId] = useState<string>('');
  const [isoDatastorePath, setIsoDatastorePath] = useState<string>('');
  const [autoPowerOn, setAutoPowerOn] = useState<boolean>(false);
  const [isMounting, setIsMounting] = useState(false);
  const [isUnmounting, setIsUnmounting] = useState(false);
  const [isVerifyingLive, setIsVerifyingLive] = useState(false);
  const [liveVerification, setLiveVerification] = useState<VmwareLiveVerificationResult | null>(null);
  const [mountResult, setMountResult] = useState<VmwareIsoMountResult | null>(null);
  const [mountSteps, setMountSteps] = useState<VmwareMountStep[]>([]);
  const [activeMountedIso, setActiveMountedIso] = useState<{
    vmId: string;
    vmName: string;
    isoPath: string;
    mountedAt: string;
    connected: boolean;
  } | null>(null);

  // Additional Step 4: Power Controls & VM State
  const [vmPowerState, setVmPowerState] = useState<'poweredOn' | 'poweredOff' | 'suspended'>('poweredOff');
  const [isPowerLoading, setIsPowerLoading] = useState(false);
  const [vmPowerDetails, setVmPowerDetails] = useState<VmwarePowerStateResult | null>(null);

  // Output Log Box State
  const [logs, setLogs] = useState<VmwareLogEntry[]>(() => [
    {
      id: 'init-1',
      timestamp: new Date().toTimeString().split(' ')[0],
      level: 'info',
      category: 'SYSTEM',
      message: 'VMware ISO Package Tester initialized. Ready for operations.',
    },
  ]);

  const addLog = (
    category: VmwareLogEntry['category'],
    message: string,
    level: VmwareLogEntry['level'] = 'info',
    details?: string
  ) => {
    const timestamp =
      new Date().toTimeString().split(' ')[0] +
      '.' +
      String(new Date().getMilliseconds()).padStart(3, '0');
    setLogs((prev) => [
      ...prev,
      {
        id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        timestamp,
        category,
        message,
        level,
        details,
      },
    ]);
  };

  // Synchronize when initialPackage is provided or modal opens
  useEffect(() => {
    if (initialPackage) {
      setSelectedPkgId(initialPackage.id);
      const isoName = initialPackage.fileName || `${initialPackage.id}.iso`;
      setUploadFileName(isoName);
      setIsoDatastorePath(`[${selectedDatastore || 'datastore1'}] iso/${isoName}`);
    } else {
      const isoPkgs = packages.filter((p) => p.packageFormat === 'ISO' || p.fileName.endsWith('.iso'));
      if (isoPkgs.length > 0 && !selectedPkgId) {
        setSelectedPkgId(isoPkgs[0].id);
        setUploadFileName(isoPkgs[0].fileName);
        setIsoDatastorePath(`[${selectedDatastore || 'datastore1'}] iso/${isoPkgs[0].fileName}`);
      }
    }
  }, [initialPackage, packages, selectedDatastore]);

  // Update ISO path and upload name when selected package changes
  const handlePackageChange = (pkgId: string) => {
    setSelectedPkgId(pkgId);
    const pkg = packages.find((p) => p.id === pkgId);
    if (pkg) {
      setUploadFileName(pkg.fileName);
      setIsoDatastorePath(`[${selectedDatastore || 'datastore1'}] iso/${pkg.fileName}`);
      addLog('SYSTEM', `Selected template package from catalog: ${pkg.name} (${pkg.fileName})`);
    }
  };

  // Get current selected target VM
  const getSelectedVm = (): VmwareVmInfo | undefined => {
    return availableVms.find((v) => v.id === selectedVmId);
  };

  // Keep target VM power state synced with vmPowerState
  useEffect(() => {
    const vm = getSelectedVm();
    if (vm) {
      setVmPowerState(vm.powerState);
      if (vm.cdromBacking?.connected) {
        setActiveMountedIso({
          vmId: vm.id,
          vmName: vm.name,
          isoPath: vm.cdromBacking.isoPath || `[${selectedDatastore}] iso/firmware.iso`,
          mountedAt: new Date().toISOString(),
          connected: true,
        });
      }
    }
  }, [selectedVmId, availableVms]);

  // Test vCenter Connection & Fetch VMs
  const handleTestConnection = async () => {
    if (!vcenterHost.trim()) {
      alert('Please enter a valid vCenter Host / FQDN / IP.');
      return;
    }

    setIsTestingConn(true);
    setConnStatus(null);

    if (vcenterHost) localStorage.setItem('vmware_vcenter_host', vcenterHost);
    if (vcenterUsername) localStorage.setItem('vmware_vcenter_username', vcenterUsername);
    if (vcenterPassword) localStorage.setItem('vmware_vcenter_password', vcenterPassword);

    addLog(
      'VCENTER',
      `Testing live connection to vCenter host: ${vcenterHost}:${vcenterPort}...`
    );

    const config: VmwareVcenterConfig = {
      host: vcenterHost,
      port: vcenterPort,
      username: vcenterUsername,
      password: vcenterPassword,
      datacenter: vcenterDatacenter,
      datastore: vcenterDatastore,
      ignoreSsl,
    };

    const res = await testVcenterConnection(config);
    setIsTestingConn(false);

    if (res.success && res.vms) {
      setConnStatus({
        connected: true,
        testedAt: new Date().toLocaleTimeString(),
        latencyMs: res.latencyMs,
      });
      setAvailableVms(res.vms);
      if (res.vms.length > 0 && !selectedVmId) {
        setSelectedVmId(res.vms[0].id);
      }
      addLog(
        'VCENTER',
        `Live vCenter verified! Discovered ${res.vms.length} Virtual Machines in ${vcenterDatacenter} (${res.latencyMs || 15}ms).`,
        'success',
        `Inventory: ${res.vms.map((v) => `${v.name} [${v.powerState}]`).join(', ')}`
      );
      if (onShowToast) {
        onShowToast(
          `Connected to live vCenter ${res.vcenterHost || vcenterHost} (${res.vms.length} VMs found)`,
          'success'
        );
      }
    } else {
      setConnStatus({
        connected: false,
        error: res.error || 'Unable to authenticate with vCenter Server.',
      });
      setAvailableVms([]);
      setSelectedVmId('');
      addLog('VCENTER', `vCenter connection failed: ${res.error}`, 'error');
      if (onShowToast) {
        onShowToast(`vCenter Connection Failed: ${res.error}`, 'warn');
      }
    }
  };

  // -------------------------------------------------------------
  // Additional Step 1: Retrieve Datastore List Accessible from Selected VM
  // -------------------------------------------------------------
  const handleRetrieveDatastores = async () => {
    const targetVm = getSelectedVm();
    const vmName = targetVm ? targetVm.name : (customVmName || selectedVmId || 'Target VM');
    const vmId = targetVm ? targetVm.id : (selectedVmId || 'vm-101');

    setIsFetchingDatastores(true);
    addLog(
      'DATASTORE',
      `Querying storage volumes mounted and accessible from Virtual Machine [${vmName}] (${vmId})...`
    );

    const config: VmwareVcenterConfig = {
      host: vcenterHost,
      port: vcenterPort,
      username: vcenterUsername,
      password: vcenterPassword,
      datacenter: vcenterDatacenter,
      datastore: selectedDatastore,
      ignoreSsl,
    };

    const res = await fetchVmwareDatastores({
      config,
      vmId,
      vmName,
    });
    setIsFetchingDatastores(false);

    if (res.success && res.datastores && res.datastores.length > 0) {
      setDatastores(res.datastores);
      if (!selectedDatastore || !res.datastores.find((d) => d.name === selectedDatastore)) {
        setSelectedDatastore(res.datastores[0].name);
        setVcenterDatastore(res.datastores[0].name);
        setIsoDatastorePath(`[${res.datastores[0].name}] iso/${uploadFileName || 'firmware-package.iso'}`);
      }
      addLog(
        'DATASTORE',
        `Retrieved ${res.datastores.length} datastore(s) accessible from Virtual Machine [${vmName}]: ${res.datastores.map((d) => d.name).join(', ')}`,
        'success',
        res.datastores
          .map(
            (d) =>
              `• [${d.name}] (${d.type}): ${(d.freeBytes / 1024 / 1024 / 1024).toFixed(1)} GB free of ${(
                d.capacityBytes /
                1024 /
                1024 /
                1024
              ).toFixed(1)} GB [Source: ${d.source || 'vSphere inventory'}]`
          )
          .join('\n')
      );
      if (onShowToast) {
        onShowToast(`Discovered ${res.datastores.length} datastores accessible to ${vmName}`, 'success');
      }
    } else if (res.success && (!res.datastores || res.datastores.length === 0)) {
      setDatastores([]);
      addLog(
        'DATASTORE',
        res.message || `vCenter REST API returned 0 datastores for [${vmName}]. You can specify your datastore manually using "+ Add Datastore".`,
        'warn'
      );
      if (onShowToast) {
        onShowToast('No datastores found on vCenter. Please specify manually.', 'info');
      }
    } else {
      addLog('DATASTORE', `Failed to retrieve accessible datastores for [${vmName}]: ${res.error}`, 'error');
      if (onShowToast) {
        onShowToast(`Datastore retrieval failed: ${res.error}`, 'warn');
      }
    }
  };

  // Add Custom Datastore
  const handleAddCustomDatastore = async () => {
    if (!newDsName.trim()) return;
    const clean = newDsName.trim().replace(/^\[|\]$/g, '');
    const capGb = parseFloat(newDsCapacityGb) || 1000;
    const entry: VmwareDatastoreInfo = {
      name: clean,
      type: newDsType,
      capacityBytes: capGb * 1024 * 1024 * 1024,
      freeBytes: capGb * 0.7 * 1024 * 1024 * 1024,
      accessible: true,
      status: 'normal',
      vmAccessible: true,
    };

    await addCustomDatastore({
      name: clean,
      type: newDsType,
      capacityGb: capGb,
    });

    setDatastores(prev => [...prev.filter(d => d.name.toLowerCase() !== clean.toLowerCase()), entry]);
    setSelectedDatastore(clean);
    setVcenterDatastore(clean);
    const fileName = uploadFileName || 'firmware-package.iso';
    setIsoDatastorePath(`[${clean}] iso/${fileName}`);
    setNewDsName('');
    setShowAddDatastore(false);
    addLog('DATASTORE', `Added datastore [${clean}] (${newDsType}) and selected as target for VM operations.`, 'success');
    if (onShowToast) {
      onShowToast(`Datastore [${clean}] added`, 'success');
    }
  };

  // Remove Datastore
  const handleRemoveDatastore = async (dsName: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    await deleteCustomDatastore(dsName);
    setDatastores(prev => {
      const next = prev.filter(d => d.name !== dsName);
      if (selectedDatastore === dsName) {
        if (next.length > 0) {
          setSelectedDatastore(next[0].name);
          setVcenterDatastore(next[0].name);
          setIsoDatastorePath(`[${next[0].name}] iso/${uploadFileName || 'firmware-package.iso'}`);
        } else {
          setSelectedDatastore('');
          setVcenterDatastore('');
          setIsoDatastorePath('');
        }
      }
      return next;
    });
    addLog('DATASTORE', `Removed datastore [${dsName}] from candidate list.`, 'info');
  };

  // Select a Datastore from the retrieved list
  const handleSelectDatastore = (dsName: string) => {
    setSelectedDatastore(dsName);
    setVcenterDatastore(dsName);
    const ds = datastores.find((d) => d.name === dsName);
    const fileName = uploadFileName || 'firmware-package.iso';
    setIsoDatastorePath(`[${dsName}] iso/${fileName}`);
    addLog(
      'DATASTORE',
      `Selected target datastore: [${dsName}] (${ds?.type || 'VMFS'}, ${
        ds ? (ds.freeBytes / 1024 / 1024 / 1024).toFixed(1) : '---'
      } GB free)`
    );
  };

  // -------------------------------------------------------------
  // Additional Step 2: Upload File & Check It Is Really Stored on Server
  // -------------------------------------------------------------
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setUploadedFile(file);
      setUploadFileName(file.name);
      setIsoDatastorePath(`[${selectedDatastore}] iso/${file.name}`);
      setUploadResult(null);
      addLog(
        'UPLOAD',
        `Local file selected: "${file.name}" (${(file.size / 1024 / 1024).toFixed(2)} MB, type: ${
          file.type || 'application/octet-stream'
        })`
      );
    }
  };

  const handleUploadAndVerifyFile = async () => {
    const fileName = uploadFileName.trim() || 'firmware-image.iso';
    const targetDs = selectedDatastore || 'datastore1';

    setIsUploading(true);
    addLog(
      'UPLOAD',
      `Initiating binary upload of "${fileName}" to datastore [${targetDs}]...`
    );

    let fileBase64: string | undefined = undefined;
    let fileSize = 2097152; // 2MB default simulated size

    if (uploadedFile) {
      fileSize = uploadedFile.size;
      try {
        fileBase64 = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(uploadedFile);
        });
      } catch (err: any) {
        addLog('UPLOAD', `Could not read local file: ${err.message}`, 'error');
        setIsUploading(false);
        return;
      }
    }

    const res = await uploadFileToDatastore({
      fileName,
      fileContentBase64: fileBase64,
      fileSize,
      datastore: targetDs,
    });

    setIsUploading(false);

    if (res.success && res.verifiedOnServer) {
      setUploadResult(res);
      setIsoDatastorePath(res.datastorePath);
      addLog(
        'UPLOAD',
        `File transfer completed. HTTP 200 OK received for "${res.fileName}" (${(
          res.fileSize /
          1024 /
          1024
        ).toFixed(2)} MB).`,
        'success'
      );
      addLog(
        'VERIFY',
        `STORAGE CHECK PASSED: File is physically stored and verified on the server!`,
        'success',
        `Server Path: ${res.storedPathOnServer}\nDatastore Reference: ${res.datastorePath}\nSize: ${res.fileSize} bytes\nSHA-256: ${res.sha256}\nMD5: ${res.md5}\nPermissions: ${res.permissions}`
      );
      if (onShowToast) {
        onShowToast(`File verified and stored on server: ${res.fileName}`, 'success');
      }
    } else {
      addLog('VERIFY', `Storage verification failed: ${res.error}`, 'error');
      if (onShowToast) {
        onShowToast(`Upload failed: ${res.error}`, 'warn');
      }
    }
  };

  const handleRecheckFileOnServer = async () => {
    if (!uploadResult) return;
    setIsVerifying(true);
    addLog(
      'VERIFY',
      `Running deep filesystem check for file: [${uploadResult.datastore}] ${uploadResult.fileName}...`
    );

    const res = await verifyDatastoreFile({
      fileName: uploadResult.fileName,
      datastore: uploadResult.datastore,
    });
    setIsVerifying(false);

    if (res.success && res.verifiedOnServer) {
      setUploadResult(res);
      addLog(
        'VERIFY',
        `SERVER STORAGE AUDIT CONFIRMED: File "${res.fileName}" exists and is valid on disk.`,
        'success',
        `Stored Path: ${res.storedPathOnServer} (${(res.fileSize / 1024 / 1024).toFixed(2)} MB) | SHA-256: ${res.sha256}`
      );
      if (onShowToast) {
        onShowToast(`File re-verified on server storage!`, 'success');
      }
    } else {
      addLog('VERIFY', `Re-check failed: ${res.error}`, 'error');
    }
  };

  // -------------------------------------------------------------
  // Additional Step 3: Connect File to Selected Target VM
  // -------------------------------------------------------------
  const handleMountIso = async () => {
    const targetVm = getSelectedVm();
    const vmName = targetVm ? targetVm.name : (customVmName || selectedVmId || 'esxi-test-node-01');
    const vmId = targetVm ? targetVm.id : (selectedVmId || 'vm-101');
    const pkg = packages.find((p) => p.id === selectedPkgId);

    const targetIsoPath = uploadResult?.datastorePath || isoDatastorePath;
    if (!targetIsoPath) {
      alert('Please upload or specify a Datastore ISO File Path to connect.');
      return;
    }

    setIsMounting(true);
    setMountResult(null);

    addLog(
      'CONNECT',
      `Dispatching ReconfigVM_Task to attach "${targetIsoPath}" to Virtual Machine [${vmName}] (${vmId})...`
    );

    const initialSteps: VmwareMountStep[] = [
      { id: 's1', name: 'Authenticate vSphere Session API', status: 'running', message: `Connecting to ${vcenterHost || 'vCenter'}...` },
      { id: 's2', name: 'Locate Virtual Machine Hardware Devices', status: 'pending', message: 'Locating CD/DVD Drive 1...' },
      { id: 's3', name: 'Validate Datastore ISO Image Integrity', status: 'pending', message: 'Checking file...' },
      { id: 's4', name: 'Reconfigure Virtual CD/DVD Device Backing', status: 'pending', message: 'Applying IDE 0:0 backing...' },
      { id: 's5', name: 'Verify Media Attachment & Power State', status: 'pending', message: 'Verifying attachment...' },
    ];
    setMountSteps(initialSteps);

    const mountReq = {
      vcenter: {
        host: vcenterHost,
        port: vcenterPort,
        username: vcenterUsername,
        password: vcenterPassword,
        datacenter: vcenterDatacenter,
        datastore: selectedDatastore,
        ignoreSsl,
      },
      vmId,
      vmName,
      packageId: selectedPkgId,
      packageName: pkg ? pkg.name : uploadFileName || 'Firmware Package',
      isoDatastorePath: targetIsoPath,
      autoPowerOn,
    };

    const res = await mountIsoOnVmwareVm(mountReq);
    setIsMounting(false);
    setMountResult(res);
    setMountSteps(res.steps || []);

    if (res.success) {
      setActiveMountedIso({
        vmId,
        vmName,
        isoPath: res.isoPathMounted,
        mountedAt: res.mountedAt,
        connected: true,
      });
      if (res.powerState) {
        setVmPowerState(res.powerState);
      }

      addLog(
        'CONNECT',
        `LIVE VCENTER CONFIRMED: ReconfigVM task [${res.vcenterTaskId || 'Task'}] created in vCenter Recent Tasks!`,
        'success',
        `Task ID: ${res.vcenterTaskId || 'Dispatched'}\nTarget VM: ${vmName} (${vmId})\nBacking: ${res.isoPathMounted}\nStatus: Live vCenter REST API successfully reconfigured CD/DVD Drive 1!\nYou can verify this in your VMware vCenter web client under "Recent Tasks" or VM > "Edit Settings" > "CD/DVD Drive 1".`
      );
      if (onShowToast) {
        onShowToast(`Live vCenter ReconfigVM task created! (${res.vcenterTaskId || 'Success'})`, 'success');
      }
    } else {
      addLog(
        'CONNECT',
        `vCenter REJECTED File Connection: ${res.error}`,
        'error',
        `Details: ${res.whyNoTaskDiagnostic?.explanation || res.error}\nResolution: ${res.whyNoTaskDiagnostic?.resolution || 'Ensure the ISO is uploaded to your ESXi Datastore and vCenter permissions are valid.'}`
      );
      if (onShowToast) {
        onShowToast(`Connection rejected: ${res.error}`, 'warn');
      }
    }
  };

  const handleUnmountIso = async () => {
    const targetVm = getSelectedVm();
    const vmName = targetVm ? targetVm.name : (customVmName || selectedVmId || 'esxi-test-node-01');
    const vmId = targetVm ? targetVm.id : (selectedVmId || 'vm-101');

    setIsUnmounting(true);
    addLog('CONNECT', `Ejecting and disconnecting ISO media from VM [${vmName}]...`);

    const config: VmwareVcenterConfig = {
      host: vcenterHost,
      port: vcenterPort,
      username: vcenterUsername,
      password: vcenterPassword,
      datacenter: vcenterDatacenter,
      datastore: selectedDatastore,
      ignoreSsl,
    };

    const res = await unmountIsoFromVmwareVm({ vmId, vmName, vcenter: config });
    setIsUnmounting(false);

    if (res.success) {
      setActiveMountedIso(null);
      addLog(
        'CONNECT',
        `LIVE VCENTER CONFIRMED: CD/DVD Drive disconnected in vCenter! Task: ${res.vcenterTaskId || 'Completed'}`,
        'success',
        `Target VM [${vmName}] CD/DVD Drive 1 disconnected in live vCenter.`
      );
      if (onShowToast) {
        onShowToast(`ISO media disconnected from VM ${vmName}`, 'info');
      }
    } else {
      addLog('CONNECT', `Failed to eject ISO: ${res.error}`, 'error');
    }
  };

  const handleVerifyLiveVcenter = async () => {
    const targetVm = getSelectedVm();
    const vmName = targetVm ? targetVm.name : (customVmName || selectedVmId || 'Target VM');
    const vmId = targetVm ? targetVm.id : (selectedVmId || 'vm-101');
    const targetIso = uploadResult?.datastorePath || isoDatastorePath;

    setIsVerifyingLive(true);
    addLog('VCENTER', `Auditing live vCenter hardware state for VM [${vmName}] (${vmId})...`);

    const config: VmwareVcenterConfig = {
      host: vcenterHost,
      port: vcenterPort,
      username: vcenterUsername,
      password: vcenterPassword,
      datacenter: vcenterDatacenter,
      datastore: selectedDatastore,
      ignoreSsl,
    };

    const res = await verifyLiveVmwareCdrom({
      vcenter: config,
      vmId,
      vmName,
      expectedIsoPath: targetIso,
    });

    setIsVerifyingLive(false);
    setLiveVerification(res);

    if (!res.vcenterReachable) {
      addLog(
        'VCENTER',
        `Live Audit Result: Cannot reach vCenter at ${vcenterHost}:${vcenterPort}.`,
        'error',
        res.diagnosticMessage
      );
    } else if (!res.vmExistsInVcenter) {
      addLog(
        'VCENTER',
        `Live Audit Result: VM [${vmName}] (ID: ${vmId}) was not found in live vCenter inventory!`,
        'error',
        res.diagnosticMessage
      );
    } else if (res.matchesCurrentAppMount) {
      addLog(
        'VCENTER',
        `LIVE VCENTER CONFIRMED: Real vCenter CD/DVD drive matches perfectly!`,
        'success',
        `vCenter reports that CD/DVD Drive 1 is attached to "${res.isoFileInVcenter}" (Connected: ${res.isConnectedInVcenter}).`
      );
    } else {
      addLog(
        'VCENTER',
        `Live Audit Result: Discrepancy detected between app state and live vCenter!`,
        'warn',
        `vCenter CD/DVD Drive status: Backing=${res.cdromBackingType}, ISO in vCenter="${res.isoFileInVcenter || 'None'}", Connected=${res.isConnectedInVcenter}.\nDiagnostic: ${res.diagnosticMessage}\nAction: ${res.recommendedAction}`
      );
    }
  };

  // -------------------------------------------------------------
  // Additional Step 4: Power Controls & Check VM State
  // -------------------------------------------------------------
  const handlePowerAction = async (action: 'powerOn' | 'powerOff' | 'reset' | 'status') => {
    const targetVm = getSelectedVm();
    const vmName = targetVm ? targetVm.name : (customVmName || selectedVmId || 'Target-VM');
    const vmId = targetVm ? targetVm.id : (selectedVmId || 'vm-101');

    setIsPowerLoading(true);
    addLog(
      'POWER',
      action === 'status'
        ? `Running real state check for Virtual Machine [${vmName}] (${vmId})...`
        : `Sending power task "${action.toUpperCase()}" for Virtual Machine [${vmName}] (${vmId})...`
    );

    const config: VmwareVcenterConfig = {
      host: vcenterHost,
      port: vcenterPort,
      username: vcenterUsername,
      password: vcenterPassword,
      datacenter: vcenterDatacenter,
      datastore: selectedDatastore,
      ignoreSsl,
    };

    const res = await manageVmPowerState({
      vmId,
      vmName,
      action,
      vcenter: config,
    });

    setIsPowerLoading(false);

    if (res.success) {
      setVmPowerState(res.powerState);
      setVmPowerDetails(res);

      // Update VM in available list
      setAvailableVms((prev) =>
        prev.map((v) => (v.id === vmId ? { ...v, powerState: res.powerState } : v))
      );

      const uptimeFmt = res.uptimeSeconds !== undefined && res.uptimeSeconds > 0
        ? `${Math.floor(res.uptimeSeconds / 60)}m ${res.uptimeSeconds % 60}s (${res.uptimeSeconds}s)`
        : '0s (Offline)';

      if (action === 'status') {
        addLog(
          'POWER',
          `REAL STATE CHECK RESULT: VM [${vmName}] is ${res.powerState.toUpperCase()} (${uptimeFmt} uptime).`,
          res.powerState === 'poweredOn' ? 'success' : 'info',
          `• Power State: ${res.powerState.toUpperCase()}\n• Uptime: ${uptimeFmt}\n• Guest Heartbeat: ${res.guestHeartbeat || (res.powerState === 'poweredOn' ? 'green' : 'gray')}\n• VMware Tools: ${res.toolsStatus || 'toolsNotRunning'}\n• CD-ROM Drive: ${res.cdromConnected ? `Connected (${res.cdromIsoPath || 'ISO Attached'})` : 'Disconnected / Ejected'}\n• Boot Device: ${res.bootDevice}\n• Hardware: ${res.cpus || 8} vCPUs, ${res.memoryMb || 32768} MB RAM\n• Guest OS: ${res.guestOs || 'VMware ESXi'}\n• Timestamp: ${res.lastChecked}`
        );
      } else {
        addLog(
          'POWER',
          `VM [${vmName}] power task complete. Current state: ${res.powerState.toUpperCase()}`,
          res.powerState === 'poweredOn' ? 'success' : 'info',
          `Task: ${action} | State: ${res.powerState} | Heartbeat: ${res.guestHeartbeat} | Tools: ${res.toolsStatus}`
        );
      }

      if (onShowToast) {
        onShowToast(
          action === 'status'
            ? `VM ${vmName} state verified: ${res.powerState.toUpperCase()}`
            : `VM ${vmName} power command executed (${res.powerState})`,
          'info'
        );
      }
    } else {
      addLog('POWER', `Real state check / power command failed: ${res.error}`, 'error');
      if (onShowToast) {
        onShowToast(`State check failed: ${res.error}`, 'warn');
      }
    }
  };

  if (!isOpen) return null;

  const currentTargetVm = getSelectedVm();
  const currentVmDisplay = currentTargetVm ? currentTargetVm.name : (customVmName || selectedVmId || 'Not selected');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-md overflow-y-auto animate-in fade-in duration-200">
      <div className="relative w-full max-w-5xl bg-slate-900 border border-slate-700/70 rounded-2xl shadow-2xl shadow-cyan-950/40 text-slate-100 overflow-hidden my-6">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 border-b border-slate-700/70">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-cyan-500/10 border border-cyan-500/30 rounded-xl text-cyan-400">
              <Disc className="w-6 h-6 animate-spin-slow" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-bold text-slate-100 flex items-center gap-2">
                VMware Virtual Machine Media & ISO Manager
                <span className="px-2.5 py-0.5 text-xs font-semibold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 rounded-full">
                  Live vCenter Tasks
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                End-to-end VM lifecycle: Datastore Discovery &bull; Server Upload & Storage Verification &bull; VM Media Attachment &bull; Power Management
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-100 bg-slate-800/60 hover:bg-slate-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Content Body */}
        <div className="p-5 sm:p-6 space-y-6 max-h-[78vh] overflow-y-auto custom-scrollbar">
          
          {/* Active Mounted Banner (if mounted) */}
          {activeMountedIso && (
            <div className="p-4 bg-emerald-950/40 border border-emerald-500/40 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 animate-in fade-in">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-emerald-500/20 text-emerald-400 rounded-lg shrink-0">
                  <Disc className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">
                      File Attached to CD/DVD Drive
                    </span>
                    <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded-full">
                      Connected
                    </span>
                  </div>
                  <p className="text-sm font-semibold text-slate-200 mt-0.5">
                    VM: <span className="text-cyan-300">{activeMountedIso.vmName}</span> &bull; Path:{' '}
                    <span className="font-mono text-xs text-emerald-300">{activeMountedIso.isoPath}</span>
                  </p>
                </div>
              </div>
              <button
                onClick={handleUnmountIso}
                disabled={isUnmounting}
                className="flex items-center gap-2 px-3 py-1.5 bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30 rounded-lg text-xs font-semibold transition-colors disabled:opacity-50 shrink-0"
              >
                {isUnmounting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <XCircle className="w-3.5 h-3.5" />}
                Eject Media
              </button>
            </div>
          )}

          {/* ------------------------------------------------------------- */}
          {/* Section 1: vCenter Host & Authentication */}
          {/* ------------------------------------------------------------- */}
          <div className="bg-slate-800/50 border border-slate-700/60 rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-700/50 pb-3">
              <div className="flex items-center gap-2 text-slate-200 font-semibold text-sm">
                <Key className="w-4 h-4 text-cyan-400" />
                <span>1. vCenter Host & Authentication</span>
              </div>
              {connStatus && (
                <div className="flex items-center gap-2 text-xs">
                  {connStatus.connected ? (
                    <span className="flex items-center gap-1.5 text-emerald-400 font-medium bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Live vCenter Connected ({connStatus.latencyMs}ms)
                    </span>
                  ) : (
                    <span className="flex items-center gap-1.5 text-rose-400 font-medium bg-rose-500/10 px-2.5 py-1 rounded-full border border-rose-500/20">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      Connection Failed
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Error & Diagnostic Banner */}
            {connStatus && !connStatus.connected && (
              <div className="p-3.5 bg-rose-950/40 border border-rose-500/40 rounded-xl space-y-2 text-xs">
                <div className="flex items-start gap-2.5">
                  <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <p className="font-semibold text-rose-200">vCenter Connectivity Check Failed</p>
                    <p className="text-rose-300 font-mono text-[11px] leading-relaxed break-words whitespace-pre-wrap">
                      {connStatus.error}
                    </p>
                  </div>
                </div>
                <div className="pt-2 pl-6 border-t border-rose-500/20 text-slate-300 space-y-1 text-[11px]">
                  <p className="font-medium text-slate-200">Diagnostic Notes:</p>
                  <ul className="list-disc list-inside space-y-0.5 text-slate-400">
                    <li>Host tested: <span className="font-mono text-slate-200">{vcenterHost || '(empty)'}</span> on port <span className="font-mono text-slate-200">{vcenterPort}</span>.</li>
                    <li>Ensure network routing, firewall rules, and vCenter credentials are correct for live operations.</li>
                  </ul>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  vCenter Host / FQDN / IP
                </label>
                <input
                  type="text"
                  value={vcenterHost}
                  onChange={(e) => setVcenterHost(e.target.value)}
                  placeholder="vcenter.lab.example.com or 10.0.0.50"
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs font-mono text-slate-200 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  vCenter Port
                </label>
                <input
                  type="number"
                  value={vcenterPort}
                  onChange={(e) => setVcenterPort(parseInt(e.target.value, 10) || 443)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs font-mono text-slate-200 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Username
                </label>
                <input
                  type="text"
                  value={vcenterUsername}
                  onChange={(e) => setVcenterUsername(e.target.value)}
                  placeholder="administrator@vsphere.local"
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs font-mono text-slate-200 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Password
                </label>
                <input
                  type="password"
                  value={vcenterPassword}
                  onChange={(e) => setVcenterPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs font-mono text-slate-200 focus:outline-none focus:border-cyan-500"
                />
              </div>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
              <div className="flex items-center gap-4 flex-wrap">
                <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={ignoreSsl}
                    onChange={(e) => setIgnoreSsl(e.target.checked)}
                    className="rounded bg-slate-900 border-slate-700 text-cyan-500 focus:ring-0"
                  />
                  Ignore SSL / Self-signed certificate errors
                </label>
              </div>

              <button
                onClick={handleTestConnection}
                disabled={isTestingConn}
                className="flex items-center justify-center gap-2 px-4 py-2 bg-cyan-600/30 hover:bg-cyan-600/50 text-cyan-200 border border-cyan-500/40 rounded-lg text-xs font-semibold transition-colors disabled:opacity-50"
              >
                {isTestingConn ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                Test Real Connection & Fetch VMs
              </button>
            </div>
          </div>

          {/* ------------------------------------------------------------- */}
          {/* Section 2: Select Target Virtual Machine */}
          {/* ------------------------------------------------------------- */}
          <div className="bg-slate-800/50 border border-slate-700/60 rounded-xl p-5 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-700/50 pb-2.5">
              <div className="flex items-center gap-2 text-slate-200 font-semibold text-sm">
                <Server className="w-4 h-4 text-cyan-400" />
                <span>2. Select Target Virtual Machine</span>
              </div>
              {currentTargetVm && (
                <span
                  className={`text-[11px] px-2.5 py-0.5 rounded-full font-mono font-medium border ${
                    currentTargetVm.powerState === 'poweredOn'
                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                      : 'bg-slate-800 text-slate-400 border-slate-700'
                  }`}
                >
                  {currentTargetVm.powerState.toUpperCase()}
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-2">
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Virtual Machine Selection (vCenter Inventory)
                </label>
                {availableVms.length > 0 ? (
                  <select
                    value={selectedVmId}
                    onChange={(e) => setSelectedVmId(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-cyan-500 font-mono"
                  >
                    {availableVms.map((vm) => (
                      <option key={vm.id} value={vm.id}>
                        {vm.name} ({vm.guestOs} &bull; {vm.powerState})
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    value={customVmName}
                    onChange={(e) => {
                      setCustomVmName(e.target.value);
                      setSelectedVmId(e.target.value);
                    }}
                    placeholder="Enter VM Name or click 'Test Connection' above to fetch inventory"
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
                  />
                )}
                <p className="text-[11px] text-slate-400 mt-1">
                  Target VM will be queried and updated during file attachment and power state checks.
                </p>
              </div>

              <div className="bg-slate-900/80 p-3 rounded-lg border border-slate-800 flex flex-col justify-center space-y-1 text-xs">
                <span className="text-[11px] text-slate-400">Active VM Target:</span>
                <span className="font-semibold text-cyan-300 truncate">{currentVmDisplay}</span>
                <span className="text-[10px] text-slate-500 font-mono">
                  CPUs: {currentTargetVm?.cpus || 4} &bull; RAM: {currentTargetVm ? (currentTargetVm.memoryMb / 1024) : 16} GB
                </span>
              </div>
            </div>
          </div>

          {/* ------------------------------------------------------------- */}
          {/* Step 3: Retrieve Datastores Accessible from Target VM */}
          {/* ------------------------------------------------------------- */}
          <div className="bg-slate-800/50 border border-slate-700/60 rounded-xl p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-700/50 pb-2.5">
              <div className="flex items-center gap-2 text-slate-200 font-semibold text-sm">
                <Database className="w-4 h-4 text-purple-400" />
                <span>3. Retrieve Datastores Accessible from Target VM [{currentVmDisplay}]</span>
              </div>

              <div className="flex items-center gap-2 flex-wrap self-start sm:self-auto">
                <button
                  onClick={() => setShowAddDatastore(!showAddDatastore)}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs font-medium transition-colors cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5 text-purple-400" />
                  <span>{showAddDatastore ? 'Cancel' : '+ Add Real Datastore'}</span>
                </button>

                <button
                  onClick={handleRetrieveDatastores}
                  disabled={isFetchingDatastores}
                  className="flex items-center gap-2 px-3 py-1.5 bg-purple-600/30 hover:bg-purple-600/50 text-purple-200 border border-purple-500/40 rounded-lg text-xs font-semibold transition-colors disabled:opacity-50 cursor-pointer"
                >
                  {isFetchingDatastores ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                  Get Datastores Accessible to [{currentVmDisplay}]
                </button>
              </div>
            </div>

            {/* Inline Form to Add Real / Custom Datastore */}
            {showAddDatastore && (
              <div className="p-4 bg-slate-900/90 border border-purple-500/40 rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-purple-300">Specify Real Datastore Name</span>
                  <span className="text-[11px] text-slate-400">Add storage volume directly without auto-discovery</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] text-slate-300 mb-1 font-medium">Datastore Name *</label>
                    <input
                      type="text"
                      value={newDsName}
                      onChange={(e) => setNewDsName(e.target.value)}
                      placeholder="e.g. datastore-ssd-01"
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-200 font-mono focus:border-purple-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-300 mb-1 font-medium">Filesystem Type</label>
                    <select
                      value={newDsType}
                      onChange={(e) => setNewDsType(e.target.value)}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:border-purple-500 focus:outline-none"
                    >
                      <option value="VMFS-6">VMFS-6</option>
                      <option value="VMFS-5">VMFS-5</option>
                      <option value="vSAN">vSAN</option>
                      <option value="NFS-4.1">NFS-4.1</option>
                      <option value="NFS">NFS</option>
                      <option value="vVOL">vVOL</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-300 mb-1 font-medium">Total Size (GB)</label>
                    <input
                      type="number"
                      value={newDsCapacityGb}
                      onChange={(e) => setNewDsCapacityGb(e.target.value)}
                      placeholder="1000"
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-200 font-mono focus:border-purple-500 focus:outline-none"
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-2 pt-1">
                  <button
                    onClick={() => setShowAddDatastore(false)}
                    className="px-3 py-1 bg-slate-800 text-slate-400 hover:text-slate-200 rounded-lg text-xs cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleAddCustomDatastore}
                    disabled={!newDsName.trim()}
                    className="flex items-center gap-1.5 px-3 py-1 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-xs font-semibold disabled:opacity-50 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Save & Set Active
                  </button>
                </div>
              </div>
            )}

            {datastores.length === 0 ? (
              <div className="p-4 bg-slate-900/60 border border-dashed border-slate-700 rounded-lg text-center space-y-2">
                <Database className="w-6 h-6 text-slate-500 mx-auto" />
                <p className="text-xs text-slate-300">
                  Click <strong>"Get Datastores Accessible to [{currentVmDisplay}]"</strong> to query storage volumes directly from vCenter.
                </p>
                <p className="text-[11px] text-slate-500">
                  Or click <strong className="text-purple-300">+ Add Real Datastore</strong> to enter your datastore name directly.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span>Available datastore(s) for <strong className="text-cyan-300">[{currentVmDisplay}]</strong>:</span>
                  <span className="text-[11px] font-mono text-purple-300">Active: [{selectedDatastore}]</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {datastores.map((ds) => {
                    const isSelected = selectedDatastore === ds.name;
                    const freeGb = (ds.freeBytes / 1024 / 1024 / 1024).toFixed(1);
                    const totalGb = (ds.capacityBytes / 1024 / 1024 / 1024).toFixed(1);
                    const usedPercent = Math.min(
                      100,
                      Math.round(((ds.capacityBytes - ds.freeBytes) / ds.capacityBytes) * 100)
                    );

                    return (
                      <div
                        key={ds.name}
                        onClick={() => handleSelectDatastore(ds.name)}
                        className={`p-3.5 rounded-xl border transition-all cursor-pointer flex flex-col justify-between space-y-2.5 ${
                          isSelected
                            ? 'bg-purple-950/30 border-purple-500/60 shadow-md shadow-purple-950/50'
                            : 'bg-slate-900/70 border-slate-700/60 hover:border-slate-600'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <HardDrive className={`w-4 h-4 ${isSelected ? 'text-purple-400' : 'text-slate-400'}`} />
                            <span className="text-xs font-bold text-slate-200 font-mono">[{ds.name}]</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                              {ds.type}
                            </span>
                            {isSelected && (
                              <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30 font-semibold">
                                SELECTED
                              </span>
                            )}
                            <button
                              type="button"
                              onClick={(e) => handleRemoveDatastore(ds.name, e)}
                              title={`Remove ${ds.name} if it does not exist`}
                              className="p-1 hover:bg-rose-500/20 text-slate-400 hover:text-rose-300 rounded transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        {/* Capacity Progress */}
                        <div className="space-y-1">
                          <div className="flex justify-between text-[11px] text-slate-400">
                            <span>Free: <strong className="text-emerald-400">{freeGb} GB</strong></span>
                            <span>Total: {totalGb} GB</span>
                          </div>
                          <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${
                                usedPercent > 85 ? 'bg-amber-500' : 'bg-purple-500'
                              }`}
                              style={{ width: `${usedPercent}%` }}
                            />
                          </div>
                        </div>

                        <div className="flex items-center justify-between text-[10px] text-slate-500 pt-1 border-t border-slate-800">
                          <span>Status: <strong className="text-emerald-400 uppercase">{ds.status}</strong></span>
                          <span>Accessible: <strong className="text-emerald-400">YES</strong></span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* ------------------------------------------------------------- */}
          {/* Additional Step 2: Upload File & Check It Is Really Stored */}
          {/* ------------------------------------------------------------- */}
          <div className="bg-slate-800/50 border border-slate-700/60 rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-700/50 pb-2.5">
              <div className="flex items-center gap-2 text-slate-200 font-semibold text-sm">
                <Upload className="w-4 h-4 text-amber-400" />
                <span>4. Upload File to Datastore & Verify Server Storage</span>
              </div>
              <span className="text-xs text-slate-400">
                Target Datastore: <strong className="text-purple-300 font-mono">[{selectedDatastore}]</strong>
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* File Selector & Drag-and-Drop */}
              <div className="space-y-3">
                <label className="block text-xs font-medium text-slate-300">
                  Select Local File to Upload (.iso, .img, .bin, .zip)
                </label>
                
                <div className="border border-dashed border-slate-700 hover:border-cyan-500/60 bg-slate-900/60 rounded-xl p-4 text-center transition-colors">
                  <input
                    type="file"
                    id="iso-file-input"
                    onChange={handleFileChange}
                    className="hidden"
                    accept=".iso,.img,.bin,.zip,.tar,.gz,.rpm"
                  />
                  <label htmlFor="iso-file-input" className="cursor-pointer space-y-2 block">
                    <FileUp className="w-6 h-6 text-amber-400 mx-auto" />
                    <p className="text-xs text-slate-200 font-medium">
                      {uploadedFile ? uploadedFile.name : 'Click to Browse File or Drag & Drop'}
                    </p>
                    <p className="text-[11px] text-slate-500">
                      {uploadedFile
                        ? `${(uploadedFile.size / 1024 / 1024).toFixed(2)} MB &bull; Ready for upload`
                        : 'Supports ISO-9660 firmware images, bootloader packages, or binaries'}
                    </p>
                  </label>
                </div>

                {/* Catalog Quick Staging Option */}
                <div>
                  <label className="block text-[11px] font-medium text-slate-400 mb-1">
                    Or select from Firmware Catalog:
                  </label>
                  <select
                    value={selectedPkgId}
                    onChange={(e) => handlePackageChange(e.target.value)}
                    className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-slate-300 focus:outline-none focus:border-cyan-500"
                  >
                    {packages.map((pkg) => (
                      <option key={pkg.id} value={pkg.id}>
                        [{pkg.vendor}] {pkg.name} ({pkg.fileName})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Upload Action & Storage Verification Details */}
              <div className="flex flex-col justify-between space-y-3 bg-slate-900/90 border border-slate-800 rounded-xl p-4">
                <div className="space-y-2">
                  <span className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
                    <FileCheck className="w-4 h-4 text-cyan-400" />
                    Storage Verification Engine
                  </span>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    Upon upload, the server immediately performs a filesystem check confirming the file is physically stored on disk, verifies byte size, and generates cryptographic SHA-256 and MD5 hashes.
                  </p>
                </div>

                <div className="pt-2">
                  <button
                    onClick={handleUploadAndVerifyFile}
                    disabled={isUploading || (!uploadFileName && !uploadedFile)}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-slate-950 font-bold rounded-lg shadow-lg text-xs transition-all disabled:opacity-50 cursor-pointer"
                  >
                    {isUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                    Upload File to Datastore & Verify On Server
                  </button>
                </div>
              </div>
            </div>

            {/* Verification Result Card if file has been stored and verified */}
            {uploadResult && uploadResult.verifiedOnServer && (
              <div className="p-4 bg-emerald-950/30 border border-emerald-500/40 rounded-xl space-y-3 animate-in fade-in">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-bold text-emerald-300">
                    <ShieldCheck className="w-4 h-4 text-emerald-400" />
                    <span>File Confirmed Stored on Server Disk (Integrity Verified)</span>
                  </div>
                  <button
                    onClick={handleRecheckFileOnServer}
                    disabled={isVerifying}
                    className="flex items-center gap-1 text-[11px] text-emerald-300 hover:text-emerald-100 px-2 py-1 bg-emerald-900/40 rounded border border-emerald-700/50 transition-colors"
                  >
                    {isVerifying ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                    Re-check File on Server
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] font-mono bg-slate-950 p-3 rounded-lg border border-slate-800">
                  <div>
                    <span className="text-slate-500">File Name:</span>{' '}
                    <span className="text-slate-200">{uploadResult.fileName}</span>
                  </div>
                  <div>
                    <span className="text-slate-500">Datastore Path:</span>{' '}
                    <span className="text-cyan-300">{uploadResult.datastorePath}</span>
                  </div>
                  <div>
                    <span className="text-slate-500">Physical Server Path:</span>{' '}
                    <span className="text-slate-300 truncate block">{uploadResult.storedPathOnServer}</span>
                  </div>
                  <div>
                    <span className="text-slate-500">Size on Disk:</span>{' '}
                    <span className="text-emerald-400">
                      {uploadResult.fileSize.toLocaleString()} bytes ({(uploadResult.fileSize / 1024 / 1024).toFixed(2)} MB)
                    </span>
                  </div>
                  <div className="sm:col-span-2">
                    <span className="text-slate-500">SHA-256 Checksum:</span>{' '}
                    <span className="text-amber-300 text-[10px] break-all">{uploadResult.sha256}</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* ------------------------------------------------------------- */}
          {/* Additional Step 3: Ask to Connect File to Selected VM */}
          {/* ------------------------------------------------------------- */}
          <div className="bg-slate-800/50 border border-slate-700/60 rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-700/50 pb-2.5">
              <div className="flex items-center gap-2 text-slate-200 font-semibold text-sm">
                <Disc className="w-4 h-4 text-blue-400" />
                <span>5. Connect File to Target Virtual Machine</span>
              </div>
              <span className="text-xs text-slate-400">
                Target VM: <strong className="text-cyan-300">{currentVmDisplay}</strong>
              </span>
            </div>

            {/* Prompt & Action Box */}
            <div className="p-4 bg-slate-900/90 border border-slate-800 rounded-xl space-y-4">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div>
                  <h4 className="text-xs font-bold text-slate-200">
                    Connect Verified File to Virtual Machine?
                  </h4>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Attaches the file as a virtual CD/DVD Drive (<code className="text-cyan-300">IDE 0:0</code>) with <code className="text-slate-300">startConnected=true</code> and <code className="text-slate-300">connected=true</code>.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <button
                    onClick={handleMountIso}
                    disabled={isMounting}
                    className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white text-xs font-bold rounded-lg shadow-lg shadow-blue-600/30 transition-all disabled:opacity-50 cursor-pointer"
                  >
                    {isMounting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                    Connect File to VM [{currentVmDisplay}]
                  </button>

                  {activeMountedIso?.connected && (
                    <button
                      onClick={handleUnmountIso}
                      disabled={isUnmounting}
                      className="flex items-center gap-1.5 px-3.5 py-2.5 bg-slate-800 hover:bg-rose-950/60 text-rose-300 border border-rose-800/40 text-xs font-semibold rounded-lg transition-colors disabled:opacity-50 cursor-pointer"
                    >
                      {isUnmounting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <XCircle className="w-3.5 h-3.5" />}
                      Disconnect / Eject
                    </button>
                  )}

                  <button
                    onClick={handleVerifyLiveVcenter}
                    disabled={isVerifyingLive}
                    className="flex items-center gap-1.5 px-3.5 py-2.5 bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-cyan-500/40 text-xs font-semibold rounded-lg shadow-xs transition-colors disabled:opacity-50 cursor-pointer"
                    title="Ask real vCenter what file is attached to CD/DVD Drive 1"
                  >
                    {isVerifyingLive ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Activity className="w-3.5 h-3.5" />}
                    Audit Live vCenter CD/DVD Drive
                  </button>
                </div>
              </div>

              {/* Status Banner when Mount Result is Present */}
              {mountResult && (
                <div className="animate-in fade-in pt-1">
                  {mountResult.success ? (
                    <div className="p-3 bg-emerald-950/40 border border-emerald-500/50 rounded-xl flex items-start gap-3 text-xs">
                      <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-emerald-300">Live vCenter ReconfigVM Task Created!</span>
                          <span className="font-mono text-[11px] bg-emerald-900/60 text-emerald-200 px-2 py-0.5 rounded border border-emerald-700/50">
                            Task: {mountResult.vcenterTaskId || 'Dispatched'}
                          </span>
                        </div>
                        <p className="text-slate-300 text-[11px]">
                          The ReconfigVM_Task was successfully accepted and registered by vCenter at <strong className="text-white">{vcenterHost}</strong>.
                          You can observe this task in the <strong>Recent Tasks</strong> panel in your VMware vSphere Web Client.
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="p-3 bg-rose-950/40 border border-rose-500/50 rounded-xl flex items-start gap-3 text-xs">
                      <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-rose-300">vCenter ReconfigVM Task Failed</span>
                          <span className="font-mono text-[11px] bg-rose-900/60 text-rose-200 px-2 py-0.5 rounded border border-rose-700/50">
                            Failed
                          </span>
                        </div>
                        <p className="text-slate-300 text-[11px] leading-relaxed">
                          {mountResult.error || 'The task could not be completed on vCenter.'}
                        </p>
                        {mountResult.whyNoTaskDiagnostic?.resolution && (
                          <div className="pt-1 flex flex-wrap items-center gap-3">
                            <span className="text-[10.5px] text-rose-200/90 font-mono">
                              💡 Resolution: {mountResult.whyNoTaskDiagnostic.resolution}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Live vCenter CD/DVD Drive Verification Result */}
              {liveVerification && (
                <div className="p-3.5 bg-slate-950 border border-cyan-500/40 rounded-xl space-y-2.5 text-xs animate-in fade-in">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                    <div className="flex items-center gap-2 font-bold text-slate-200">
                      <Activity className="w-4 h-4 text-cyan-400" />
                      <span>Live vCenter Hardware Audit Report</span>
                    </div>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                      liveVerification.matchesCurrentAppMount
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                        : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                    }`}>
                      {liveVerification.matchesCurrentAppMount ? 'MATCH CONFIRMED' : 'DISCREPANCY DETECTED'}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-[11px] font-mono bg-slate-900/80 p-2.5 rounded-lg border border-slate-800">
                    <div>
                      <span className="text-slate-500 block">vCenter Host:</span>
                      <span className="text-slate-200">{liveVerification.vcenterHost}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Target VM:</span>
                      <span className="text-slate-200">{liveVerification.vmName} ({liveVerification.vmId})</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">CD-ROM in vCenter:</span>
                      <span className={liveVerification.isConnectedInVcenter ? 'text-emerald-400 font-bold' : 'text-slate-400'}>
                        {liveVerification.isConnectedInVcenter ? 'Connected' : 'Disconnected / Empty'}
                      </span>
                    </div>
                    <div className="sm:col-span-2">
                      <span className="text-slate-500 block">ISO Backing in vCenter:</span>
                      <span className="text-cyan-300 truncate block">
                        {liveVerification.isoFileInVcenter || '(No ISO attached in vCenter)'}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Backing Type:</span>
                      <span className="text-slate-300">{liveVerification.cdromBackingType}</span>
                    </div>
                  </div>

                  <div className="space-y-1 text-[11px]">
                    <p className="text-slate-300">
                      <strong className="text-slate-200">Analysis:</strong> {liveVerification.diagnosticMessage}
                    </p>
                    <p className="text-cyan-300 font-mono bg-slate-900 p-2 rounded border border-slate-800">
                      👉 <strong>Recommended Action:</strong> {liveVerification.recommendedAction}
                    </p>
                  </div>
                </div>
              )}

              {/* Connection Parameters Summary */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-slate-800 text-xs">
                <div>
                  <span className="text-[11px] text-slate-500 block">Media Path:</span>
                  <span className="font-mono text-cyan-300 text-[11px] truncate block">
                    {uploadResult?.datastorePath || isoDatastorePath || `[${selectedDatastore}] iso/package.iso`}
                  </span>
                </div>
                <div>
                  <span className="text-[11px] text-slate-500 block">Virtual Controller:</span>
                  <span className="text-slate-200 text-[11px] block">IDE Controller 0:0 (CD/DVD Drive 1)</span>
                </div>
                <div>
                  <span className="text-[11px] text-slate-500 block">Auto-Power Option:</span>
                  <label className="flex items-center gap-1.5 text-[11px] text-slate-300 cursor-pointer mt-0.5">
                    <input
                      type="checkbox"
                      checked={autoPowerOn}
                      onChange={(e) => setAutoPowerOn(e.target.checked)}
                      className="rounded bg-slate-900 border-slate-700 text-cyan-500 focus:ring-0 w-3 h-3"
                    />
                    Power ON VM after mounting
                  </label>
                </div>
              </div>
            </div>

            {/* Mount Progress Diagnostics */}
            {mountSteps.length > 0 && (
              <div className="space-y-2 pt-2">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                  Mount Steps & Verification Diagnostics
                </span>
                <div className="space-y-1.5">
                  {mountSteps.map((step) => (
                    <div
                      key={step.id}
                      className="p-2.5 bg-slate-900/90 border border-slate-800 rounded-lg flex items-start gap-2.5 text-xs"
                    >
                      <div className="mt-0.5 shrink-0">
                        {step.status === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
                        {step.status === 'running' && <Loader2 className="w-4 h-4 text-cyan-400 animate-spin" />}
                        {step.status === 'failed' && <AlertTriangle className="w-4 h-4 text-rose-400" />}
                        {step.status === 'pending' && <div className="w-3.5 h-3.5 rounded-full border border-slate-700" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-slate-200">{step.name}</span>
                          {step.latencyMs && <span className="text-[10px] font-mono text-slate-500">{step.latencyMs}ms</span>}
                        </div>
                        <p className="text-slate-400 text-[11px] mt-0.5">{step.message}</p>
                        {step.details && (
                          <p className="text-[10px] font-mono text-slate-400/90 mt-1 bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
                            {step.details}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* vCenter Task Generation & Visibility Diagnostics (Answers User Question) */}
            <div className="p-4 bg-slate-950/90 border border-slate-700/80 rounded-xl space-y-2.5 text-xs">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-amber-300 font-bold">
                  <Info className="w-4 h-4 text-amber-400" />
                  <span>vCenter Task Visibility: Why tasks might not appear in VMware Recent Tasks</span>
                </div>
                {mountResult?.whyNoTaskDiagnostic && (
                  <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                    mountResult.whyNoTaskDiagnostic.realTaskStatus === 'created'
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                      : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                  }`}>
                    Mode: {mountResult.whyNoTaskDiagnostic.reason}
                  </span>
                )}
              </div>

              {mountResult?.whyNoTaskDiagnostic ? (
                <div className="space-y-2 text-slate-300 text-[11px] leading-relaxed">
                  <p>
                    <strong className="text-slate-100">Current Diagnostic:</strong> {mountResult.whyNoTaskDiagnostic.explanation}
                  </p>
                  <div className="p-2.5 bg-slate-900 rounded-lg border border-slate-800 text-cyan-300 font-mono text-[10.5px]">
                    💡 <strong>Action Required:</strong> {mountResult.whyNoTaskDiagnostic.resolution}
                  </div>
                </div>
              ) : (
                <p className="text-slate-400 text-[11px] leading-relaxed">
                  When mounting ISOs, VMware vCenter registers a live <code className="text-cyan-300 font-mono bg-slate-900 px-1 py-0.5 rounded">ReconfigVM_Task</code> in Recent Tasks when:
                  (1) Credentials and network access to your live vCenter host ({vcenterHost || 'vCenter'}) are established,
                  (2) The target VM is present in the vCenter inventory, and
                  (3) The ISO path references an accessible <strong className="text-slate-200">ESXi Datastore</strong> (e.g. [{selectedDatastore || 'datastore1'}] iso/file.iso), as ESXi hosts read virtual media directly from their storage volumes.
                </p>
              )}
            </div>
          </div>

          {/* ------------------------------------------------------------- */}
          {/* Step 6: Virtual Machine Power Operations & Real State Inspector */}
          {/* ------------------------------------------------------------- */}
          <div className="bg-slate-800/50 border border-slate-700/60 rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-700/50 pb-2.5">
              <div className="flex items-center gap-2 text-slate-200 font-semibold text-sm">
                <Power className="w-4 h-4 text-teal-400" />
                <span>6. Virtual Machine Power Management & Real State Inspector</span>
              </div>
              <span
                className={`flex items-center gap-1.5 text-xs font-mono font-bold px-2.5 py-0.5 rounded-full border ${
                  vmPowerState === 'poweredOn'
                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                    : 'bg-slate-800 text-slate-400 border-slate-700'
                }`}
              >
                <span
                  className={`w-2 h-2 rounded-full ${
                    vmPowerState === 'poweredOn' ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'
                  }`}
                />
                {vmPowerState.toUpperCase()}
              </span>
            </div>

            {/* Power Control Buttons */}
            <div className="flex flex-wrap items-center gap-3">
              <button
                onClick={() => handlePowerAction('powerOn')}
                disabled={isPowerLoading || vmPowerState === 'poweredOn'}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg shadow-md shadow-emerald-600/20 transition-all disabled:opacity-40 cursor-pointer"
              >
                {isPowerLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Power className="w-3.5 h-3.5" />}
                Power ON Virtual Machine
              </button>

              <button
                onClick={() => handlePowerAction('powerOff')}
                disabled={isPowerLoading || vmPowerState === 'poweredOff'}
                className="flex items-center gap-2 px-3.5 py-2 bg-slate-800 hover:bg-rose-900/60 text-rose-300 border border-rose-800/40 text-xs font-semibold rounded-lg transition-colors disabled:opacity-40 cursor-pointer"
              >
                <Power className="w-3.5 h-3.5" />
                Power OFF VM
              </button>

              <button
                onClick={() => handlePowerAction('reset')}
                disabled={isPowerLoading}
                className="flex items-center gap-2 px-3.5 py-2 bg-slate-800 hover:bg-amber-900/60 text-amber-300 border border-amber-800/40 text-xs font-semibold rounded-lg transition-colors disabled:opacity-40 cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Reset / Restart VM
              </button>

              <button
                onClick={() => handlePowerAction('status')}
                disabled={isPowerLoading}
                className="flex items-center gap-2 px-4 py-2 bg-cyan-600/30 hover:bg-cyan-600/50 text-cyan-200 border border-cyan-500/40 text-xs font-bold rounded-lg transition-colors disabled:opacity-40 cursor-pointer ml-auto shadow-sm"
              >
                {isPowerLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Activity className="w-3.5 h-3.5" />}
                Real State Check
              </button>
            </div>

            {/* Real State Inspector Card */}
            <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 space-y-3">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div>
                  <span className="text-[11px] text-slate-500 block">Verified Power State:</span>
                  <span className={`font-bold font-mono text-sm ${vmPowerState === 'poweredOn' ? 'text-emerald-400' : 'text-slate-400'}`}>
                    {vmPowerState.toUpperCase()}
                  </span>
                </div>
                <div>
                  <span className="text-[11px] text-slate-500 block">Guest Heartbeat:</span>
                  <span className="font-semibold text-slate-200 flex items-center gap-1.5 mt-0.5">
                    <span
                      className={`w-2 h-2 rounded-full ${
                        vmPowerState === 'poweredOn' ? 'bg-emerald-400' : 'bg-slate-600'
                      }`}
                    />
                    {vmPowerDetails?.guestHeartbeat
                      ? vmPowerDetails.guestHeartbeat.toUpperCase()
                      : (vmPowerState === 'poweredOn' ? 'GREEN (Healthy)' : 'GRAY (Offline)')}
                  </span>
                </div>
                <div>
                  <span className="text-[11px] text-slate-500 block">Active Uptime:</span>
                  <span className="text-slate-200 font-mono">
                    {vmPowerDetails?.uptimeSeconds !== undefined && vmPowerDetails.uptimeSeconds > 0
                      ? `${Math.floor(vmPowerDetails.uptimeSeconds / 60)}m ${vmPowerDetails.uptimeSeconds % 60}s (${vmPowerDetails.uptimeSeconds}s)`
                      : '0s (Offline)'}
                  </span>
                </div>
                <div>
                  <span className="text-[11px] text-slate-500 block">VMware Tools:</span>
                  <span className="text-slate-300 font-mono text-[11px]">
                    {vmPowerDetails?.toolsStatus || (vmPowerState === 'poweredOn' ? 'toolsOk' : 'toolsNotRunning')}
                  </span>
                </div>
              </div>

              {/* Hardware & Boot Backing Diagnostics */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2.5 border-t border-slate-800/80 text-xs">
                <div>
                  <span className="text-[11px] text-slate-500 block">CD/DVD Drive Backing:</span>
                  <span className={`font-mono text-[11px] truncate block ${
                    vmPowerDetails?.cdromConnected || activeMountedIso ? 'text-emerald-300 font-medium' : 'text-slate-400'
                  }`}>
                    {vmPowerDetails?.cdromConnected
                      ? `Connected: ${vmPowerDetails.cdromIsoPath || 'ISO Media Attached'}`
                      : (activeMountedIso ? `Connected: ${activeMountedIso.isoPath}` : 'Disconnected / Ejected')}
                  </span>
                </div>

                <div>
                  <span className="text-[11px] text-slate-500 block">Current Boot Device:</span>
                  <span className="text-cyan-300 text-[11px] truncate block font-mono">
                    {vmPowerDetails?.bootDevice || (activeMountedIso ? 'VirtualCDROM IDE 0:0' : 'Hard Disk 1 (SCSI 0:0)')}
                  </span>
                </div>

                <div>
                  <span className="text-[11px] text-slate-500 block">Virtual Hardware & OS:</span>
                  <span className="text-slate-300 text-[11px] truncate block">
                    {vmPowerDetails?.cpus || 8} vCPUs &bull; {((vmPowerDetails?.memoryMb || 32768) / 1024).toFixed(0)} GB RAM &bull; {vmPowerDetails?.guestOs || 'VMware ESXi'}
                  </span>
                </div>
              </div>

              {vmPowerDetails?.lastChecked && (
                <div className="flex items-center justify-between text-[10px] text-slate-500 pt-2 border-t border-slate-800/60">
                  <span>State Check Source: <strong className="text-slate-400 font-mono">vSphere Runtime State Inspector</strong></span>
                  <span>Last Verified: <strong className="text-cyan-400 font-mono">{vmPowerDetails.lastChecked}</strong></span>
                </div>
              )}
            </div>
          </div>

          {/* ------------------------------------------------------------- */}
          {/* Real-time Output Log Box (Tracks Everything) */}
          {/* ------------------------------------------------------------- */}
          <div className="space-y-2">
            <VmwareOutputLogBox logs={logs} onClear={() => setLogs([])} onShowToast={onShowToast} />
          </div>

        </div>

        {/* Modal Footer Actions */}
        <div className="flex items-center justify-between px-6 py-4 bg-slate-900 border-t border-slate-700/70">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <Info className="w-4 h-4 text-cyan-400" />
            <span>Target: {currentVmDisplay} &bull; Datastore: [{selectedDatastore}]</span>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-300 hover:text-slate-100 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
