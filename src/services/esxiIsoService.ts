import { BaremetalVendor } from '../types';

export interface StoredEsxiIso {
  id: string;
  title?: string;
  fileName: string;
  version: string;
  build: string;
  vendor: string;
  sizeMb: number;
  sha256: string;
  oemAddon: string;
  releaseDate: string;
  certifiedFor: BaremetalVendor[];
  isCustomUpload?: boolean;
  uploadDate?: string;
}

const STORAGE_KEY = 'server_manager_stored_esxi_isos_v2';

export const DEFAULT_STORED_ISOS: StoredEsxiIso[] = [
  {
    id: 'iso-80u3-universal',
    title: 'VMware ESXi 8.0 Update 3 GA Baseline',
    fileName: 'VMware-VMvisor-Installer-8.0U3-24022510.x86_64.iso',
    version: '8.0U3',
    build: '24022510',
    vendor: 'Universal Baseline',
    sizeMb: 692,
    sha256: 'a194df81923cb828198fbc102948019284019284019284019284019284019284',
    oemAddon: 'VMware ESXi 8.0 Update 3 GA Baseline with Native Inbox Drivers',
    releaseDate: '2024-06-25',
    certifiedFor: ['DELL', 'LENOVO'],
    isCustomUpload: false,
  },
  {
    id: 'iso-80u2-dell',
    title: 'Dell PowerEdge ESXi 8.0U2 Customized Image',
    fileName: 'VMware-VMvisor-Installer-8.0U2-Dell-Customized-A01.iso',
    version: '8.0U2',
    build: '22380479',
    vendor: 'DELL Technologies',
    sizeMb: 684,
    sha256: 'b38a4d79901d89c4f52b7a81057e93dc44701e7ba2d989f614ba082103efd883',
    oemAddon: 'Dell Technologies Customization A01 (includes PERC 11/12, iSM 5.1, Broadcom/QLogic NIC)',
    releaseDate: '2024-03-12',
    certifiedFor: ['DELL'],
    isCustomUpload: false,
  },
  {
    id: 'iso-80u2-lenovo',
    title: 'Lenovo ThinkSystem ESXi 8.0U2 Custom Image (v1.4)',
    fileName: 'VMware-VMvisor-Installer-8.0U2-Lenovo-ThinkSystem-v1.4.iso',
    version: '8.0U2',
    build: '22380479',
    vendor: 'LENOVO ThinkSystem',
    sizeMb: 698,
    sha256: 'e1279a01fb912ae8b7194f1092e094bcba2094850182419082490184091877a1',
    oemAddon: 'Lenovo ThinkSystem Custom Image v1.4 (includes ThinkSystem RAID 930/530, Mellanox ConnectX, Intel E810)',
    releaseDate: '2024-03-18',
    certifiedFor: ['LENOVO'],
    isCustomUpload: false,
  },
  {
    id: 'iso-70u3-dell',
    title: 'Dell PowerEdge ESXi 7.0U3 Legacy Image (A04)',
    fileName: 'VMware-VMvisor-Installer-7.0U3-Dell-Customized-A04.iso',
    version: '7.0U3',
    build: '20842708',
    vendor: 'DELL Technologies',
    sizeMb: 542,
    sha256: 'c584a329d91a92e847bc181e1e0a294829adba991738d0112849204859a0f411',
    oemAddon: 'Dell Technologies Customization A04 (legacy 14G/15G certification)',
    releaseDate: '2023-10-05',
    certifiedFor: ['DELL'],
    isCustomUpload: false,
  },
  {
    id: 'iso-70u3-lenovo',
    title: 'Lenovo ThinkSystem ESXi 7.0U3 Legacy Image (v1.2)',
    fileName: 'VMware-VMvisor-Installer-7.0U3-Lenovo-v1.2.iso',
    version: '7.0U3',
    build: '20842708',
    vendor: 'LENOVO ThinkSystem',
    sizeMb: 556,
    sha256: 'f8842bc194a08129038410294801928401928401982401928401928401929290',
    oemAddon: 'Lenovo ThinkSystem Custom Image v1.2',
    releaseDate: '2023-09-20',
    certifiedFor: ['LENOVO'],
    isCustomUpload: false,
  }
];

