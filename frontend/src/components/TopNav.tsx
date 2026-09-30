import React, { useState } from 'react';
import { ConsoleModule } from '../types';
import { ThreeNeuralCore } from './common/ThreeNeuralCore';
import { VectorSpace3DModal } from './modals/VectorSpace3DModal';
import { ChangePasswordModal } from './modals/ChangePasswordModal';
import { useTheme } from '../context/ThemeContext';
import {can} from '../services/authorization';

interface TopNavProps {
  activeModule: ConsoleModule;
  setActiveModule: (m: ConsoleModule) => void;
  openCommandPalette: () => void;
  onOpenAuditLogs?: () => void;
  me?: any;
  onLogout?: () => void;
}

export const TopNav: React.FC<TopNavProps> = ({
  activeModule,
  setActiveModule,
  openCommandPalette,
  onOpenAuditLogs,
  me,
  onLogout,
}) => {
  const { theme, toggleTheme } = useTheme();
  const [showNotifications, setShowNotifications] = useState(false);
  const [showTuneModal, setShowTuneModal] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showVectorModal, setShowVectorModal] = useState(false);
  const [showChangePasswordModal, setShowChangePasswordModal] = useState(false);
  const [activeQueueTab, setActiveQueueTab] = useState<'live' | 'handoffs' | 'resolved'>('live');

  const displayName = me?.user?.fullName || me?.user?.full_name || me?.user?.name || me?.user?.email?.split('@')[0] || 'Chưa xác định';
  const displayEmail = me?.user?.email || 'Chưa xác định';
  const displayRole = me?.role === 'Owner' ? 'Workspace Owner' : me?.role || 'Chưa xác định';
  const avatarUrl = `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(displayName)}`;

  return (
    <>
      <header className="flex justify-between items-center w-full px-5 h-14 bg-white dark:bg-[#0c1220] backdrop-blur-xl border-b border-slate-200/80 dark:border-slate-800/80 shrink-0 z-30 select-none transition-colors">
        {/* Brand & Global Search */}
        <div className="flex items-center gap-5">
          <div 
            onClick={() => setActiveModule('inbox')} 
            className="flex items-center gap-2 cursor-pointer group"
          >
            <img src="/gotek-logo.png" alt="GoTek" className="h-8 object-contain transition-transform group-hover:scale-105" />
            <span className="font-bold text-[#1664ff] dark:text-[#3b82f6] text-[13.5px] tracking-tight hidden sm:inline border-l border-slate-200 dark:border-slate-800 pl-3 ml-1">
              Support Console
            </span>
          </div>

          {/* Global Search Bar with ⌘K */}
          <div className="relative w-64 md:w-80">
            <span className="material-symbols-outlined absolute left-3 top-2 text-slate-400 dark:text-slate-500 text-[18px] pointer-events-none">
              search
            </span>
            <input
              type="text"
              readOnly
              onClick={openCommandPalette}
              placeholder="Tìm kiếm hội thoại, tài liệu (/)..."
              className="w-full pl-9 pr-9 py-1.5 bg-slate-100/80 dark:bg-slate-900/90 hover:bg-slate-100 dark:hover:bg-slate-800 border border-transparent dark:border-slate-800 focus:border-[#1664ff] dark:focus:border-blue-500 rounded-lg text-[13px] text-[#1f2329] dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 cursor-pointer transition-all focus:outline-none"
            />
            <kbd 
              onClick={openCommandPalette}
              className="absolute right-2 top-2 px-1.5 py-0.5 text-[10px] font-mono text-slate-400 dark:text-slate-400 border border-slate-200 dark:border-slate-700 rounded bg-white dark:bg-slate-800 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700"
            >
              ⌘K
            </kbd>
          </div>
        </div>

        {/* Center Breadcrumb Context */}
        <div className="hidden lg:flex items-center gap-2 text-[13px] text-slate-500 dark:text-slate-400 font-medium">
          <span className="flex items-center gap-1.5 text-slate-700 dark:text-slate-200 font-semibold">
            <span className="material-symbols-outlined text-[17px] text-[#1664ff] dark:text-blue-400">inbox</span>
            <span>Hộp thư CSKH</span>
          </span>
          <span className="text-slate-300 dark:text-slate-700">/</span>
          <span className="px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800/90 text-slate-700 dark:text-slate-300 text-[12px] font-medium flex items-center gap-1.5 border border-transparent dark:border-slate-700/60">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            <span>{me?.workspaces?.find((workspace: any) => workspace.id === me.workspaceId)?.name || 'Workspace'}</span>
          </span>
        </div>

        {/* Right Section: System Diagnostics, Mode Switcher & Profile */}
        <div className="flex items-center gap-3">
          {/* Interactive Three.js 3D Neural Core Orb */}
          <button
            style={{display: can(me, 'knowledge.manage') ? undefined : 'none'}}
            onClick={() => setShowVectorModal(true)}
            className="flex items-center gap-2.5 px-3 py-1 bg-gradient-to-r from-blue-50/90 to-indigo-50/90 dark:from-blue-950/40 dark:to-indigo-950/40 hover:from-blue-100 hover:to-indigo-100 dark:hover:from-blue-900/50 dark:hover:to-indigo-900/50 border border-blue-200/80 dark:border-blue-800/60 rounded-full transition-all group shadow-xs cursor-pointer"
            title="Khám phá Không gian Vector Tri thức 3D (Three.js WebGL)"
            type="button"
          >
            <ThreeNeuralCore variant="mini" isProcessing={false} className="w-5 h-5" />
            <div className="text-left hidden md:block">
              <div className="flex items-center gap-1.5">
                <span className="text-[12px] font-bold text-slate-800 dark:text-slate-200 group-hover:text-[#1664ff] dark:group-hover:text-blue-400 transition-colors">
                  AI Neural Core
                </span>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              </div>
              <p className="text-[10px] font-mono text-slate-400 dark:text-slate-500">pgvector · 38ms</p>
            </div>
            <span className="material-symbols-outlined text-[15px] text-blue-500 dark:text-blue-400 opacity-60 group-hover:opacity-100 transition-opacity">
              view_in_ar
            </span>
          </button>

          {/* Quick Toggle: Console View vs Client Widget View */}
          <div className="flex items-center bg-slate-100 dark:bg-slate-800/90 p-0.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs">
            <button
              onClick={() => setActiveModule('inbox')}
              className={`px-3 py-1 rounded-md font-semibold transition-all ${
                activeModule !== 'widget-demo'
                  ? 'bg-white dark:bg-slate-700 text-[#1664ff] dark:text-blue-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
              title="Agent & Operations Console"
            >
              Console
            </button>
            <button
              style={{display: can(me, 'channels.manage') ? undefined : 'none'}}
              onClick={() => setActiveModule('widget-demo')}
              className={`px-3 py-1 rounded-md font-semibold flex items-center gap-1 transition-all ${
                activeModule === 'widget-demo'
                  ? 'bg-[#1664ff] dark:bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
              title="Test Live Visitor Support Widget"
            >
              <span className="material-symbols-outlined text-[15px]">chat</span>
              <span>Live Widget</span>
            </button>
          </div>

          {/* Theme Toggle Button (Light ☀️ / Dark 🌙) */}
          <button
            onClick={toggleTheme}
            className="p-1.5 rounded-xl text-slate-500 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80 transition-all cursor-pointer relative group flex items-center justify-center shadow-2xs"
            title={theme === 'dark' ? 'Chuyển sang Giao diện Sáng (Daylight)' : 'Chuyển sang Giao diện Tối Vũ Trụ (Cosmic Dark)'}
            type="button"
          >
            {theme === 'dark' ? (
              <span className="material-symbols-outlined text-[19px] text-amber-400 group-hover:rotate-90 transition-transform duration-300">
                light_mode
              </span>
            ) : (
              <span className="material-symbols-outlined text-[19px] text-slate-700 group-hover:-rotate-12 transition-transform duration-300">
                dark_mode
              </span>
            )}
          </button>

          {/* Notification Button with Dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowNotifications(!showNotifications)}
              className="relative p-1.5 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
              title="System Notifications"
              type="button"
            >
              <span className="material-symbols-outlined">notifications</span>
              <span className="absolute top-1 right-1 w-2 h-2 bg-[#ba1a1a] rounded-full ring-2 ring-white dark:ring-slate-900"></span>
            </button>

            {showNotifications && (
              <div className="absolute right-0 mt-2 w-80 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl py-2 z-50 animate-in fade-in zoom-in-95 duration-150">
                <div className="px-4 py-2 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                  <span className="font-semibold text-xs text-slate-900 dark:text-slate-100">Thông báo hệ thống</span>
                  <span className="text-[10px] text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded font-mono font-semibold border border-emerald-200 dark:border-emerald-800/40">
                    Realtime
                  </span>
                </div>
                <div className="divide-y divide-slate-100 dark:divide-slate-800/70 text-xs max-h-64 overflow-y-auto">
                  <div className="p-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer">
                    <div className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400 font-semibold mb-1">
                      <span className="material-symbols-outlined text-[15px]">priority_high</span>
                      <span>SLA Escalation Triggered</span>
                    </div>
                    <p className="text-slate-600 dark:text-slate-300 text-[11px]">
                      Nguyễn Minh Tuấn (Techcombank) requested NDA review. SLA countdown &lt; 2m.
                    </p>
                    <span className="text-[10px] text-slate-400 dark:text-slate-500 mt-1 block">1 phút trước</span>
                  </div>
                  <div className="p-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer">
                    <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-semibold mb-1">
                      <span className="material-symbols-outlined text-[15px]">check_circle</span>
                      <span>Vector Store Re-indexed</span>
                    </div>
                    <p className="text-slate-600 dark:text-slate-300 text-[11px]">
                      142 documents synced to text-embedding-3-large pgvector index.
                    </p>
                    <span className="text-[10px] text-slate-400 dark:text-slate-500 mt-1 block">12 phút trước</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Quick Settings / Console Tuning */}
          <div className="relative">
            <button
              style={{display: can(me, 'workspace.manage') ? undefined : 'none'}}
              onClick={() => setShowTuneModal(!showTuneModal)}
              className="p-1.5 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
              title="RAG Pipeline Tuning"
              type="button"
            >
              <span className="material-symbols-outlined">tune</span>
            </button>

            {showTuneModal && (
              <div className="absolute right-0 mt-2 w-72 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl p-4 z-50 space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
                  <span className="font-semibold text-xs text-slate-900 dark:text-slate-100">Tham số RAG Pipeline</span>
                  <span className="text-[10px] text-[#4f46e5] dark:text-indigo-400 font-mono">v4.2</span>
                </div>
                <div className="space-y-2 text-xs">
                  <div>
                    <label className="text-[11px] text-slate-500 dark:text-slate-400 block mb-1">Embedding Model</label>
                    <div className="p-1.5 bg-slate-100 dark:bg-slate-800 rounded font-mono text-[11px] text-blue-600 dark:text-blue-400 font-medium border border-slate-200 dark:border-slate-700">
                      text-embedding-3-large (1536d)
                    </div>
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-500 dark:text-slate-400 block mb-1">Cosine Sim Threshold</label>
                    <input type="range" min="0.7" max="0.95" step="0.01" defaultValue="0.85" className="w-full accent-blue-600" />
                    <div className="flex justify-between text-[10px] text-slate-400">
                      <span>0.70 Thấp</span>
                      <span className="font-bold text-blue-600 dark:text-blue-400">0.85 Chuẩn</span>
                      <span>0.95 Nghiêm ngặt</span>
                    </div>
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-500 dark:text-slate-400 block mb-1">Chunk Size / Overlap</label>
                    <div className="p-1.5 bg-slate-100 dark:bg-slate-800 rounded font-mono text-[11px] text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700">
                      512 tokens / 64 overlap
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="h-6 w-px bg-slate-200 dark:bg-slate-800 mx-1"></div>

          {/* User Profile Avatar */}
          <div className="relative">
            <button
              onClick={() => setShowProfileMenu(!showProfileMenu)}
              className="flex items-center gap-2 p-1 pl-1.5 pr-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-left"
              type="button"
            >
              <img
                src={avatarUrl}
                alt={displayName}
                className="w-8 h-8 rounded-full object-cover border border-slate-200 dark:border-slate-700 ring-1 ring-blue-500/30 bg-blue-50 dark:bg-slate-800"
              />
              <div className="hidden xl:block leading-tight">
                <p className="font-semibold text-xs text-slate-900 dark:text-slate-100 truncate max-w-[120px]">{displayName}</p>
                <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium truncate max-w-[120px]">{displayRole}</p>
              </div>
              <span className="material-symbols-outlined text-slate-400 text-[16px]">expand_more</span>
            </button>

            {showProfileMenu && (
              <div className="absolute right-0 mt-2 w-60 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl py-2 z-50 text-xs animate-in fade-in zoom-in-95 duration-100">
                <div className="px-3 py-2 border-b border-slate-100 dark:border-slate-800">
                  <p className="font-semibold text-slate-900 dark:text-slate-100 truncate">{displayName}</p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">{displayEmail}</p>
                </div>
                <div className="py-1">
                  <button style={{display: can(me, 'members.manage') ? undefined : 'none'}}
                    onClick={() => {
                      setActiveModule('settings');
                      setShowProfileMenu(false);
                    }}
                    className="w-full text-left px-3 py-1.5 hover:bg-slate-50 dark:hover:bg-slate-800/60 flex items-center gap-2 text-slate-700 dark:text-slate-200 transition-colors"
                  >
                    <span className="material-symbols-outlined text-[16px] text-blue-600 dark:text-blue-400">settings</span>
                    <span>Cấu hình Nhân sự & Vai trò</span>
                  </button>
                  <button style={{display: can(me, 'audit.read') ? undefined : 'none'}}
                    onClick={() => {
                      if (onOpenAuditLogs) onOpenAuditLogs();
                      setShowProfileMenu(false);
                    }}
                    className="w-full text-left px-3 py-1.5 hover:bg-slate-50 dark:hover:bg-slate-800/60 flex items-center gap-2 text-slate-700 dark:text-slate-200 transition-colors"
                  >
                    <span className="material-symbols-outlined text-[16px] text-amber-600 dark:text-amber-400">receipt_long</span>
                    <span>Nhật ký Kiểm toán (Audit)</span>
                  </button>
                  <button style={{display: can(me, 'channels.manage') ? undefined : 'none'}}
                    onClick={() => {
                      setActiveModule('widget-demo');
                      setShowProfileMenu(false);
                    }}
                    className="w-full text-left px-3 py-1.5 hover:bg-slate-50 dark:hover:bg-slate-800/60 flex items-center gap-2 text-slate-700 dark:text-slate-200 transition-colors"
                  >
                    <span className="material-symbols-outlined text-[16px] text-emerald-600 dark:text-emerald-400">visibility</span>
                    <span>Xem Thử Live Widget</span>
                  </button>
                  <button 
                    onClick={() => {
                      setShowChangePasswordModal(true);
                      setShowProfileMenu(false);
                    }}
                    className="w-full text-left px-3 py-1.5 hover:bg-slate-50 dark:hover:bg-slate-800/60 flex items-center gap-2 text-slate-700 dark:text-slate-200 transition-colors"
                  >
                    <span className="material-symbols-outlined text-[16px] text-indigo-600 dark:text-indigo-400">lock_reset</span>
                    <span>Đổi mật khẩu</span>
                  </button>
                </div>
                {onLogout && (
                  <div className="pt-1 mt-1 border-t border-slate-100 dark:border-slate-800">
                    <button 
                      onClick={() => {
                        setShowProfileMenu(false);
                        onLogout();
                      }}
                      className="w-full text-left px-3 py-1.5 hover:bg-rose-50 dark:hover:bg-rose-950/40 flex items-center gap-2 text-rose-600 dark:text-rose-400 font-semibold transition-colors"
                    >
                      <span className="material-symbols-outlined text-[16px]">logout</span>
                      <span>Đăng xuất</span>
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Cinematic 3D Vector Space Modal */}
      <VectorSpace3DModal
        isOpen={showVectorModal}
        onClose={() => setShowVectorModal(false)}
      />

      {/* Change Password Modal */}
      <ChangePasswordModal
        isOpen={showChangePasswordModal}
        onClose={() => setShowChangePasswordModal(false)}
      />
    </>
  );
};
