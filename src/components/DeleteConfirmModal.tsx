import React from 'react';
import { AlertTriangle, X, Trash2 } from 'lucide-react';
import { Server } from '../types';

interface DeleteConfirmModalProps {
  isOpen: boolean;
  server: Server | null;
  onClose: () => void;
  onConfirmDelete: (serverId: string) => void;
}

export const DeleteConfirmModal: React.FC<DeleteConfirmModalProps> = ({
  isOpen,
  server,
  onClose,
  onConfirmDelete,
}) => {
  if (!isOpen || !server) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="relative bg-white rounded-2xl shadow-2xl max-w-md w-full border border-slate-200 overflow-hidden">
        <div className="p-6">
          <div className="w-12 h-12 rounded-full bg-red-100 border border-red-200 flex items-center justify-center text-red-600 mb-4">
            <Trash2 className="w-6 h-6" />
          </div>

          <h3 className="text-base font-bold text-slate-900">
            Decommission & Delete Device?
          </h3>
          
          <p className="text-xs text-slate-600 mt-2 leading-relaxed">
            Are you sure you want to permanently remove <strong className="font-mono text-slate-900">{server.hostname}</strong> from the datacenter inventory?
          </p>

          <div className="mt-3.5 p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1 text-xs">
            <div className="flex justify-between text-slate-600">
              <span>Hardware Model:</span>
              <span className="font-medium text-slate-900">{server.model}</span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>IP Address:</span>
              <span className="font-mono text-slate-900">{server.ip}</span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>Location:</span>
              <span className="text-slate-900">{server.datacenter} • {server.rack}</span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>Installed BIOS:</span>
              <span className="font-mono text-slate-900">{server.components.BIOS?.currentVersion || 'N/A'}</span>
            </div>
          </div>

          <div className="mt-4 flex items-center justify-end space-x-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 rounded-lg hover:bg-slate-100 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              id="btn-confirm-delete-device"
              onClick={() => {
                onConfirmDelete(server.id);
                onClose();
              }}
              className="px-4 py-2 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg shadow-xs flex items-center gap-1.5 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete Device</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
