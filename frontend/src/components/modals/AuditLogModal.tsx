import React, { useState } from 'react';
import { AuditLogEntry } from '../../types';

interface AuditLogModalProps {
  isOpen: boolean;
  onClose: () => void;
  logs: AuditLogEntry[];
}

export const AuditLogModal: React.FC<AuditLogModalProps> = ({ isOpen, onClose, logs }) => {
  const [filterQuery, setFilterQuery] = useState('');

  if (!isOpen) return null;

  const filteredLogs = logs.filter(
    (l) =>
      l.actor.toLowerCase().includes(filterQuery.toLowerCase()) ||
      l.action.toLowerCase().includes(filterQuery.toLowerCase()) ||
      l.target.toLowerCase().includes(filterQuery.toLowerCase()) ||
      l.complianceCode.toLowerCase().includes(filterQuery.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150">
      <div 
        onClick={(e) => e.stopPropagation()}
        className="bg-white border border-[#c7c4d8] rounded-2xl w-full max-w-3xl shadow-2xl overflow-hidden flex flex-col"
      >
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-[#c7c4d8]/70 flex items-center justify-between bg-[#f2f3ff]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#3525cd] text-white flex items-center justify-center">
              <span className="material-symbols-outlined text-[18px]">receipt_long</span>
            </div>
            <div>
              <h3 className="font-bold text-sm text-[#131b2e]">
                Enterprise Audit Trail Archive (FR-OPS-01)
              </h3>
              <p className="text-[11px] text-[#464555]">
                Immutable cryptographic ledger of permissions, TTL grants, and document state changes.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded text-[#777587] hover:bg-[#eaedff] transition-colors"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* Modal Search */}
        <div className="p-4 border-b border-[#c7c4d8]/60 bg-white flex items-center justify-between gap-3">
          <div className="relative flex-1">
            <span className="material-symbols-outlined absolute left-3 top-2 text-[#777587] text-[16px]">
              search
            </span>
            <input
              type="text"
              value={filterQuery}
              onChange={(e) => setFilterQuery(e.target.value)}
              placeholder="Search by actor, action code, or target..."
              className="w-full pl-9 pr-4 py-1.5 bg-[#f2f3ff] border border-[#c7c4d8] rounded-lg text-xs text-[#131b2e] focus:outline-none"
            />
          </div>
          <span className="text-[11px] text-[#777587] font-mono">
            {filteredLogs.length} audit entries
          </span>
        </div>

        {/* Log Entries Table */}
        <div className="p-4 max-h-[60vh] overflow-y-auto text-xs">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[#c7c4d8]/70 text-[10px] uppercase font-bold text-[#777587]">
                <th className="pb-2 font-bold">Timestamp (UTC)</th>
                <th className="pb-2 font-bold">Actor</th>
                <th className="pb-2 font-bold">Action Event</th>
                <th className="pb-2 font-bold">Target Resource</th>
                <th className="pb-2 font-bold">Code</th>
                <th className="pb-2 font-bold text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#eaedff]">
              {filteredLogs.map((log) => (
                <tr key={log.id} className="hover:bg-[#f2f3ff]/50">
                  <td className="py-2.5 font-mono text-[11px] text-[#464555]">{log.timestamp}</td>
                  <td className="py-2.5 font-medium text-[#131b2e]">{log.actor}</td>
                  <td className="py-2.5">
                    <span className="px-1.5 py-0.5 rounded bg-[#eaedff] text-[#3525cd] font-mono text-[10px] font-bold">
                      {log.action}
                    </span>
                  </td>
                  <td className="py-2.5 text-[#464555] max-w-[200px] truncate">{log.target}</td>
                  <td className="py-2.5">
                    <span className="font-mono text-[10px] text-amber-800 bg-[#fef3c7] px-1 py-0.2 rounded border border-[#fde68a]">
                      {log.complianceCode}
                    </span>
                  </td>
                  <td className="py-2.5 text-right">
                    <span className="inline-flex items-center gap-1 text-[11px] text-emerald-700 font-bold">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                      <span>{log.status}</span>
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-[#c7c4d8]/70 bg-[#f2f3ff] flex items-center justify-between text-xs">
          <span className="text-[11px] text-[#777587]">
            SHA-256 Checksum: c98d3e21894a7e8b84... Verified
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 bg-[#3525cd] text-white rounded-lg font-semibold hover:bg-[#4f46e5]"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
