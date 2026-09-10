import React, { useState } from 'react';
import { Trash2, AlertTriangle, X, CheckCircle2, RotateCcw, Server, FileCode, History } from 'lucide-react';

interface FlushConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirmFlush: () => Promise<void> | void;
  isDbConnected?: boolean;
}

export const FlushConfirmModal: React.FC<FlushConfirmModalProps> = ({
  isOpen,
  onClose,
  onConfirmFlush,
  isDbConnected = false,
}) => {
  const [isProcessing, setIsProcessing] = useState(false);

  if (!isOpen) return null;

  const handleConfirm = async () => {
    try {
      setIsProcessing(true);
      await onConfirmFlush();
      onClose();
    } catch (e) {
      console.error('Flush operation failed', e);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs"
      onClick={onClose}
    >
      <div 
        className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 relative overflow-hidden"
        onClick={e => e.stopPropagation()}
        id="modal-flush-confirm"
      >
        {/* Decorative alert accent bar */}
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-rose-500" />

        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-600">
              <Trash2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Flush All Entries?</h3>
              <p className="text-xs text-slate-500 mt-0.5">Purge fleet and repository datasets</p>
            </div>
          </div>
          <button
            type="button"
            id="btn-close-flush-modal"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Description body */}
        <div className="mt-4 space-y-3 text-xs text-slate-600">
          <p>
            This action will completely purge all active entries and records across the entire platform:
          </p>
          <ul className="space-y-2 bg-slate-50 border border-slate-200 rounded-xl p-3.5">
            <li className="flex items-center gap-2 text-slate-700">
              <Server className="w-3.5 h-3.5 text-slate-500" />
              <span>All server inventory nodes & BMC configurations</span>
            </li>
            <li className="flex items-center gap-2 text-slate-700">
              <FileCode className="w-3.5 h-3.5 text-slate-500" />
              <span>All registered firmware binaries & release packages</span>
            </li>
            <li className="flex items-center gap-2 text-slate-700">
              <History className="w-3.5 h-3.5 text-slate-500" />
              <span>Historical upgrade execution logs & audit records</span>
            </li>
            <li className="flex items-center gap-2 text-slate-700">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
              <span>Active and queued firmware campaign jobs</span>
            </li>
          </ul>

          {isDbConnected && (
            <div className="p-2.5 rounded-lg bg-indigo-50/70 border border-indigo-200/80 text-[11px] text-indigo-900 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-indigo-600 shrink-0" />
              <span>Connected PostgreSQL tables will be truncated and local browser storage cleared.</span>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="mt-6 flex items-center justify-end space-x-3 pt-3 border-t border-slate-100">
          <button
            type="button"
            id="btn-cancel-flush"
            onClick={onClose}
            disabled={isProcessing}
            className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-300 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            id="btn-confirm-flush"
            onClick={handleConfirm}
            disabled={isProcessing}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 active:bg-rose-800 disabled:opacity-50 rounded-lg transition-colors shadow-xs"
          >
            {isProcessing ? (
              <>
                <RotateCcw className="w-3.5 h-3.5 animate-spin" />
                <span>Flushing...</span>
              </>
            ) : (
              <>
                <Trash2 className="w-3.5 h-3.5" />
                <span>Confirm Flush All</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
