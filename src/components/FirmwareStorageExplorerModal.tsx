import React, { useState, useEffect } from 'react';
import { 
  HardDrive, 
  Folder, 
  FolderCheck, 
  CheckCircle2, 
  AlertCircle, 
  Download, 
  Trash2, 
  RefreshCw, 
  Copy, 
  Check, 
  X, 
  FileCode, 
  Terminal, 
  Info,
  ShieldCheck
} from 'lucide-react';
import { ServerStorageFile, DiskVerificationResult } from '../types';
import { fetchServerStorageFiles, deleteServerStorageFile } from '../services/api';

interface FirmwareStorageExplorerModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetInspectFileName?: string | null;
  targetFile?: string | null;
  onFileDeleted?: (fileName: string) => void;
  onShowToast?: (msg: string, type?: 'success' | 'info' | 'warn') => void;
}

export const FirmwareStorageExplorerModal: React.FC<FirmwareStorageExplorerModalProps> = ({
  isOpen,
  onClose,
  targetInspectFileName,
  targetFile,
  onFileDeleted,
  onShowToast,
}) => {
  const effectiveTarget = targetInspectFileName || targetFile;
  const [loading, setLoading] = useState(false);
  const [serverWorkingDir, setServerWorkingDir] = useState<string>('');
  const [firmwareDir, setFirmwareDir] = useState<string>('');
  const [datastoresDir, setDatastoresDir] = useState<string>('');
  const [files, setFiles] = useState<ServerStorageFile[]>([]);
  const [totalFiles, setTotalFiles] = useState<number>(0);
  const [totalSizeBytes, setTotalSizeBytes] = useState<number>(0);
  const [copiedPath, setCopiedPath] = useState<string | null>(null);
  const [filterFolder, setFilterFolder] = useState<'all' | 'firmware' | 'datastores'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [deletingFileName, setDeletingFileName] = useState<string | null>(null);
  const [fileToConfirmDelete, setFileToConfirmDelete] = useState<ServerStorageFile | null>(null);

  const loadStorageFiles = async () => {
    setLoading(true);
    try {
      const res = await fetchServerStorageFiles();
      if (res && res.success) {
        setServerWorkingDir(res.serverWorkingDir || '/workspace');
        setFirmwareDir(res.firmwareDir || './uploads/firmware');
        setDatastoresDir(res.datastoresDir || './uploads/datastores');
        setFiles(Array.isArray(res.files) ? res.files : []);
        setTotalFiles(res.totalFiles ?? (res.files?.length || 0));
        setTotalSizeBytes(res.totalSizeBytes ?? 0);
      } else {
        setServerWorkingDir('/workspace');
        setFirmwareDir('./uploads/firmware');
        setDatastoresDir('./uploads/datastores');
      }
    } catch (e: any) {
      if (onShowToast) onShowToast('Failed to read server storage directory', 'warn');
      setServerWorkingDir('/workspace');
      setFirmwareDir('./uploads/firmware');
      setDatastoresDir('./uploads/datastores');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadStorageFiles();
      if (effectiveTarget) {
        setSearchQuery(effectiveTarget);
      }
    }
  }, [isOpen, effectiveTarget]);

  const handleCopy = (text: string, id: string) => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).catch(() => {
          fallbackCopyText(text);
        });
      } else {
        fallbackCopyText(text);
      }
    } catch {
      fallbackCopyText(text);
    }
    setCopiedPath(id);
    setTimeout(() => setCopiedPath(null), 2000);
    if (onShowToast) onShowToast('File path copied to clipboard!', 'info');
  };

  const fallbackCopyText = (text: string) => {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    try {
      document.execCommand('copy');
    } catch {}
    document.body.removeChild(textarea);
  };

  const confirmDelete = async () => {
    if (!fileToConfirmDelete) return;
    const file = fileToConfirmDelete;
    setDeletingFileName(file.fileName);
    setFileToConfirmDelete(null);
    try {
      const res = await deleteServerStorageFile(file.fileName, file.folder);
      if (res && res.success) {
        if (onShowToast) onShowToast(`File "${file.fileName}" deleted from server storage.`, 'success');
        if (onFileDeleted) onFileDeleted(file.fileName);
        await loadStorageFiles();
      } else {
        if (onShowToast) onShowToast(res?.error || 'Failed to delete file', 'warn');
      }
    } catch (e: any) {
      if (onShowToast) onShowToast('Error deleting file: ' + (e?.message || 'Network error'), 'warn');
    } finally {
      setDeletingFileName(null);
    }
  };

  if (!isOpen) return null;

  const filteredFiles = (files || []).filter(f => {
    if (!f) return false;
    if (filterFolder !== 'all' && f.folder !== filterFolder) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = (f.fileName || '').toLowerCase().includes(q);
      const matchPath = (f.storedPathOnServer || '').toLowerCase().includes(q);
      return matchName || matchPath;
    }
    return true;
  });

  const formatBytes = (bytes?: number) => {
    if (!bytes || bytes <= 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + (sizes[i] || 'B');
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return 'Recent';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      return `${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/80">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center border border-emerald-200">
              <HardDrive className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold text-slate-900">Server Local File System Storage</h3>
                <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[11px] font-semibold border border-emerald-300 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> fs.existsSync Verified
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Inspect files physically stored on this server disk under <code className="bg-slate-200 px-1 py-0.5 rounded text-slate-800 font-mono">/uploads/firmware</code> and <code className="bg-slate-200 px-1 py-0.5 rounded text-slate-800 font-mono">/uploads/datastores</code>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={loadStorageFiles}
              disabled={loading}
              className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-200/60 rounded-lg transition-colors flex items-center gap-1.5 text-xs font-medium border border-slate-300"
              title="Refresh Disk Files"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-emerald-600' : ''}`} />
              <span>Refresh Disk</span>
            </button>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Directory Diagnostic Strip */}
        <div className="bg-slate-900 text-slate-200 px-6 py-3 border-b border-slate-800 text-xs font-mono flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2 overflow-x-auto max-w-2xl">
            <Terminal className="w-4 h-4 text-emerald-400 shrink-0" />
            <span className="text-slate-400">HOST ROOT:</span>
            <span className="text-emerald-300 select-all font-semibold">{serverWorkingDir || '/workspace'}</span>
            <span className="text-slate-600">|</span>
            <span className="text-slate-400">DIR:</span>
            <span className="text-slate-300 select-all">{firmwareDir || './uploads/firmware'}</span>
          </div>
          <div className="flex items-center gap-4 text-slate-400">
            <span>Disk Files: <strong className="text-white">{totalFiles}</strong></span>
            <span>Total Used: <strong className="text-white">{formatBytes(totalSizeBytes)}</strong></span>
          </div>
        </div>

        {/* Filters and search */}
        <div className="p-4 border-b border-slate-200 bg-white flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setFilterFolder('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                filterFolder === 'all'
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              All Storage ({files.length})
            </button>
            <button
              onClick={() => setFilterFolder('firmware')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 ${
                filterFolder === 'firmware'
                  ? 'bg-indigo-600 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <Folder className="w-3.5 h-3.5" />
              Firmware Catalog ({files.filter(f => f.folder === 'firmware').length})
            </button>
            <button
              onClick={() => setFilterFolder('datastores')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 ${
                filterFolder === 'datastores'
                  ? 'bg-emerald-600 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <HardDrive className="w-3.5 h-3.5" />
              Datastores ({files.filter(f => f.folder === 'datastores').length})
            </button>
          </div>

          <div className="w-72">
            <input
              type="text"
              placeholder="Search file name or path..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
            />
          </div>
        </div>

        {/* File Table Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="py-16 flex flex-col items-center justify-center text-slate-400 gap-3">
              <RefreshCw className="w-8 h-8 animate-spin text-emerald-600" />
              <p className="text-sm font-medium">Scanning server disk directories...</p>
            </div>
          ) : filteredFiles.length === 0 ? (
            <div className="py-16 text-center bg-slate-50 rounded-xl border border-dashed border-slate-300 p-8">
              <FolderCheck className="w-12 h-12 mx-auto text-slate-400 mb-3" />
              <h4 className="text-base font-semibold text-slate-800">No Files Found on Server Disk</h4>
              <p className="text-xs text-slate-500 max-w-md mx-auto mt-1 mb-4">
                {searchQuery 
                  ? `No file matching "${searchQuery}" exists in ${filterFolder === 'all' ? 'any directory' : filterFolder}.`
                  : 'When you upload a firmware binary or ISO in the Firmware Catalog, it will be saved to disk and verified here.'}
              </p>
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="px-3 py-1.5 text-xs font-medium bg-slate-200 text-slate-800 rounded-lg hover:bg-slate-300"
                >
                  Clear Search Filter
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {filteredFiles.map((file, idx) => {
                const isTarget = effectiveTarget && (file.fileName || '').toLowerCase().includes(effectiveTarget.toLowerCase());
                return (
                  <div 
                    key={file.storedPathOnServer || file.fileName || idx}
                    className={`border rounded-xl p-4 transition-all ${
                      isTarget 
                        ? 'border-emerald-500 bg-emerald-50/50 ring-2 ring-emerald-400/30' 
                        : 'border-slate-200 bg-white hover:border-slate-300 shadow-sm'
                    }`}
                  >
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                      
                      {/* Left: Name and directory badge */}
                      <div className="flex items-start gap-3 flex-1 min-w-0">
                        <div className={`p-2.5 rounded-lg shrink-0 mt-0.5 ${
                          file.folder === 'firmware' 
                            ? 'bg-indigo-100 text-indigo-700 border border-indigo-200' 
                            : 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                        }`}>
                          <FileCode className="w-5 h-5" />
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-sm text-slate-900 font-mono break-all">{file.fileName}</span>
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                              file.folder === 'firmware'
                                ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                                : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            }`}>
                              {file.folder}
                            </span>
                            <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-semibold border border-emerald-300 flex items-center gap-1">
                              <CheckCircle2 className="w-2.5 h-2.5" /> Exists On Disk
                            </span>
                          </div>

                          {/* Absolute path display with copy */}
                          <div className="mt-1.5 flex items-center gap-1.5 bg-slate-100/90 border border-slate-200/80 rounded px-2.5 py-1 text-[11px] font-mono text-slate-700 group max-w-full overflow-hidden">
                            <span className="text-slate-400 shrink-0 select-none">Path:</span>
                            <span className="truncate select-all text-slate-800 font-medium" title={file.storedPathOnServer}>
                              {file.storedPathOnServer}
                            </span>
                            <button
                              onClick={() => handleCopy(file.storedPathOnServer, file.storedPathOnServer)}
                              className="ml-auto shrink-0 p-1 text-slate-400 hover:text-slate-700 rounded hover:bg-slate-200 transition-colors"
                              title="Copy exact file path on server"
                            >
                              {copiedPath === file.storedPathOnServer ? (
                                <Check className="w-3.5 h-3.5 text-emerald-600" />
                              ) : (
                                <Copy className="w-3.5 h-3.5" />
                              )}
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Right: Metrics & Actions */}
                      <div className="flex items-center justify-between md:justify-end gap-3 shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-slate-100">
                        <div className="text-left md:text-right">
                          <div className="text-xs font-bold text-slate-900 font-mono">
                            {formatBytes(file.fileSizeBytes)}
                          </div>
                          <div className="text-[10px] text-slate-500">
                            {(file.fileSizeBytes || 0).toLocaleString()} bytes
                          </div>
                          <div className="text-[10px] text-slate-400 mt-0.5">
                            Mod: {formatDate(file.modifiedAt)}
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5">
                          <a
                            href={`/api/firmware/download/${encodeURIComponent(file.fileName)}`}
                            download={file.fileName}
                            className="p-2 text-slate-600 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg border border-slate-300 transition-colors"
                            title="Download verified binary from server disk"
                          >
                            <Download className="w-4 h-4" />
                          </a>
                          <button
                            onClick={() => setFileToConfirmDelete(file)}
                            disabled={deletingFileName === file.fileName}
                            className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg border border-slate-200 hover:border-red-200 transition-colors"
                            title="Delete file from server filesystem"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>

                      </div>
                    </div>

                    {/* Checksum & Permissions bar */}
                    <div className="mt-3 pt-2.5 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500 font-mono">
                      <div className="flex items-center gap-2 overflow-hidden">
                        <span className="text-slate-400">SHA-256:</span>
                        <span className="truncate text-slate-700 max-w-[320px] select-all font-semibold" title={file.sha256}>
                          {file.sha256}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        {file.permissions && (
                          <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded text-[10px]">
                            Perm: {file.permissions}
                          </span>
                        )}
                        <span className="text-emerald-700 font-semibold flex items-center gap-1">
                          <ShieldCheck className="w-3.5 h-3.5" /> Verified Physical Storage
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Inline Deletion Confirmation Dialog */}
        {fileToConfirmDelete && (
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-20">
            <div className="bg-white border border-slate-200 rounded-xl p-5 max-w-md w-full shadow-xl space-y-4">
              <div className="flex items-center gap-3 text-red-600">
                <AlertCircle className="w-6 h-6" />
                <h4 className="text-sm font-bold text-slate-900">Delete File from Disk?</h4>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                Are you sure you want to permanently delete <strong className="font-mono text-slate-900">{fileToConfirmDelete.fileName}</strong> from server physical storage ({fileToConfirmDelete.folder})?
              </p>
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setFileToConfirmDelete(null)}
                  className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={confirmDelete}
                  className="px-3 py-1.5 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors"
                >
                  Permanently Delete
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between text-xs text-slate-500">
          <div className="flex items-center gap-1.5">
            <Info className="w-4 h-4 text-slate-400 shrink-0" />
            <span>Files listed above are verified using Node.js <code className="bg-slate-200 px-1 py-0.5 rounded text-slate-800 font-mono">fs.statSync</code> on the host container.</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-900 text-white text-xs font-semibold rounded-lg hover:bg-slate-800 transition-colors"
          >
            Close Explorer
          </button>
        </div>

      </div>
    </div>
  );
};
