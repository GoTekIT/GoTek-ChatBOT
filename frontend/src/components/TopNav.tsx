import React, { useState } from 'react';
import { ConsoleModule } from '../types';

interface TopNavProps {
  activeModule: ConsoleModule;
  setActiveModule: (m: ConsoleModule) => void;
  openCommandPalette: () => void;
  onOpenAuditLogs?: () => void;
}

export const TopNav: React.FC<TopNavProps> = ({
  activeModule,
  setActiveModule,
  openCommandPalette,
  onOpenAuditLogs,
}) => {
  const [showNotifications, setShowNotifications] = useState(false);
  const [showTuneModal, setShowTuneModal] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [activeQueueTab, setActiveQueueTab] = useState<'live' | 'handoffs' | 'resolved'>('live');

  return (
    <>
      <header className="flex justify-between items-center w-full px-4 h-14 bg-white border-b border-[#c7c4d8]/70 shrink-0 z-30 select-none shadow-xs">
        {/* Brand & Global Search */}
        <div className="flex items-center gap-5">
          <div 
            onClick={() => setActiveModule('inbox')} 
            className="flex items-center gap-2 cursor-pointer group"
          >
            <img src="/gotek-logo.png" alt="GoTek" className="h-8 object-contain transition-transform group-hover:scale-105" />
            <span className="font-bold text-[#3525cd] text-sm tracking-tight hidden sm:inline border-l border-[#c7c4d8]/70 pl-2.5 ml-1">
              Support Console
            </span>
          </div>

          {/* Global Search Bar with ⌘K */}
          <div className="relative w-64 md:w-80">
            <span className="material-symbols-outlined absolute left-3 top-2 text-[#777587] text-[1.125rem] pointer-events-none">
              search
            </span>
            <input
              type="text"
              readOnly
              onClick={openCommandPalette}
              placeholder="Search conversations, tickets, docs (/)..."
              className="w-full pl-9 pr-9 py-1.5 bg-[#f2f3ff] hover:bg-[#eaedff] border border-[#c7c4d8]/70 rounded-lg text-xs text-[#131b2e] placeholder:text-[#777587] cursor-pointer transition-all focus:outline-none"
            />
            <kbd 
              onClick={openCommandPalette}
              className="absolute right-2 top-2 px-1.5 py-0.5 text-[10px] font-mono text-[#777587] border border-[#c7c4d8] rounded bg-white cursor-pointer hover:bg-slate-50"
            >
              ⌘K
            </kbd>
          </div>
        </div>

        {/* Center Queue Navigation Links */}
        <nav className="hidden lg:flex items-center gap-6 h-full pt-1">
          <button
            onClick={() => {
              setActiveQueueTab('live');
              setActiveModule('inbox');
            }}
            className={`pb-1 text-sm font-semibold flex items-center gap-1.5 transition-colors border-b-2 ${
              activeQueueTab === 'live' && activeModule === 'inbox'
                ? 'text-[#3525cd] border-[#3525cd]'
                : 'text-[#464555] border-transparent hover:text-[#131b2e]'
            }`}
          >
            <span>Live Queue</span>
            <span className="px-1.5 py-0.2 rounded-full bg-[#4f46e5] text-white text-[11px] font-bold">
              25
            </span>
          </button>

          <button
            onClick={() => {
              setActiveQueueTab('handoffs');
              setActiveModule('inbox');
            }}
            className={`pb-1 text-sm font-semibold flex items-center gap-1.5 transition-colors border-b-2 ${
              activeQueueTab === 'handoffs' && activeModule === 'inbox'
                ? 'text-[#ba1a1a] border-[#ba1a1a]'
                : 'text-[#464555] border-transparent hover:text-[#131b2e]'
            }`}
          >
            <span>Handoffs</span>
            <span className="px-1.5 py-0.2 rounded-full bg-[#ffdad6] text-[#ba1a1a] text-[11px] font-bold">
              4
            </span>
          </button>

          <button
            onClick={() => {
              setActiveQueueTab('resolved');
              setActiveModule('inbox');
            }}
            className={`pb-1 text-sm font-semibold flex items-center gap-1.5 transition-colors border-b-2 ${
              activeQueueTab === 'resolved' && activeModule === 'inbox'
                ? 'text-[#3525cd] border-[#3525cd]'
                : 'text-[#464555] border-transparent hover:text-[#131b2e]'
            }`}
          >
            <span>Resolved</span>
          </button>
        </nav>

        {/* Right Section: System Diagnostics, Mode Switcher & Profile */}
        <div className="flex items-center gap-3">
          {/* RAG Engine Status Pill */}
          <div className="hidden xl:flex items-center gap-2 px-2.5 py-1 bg-emerald-50 border border-emerald-200 rounded-full">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span className="text-xs font-semibold text-emerald-800">
              RAG Engine: Healthy v4.2
            </span>
            <span className="text-[11px] text-emerald-700 border-l border-emerald-300 pl-1.5 font-mono">
              38ms
            </span>
          </div>

          {/* Quick Toggle: Console View vs Client Widget View */}
          <div className="flex items-center bg-[#eaedff] p-0.5 rounded-lg border border-[#c7c4d8]/80 text-xs">
            <button
              onClick={() => setActiveModule('inbox')}
              className={`px-2.5 py-1 rounded font-semibold transition-all ${
                activeModule !== 'widget-demo'
                  ? 'bg-white text-[#3525cd] shadow-xs'
                  : 'text-[#464555] hover:text-[#131b2e]'
              }`}
              title="Agent & Operations Console"
            >
              Console
            </button>
            <button
              onClick={() => setActiveModule('widget-demo')}
              className={`px-2.5 py-1 rounded font-semibold flex items-center gap-1 transition-all ${
                activeModule === 'widget-demo'
                  ? 'bg-[#4f46e5] text-white shadow-xs'
                  : 'text-[#464555] hover:text-[#131b2e]'
              }`}
              title="Test Live Visitor Support Widget"
            >
              <span className="material-symbols-outlined text-[14px]">chat</span>
              <span>Live Widget</span>
            </button>
          </div>

          {/* Notification Button with Dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowNotifications(!showNotifications)}
              className="relative p-1.5 text-[#464555] hover:text-[#131b2e] hover:bg-[#f2f3ff] rounded-lg transition-colors"
              title="System Notifications"
              type="button"
            >
              <span className="material-symbols-outlined">notifications</span>
              <span className="absolute top-1 right-1 w-2 h-2 bg-[#ba1a1a] rounded-full ring-2 ring-white"></span>
            </button>

            {showNotifications && (
              <div className="absolute right-0 mt-2 w-80 bg-white border border-[#c7c4d8] rounded-xl shadow-xl py-2 z-50 animate-in fade-in zoom-in-95 duration-150">
                <div className="px-4 py-2 border-b border-[#eaedff] flex items-center justify-between">
                  <span className="font-semibold text-xs text-[#131b2e]">Notifications</span>
                  <span className="text-[10px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded font-mono font-semibold">
                    Realtime
                  </span>
                </div>
                <div className="divide-y divide-[#eaedff] text-xs max-h-64 overflow-y-auto">
                  <div className="p-3 hover:bg-[#f2f3ff] cursor-pointer">
                    <div className="flex items-center gap-1.5 text-amber-700 font-semibold mb-1">
                      <span className="material-symbols-outlined text-[15px]">priority_high</span>
                      <span>SLA Escalation Triggered</span>
                    </div>
                    <p className="text-[#464555] text-[11px]">
                      Nguyễn Minh Tuấn (Techcombank) requested NDA review. SLA countdown &lt; 2m.
                    </p>
                    <span className="text-[10px] text-[#777587] mt-1 block">1 min ago</span>
                  </div>
                  <div className="p-3 hover:bg-[#f2f3ff] cursor-pointer">
                    <div className="flex items-center gap-1.5 text-emerald-700 font-semibold mb-1">
                      <span className="material-symbols-outlined text-[15px]">check_circle</span>
                      <span>Vector Store Re-indexed</span>
                    </div>
                    <p className="text-[#464555] text-[11px]">
                      142 documents synced to text-embedding-3-large pgvector index.
                    </p>
                    <span className="text-[10px] text-[#777587] mt-1 block">12 mins ago</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Quick Settings / Console Tuning */}
          <div className="relative">
            <button
              onClick={() => setShowTuneModal(!showTuneModal)}
              className="p-1.5 text-[#464555] hover:text-[#131b2e] hover:bg-[#f2f3ff] rounded-lg transition-colors"
              title="RAG Pipeline Tuning"
              type="button"
            >
              <span className="material-symbols-outlined">tune</span>
            </button>

            {showTuneModal && (
              <div className="absolute right-0 mt-2 w-72 bg-white border border-[#c7c4d8] rounded-xl shadow-xl p-4 z-50 space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-[#eaedff]">
                  <span className="font-semibold text-xs text-[#131b2e]">Pipeline Parameters</span>
                  <span className="text-[10px] text-[#4f46e5] font-mono">v4.2</span>
                </div>
                <div className="space-y-2 text-xs">
                  <div>
                    <label className="text-[11px] text-[#777587] block mb-1">Embedding Model</label>
                    <div className="p-1.5 bg-[#f2f3ff] rounded font-mono text-[11px] text-[#3525cd] font-medium">
                      text-embedding-3-large (1536d)
                    </div>
                  </div>
                  <div>
                    <label className="text-[11px] text-[#777587] block mb-1">Cosine Sim Threshold</label>
                    <input type="range" min="0.7" max="0.95" step="0.01" defaultValue="0.85" className="w-full accent-[#4f46e5]" />
                    <div className="flex justify-between text-[10px] text-[#777587]">
                      <span>0.70 Low</span>
                      <span className="font-bold text-[#4f46e5]">0.85 Optimal</span>
                      <span>0.95 Strict</span>
                    </div>
                  </div>
                  <div>
                    <label className="text-[11px] text-[#777587] block mb-1">Chunk Size / Overlap</label>
                    <div className="p-1.5 bg-[#f2f3ff] rounded font-mono text-[11px] text-[#131b2e]">
                      512 tokens / 64 overlap
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="h-6 w-px bg-[#c7c4d8] mx-1"></div>

          {/* Alex Rivera Profile Avatar */}
          <div className="relative">
            <button
              onClick={() => setShowProfileMenu(!showProfileMenu)}
              className="flex items-center gap-2 p-1 pl-1.5 pr-2 rounded-lg hover:bg-[#f2f3ff] transition-colors text-left"
              type="button"
            >
              <img
                src="https://lh3.googleusercontent.com/aida-public/AB6AXuDIpnACt-DPC3EKmST8JcrUEP9KWQ8q1_M7agMdnMqkzEK7tjVPpxLI9Cx9LbwC3aoyC5uEoxuVCyJmtffZtxqnhmgTEv9kf4T_yjafri4PEh7D2Lx5zYBOeH-rkZwWrIVaQADElxBweXoaSus1DU1Cu0jfvtexBbpPT-wcHmXzzeBQsXxjzhMsO2zGm1uvrDKKJydKLE9mbiH31T126aR6_jdWfez4UGeUCVUOnUJr3dqJTL7v55yh"
                alt="Agent Alex Rivera"
                referrerPolicy="no-referrer"
                className="w-8 h-8 rounded-full object-cover border border-[#c7c4d8] ring-1 ring-[#4f46e5]/30"
              />
              <div className="hidden xl:block leading-tight">
                <p className="font-semibold text-xs text-[#131b2e]">Alex Rivera</p>
                <p className="text-[10px] text-emerald-700 font-medium">Senior AI Admin</p>
              </div>
              <span className="material-symbols-outlined text-[#777587] text-[16px]">expand_more</span>
            </button>

            {showProfileMenu && (
              <div className="absolute right-0 mt-2 w-56 bg-white border border-[#c7c4d8] rounded-xl shadow-xl py-2 z-50 text-xs">
                <div className="px-3 py-2 border-b border-[#eaedff]">
                  <p className="font-semibold text-[#131b2e]">Alex Rivera</p>
                  <p className="text-[11px] text-[#777587]">alex.rivera@acme.com</p>
                </div>
                <div className="py-1">
                  <button 
                    onClick={() => {
                      setActiveModule('settings');
                      setShowProfileMenu(false);
                    }}
                    className="w-full text-left px-3 py-1.5 hover:bg-[#f2f3ff] flex items-center gap-2"
                  >
                    <span className="material-symbols-outlined text-[16px] text-[#4f46e5]">settings</span>
                    <span>Staff & Roles Settings</span>
                  </button>
                  <button 
                    onClick={() => {
                      if (onOpenAuditLogs) onOpenAuditLogs();
                      setShowProfileMenu(false);
                    }}
                    className="w-full text-left px-3 py-1.5 hover:bg-[#f2f3ff] flex items-center gap-2"
                  >
                    <span className="material-symbols-outlined text-[16px] text-amber-700">receipt_long</span>
                    <span>Inspect Audit Trail</span>
                  </button>
                  <button 
                    onClick={() => {
                      setActiveModule('widget-demo');
                      setShowProfileMenu(false);
                    }}
                    className="w-full text-left px-3 py-1.5 hover:bg-[#f2f3ff] flex items-center gap-2"
                  >
                    <span className="material-symbols-outlined text-[16px] text-emerald-700">visibility</span>
                    <span>Preview Visitor Widget</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>
    </>
  );
};