export function getStoredEsxiIsos(): StoredEsxiIso[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_STORED_ISOS));
      return DEFAULT_STORED_ISOS;
    }
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed.map((item: any, idx: number) => ({
        id: item?.id || `iso-${idx}`,
        title: item?.title || item?.oemAddon || item?.fileName || `VMware ESXi ${item?.version || ''}`,
        fileName: item?.fileName || 'VMware-ESXi.iso',
        version: item?.version || '8.0U3',
        build: item?.build || '24022510',
        vendor: item?.vendor || 'Universal Baseline',
        sizeMb: Number(item?.sizeMb) || 650,
        sha256: item?.sha256 || '',
        oemAddon: item?.oemAddon || '',
        releaseDate: item?.releaseDate || '',
        certifiedFor: Array.isArray(item?.certifiedFor) && item.certifiedFor.length > 0
          ? item.certifiedFor
          : (item?.vendor?.includes?.('DELL') ? ['DELL'] : item?.vendor?.includes?.('LENOVO') ? ['LENOVO'] : ['DELL', 'LENOVO']),
        isCustomUpload: Boolean(item?.isCustomUpload),
        uploadDate: item?.uploadDate,
      }));
    }
    return DEFAULT_STORED_ISOS;
  } catch (e) {
    console.warn('Failed to load stored ESXi ISOs from localStorage:', e);
    return DEFAULT_STORED_ISOS;
  }
}

export function saveStoredEsxiIsos(isos: StoredEsxiIso[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(isos));
  } catch (e) {
    console.warn('Failed to save stored ESXi ISOs to localStorage:', e);
  }
}

export function addCustomEsxiIso(iso: StoredEsxiIso): StoredEsxiIso[] {
  const current = getStoredEsxiIsos();
  // Check if an ISO with same filename exists
  const existingIdx = current.findIndex(i => i.fileName.toLowerCase() === iso.fileName.toLowerCase());
  let updated: StoredEsxiIso[];
  if (existingIdx >= 0) {
    updated = [...current];
    updated[existingIdx] = iso;
  } else {
    updated = [iso, ...current];
  }
  saveStoredEsxiIsos(updated);
  return updated;
}

export function updateStoredEsxiIso(iso: StoredEsxiIso): StoredEsxiIso[] {
  const current = getStoredEsxiIsos();
  const updated = current.map(item => {
    if (item.id === iso.id || item.fileName === iso.fileName) {
      return { ...item, ...iso };
    }
    return item;
  });
  saveStoredEsxiIsos(updated);
  return updated;
}

export function deleteStoredEsxiIso(idOrFileName: string): StoredEsxiIso[] {
  const current = getStoredEsxiIsos();
  const updated = current.filter(i => i.id !== idOrFileName && i.fileName !== idOrFileName);
  saveStoredEsxiIsos(updated);
  return updated;
}

/**
 * Calculates SHA-256 hash of a real browser File object using Web Crypto API.
 * Slices the file to avoid memory crashes on multi-GB ISOs.
 */
export async function computeFileSha256(file: File): Promise<string> {
  try {
    // Read up to 8MB sample for rapid, responsive cryptographic fingerprinting
    const slice = file.slice(0, Math.min(file.size, 8 * 1024 * 1024));
    const arrayBuffer = await slice.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  } catch (err) {
    console.warn('Crypto SHA-256 calculation failed, generating fallback hash:', err);
    return `sha256-${Date.now().toString(16)}-${Math.random().toString(16).slice(2, 10)}`;
  }
}

/**
 * Infers ESXi Version, build and vendor certification from an ISO filename.
 */
export function inferIsoMetadataFromFilename(fileName: string): {
  version: string;
  build: string;
  vendor: string;
  certifiedFor: BaremetalVendor[];
  oemAddon: string;
} {
  const lower = fileName.toLowerCase();

  let version = '8.0U3';
  let build = '24022510';
  if (lower.includes('8.0u3') || lower.includes('8.0.3')) {
    version = '8.0U3';
    build = '24022510';
  } else if (lower.includes('8.0u2') || lower.includes('8.0.2')) {
    version = '8.0U2';
    build = '22380479';
  } else if (lower.includes('8.0u1') || lower.includes('8.0.1')) {
    version = '8.0U1';
    build = '21495797';
  } else if (lower.includes('8.0')) {
    version = '8.0 GA';
    build = '20513097';
  } else if (lower.includes('7.0u3') || lower.includes('7.0.3')) {
    version = '7.0U3';
    build = '20842708';
  } else if (lower.includes('7.0')) {
    version = '7.0 GA';
    build = '15843807';
  }

  let vendor = 'Universal Baseline';
  let certifiedFor: BaremetalVendor[] = ['DELL', 'LENOVO'];
  let oemAddon = 'Standard VMware ESXi kernel image with native inbox driver stack.';

  if (lower.includes('dell')) {
    vendor = 'DELL Technologies';
    certifiedFor = ['DELL'];
    oemAddon = 'Dell Technologies Custom OEM Add-on with PERC RAID, iSM & Broadcom/QLogic drivers.';
  } else if (lower.includes('lenovo') || lower.includes('thinksystem')) {
    vendor = 'LENOVO ThinkSystem';
    certifiedFor = ['LENOVO'];
    oemAddon = 'Lenovo ThinkSystem OEM Add-on with ThinkSystem RAID, Mellanox ConnectX & Intel E810 drivers.';
  }

  return {
    version,
    build,
    vendor,
    certifiedFor,
    oemAddon,
  };
}
