import React, { useState, useEffect } from 'react';
import {canOpenModule, type AuthorizationContext} from '../../services/authorization';
import { ConsoleModule, KnowledgeDocument, Conversation, StaffMember } from '../../types';

interface CommandPaletteProps {
  authorization: AuthorizationContext;
  isOpen: boolean;
  onClose: () => void;
  documents: KnowledgeDocument[];
  conversations: Conversation[];
  staff: StaffMember[];
  onSelectModule: (m: ConsoleModule) => void;
  onSelectConversation: (id: string) => void;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  authorization,
  isOpen,
  onClose,
  documents,
  conversations,
  staff,
  onSelectModule,
  onSelectConversation,
}) => {
  const [query, setQuery] = useState('');

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        if (isOpen) onClose();
      }
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const matchedDocs = documents.filter((d) =>
    d.title.toLowerCase().includes(query.toLowerCase())
  );
  const matchedConvs = conversations.filter(
    (c) =>
      c.customerName.toLowerCase().includes(query.toLowerCase()) ||
      (c.customerCompany || '').toLowerCase().includes(query.toLowerCase())
  );
  const matchedStaff = staff.filter((s) =>
    s.name.toLowerCase().includes(query.toLowerCase()) || s.email.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-start justify-center pt-20 p-4 animate-in fade-in duration-100"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white border border-[#c7c4d8] rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden flex flex-col"
      >
        <div className="relative border-b border-[#c7c4d8]/70 p-3 flex items-center gap-2.5">
          <span className="material-symbols-outlined text-[#777587] text-[20px]">search</span>
          <input
            type="text"
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type a command, search documents, staff, or tickets..."
            className="w-full text-xs text-[#131b2e] placeholder:text-[#777587] focus:outline-none bg-transparent"
          />
          <kbd className="px-1.5 py-0.5 text-[10px] font-mono text-[#777587] border border-[#c7c4d8] rounded bg-[#f2f3ff]">
            ESC
          </kbd>
        </div>

        <div className="max-h-80 overflow-y-auto p-2 text-xs divide-y divide-[#eaedff]">
          {/* Quick Navigation Commands */}
          <div className="py-2 space-y-1">
            <p className="px-2 text-[10px] font-bold text-[#777587] uppercase tracking-wider">
              Quick Navigation
            </p>
            <button
              style={{display: canOpenModule(authorization, 'inbox') ? undefined : 'none'}}
              onClick={() => {
                onSelectModule('inbox');
                onClose();
              }}
              className="w-full flex items-center justify-between p-2 rounded-lg hover:bg-[#f2f3ff] text-left transition-colors"
            >
              <span className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[16px] text-[#3525cd]">inbox</span>
                <span className="font-semibold text-[#131b2e]">Go to Inbox & Live Queue</span>
              </span>
              <span className="text-[10px] text-[#777587] font-mono">Module 1</span>
            </button>
            <button
              style={{display: canOpenModule(authorization, 'knowledge') ? undefined : 'none'}}
              onClick={() => {
                onSelectModule('knowledge');
                onClose();
              }}
              className="w-full flex items-center justify-between p-2 rounded-lg hover:bg-[#f2f3ff] text-left transition-colors"
            >
              <span className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[16px] text-[#3525cd]">menu_book</span>
                <span className="font-semibold text-[#131b2e]">Kho tri thức AI & RAG</span>
              </span>
              <span className="text-[10px] text-[#777587]">Tri thức</span>
            </button>
            <button
              style={{display: canOpenModule(authorization, 'settings') ? undefined : 'none'}}
              onClick={() => {
                onSelectModule('settings');
                onClose();
              }}
              className="w-full flex items-center justify-between p-2 rounded-lg hover:bg-[#f2f3ff] text-left transition-colors"
            >
              <span className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[16px] text-[#3525cd]">manage_accounts</span>
                <span className="font-semibold text-[#131b2e]">Go to Staff & Access Control (RBAC)</span>
              </span>
              <span className="text-[10px] text-[#777587] font-mono">Settings</span>
            </button>
            <button
              style={{display: canOpenModule(authorization, 'widget-demo') ? undefined : 'none'}}
              onClick={() => {
                onSelectModule('widget-demo');
                onClose();
              }}
              className="w-full flex items-center justify-between p-2 rounded-lg hover:bg-[#f2f3ff] text-left transition-colors"
            >
              <span className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[16px] text-emerald-600">visibility</span>
                <span className="font-semibold text-[#131b2e]">Test Live Customer Support Widget</span>
              </span>
              <span className="text-[10px] text-emerald-700 bg-emerald-50 px-1 rounded font-mono font-bold">
                Live
              </span>
            </button>
          </div>

          {/* Conversations */}
          {matchedConvs.length > 0 && (
            <div className="py-2 space-y-1">
              <p className="px-2 text-[10px] font-bold text-[#777587] uppercase tracking-wider">
                Conversations
              </p>
              {matchedConvs.map((c) => (
                <button
                  key={c.id}
                  onClick={() => {
                    onSelectModule('inbox');
                    onSelectConversation(c.id);
                    onClose();
                  }}
                  className="w-full flex items-center justify-between p-2 rounded-lg hover:bg-[#f2f3ff] text-left transition-colors"
                >
                  <div className="flex items-center gap-2 truncate">
                    <img
                      src={c.customerAvatar}
                      alt={c.customerName}
                      referrerPolicy="no-referrer"
                      className="w-5 h-5 rounded-full object-cover border"
                    />
                    <span className="font-medium text-[#131b2e] truncate">{c.customerName}</span>
                    <span className="text-[#777587] text-[11px] truncate">({c.customerCompany})</span>
                  </div>
                  <span className="text-[10px] text-[#777587] font-mono shrink-0">{c.channel}</span>
                </button>
              ))}
            </div>
          )}

          {/* Documents */}
          {matchedDocs.length > 0 && (
            <div className="py-2 space-y-1">
              <p className="px-2 text-[10px] font-bold text-[#777587] uppercase tracking-wider">
                Knowledge Documents ({matchedDocs.length})
              </p>
              {matchedDocs.slice(0, 4).map((d) => (
                <button
                  key={d.id}
                  onClick={() => {
                    onSelectModule('knowledge');
                    onClose();
                  }}
                  className="w-full flex items-center justify-between p-2 rounded-lg hover:bg-[#f2f3ff] text-left transition-colors"
                >
                  <span className="flex items-center gap-2 truncate">
                    <span className="material-symbols-outlined text-[15px] text-[#777587]">
                      description
                    </span>
                    <span className="font-mono text-[11px] text-[#131b2e] truncate">{d.title}</span>
                  </span>
                  <span className="text-[10px] text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded font-mono">
                    {d.audience}
                  </span>
                </button>
              ))}
            </div>
          )}

          {/* Staff Members */}
          {matchedStaff.length > 0 && (
            <div className="py-2 space-y-1">
              <p className="px-2 text-[10px] font-bold text-[#777587] uppercase tracking-wider">
                Workspace Staff
              </p>
              {matchedStaff.map((s) => (
                <button
                  key={s.id}
                  onClick={() => {
                    onSelectModule('settings');
                    onClose();
                  }}
                  className="w-full flex items-center justify-between p-2 rounded-lg hover:bg-[#f2f3ff] text-left transition-colors"
                >
                  <span className="flex items-center gap-2 truncate">
                    <span className="material-symbols-outlined text-[15px] text-[#4f46e5]">
                      badge
                    </span>
                    <span className="font-semibold text-[#131b2e]">{s.name}</span>
                    <span className="text-[#777587] text-[11px]">({s.roleTitle})</span>
                  </span>
                  <span className="text-[10px] text-[#777587] font-mono">{s.email}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
