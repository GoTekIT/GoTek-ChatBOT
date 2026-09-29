import React from 'react';
import { ConsoleModule, SettingsSubTab } from '../types';

interface SidebarProps {
  activeModule: ConsoleModule;
  setActiveModule: (m: ConsoleModule) => void;
  settingsSubTab: SettingsSubTab;
  setSettingsSubTab: (t: SettingsSubTab) => void;
  onOpenAuditLogs: () => void;
  onSwitchWorkspace?: () => void;
  sidebarWidth: number;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeModule,
  setActiveModule,
  settingsSubTab,
  setSettingsSubTab,
  onOpenAuditLogs,
  onSwitchWorkspace,
  sidebarWidth,
  isCollapsed,
  onToggleCollapse,
}) => {
  if (isCollapsed) {
    // Compact Icon-only rail mode (64px)
    return (
      <aside className="h-full w-16 flex flex-col justify-between shrink-0 bg-white border-r border-[#c7c4d8]/70 select-none z-20 py-3 items-center">
        {/* Top: Brand icon & expand button */}
        <div className="flex flex-col items-center gap-3">
          <button
            onClick={onSwitchWorkspace}
            className="w-10 h-10 rounded-xl bg-white border border-[#c7c4d8]/70 flex items-center justify-center p-1 shadow-sm hover:border-[#3525cd] transition-all"
            title="GoTek Solutions HQ - Enterprise Tier"
            type="button"
          >
            <img src="/gotek-logo.png" alt="GoTek" className="w-full h-full object-contain" />
          </button>
          <button
            onClick={onToggleCollapse}
            className="p-1.5 rounded-lg text-[#777587] hover:bg-[#eaedff] hover:text-[#3525cd] transition-colors"
            title="Mở rộng Sidebar"
            type="button"
          >
            <span className="material-symbols-outlined text-[20px]">chevron_right</span>
          </button>
        </div>

        {/* Middle Navigation Icons */}
        <nav className="flex flex-col items-center gap-2">
          <button
            onClick={() => setActiveModule('inbox')}
            className={`w-10 h-10 rounded-xl flex items-center justify-center relative transition-colors ${
              activeModule === 'inbox'
                ? 'bg-[#eaedff] text-[#3525cd]'
                : 'text-[#464555] hover:bg-[#f2f3ff]'
            }`}
            title="Inbox (Hàng chờ)"
            type="button"
          >
            <span className="material-symbols-outlined text-[20px]">inbox</span>
            <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-[#4f46e5]"></span>
          </button>

          <button
            onClick={() => setActiveModule('knowledge')}
            className={`w-10 h-10 rounded-xl flex items-center justify-center relative transition-colors ${
              activeModule === 'knowledge'
                ? 'bg-[#eaedff] text-[#3525cd]'
                : 'text-[#464555] hover:bg-[#f2f3ff]'
            }`}
            title="Knowledge Base & RAG Indexing"
            type="button"
          >
            <span className="material-symbols-outlined text-[20px]">menu_book</span>
          </button>

          <button
            onClick={() => setActiveModule('channels')}
            className={`w-10 h-10 rounded-xl flex items-center justify-center relative transition-colors ${
              activeModule === 'channels'
                ? 'bg-[#eaedff] text-[#3525cd]'
                : 'text-[#464555] hover:bg-[#f2f3ff]'
            }`}
            title="Channels & Integrations"
            type="button"
          >
            <span className="material-symbols-outlined text-[20px]">hub</span>
          </button>

          <button
            onClick={() => setActiveModule('analytics')}
            className={`w-10 h-10 rounded-xl flex items-center justify-center relative transition-colors ${
              activeModule === 'analytics'
                ? 'bg-[#eaedff] text-[#3525cd]'
                : 'text-[#464555] hover:bg-[#f2f3ff]'
            }`}
            title="Analytics"
            type="button"
          >
            <span className="material-symbols-outlined text-[20px]">insights</span>
          </button>

          <button
            onClick={() => setActiveModule('settings')}
            className={`w-10 h-10 rounded-xl flex items-center justify-center relative transition-colors ${
              activeModule === 'settings'
                ? 'bg-[#eaedff] text-[#3525cd]'
                : 'text-[#464555] hover:bg-[#f2f3ff]'
            }`}
            title="Settings (Staff & RBAC)"
            type="button"
          >
            <span className="material-symbols-outlined text-[20px]">settings</span>
          </button>
        </nav>

        {/* Bottom Status */}
        <div className="flex flex-col items-center gap-2">
          <div
            className="w-3 h-3 rounded-full bg-emerald-500 ring-2 ring-emerald-200"
            title="Staff: 3/5 Online"
          ></div>
        </div>
      </aside>
    );
  }

  // Expanded Sidebar with custom width
  return (
    <aside
      style={{ width: `${sidebarWidth}px` }}
      className="h-full flex flex-col justify-between shrink-0 bg-white border-r border-[#c7c4d8]/70 select-none z-20 overflow-hidden"
    >
      {/* Top Section: Workspace Context Switcher & Collapse Toggle */}
      <div className="p-3 border-b border-[#c7c4d8]/60 flex items-center justify-between gap-1">
        <div
          onClick={onSwitchWorkspace}
          className="flex-1 flex items-center justify-between p-2 rounded-lg hover:bg-[#f2f3ff] transition-colors duration-150 cursor-pointer border border-[#c7c4d8]/40 overflow-hidden"
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-white border border-[#c7c4d8]/70 flex items-center justify-center p-1 shadow-xs shrink-0">
              <img src="/gotek-logo.png" alt="GoTek" className="w-full h-full object-contain" />
            </div>
            <div className="flex flex-col min-w-0">
              <span className="font-semibold text-sm text-[#131b2e] truncate">GoTek Solutions HQ</span>
              <span className="text-[11px] text-[#3525cd] font-semibold tracking-tight truncate">
                Enterprise Tier
              </span>
            </div>
          </div>
          <span className="material-symbols-outlined text-[#777587] text-[18px] shrink-0">
            unfold_more
          </span>
        </div>

        {/* Collapse button */}
        <button
          onClick={onToggleCollapse}
          className="p-1.5 rounded-lg text-[#777587] hover:bg-[#eaedff] hover:text-[#3525cd] transition-colors shrink-0"
          title="Thu gọn Sidebar"
          type="button"
        >
          <span className="material-symbols-outlined text-[18px]">chevron_left</span>
        </button>
      </div>

      {/* Main Navigation Items */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-1 custom-scrollbar">
        <div className="px-3 pb-2 text-[10px] font-bold text-[#777587] uppercase tracking-wider">
          Console Modules
        </div>

        {/* Tab 1: Inbox */}
        <button
          onClick={() => setActiveModule('inbox')}
          className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left text-xs transition-colors duration-150 active:scale-[0.99] ${
            activeModule === 'inbox'
              ? 'bg-[#eaedff] text-[#3525cd] font-bold shadow-xs'
              : 'text-[#464555] hover:bg-[#f2f3ff] hover:text-[#131b2e]'
          }`}
          type="button"
        >
          <span
            className="material-symbols-outlined text-[18px] shrink-0"
            style={{ fontVariationSettings: activeModule === 'inbox' ? "'FILL' 1" : "'FILL' 0" }}
          >
            inbox
          </span>
          <span className="font-medium text-xs flex-1 truncate">Inbox</span>
          <span className="bg-[#e2e7ff] text-[#3525cd] text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0">
            3
          </span>
        </button>

        {/* Tab 2: Knowledge Base */}
        <button
          onClick={() => setActiveModule('knowledge')}
          className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left text-xs transition-colors duration-150 active:scale-[0.99] ${
            activeModule === 'knowledge'
              ? 'bg-[#eaedff] text-[#3525cd] font-bold shadow-xs'
              : 'text-[#464555] hover:bg-[#f2f3ff] hover:text-[#131b2e]'
          }`}
          type="button"
        >
          <span
            className="material-symbols-outlined text-[18px] shrink-0"
            style={{ fontVariationSettings: activeModule === 'knowledge' ? "'FILL' 1" : "'FILL' 0" }}
          >
            menu_book
          </span>
          <span className="font-medium text-xs flex-1 truncate">Knowledge Base</span>
          {activeModule === 'knowledge' && (
            <span className="w-1.5 h-1.5 rounded-full bg-[#3525cd] shrink-0"></span>
          )}
        </button>

        {/* Tab 3: Channels & Integrations */}
        <button
          onClick={() => setActiveModule('channels')}
          className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left text-xs transition-colors duration-150 active:scale-[0.99] ${
            activeModule === 'channels'
              ? 'bg-[#eaedff] text-[#3525cd] font-bold shadow-xs'
              : 'text-[#464555] hover:bg-[#f2f3ff] hover:text-[#131b2e]'
          }`}
          type="button"
        >
          <span className="material-symbols-outlined text-[18px] shrink-0">hub</span>
          <span className="font-medium text-xs flex-1 truncate">Channels & Integrations</span>
        </button>

        {/* Tab 4: Analytics */}
        <button
          onClick={() => setActiveModule('analytics')}
          className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left text-xs transition-colors duration-150 active:scale-[0.99] ${
            activeModule === 'analytics'
              ? 'bg-[#eaedff] text-[#3525cd] font-bold shadow-xs'
              : 'text-[#464555] hover:bg-[#f2f3ff] hover:text-[#131b2e]'
          }`}
          type="button"
        >
          <span className="material-symbols-outlined text-[18px] shrink-0">insights</span>
          <span className="font-medium text-xs flex-1 truncate">Analytics</span>
        </button>

        {/* Tab 5: Settings */}
        <div>
          <button
            onClick={() => setActiveModule('settings')}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left text-xs transition-colors duration-150 active:scale-[0.99] ${
              activeModule === 'settings'
                ? 'bg-[#eaedff] text-[#3525cd] font-bold shadow-xs'
                : 'text-[#464555] hover:bg-[#f2f3ff] hover:text-[#131b2e]'
            }`}
            type="button"
          >
            <span
              className="material-symbols-outlined text-[18px] shrink-0"
              style={{ fontVariationSettings: activeModule === 'settings' ? "'FILL' 1" : "'FILL' 0" }}
            >
              settings
            </span>
            <span className="font-medium text-xs flex-1 truncate">Settings</span>
            {activeModule === 'settings' && (
              <span className="w-1.5 h-1.5 rounded-full bg-[#3525cd] shrink-0"></span>
            )}
          </button>

          {/* Sub-Navigation when Settings is active */}
          {activeModule === 'settings' && (
            <div className="pl-7 pr-2 py-1.5 space-y-1">
              <button
                onClick={() => setSettingsSubTab('general')}
                className={`w-full text-left px-2.5 py-1 text-[11px] rounded transition-colors truncate ${
                  settingsSubTab === 'general'
                    ? 'text-[#3525cd] font-bold bg-[#e2dfff]/60'
                    : 'text-[#464555] hover:text-[#131b2e] hover:bg-[#f2f3ff]'
                }`}
              >
                General & Bot Personality
              </button>
              <button
                onClick={() => setSettingsSubTab('staff')}
                className={`w-full text-left px-2.5 py-1 text-[11px] rounded transition-colors truncate ${
                  settingsSubTab === 'staff'
                    ? 'text-[#3525cd] font-bold bg-[#e2dfff]/60'
                    : 'text-[#464555] hover:text-[#131b2e] hover:bg-[#f2f3ff]'
                }`}
              >
                Staff & Roles (RBAC)
              </button>
              <button
                onClick={() => setSettingsSubTab('routing')}
                className={`w-full text-left px-2.5 py-1 text-[11px] rounded transition-colors truncate ${
                  settingsSubTab === 'routing'
                    ? 'text-[#3525cd] font-bold bg-[#e2dfff]/60'
                    : 'text-[#464555] hover:text-[#131b2e] hover:bg-[#f2f3ff]'
                }`}
              >
                Queue Routing Rules
              </button>
              <button
                onClick={() => {
                  setSettingsSubTab('audit');
                  onOpenAuditLogs();
                }}
                className={`w-full text-left px-2.5 py-1 text-[11px] rounded transition-colors truncate ${
                  settingsSubTab === 'audit'
                    ? 'text-[#3525cd] font-bold bg-[#e2dfff]/60'
                    : 'text-[#464555] hover:text-[#131b2e] hover:bg-[#f2f3ff]'
                }`}
              >
                Audit Logs (FR-OPS)
              </button>
            </div>
          )}
        </div>

        {/* Section 2: RAG Vector Pipelines */}
        <div className="pt-4 px-3 pb-2 text-[10px] font-bold text-[#777587] uppercase tracking-wider">
          RAG Vector Pipelines
        </div>
        <div className="space-y-1">
          <button
            onClick={() => setActiveModule('knowledge')}
            className="w-full flex items-center gap-3 px-3 py-1.5 text-[#464555] hover:bg-[#f2f3ff] rounded-lg text-xs text-left"
            type="button"
          >
            <span className="material-symbols-outlined text-[16px] text-[#005338] shrink-0">database</span>
            <span className="truncate">Vector Store (pgvector)</span>
          </button>
          <button
            onClick={() => setActiveModule('knowledge')}
            className="w-full flex items-center gap-3 px-3 py-1.5 text-[#464555] hover:bg-[#f2f3ff] rounded-lg text-xs text-left"
            type="button"
          >
            <span className="material-symbols-outlined text-[16px] text-[#3525cd] shrink-0">
              sync_saved_locally
            </span>
            <span className="flex-1 truncate">Crawl Pipelines</span>
            <span className="font-mono text-[10px] text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200 font-semibold shrink-0">
              Active
            </span>
          </button>
        </div>

        {/* Triage Views Quick Filters */}
        <div className="pt-4 px-3 pb-2 text-[10px] font-bold text-[#777587] uppercase tracking-wider">
          Triage Views
        </div>
        <div className="space-y-1">
          <button
            onClick={() => setActiveModule('inbox')}
            className="w-full flex items-center justify-between px-3 py-1.5 text-xs text-[#464555] hover:bg-[#f2f3ff] rounded-lg"
            type="button"
          >
            <span className="flex items-center gap-2 truncate">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0"></span>
              <span className="truncate">VIP Banking Leads</span>
            </span>
            <span className="text-[#777587] text-[11px] font-mono shrink-0">2</span>
          </button>
          <button
            onClick={() => setActiveModule('inbox')}
            className="w-full flex items-center justify-between px-3 py-1.5 text-xs text-[#464555] hover:bg-[#f2f3ff] rounded-lg"
            type="button"
          >
            <span className="flex items-center gap-2 truncate">
              <span className="w-1.5 h-1.5 rounded-full bg-[#ba1a1a] shrink-0"></span>
              <span className="text-[#ba1a1a] font-medium truncate">SLA Breaching Soon</span>
            </span>
            <span className="text-[#ba1a1a] text-[11px] font-bold font-mono shrink-0">1</span>
          </button>
        </div>
      </div>

      {/* Sidebar Footer */}
      <div className="p-3 border-t border-[#c7c4d8]/60 bg-[#f2f3ff]/40 space-y-1">
        <div
          onClick={() => {
            setActiveModule('settings');
            setSettingsSubTab('staff');
          }}
          className="flex items-center justify-between px-3 py-2 rounded-lg bg-white border border-[#c7c4d8]/60 hover:border-[#3525cd] cursor-pointer transition-colors"
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="material-symbols-outlined text-emerald-600 text-[18px] shrink-0">
              radio_button_checked
            </span>
            <div className="leading-tight truncate">
              <p className="font-semibold text-xs text-[#131b2e] truncate">Staff Online Status</p>
              <p className="text-[10px] text-[#777587] truncate">SLA average 42s</p>
            </div>
          </div>
          <span className="text-[11px] font-mono font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200 shrink-0">
            3 / 5
          </span>
        </div>

        <div className="px-3 pt-1 text-[10px] font-mono text-[#777587] flex items-center justify-between">
          <span className="truncate">GoTek AI Engine</span>
          <span className="shrink-0">SRS v1.0</span>
        </div>
      </div>
    </aside>
  );
};
