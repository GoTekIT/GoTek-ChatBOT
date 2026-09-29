import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
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
  return (
    <motion.aside
      initial={false}
      animate={{
        width: isCollapsed ? 64 : sidebarWidth,
      }}
      transition={{
        type: 'spring',
        stiffness: 340,
        damping: 32,
      }}
      className="h-full flex flex-col justify-between shrink-0 bg-[#f8f9fa] dark:bg-[#0a0e17]/95 backdrop-blur-xl border-r border-slate-200/80 dark:border-slate-800/80 select-none z-20 relative transition-colors"
      style={{ willChange: 'width' }}
    >
      {/* =====================================================================
          1. TOP SECTION: BRAND LOGO & WORKSPACE SWITCHER (ENLARGED & POLISHED)
          ===================================================================== */}
      <div className={`border-b border-slate-200/70 dark:border-slate-800/80 flex items-center transition-all ${
        isCollapsed ? 'p-2.5 flex-col justify-center' : 'p-3 justify-between gap-2'
      }`}>
        <div
          onClick={onSwitchWorkspace}
          className={`flex items-center rounded-2xl bg-white dark:bg-slate-800/90 hover:bg-slate-50 dark:hover:bg-slate-750 border border-slate-200/80 dark:border-slate-700/80 hover:border-blue-500/50 dark:hover:border-blue-500/60 transition-all duration-200 cursor-pointer shadow-xs group ${
            isCollapsed ? 'w-11 h-11 p-1.5 justify-center' : 'flex-1 p-2.5 justify-between min-w-0'
          }`}
          title="Đổi không gian làm việc (Click để mở danh sách Workspace)"
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200/80 dark:border-slate-700 p-1 flex items-center justify-center shrink-0 shadow-xs ring-2 ring-blue-500/10 group-hover:scale-105 transition-transform">
              <img src="/gotek-logo.png" alt="GoTek" className="w-full h-full object-contain" />
            </div>

            <AnimatePresence>
              {!isCollapsed && (
                <motion.div
                  initial={{ opacity: 0, width: 0 }}
                  animate={{ opacity: 1, width: 'auto' }}
                  exit={{ opacity: 0, width: 0 }}
                  transition={{ duration: 0.2 }}
                  className="flex flex-col min-w-0 overflow-hidden whitespace-nowrap"
                >
                  <span className="font-bold text-[13px] text-slate-800 dark:text-slate-100 truncate group-hover:text-[#1664ff] dark:group-hover:text-blue-400 transition-colors">
                    GoTek Solutions HQ
                  </span>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                    <span className="text-[10px] text-[#1664ff] dark:text-blue-400 font-semibold tracking-tight truncate">
                      Enterprise Tier
                    </span>
                    <span className="text-[9px] font-mono text-slate-400 dark:text-slate-500">
                      #ws-88f2
                    </span>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {!isCollapsed && (
            <div className="p-1 rounded-lg bg-slate-100 dark:bg-slate-700/60 group-hover:bg-blue-50 dark:group-hover:bg-blue-900/40 text-slate-400 group-hover:text-[#1664ff] dark:group-hover:text-blue-400 transition-colors shrink-0">
              <span className="material-symbols-outlined text-[18px] block">
                unfold_more
              </span>
            </div>
          )}
        </div>
      </div>

      {/* =====================================================================
          2. MAIN NAVIGATION ITEMS (SMOOTH TRANSITIONING BETWEEN RAIL & EXPANDED)
          ===================================================================== */}
      <div className="flex-1 overflow-y-auto px-2 py-2.5 space-y-1 custom-scrollbar overflow-x-hidden">
        {/* Section title (fade in/out) */}
        <AnimatePresence>
          {!isCollapsed && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.15 }}
              className="px-2.5 pb-1 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider whitespace-nowrap overflow-hidden"
            >
              Phân hệ chính
            </motion.div>
          )}
        </AnimatePresence>

        {/* Tab 1: Inbox */}
        <div className="relative group w-full flex justify-center">
          <button
            onClick={() => setActiveModule('inbox')}
            className={`flex items-center rounded-xl transition-all duration-200 border-0 border-none outline-none cursor-pointer relative ${
              isCollapsed
                ? 'w-10 h-10 justify-center'
                : 'w-full px-3 py-2 justify-start gap-2.5'
            } ${
              activeModule === 'inbox'
                ? 'bg-[#e8f3ff] dark:bg-blue-950/70 text-[#1664ff] dark:text-blue-400 font-bold border border-transparent dark:border-blue-800/60 shadow-xs'
                : 'text-[#646a73] dark:text-slate-400 hover:bg-[#ebedf0] dark:hover:bg-slate-800/70 hover:text-[#1f2329] dark:hover:text-slate-100'
            }`}
            type="button"
          >
            {activeModule === 'inbox' && (
              <motion.span
                layoutId="activeNavPill"
                className="absolute left-0 top-2 bottom-2 w-1 bg-[#1664ff] dark:bg-blue-400 rounded-r-full"
              />
            )}
            <span
              className="material-symbols-outlined text-[20px] shrink-0"
              style={{ fontVariationSettings: activeModule === 'inbox' ? "'FILL' 1" : "'FILL' 0" }}
            >
              forum
            </span>

            {!isCollapsed && (
              <span className="font-medium text-xs flex-1 truncate text-left whitespace-nowrap">
                Hộp thư CSKH
              </span>
            )}

            <span className={`bg-[#f53f3f] text-white text-[9.5px] font-bold rounded-full flex items-center justify-center shadow-xs shrink-0 ${
              isCollapsed ? 'absolute top-1 right-1 px-1 min-w-[15px] h-3.5' : 'px-1.5 py-0.2'
            }`}>
              3
            </span>
          </button>

          {/* Floating Tooltip when collapsed */}
          {isCollapsed && (
            <div className="absolute left-[68px] top-1/2 -translate-y-1/2 px-2.5 py-1.5 bg-[#1f2329] dark:bg-slate-800 text-white text-xs font-medium rounded-lg shadow-xl opacity-0 pointer-events-none group-hover:opacity-100 group-hover:translate-x-0 -translate-x-2 transition-all whitespace-nowrap z-50 border border-transparent dark:border-slate-700">
              Hộp thư CSKH (Inbox)
              <div className="absolute -left-1 top-1/2 -translate-y-1/2 w-2 h-2 bg-[#1f2329] dark:bg-slate-800 rotate-45" />
            </div>
          )}
        </div>

        {/* Tab 2: Knowledge Base */}
        <div className="relative group w-full flex justify-center">
          <button
            onClick={() => setActiveModule('knowledge')}
            className={`flex items-center rounded-xl transition-all duration-200 border-0 border-none outline-none cursor-pointer relative ${
              isCollapsed
                ? 'w-10 h-10 justify-center'
                : 'w-full px-3 py-2 justify-start gap-2.5'
            } ${
              activeModule === 'knowledge'
                ? 'bg-[#e8f3ff] dark:bg-blue-950/70 text-[#1664ff] dark:text-blue-400 font-bold border border-transparent dark:border-blue-800/60 shadow-xs'
                : 'text-[#646a73] dark:text-slate-400 hover:bg-[#ebedf0] dark:hover:bg-slate-800/70 hover:text-[#1f2329] dark:hover:text-slate-100'
            }`}
            type="button"
          >
            {activeModule === 'knowledge' && (
              <motion.span
                layoutId="activeNavPill"
                className="absolute left-0 top-2 bottom-2 w-1 bg-[#1664ff] dark:bg-blue-400 rounded-r-full"
              />
            )}
            <span
              className="material-symbols-outlined text-[20px] shrink-0"
              style={{ fontVariationSettings: activeModule === 'knowledge' ? "'FILL' 1" : "'FILL' 0" }}
            >
              menu_book
            </span>

            {!isCollapsed && (
              <span className="font-medium text-xs flex-1 truncate text-left whitespace-nowrap">
                Kho tri thức RAG
              </span>
            )}
            {!isCollapsed && activeModule === 'knowledge' && (
              <span className="w-1.5 h-1.5 rounded-full bg-[#1664ff] dark:bg-blue-400 shrink-0" />
            )}
          </button>

          {isCollapsed && (
            <div className="absolute left-[68px] top-1/2 -translate-y-1/2 px-2.5 py-1.5 bg-[#1f2329] dark:bg-slate-800 text-white text-xs font-medium rounded-lg shadow-xl opacity-0 pointer-events-none group-hover:opacity-100 group-hover:translate-x-0 -translate-x-2 transition-all whitespace-nowrap z-50 border border-transparent dark:border-slate-700">
              Kho tri thức RAG (Knowledge)
              <div className="absolute -left-1 top-1/2 -translate-y-1/2 w-2 h-2 bg-[#1f2329] dark:bg-slate-800 rotate-45" />
            </div>
          )}
        </div>

        {/* Tab 3: Channels & Integrations */}
        <div className="relative group w-full flex justify-center">
          <button
            onClick={() => setActiveModule('channels')}
            className={`flex items-center rounded-xl transition-all duration-200 border-0 border-none outline-none cursor-pointer relative ${
              isCollapsed
                ? 'w-10 h-10 justify-center'
                : 'w-full px-3 py-2 justify-start gap-2.5'
            } ${
              activeModule === 'channels'
                ? 'bg-[#e8f3ff] dark:bg-blue-950/70 text-[#1664ff] dark:text-blue-400 font-bold border border-transparent dark:border-blue-800/60 shadow-xs'
                : 'text-[#646a73] dark:text-slate-400 hover:bg-[#ebedf0] dark:hover:bg-slate-800/70 hover:text-[#1f2329] dark:hover:text-slate-100'
            }`}
            type="button"
          >
            {activeModule === 'channels' && (
              <motion.span
                layoutId="activeNavPill"
                className="absolute left-0 top-2 bottom-2 w-1 bg-[#1664ff] dark:bg-blue-400 rounded-r-full"
              />
            )}
            <span className="material-symbols-outlined text-[20px] shrink-0">hub</span>

            {!isCollapsed && (
              <span className="font-medium text-xs flex-1 truncate text-left whitespace-nowrap">
                Kênh & Widget SDK
              </span>
            )}
          </button>

          {isCollapsed && (
            <div className="absolute left-[68px] top-1/2 -translate-y-1/2 px-2.5 py-1.5 bg-[#1f2329] dark:bg-slate-800 text-white text-xs font-medium rounded-lg shadow-xl opacity-0 pointer-events-none group-hover:opacity-100 group-hover:translate-x-0 -translate-x-2 transition-all whitespace-nowrap z-50 border border-transparent dark:border-slate-700">
              Kênh liên lạc & Widget SDK
              <div className="absolute -left-1 top-1/2 -translate-y-1/2 w-2 h-2 bg-[#1f2329] dark:bg-slate-800 rotate-45" />
            </div>
          )}
        </div>

        {/* Tab 4: Analytics */}
        <div className="relative group w-full flex justify-center">
          <button
            onClick={() => setActiveModule('analytics')}
            className={`flex items-center rounded-xl transition-all duration-200 border-0 border-none outline-none cursor-pointer relative ${
              isCollapsed
                ? 'w-10 h-10 justify-center'
                : 'w-full px-3 py-2 justify-start gap-2.5'
            } ${
              activeModule === 'analytics'
                ? 'bg-[#e8f3ff] dark:bg-blue-950/70 text-[#1664ff] dark:text-blue-400 font-bold border border-transparent dark:border-blue-800/60 shadow-xs'
                : 'text-[#646a73] dark:text-slate-400 hover:bg-[#ebedf0] dark:hover:bg-slate-800/70 hover:text-[#1f2329] dark:hover:text-slate-100'
            }`}
            type="button"
          >
            {activeModule === 'analytics' && (
              <motion.span
                layoutId="activeNavPill"
                className="absolute left-0 top-2 bottom-2 w-1 bg-[#1664ff] dark:bg-blue-400 rounded-r-full"
              />
            )}
            <span className="material-symbols-outlined text-[20px] shrink-0">insights</span>

            {!isCollapsed && (
              <span className="font-medium text-xs flex-1 truncate text-left whitespace-nowrap">
                Báo cáo & Phân tích
              </span>
            )}
          </button>

          {isCollapsed && (
            <div className="absolute left-[68px] top-1/2 -translate-y-1/2 px-2.5 py-1.5 bg-[#1f2329] dark:bg-slate-800 text-white text-xs font-medium rounded-lg shadow-xl opacity-0 pointer-events-none group-hover:opacity-100 group-hover:translate-x-0 -translate-x-2 transition-all whitespace-nowrap z-50 border border-transparent dark:border-slate-700">
              Báo cáo & Phân tích
              <div className="absolute -left-1 top-1/2 -translate-y-1/2 w-2 h-2 bg-[#1f2329] dark:bg-slate-800 rotate-45" />
            </div>
          )}
        </div>

        {/* Tab 5: Settings */}
        <div className="relative group w-full flex flex-col items-center">
          <button
            onClick={() => setActiveModule('settings')}
            className={`flex items-center rounded-xl transition-all duration-200 border-0 border-none outline-none cursor-pointer relative ${
              isCollapsed
                ? 'w-10 h-10 justify-center'
                : 'w-full px-3 py-2 justify-start gap-2.5'
            } ${
              activeModule === 'settings'
                ? 'bg-[#e8f3ff] dark:bg-blue-950/70 text-[#1664ff] dark:text-blue-400 font-bold border border-transparent dark:border-blue-800/60 shadow-xs'
                : 'text-[#646a73] dark:text-slate-400 hover:bg-[#ebedf0] dark:hover:bg-slate-800/70 hover:text-[#1f2329] dark:hover:text-slate-100'
            }`}
            type="button"
          >
            {activeModule === 'settings' && (
              <motion.span
                layoutId="activeNavPill"
                className="absolute left-0 top-2 bottom-2 w-1 bg-[#1664ff] dark:bg-blue-400 rounded-r-full"
              />
            )}
            <span
              className="material-symbols-outlined text-[20px] shrink-0"
              style={{ fontVariationSettings: activeModule === 'settings' ? "'FILL' 1" : "'FILL' 0" }}
            >
              settings
            </span>

            {!isCollapsed && (
              <span className="font-medium text-xs flex-1 truncate text-left whitespace-nowrap">
                Cài đặt hệ thống
              </span>
            )}
            {!isCollapsed && activeModule === 'settings' && (
              <span className="w-1.5 h-1.5 rounded-full bg-[#1664ff] dark:bg-blue-400 shrink-0" />
            )}
          </button>

          {isCollapsed && (
            <div className="absolute left-[68px] top-1/2 -translate-y-1/2 px-2.5 py-1.5 bg-[#1f2329] dark:bg-slate-800 text-white text-xs font-medium rounded-lg shadow-xl opacity-0 pointer-events-none group-hover:opacity-100 group-hover:translate-x-0 -translate-x-2 transition-all whitespace-nowrap z-50 border border-transparent dark:border-slate-700">
              Cài đặt & Nhân sự
              <div className="absolute -left-1 top-1/2 -translate-y-1/2 w-2 h-2 bg-[#1f2329] dark:bg-slate-800 rotate-45" />
            </div>
          )}

          {/* Submenu when expanded */}
          <AnimatePresence>
            {!isCollapsed && activeModule === 'settings' && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.18 }}
                className="w-full pl-6 pr-1 py-1 space-y-0.5 mt-1 border-l-2 border-slate-200 dark:border-slate-700 ml-4 overflow-hidden"
              >
                <button
                  onClick={() => setSettingsSubTab('general')}
                  className={`w-full text-left px-2 py-1 text-[11px] rounded transition-colors truncate border-0 border-none outline-none cursor-pointer ${
                    settingsSubTab === 'general'
                      ? 'text-[#1664ff] dark:text-blue-400 font-bold bg-[#e8f3ff] dark:bg-blue-950/60'
                      : 'text-[#646a73] dark:text-slate-400 hover:text-[#1f2329] dark:hover:text-slate-200 hover:bg-[#ebedf0] dark:hover:bg-slate-800/60'
                  }`}
                >
                  Cấu hình & Persona
                </button>
                <button
                  onClick={() => setSettingsSubTab('staff')}
                  className={`w-full text-left px-2 py-1 text-[11px] rounded transition-colors truncate border-0 border-none outline-none cursor-pointer ${
                    settingsSubTab === 'staff'
                      ? 'text-[#1664ff] dark:text-blue-400 font-bold bg-[#e8f3ff] dark:bg-blue-950/60'
                      : 'text-[#646a73] dark:text-slate-400 hover:text-[#1f2329] dark:hover:text-slate-200 hover:bg-[#ebedf0] dark:hover:bg-slate-800/60'
                  }`}
                >
                  Nhân sự & Phân quyền
                </button>
                <button
                  onClick={() => setSettingsSubTab('routing')}
                  className={`w-full text-left px-2 py-1 text-[11px] rounded transition-colors truncate border-0 border-none outline-none cursor-pointer ${
                    settingsSubTab === 'routing'
                      ? 'text-[#1664ff] dark:text-blue-400 font-bold bg-[#e8f3ff] dark:bg-blue-950/60'
                      : 'text-[#646a73] dark:text-slate-400 hover:text-[#1f2329] dark:hover:text-slate-200 hover:bg-[#ebedf0] dark:hover:bg-slate-800/60'
                  }`}
                >
                  Định tuyến hàng đợi
                </button>
                <button
                  onClick={() => {
                    setSettingsSubTab('audit');
                    onOpenAuditLogs();
                  }}
                  className={`w-full text-left px-2 py-1 text-[11px] rounded transition-colors truncate border-0 border-none outline-none cursor-pointer ${
                    settingsSubTab === 'audit'
                      ? 'text-[#1664ff] dark:text-blue-400 font-bold bg-[#e8f3ff] dark:bg-blue-950/60'
                      : 'text-[#646a73] dark:text-slate-400 hover:text-[#1f2329] dark:hover:text-slate-200 hover:bg-[#ebedf0] dark:hover:bg-slate-800/60'
                  }`}
                >
                  Nhật ký kiểm toán
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Section 2: Pipelines & Triage (only when expanded) */}
        <AnimatePresence>
          {!isCollapsed && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden space-y-3 pt-2"
            >
              <div>
                <div className="px-2.5 pb-1 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider whitespace-nowrap">
                  RAG Pipelines
                </div>
                <div className="space-y-0.5">
                  <button
                    onClick={() => setActiveModule('knowledge')}
                    className="w-full flex items-center gap-2 px-3 py-1.5 text-[#646a73] dark:text-slate-400 hover:bg-[#ebedf0] dark:hover:bg-slate-800/60 hover:text-[#1f2329] dark:hover:text-slate-200 rounded-lg text-xs text-left border-0 border-none outline-none cursor-pointer transition-colors"
                    type="button"
                  >
                    <span className="material-symbols-outlined text-[15px] text-emerald-600 dark:text-emerald-400 shrink-0">database</span>
                    <span className="truncate">Vector Store (pgvector)</span>
                  </button>
                  <button
                    onClick={() => setActiveModule('knowledge')}
                    className="w-full flex items-center gap-2 px-3 py-1.5 text-[#646a73] dark:text-slate-400 hover:bg-[#ebedf0] dark:hover:bg-slate-800/60 hover:text-[#1f2329] dark:hover:text-slate-200 rounded-lg text-xs text-left border-0 border-none outline-none cursor-pointer transition-colors"
                    type="button"
                  >
                    <span className="material-symbols-outlined text-[15px] text-[#1664ff] dark:text-blue-400 shrink-0">
                      sync_saved_locally
                    </span>
                    <span className="flex-1 truncate">Thu thập tự động</span>
                    <span className="font-mono text-[9px] text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-1 py-0.2 rounded border border-emerald-200/80 dark:border-emerald-800/40 font-semibold shrink-0">
                      Active
                    </span>
                  </button>
                </div>
              </div>

              <div>
                <div className="px-2.5 pb-1 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider whitespace-nowrap">
                  Bộ lọc nhanh
                </div>
                <div className="space-y-0.5">
                  <button
                    onClick={() => setActiveModule('inbox')}
                    className="w-full flex items-center justify-between px-3 py-1.5 text-xs text-[#646a73] dark:text-slate-400 hover:bg-[#ebedf0] dark:hover:bg-slate-800/60 hover:text-[#1f2329] dark:hover:text-slate-200 rounded-lg border-0 border-none outline-none cursor-pointer transition-colors"
                    type="button"
                  >
                    <span className="flex items-center gap-2 truncate">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
                      <span className="truncate">VIP Banking Leads</span>
                    </span>
                    <span className="text-slate-400 dark:text-slate-500 text-[10.5px] font-mono shrink-0">2</span>
                  </button>
                  <button
                    onClick={() => setActiveModule('inbox')}
                    className="w-full flex items-center justify-between px-3 py-1.5 text-xs text-[#646a73] dark:text-slate-400 hover:bg-[#ebedf0] dark:hover:bg-slate-800/60 hover:text-[#1f2329] dark:hover:text-slate-200 rounded-lg border-0 border-none outline-none cursor-pointer transition-colors"
                    type="button"
                  >
                    <span className="flex items-center gap-2 truncate">
                      <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0" />
                      <span className="text-rose-600 dark:text-rose-400 font-medium truncate">Sắp quá hạn SLA</span>
                    </span>
                    <span className="text-rose-600 dark:text-rose-400 text-[10.5px] font-bold font-mono shrink-0">1</span>
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* =====================================================================
          3. BOTTOM SECTION: AUDIT & PROFILE (CLEAN, NO REDUNDANT TEXT BUTTONS)
          ===================================================================== */}
      <div className="p-2 border-t border-slate-200/70 dark:border-slate-800/80 bg-white/70 dark:bg-slate-900/60 flex flex-col gap-1.5">
        {/* Audit Logs button */}
        <div className="relative group w-full flex justify-center">
          <button
            onClick={onOpenAuditLogs}
            className={`flex items-center rounded-xl text-[#646a73] dark:text-slate-400 hover:bg-[#ebedf0] dark:hover:bg-slate-800/80 hover:text-[#1f2329] dark:hover:text-slate-200 transition-all border-0 border-none outline-none cursor-pointer ${
              isCollapsed ? 'w-9 h-9 justify-center' : 'w-full px-2.5 py-1.5 gap-2'
            }`}
            type="button"
            title="Nhật ký kiểm toán (Audit Logs)"
          >
            <span className="material-symbols-outlined text-[19px] shrink-0">verified_user</span>
            {!isCollapsed && (
              <span className="text-xs font-medium truncate">Nhật ký kiểm toán</span>
            )}
          </button>

          {isCollapsed && (
            <div className="absolute left-[68px] top-1/2 -translate-y-1/2 px-2.5 py-1.5 bg-[#1f2329] dark:bg-slate-800 text-white text-xs font-medium rounded-lg shadow-xl opacity-0 pointer-events-none group-hover:opacity-100 group-hover:translate-x-0 -translate-x-2 transition-all whitespace-nowrap z-50 border border-transparent dark:border-slate-700">
              Nhật ký kiểm toán (Audit Logs)
              <div className="absolute -left-1 top-1/2 -translate-y-1/2 w-2 h-2 bg-[#1f2329] dark:bg-slate-800 rotate-45" />
            </div>
          )}
        </div>

        {/* User Status / Avatar */}
        <div className={`flex items-center rounded-xl bg-white dark:bg-slate-800/90 border border-transparent dark:border-slate-750 shadow-xs transition-all ${
          isCollapsed ? 'justify-center p-1.5' : 'justify-between px-2.5 py-1.5'
        }`}>
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-[#1664ff] to-[#4f46e5] text-white font-bold text-xs flex items-center justify-center relative shadow-xs shrink-0 cursor-pointer hover:scale-105 transition-transform">
              <span>A</span>
              <span className="absolute bottom-0 right-0 w-2 h-2 rounded-full bg-[#00b42a] ring-2 ring-white dark:ring-slate-900" />
            </div>

            {!isCollapsed && (
              <div className="leading-tight truncate overflow-hidden">
                <p className="font-semibold text-xs text-[#1f2329] dark:text-slate-100 truncate">Nhân sự online</p>
                <p className="text-[10px] text-slate-400 dark:text-slate-500 truncate">SLA phản hồi: 42s</p>
              </div>
            )}
          </div>

          {!isCollapsed && (
            <span className="text-[10px] font-mono font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-1.5 py-0.5 rounded border border-emerald-200/80 dark:border-emerald-800/40 shrink-0">
              3 / 5
            </span>
          )}
        </div>
      </div>

      {/* =====================================================================
          4. FLOATING RAIL EDGE TOGGLE (NO TEXT - CLICK RAIL OR FLOATING BUTTON TO OPEN/CLOSE)
          ===================================================================== */}
      {/* Full-height subtle Rail Trigger bar */}
      <div
        onClick={onToggleCollapse}
        className="absolute top-0 right-0 w-1.5 h-full cursor-pointer hover:bg-[#1664ff]/30 active:bg-[#1664ff] transition-all z-20 group"
        title={isCollapsed ? 'Nhấp vào mép thanh để mở rộng' : 'Nhấp vào mép thanh để thu gọn'}
      />

      {/* Floating Pill/Circle Button hovering on edge */}
      <motion.button
        onClick={onToggleCollapse}
        type="button"
        whileHover={{ scale: 1.15 }}
        whileTap={{ scale: 0.9 }}
        className="absolute -right-3.5 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 shadow-md hover:shadow-lg hover:border-[#1664ff] dark:hover:border-blue-400 text-slate-600 dark:text-slate-300 hover:text-[#1664ff] dark:hover:text-blue-400 flex items-center justify-center cursor-pointer transition-colors z-30 group outline-none"
        title={isCollapsed ? 'Mở rộng Sidebar' : 'Thu gọn Sidebar'}
      >
        <motion.span
          animate={{ rotate: isCollapsed ? 0 : 180 }}
          transition={{ type: 'spring', stiffness: 350, damping: 25 }}
          className="material-symbols-outlined text-[17px] leading-none shrink-0 group-hover:text-[#1664ff] dark:group-hover:text-blue-400 transition-colors"
        >
          chevron_right
        </motion.span>
        {/* Ambient neon aura on hover */}
        <span className="absolute inset-0 rounded-full bg-[#1664ff]/25 dark:bg-blue-400/25 opacity-0 group-hover:opacity-100 transition-opacity blur-[3px] pointer-events-none" />
      </motion.button>
    </motion.aside>
  );
};
