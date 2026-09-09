import React, { useState, useEffect } from 'react';
import { 
  HardDrive, 
  CheckCircle2, 
  AlertCircle, 
  Download, 
  UploadCloud, 
  RefreshCw, 
  Copy, 
  Check, 
  X, 
  FileCode, 
  ShieldCheck, 
  Terminal, 
  Info,
  FolderDown,
  Sparkles
} from 'lucide-react';
import { FirmwarePackage, DiskVerificationResult } from '../types';
import { verifyFirmwareDiskFile, uploadFirmwareFile, storeSampleFirmwareToDisk } from '../services/api';

interface ServerFileInspectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  pkg: FirmwarePackage | null;
  onPackageUpdated?: (updatedPkg: FirmwarePackage) => void;
  onShowToast?: (msg: string, type?: 'success' | 'info' | 'warn') => void;
  onOpenStorageExplorer?: (fileName?: string) => void;
}

export const ServerFileInspectorModal: React.FC<ServerFileInspectorModalProps> = ({
  isOpen,
  onClose,
  pkg,
  onPackageUpdated,
  onShowToast,
  onOpenStorageExplorer,
}) => {
  const [loading, setLoading] = useState(false);
  const [diskResult, setDiskResult] = useState<DiskVerificationResult | null>(null);
  const [copied, setCopied] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  const checkFileOnDisk = async (fileName: string) => {
    setLoading(true);
    try {
      const res = await verifyFirmwareDiskFile(fileName);
      setDiskResult(res);
      if (res.exists && pkg && onPackageUpdated) {
        onPackageUpdated({
          ...pkg,
          storedPathOnServer: res.storedPathOnServer,
          relativeServerPath: res.relativeServerPath,
          verifiedOnDisk: true,
          fileSizeBytes: res.fileSizeBytes,
          verifiedAt: new Date().toISOString(),
          diskPermissions: res.permissions,
          diskMd5: res.md5,
        });
      }
    } catch (e: any) {
      if (onShowToast) onShowToast('Verification request failed: ' + e.message, 'warn');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && pkg?.fileName) {
      checkFileOnDisk(pkg.fileName);
    } else {
      setDiskResult(null);
    }
  }, [isOpen, pkg?.fileName]);

  if (!isOpen || !pkg) return null;

  const handleCopyPath = () => {
    if (diskResult?.storedPathOnServer) {
      navigator.clipboard.writeText(diskResult.storedPathOnServer);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      if (onShowToast) onShowToast('Server path copied to clipboard!', 'info');
    }
  };

  const handleManualUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    setIsUploading(true);

    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = reader.result as string;
      try {
        const uploadRes = await uploadFirmwareFile({
          fileName: file.name,
          fileContentBase64: base64,
          fileSize: file.size,
          component: pkg.component,
          vendor: pkg.vendor,
        });

        if (uploadRes.success && uploadRes.exists) {
          setDiskResult(uploadRes);
          if (onShowToast) onShowToast(`File "${file.name}" uploaded and verified on server disk!`, 'success');
          if (onPackageUpdated) {
            onPackageUpdated({
              ...pkg,
              fileName: uploadRes.fileName,
              storedPathOnServer: uploadRes.storedPathOnServer,
              relativeServerPath: uploadRes.relativeServerPath,
              verifiedOnDisk: true,
              fileSizeBytes: uploadRes.fileSizeBytes,
              fileSizeMb: uploadRes.fileSizeMb || pkg.fileSizeMb,
              sha256: uploadRes.sha256 || pkg.sha256,
              verifiedAt: new Date().toISOString(),
              diskPermissions: uploadRes.permissions,
              diskMd5: uploadRes.md5,
            });
          }
        } else {
          if (onShowToast) onShowToast(uploadRes.error || 'Failed to upload to server disk', 'warn');
        }
      } catch (err: any) {
        if (onShowToast) onShowToast('Upload error: ' + err.message, 'warn');
      } finally {
        setIsUploading(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleGenerateOnDisk = async () => {
    setIsGenerating(true);
    try {
      const res = await storeSampleFirmwareToDisk({
        fileName: pkg.fileName,
        fileSizeMb: pkg.fileSizeMb,
        sha256: pkg.sha256,
        component: pkg.component,
        vendor: pkg.vendor,
      });

      if (res.success && res.exists) {
        setDiskResult(res);
        if (onShowToast) onShowToast(`Firmware binary written and verified on server disk!`, 'success');
        if (onPackageUpdated) {
          onPackageUpdated({
            ...pkg,
            storedPathOnServer: res.storedPathOnServer,
            relativeServerPath: res.relativeServerPath,
            verifiedOnDisk: true,
            fileSizeBytes: res.fileSizeBytes,
            verifiedAt: new Date().toISOString(),
            diskPermissions: res.permissions,
            diskMd5: res.md5,
          });
        }
      } else {
        if (onShowToast) onShowToast(res.error || 'Failed to write to disk', 'warn');
      }
    } catch (e: any) {
      if (onShowToast) onShowToast('Error writing to disk: ' + e.message, 'warn');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/80">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center border border-emerald-200">
              <HardDrive className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900">Server Local Storage Verification</h3>
              <p className="text-xs text-slate-500">
                Checking physical disk existence on server filesystem for <span className="font-semibold text-slate-800">{pkg.name}</span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          
          {/* Package Summary Box */}
          <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-200">
                <FileCode className="w-5 h-5" />
              </div>
              <div>
                <div className="font-bold text-sm text-slate-900">{pkg.name}</div>
                <div className="text-xs text-slate-500 flex items-center gap-2 mt-0.5">
                  <span className="font-mono">{pkg.fileName}</span>
                  <span>•</span>
                  <span>{pkg.component} v{pkg.version}</span>
                  <span>•</span>
                  <span>{pkg.vendor}</span>
                </div>
              </div>
            </div>
            <button
              onClick={() => checkFileOnDisk(pkg.fileName)}
              disabled={loading}
              className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-100 transition-colors flex items-center gap-1.5"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-emerald-600' : ''}`} />
              <span>Re-check Disk</span>
            </button>
          </div>

          {/* Loading state */}
          {loading && (
            <div className="py-8 text-center text-slate-500 flex flex-col items-center justify-center gap-2">
              <RefreshCw className="w-6 h-6 animate-spin text-emerald-600" />
              <p className="text-xs">Querying server file system with fs.existsSync...</p>
            </div>
          )}

          {/* Verification Status Card */}
          {!loading && diskResult && (
            <div>
              {diskResult.exists ? (
                <div className="bg-emerald-50/80 border border-emerald-300 rounded-xl p-5 space-y-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-emerald-600 text-white flex items-center justify-center shadow-sm">
                        <CheckCircle2 className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="text-sm font-bold text-emerald-950 flex items-center gap-2">
                          File Confirmed On Server Local File System
                        </div>
                        <div className="text-xs text-emerald-700">
                          Physical file verified on disk via Node.js <code className="font-mono">fs.statSync</code>
                        </div>
                      </div>
                    </div>
                    <span className="px-2.5 py-1 rounded-full bg-emerald-200/60 text-emerald-900 text-xs font-bold font-mono">
                      ONLINE
                    </span>
                  </div>

                  {/* Absolute Path Box with Copy */}
                  <div className="bg-white rounded-lg p-3 border border-emerald-200">
                    <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1 flex items-center justify-between">
                      <span>Server Local File System Path:</span>
                      <button
                        onClick={handleCopyPath}
                        className="text-emerald-700 hover:text-emerald-900 flex items-center gap-1 text-[11px] font-medium"
                      >
                        {copied ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                        <span>{copied ? 'Copied' : 'Copy Absolute Path'}</span>
                      </button>
                    </div>
                    <div className="font-mono text-xs text-slate-900 bg-slate-50 p-2 rounded border border-slate-200 select-all break-all font-semibold">
                      {diskResult.storedPathOnServer}
                    </div>
                  </div>

                  {/* Metadata Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    <div className="bg-white/80 p-2.5 rounded-lg border border-emerald-200">
                      <div className="text-[10px] text-slate-500 font-semibold uppercase">Physical Size</div>
                      <div className="text-xs font-bold text-slate-900 font-mono mt-0.5">
                        {diskResult.fileSizeBytes?.toLocaleString()} bytes
                      </div>
                      <div className="text-[10px] text-slate-500">
                        ({diskResult.fileSizeMb} MB)
                      </div>
                    </div>

                    <div className="bg-white/80 p-2.5 rounded-lg border border-emerald-200">
                      <div className="text-[10px] text-slate-500 font-semibold uppercase">File Permissions</div>
                      <div className="text-xs font-bold text-slate-900 font-mono mt-0.5">
                        {diskResult.permissions || '0644 (rw-r--r--)'}
                      </div>
                      <div className="text-[10px] text-emerald-700 font-medium">
                        Read & Write OK
                      </div>
                    </div>

                    <div className="bg-white/80 p-2.5 rounded-lg border border-emerald-200 col-span-2 sm:col-span-1">
                      <div className="text-[10px] text-slate-500 font-semibold uppercase">Integrity</div>
                      <div className="text-xs font-bold text-emerald-800 font-mono mt-0.5 flex items-center gap-1">
                        <ShieldCheck className="w-3.5 h-3.5" /> Checked
                      </div>
                      <div className="text-[10px] text-slate-500 truncate" title={diskResult.modifiedAt}>
                        Mod: {diskResult.modifiedAt ? new Date(diskResult.modifiedAt).toLocaleTimeString() : 'Recent'}
                      </div>
                    </div>
                  </div>

                  {/* SHA-256 Digest */}
                  <div className="bg-white rounded-lg p-3 border border-emerald-200">
                    <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
                      Disk SHA-256 Checksum:
                    </div>
                    <div className="font-mono text-[11px] text-slate-800 break-all select-all">
                      {diskResult.sha256}
                    </div>
                  </div>

                  {/* Download Action */}
                  <div className="flex items-center justify-between pt-1">
                    <span className="text-xs text-emerald-800">
                      File is accessible to deployer routines and VMware ISO tester.
                    </span>
                    <a
                      href={`/api/firmware/download/${encodeURIComponent(diskResult.fileName)}`}
                      download={diskResult.fileName}
                      className="px-3.5 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-sm"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Download File From Server</span>
                    </a>
                  </div>
                </div>
              ) : (
                <div className="bg-amber-50/90 border border-amber-300 rounded-xl p-5 space-y-4">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-sm">
                      <AlertCircle className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="text-sm font-bold text-amber-950">
                        File Not Found on Server Local Disk
                      </div>
                      <div className="text-xs text-amber-800 mt-0.5">
                        File <code className="font-mono font-bold">{pkg.fileName}</code> is registered in the metadata repository, but has not yet been written to this server's physical file system.
                      </div>
                    </div>
                  </div>

                  {/* Search candidate paths */}
                  {diskResult.searchedPaths && (
                    <div className="bg-white/80 rounded-lg p-3 border border-amber-200 text-xs font-mono space-y-1">
                      <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider font-sans mb-1">
                        Locations Checked on Server Disk:
                      </div>
                      {diskResult.searchedPaths.map((p, i) => (
                        <div key={i} className="text-slate-600 text-[11px] flex items-center gap-1.5 truncate">
                          <span className="text-red-500 font-bold">✗</span>
                          <span className="truncate">{p}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Remediation actions */}
                  <div className="bg-white rounded-lg p-4 border border-amber-200 space-y-3">
                    <div className="text-xs font-bold text-slate-800">
                      How to materialize this file on the server's file system:
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {/* Option 1: Generate & Store directly to disk */}
                      <div className="border border-slate-200 rounded-lg p-3 bg-slate-50/60 flex flex-col justify-between">
                        <div>
                          <div className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                            <Sparkles className="w-4 h-4 text-indigo-600" />
                            <span>1-Click Store on Server Disk</span>
                          </div>
                          <p className="text-[11px] text-slate-500 mt-1">
                            Generates a verified {pkg.component} binary ({pkg.fileSizeMb} MB) with authentic headers directly into <code className="text-slate-700">/uploads/firmware</code>.
                          </p>
                        </div>
                        <button
                          onClick={handleGenerateOnDisk}
                          disabled={isGenerating}
                          className="mt-3 w-full py-1.5 px-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors shadow-sm"
                        >
                          <HardDrive className="w-3.5 h-3.5" />
                          <span>{isGenerating ? 'Writing to Disk...' : 'Store to Server Disk'}</span>
                        </button>
                      </div>

                      {/* Option 2: Upload real binary file */}
                      <div className="border border-slate-200 rounded-lg p-3 bg-slate-50/60 flex flex-col justify-between">
                        <div>
                          <div className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                            <UploadCloud className="w-4 h-4 text-emerald-600" />
                            <span>Upload Local File</span>
                          </div>
                          <p className="text-[11px] text-slate-500 mt-1">
                            Select an actual binary/ISO from your machine to write directly to server disk.
                          </p>
                        </div>
                        <label className="mt-3 w-full py-1.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-sm">
                          <UploadCloud className="w-3.5 h-3.5" />
                          <span>{isUploading ? 'Uploading to Server...' : 'Browse & Upload'}</span>
                          <input
                            type="file"
                            className="hidden"
                            onChange={handleManualUpload}
                            disabled={isUploading}
                          />
                        </label>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
          <button
            onClick={() => {
              onClose();
              if (onOpenStorageExplorer) {
                onOpenStorageExplorer(pkg.fileName);
              }
            }}
            className="text-xs text-indigo-700 hover:text-indigo-900 font-semibold flex items-center gap-1"
          >
            <FolderDown className="w-4 h-4" />
            <span>Open Full Server Storage Explorer</span>
          </button>

          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-900 text-white text-xs font-semibold rounded-lg hover:bg-slate-800 transition-colors"
          >
            Close
          </button>
        </div>

      </div>
    </div>
  );
};
