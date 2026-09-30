import React, { useState, useEffect } from 'react';
import { ConsoleModule, SettingsSubTab, KnowledgeDocument, StaffMember, Conversation, ChatMessage } from '../../types';
import { INITIAL_DOCUMENTS, INITIAL_STAFF, INITIAL_CONVERSATIONS, INITIAL_AUDIT_LOGS } from '../../data/mockData';
import { TopNav } from '../../components/TopNav';
import { Sidebar } from '../../components/Sidebar';
import { InboxView } from '../../components/inbox/InboxView';
import { KnowledgeBaseView } from '../../components/knowledge/KnowledgeBaseView';
import { StaffRolesView } from '../../components/settings/StaffRolesView';
import { CustomerWidgetView } from '../../components/widget/CustomerWidgetView';
import { ChannelsView } from '../../components/channels/ChannelsView';
import { AnalyticsView } from '../../components/analytics/AnalyticsView';
import { CommandPalette } from '../../components/modals/CommandPalette';
import { AuditLogModal } from '../../components/modals/AuditLogModal';
import { navigate } from '../../hooks/usePath';

interface ConsoleWorkspaceProps {
  me?: any;
  onLogout?: () => void;
  onRefresh?: () => Promise<void>;
  onSwitchWorkspace?: (workspaceId: string) => Promise<void>;
  currentPath?: string;
}

function resolveInitialModule(path?: string): ConsoleModule {
  if (!path) return 'inbox';
  if (path === '/app/inbox' || path === '/dashboard' || path === '/app' || path.startsWith('/settings/inboxes') || path === '/inbox') return 'inbox';
  if (path === '/app/knowledge' || path === '/knowledge' || path.startsWith('/settings/knowledge') || path.startsWith('/settings/web-sources') || path.startsWith('/settings/ai-rules')) return 'knowledge';
  if (path === '/app/channels' || path === '/channels' || path.startsWith('/settings/channels')) return 'channels';
  if (path === '/app/widget' || path === '/widget' || path.startsWith('/settings/widget')) return 'widget-demo';
  if (path === '/app/analytics' || path === '/app/reports' || path === '/app/usage' || path === '/analytics' || path.startsWith('/settings/usage') || path.startsWith('/settings/analytics')) return 'analytics';
  if (path.startsWith('/app/settings') || path.startsWith('/settings')) return 'settings';
  return 'inbox';
}

export function ConsoleWorkspace({
  me,
  onLogout,
  onRefresh,
  onSwitchWorkspace,
  currentPath = '/app/inbox',
}: ConsoleWorkspaceProps) {
  const [activeModule, setActiveModule] = useState<ConsoleModule>(() => resolveInitialModule(currentPath));

  // Sync activeModule whenever external URL route changes
  useEffect(() => {
    setActiveModule(resolveInitialModule(currentPath));
  }, [currentPath]);
  const [settingsSubTab, setSettingsSubTab] = useState<SettingsSubTab>('staff');
  const [documents, setDocuments] = useState<KnowledgeDocument[]>(INITIAL_DOCUMENTS);
  const [staffList, setStaffList] = useState<StaffMember[]>(() => {
    if (me?.user) {
      const currentUserName = me.user.name || me.user.email?.split('@')[0] || 'Admin';
      const currentUserEmail = me.user.email || 'admin@gotek.vn';
      return [
        {
          id: me.user.id || 'current-user',
          name: currentUserName,
          email: currentUserEmail,
          avatarUrl: `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(currentUserName)}`,
          role: 'owner',
          roleTitle: 'Workspace Owner',
          isCurrentUser: true,
          status: 'online',
          statusText: 'Đang trực tuyến',
          activeChats: 1,
          maxChats: 6,
          assignedChannels: ['Widget', 'Email'],
          lastActive: 'Vừa xong',
          locationInfo: 'Hà Nội, VN',
        },
        ...INITIAL_STAFF.filter((s) => !s.isCurrentUser),
      ];
    }
    return INITIAL_STAFF;
  });

  const [conversations, setConversations] = useState<Conversation[]>(INITIAL_CONVERSATIONS);
  const [selectedConvId, setSelectedConvId] = useState<string>('conv-1');
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [isAuditModalOpen, setIsAuditModalOpen] = useState(false);
  const [workspaceModalOpen, setWorkspaceModalOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Sidebar resizer & collapse state (Default: true for icon-only rail mode like Lark)
  const [sidebarWidth, setSidebarWidth] = useState<number>(256);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(true);
  const [isDraggingSidebar, setIsDraggingSidebar] = useState<boolean>(false);

  // Synchronize route when module changes according to Frontend Group Routes
  const handleSelectModule = (mod: ConsoleModule) => {
    setActiveModule(mod);
    const routeMap: Record<ConsoleModule, string> = {
      inbox: '/app/inbox',
      knowledge: '/app/knowledge',
      channels: '/app/channels',
      analytics: '/app/analytics',
      settings: '/app/settings/members',
      'widget-demo': '/app/widget',
    };
    navigate(routeMap[mod] || '/app/inbox');
  };

  // Keyboard shortcut: Ctrl+K or Cmd+K for Command Palette
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsCommandPaletteOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Sidebar drag resizer
  useEffect(() => {
    if (!isDraggingSidebar) return;

    const handleMouseMove = (e: MouseEvent) => {
      const newWidth = Math.max(180, Math.min(420, e.clientX));
      setSidebarWidth(newWidth);
    };

    const handleMouseUp = () => {
      setIsDraggingSidebar(false);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isDraggingSidebar]);

  const showGlobalToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3200);
  };

  // Document actions
  const handleAddDocument = (newDoc: KnowledgeDocument) => {
    setDocuments((prev) => [newDoc, ...prev]);
    showGlobalToast(`Đã thêm tài liệu tri thức: "${newDoc.title}"`);
  };

  const handleUpdateDocument = (id: string, updates: Partial<KnowledgeDocument>) => {
    setDocuments((prev) =>
      prev.map((d) => (d.id === id ? { ...d, ...updates } : d))
    );
    showGlobalToast('Đã cập nhật trạng thái tài liệu');
  };

  const handleDeleteDocument = (id: string) => {
    setDocuments((prev) => prev.filter((d) => d.id !== id));
    showGlobalToast('Đã gỡ tài liệu khỏi kho tri thức');
  };

  // Staff actions
  const handleInviteStaff = (newStaff: StaffMember) => {
    setStaffList((prev) => [...prev, newStaff]);
    showGlobalToast(`Đã gửi lời mời tham gia tới ${newStaff.email}`);
  };

  const handleUpdateStaffRole = (id: string, newRole: any) => {
    setStaffList((prev) =>
      prev.map((s) =>
        s.id === id
          ? {
              ...s,
              role: newRole,
              roleTitle: newRole === 'admin' ? 'Workspace Admin' : 'Agent',
            }
          : s
      )
    );
    showGlobalToast('Đã phân lại quyền hạn nhân viên');
  };

  const handleRevokeStaff = (id: string) => {
    setStaffList((prev) => prev.filter((s) => s.id !== id));
    showGlobalToast('Đã thu hồi quyền truy cập của nhân viên');
  };

  // Chat actions
  const handleSendMessage = (
    convId: string,
    message: Omit<ChatMessage, 'id' | 'timestamp'>
  ) => {
    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const fullMsg: ChatMessage = {
      ...message,
      id: `msg-${Date.now()}`,
      timestamp: timeStr,
    };

    setConversations((prev) =>
      prev.map((c) => {
        if (c.id === convId) {
          return {
            ...c,
            lastMessageSnippet: message.content.slice(0, 80),
            lastMessageTime: 'Vừa xong',
            messages: [...c.messages, fullMsg],
          };
        }
        return c;
      })
    );
  };

  const handleTakeover = (convId: string) => {
    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const takeoverNotice: ChatMessage = {
      id: `sys-${Date.now()}`,
      senderType: 'system_event',
      senderName: 'Hệ thống',
      timestamp: timeStr,
      content: 'Nhân viên hỗ trợ đã tiếp quản hội thoại này từ AI Copilot.',
    };

    setConversations((prev) =>
      prev.map((c) =>
        c.id === convId
          ? {
              ...c,
              status: 'in_review',
              slaUrgent: false,
              messages: [...c.messages, takeoverNotice],
            }
          : c
      )
    );
    showGlobalToast('Bạn đã tiếp quản thành công hội thoại với khách hàng');
  };

  const handleResolve = (convId: string) => {
    setConversations((prev) =>
      prev.map((c) => (c.id === convId ? { ...c, status: 'resolved' } : c))
    );
    showGlobalToast('Hội thoại đã được đánh dấu giải quyết và lưu trữ');
  };

  return (
    <div className="h-screen w-screen overflow-hidden flex flex-col bg-[#f8f9fb] dark:bg-[#080c14] text-[#1f2329] dark:text-slate-100 antialiased transition-colors duration-300">
      {/* Global Toast */}
      {toastMessage && (
        <div className="fixed top-4 right-4 z-50 bg-[#131b2e] dark:bg-slate-900 text-white text-xs px-4 py-2.5 rounded-xl shadow-2xl flex items-center gap-2 border border-[#4f46e5] dark:border-blue-500/50 animate-in fade-in slide-in-from-top-2">
          <span className="material-symbols-outlined text-[16px] text-emerald-400">check_circle</span>
          <span className="font-medium">{toastMessage}</span>
        </div>
      )}

      {/* Top Navigation */}
      <TopNav
        activeModule={activeModule}
        setActiveModule={handleSelectModule}
        openCommandPalette={() => setIsCommandPaletteOpen(true)}
        onOpenAuditLogs={() => setIsAuditModalOpen(true)}
      />

      {/* Main Workspace Frame */}
      <div className="flex flex-1 overflow-hidden relative">
        {activeModule !== 'widget-demo' ? (
          <>
            {/* Left Sidebar */}
            <Sidebar
              activeModule={activeModule}
              setActiveModule={handleSelectModule}
              settingsSubTab={settingsSubTab}
              setSettingsSubTab={setSettingsSubTab}
              onOpenAuditLogs={() => setIsAuditModalOpen(true)}
              onSwitchWorkspace={() => setWorkspaceModalOpen(true)}
              sidebarWidth={sidebarWidth}
              isCollapsed={isSidebarCollapsed}
              onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
            />

            {/* Subtle Draggable Resizer between Sidebar & Content */}
            {!isSidebarCollapsed && (
              <div
                onMouseDown={() => setIsDraggingSidebar(true)}
                className={`w-1 h-full cursor-col-resize hover:bg-[#3370ff]/30 active:bg-[#3370ff] transition-colors z-20 select-none shrink-0 ${
                  isDraggingSidebar ? 'bg-[#3370ff]' : 'bg-transparent'
                }`}
                title="Kéo sang trái / phải để thay đổi độ rộng Sidebar"
              />
            )}

            {/* Content Viewport */}
            {activeModule === 'inbox' && (
              <InboxView
                conversations={conversations}
                selectedConvId={selectedConvId}
                setSelectedConvId={setSelectedConvId}
                onSendMessage={handleSendMessage}
                onTakeover={handleTakeover}
                onResolve={handleResolve}
              />
            )}

            {activeModule === 'knowledge' && (
              <KnowledgeBaseView
                documents={documents}
                onAddDocument={handleAddDocument}
                onUpdateDocument={handleUpdateDocument}
                onDeleteDocument={handleDeleteDocument}
              />
            )}

            {activeModule === 'settings' && (
              <StaffRolesView
                staffList={staffList}
                onInviteMember={handleInviteStaff}
                onUpdateMemberRole={handleUpdateStaffRole}
                onRevokeMember={handleRevokeStaff}
                onOpenAuditLogs={() => setIsAuditModalOpen(true)}
              />
            )}

            {activeModule === 'channels' && <ChannelsView />}
            {activeModule === 'analytics' && <AnalyticsView />}
          </>
        ) : (
          /* Live Customer Widget View */
          <CustomerWidgetView onBackToConsole={() => handleSelectModule('inbox')} />
        )}
      </div>

      {/* Command Palette (⌘K) */}
      <CommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        documents={documents}
        conversations={conversations}
        staff={staffList}
        onSelectModule={(m) => {
          handleSelectModule(m);
          setIsCommandPaletteOpen(false);
        }}
        onSelectConversation={(id) => {
          setSelectedConvId(id);
          setIsCommandPaletteOpen(false);
        }}
      />

      {/* Audit Log Modal */}
      <AuditLogModal
        isOpen={isAuditModalOpen}
        onClose={() => setIsAuditModalOpen(false)}
        logs={INITIAL_AUDIT_LOGS}
      />

      {/* Expansive Bento Workspace Hub Modal */}
      {workspaceModalOpen && (
        <div
          onClick={() => setWorkspaceModalOpen(false)}
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-150"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white dark:bg-[#0d131f] rounded-2xl border border-slate-200 dark:border-slate-800 shadow-[0_20px_60px_rgba(0,0,0,0.35)] max-w-xl w-full p-6 space-y-4 animate-in zoom-in-95 duration-200"
          >
            {/* Header */}
            <div className="flex items-start justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800/60 flex items-center justify-center text-[#1664ff] dark:text-blue-400 shrink-0">
                  <span className="material-symbols-outlined text-[24px]">domain</span>
                </div>
                <div>
                  <h3 className="font-bold text-base text-slate-900 dark:text-slate-100">
                    Không gian làm việc & Tổ chức
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Chuyển đổi tenant, cluster dữ liệu và môi trường thử nghiệm độc lập
                  </p>
                </div>
              </div>
              <button
                onClick={() => setWorkspaceModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                type="button"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            {/* Current Organization Info */}
            <div className="px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800 flex items-center justify-between text-xs">
              <span className="text-slate-600 dark:text-slate-400 font-medium">
                Tài khoản đăng nhập: <strong className="text-slate-900 dark:text-slate-200">{me?.user?.email || 'admin@gotek.vn'}</strong>
              </span>
              <span className="px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 font-semibold border border-emerald-200/80 dark:border-emerald-800/50">
                Tenant Admin
              </span>
            </div>

            {/* Workspaces List */}
            <div className="space-y-2.5 max-h-[360px] overflow-y-auto pr-1">
              {/* WS 1: Active HQ */}
              <div
                onClick={() => {
                  showGlobalToast('Đang ở không gian chính: GoTek Solutions HQ');
                  setWorkspaceModalOpen(false);
                }}
                className="w-full p-3.5 rounded-xl border-2 border-[#1664ff] dark:border-blue-500 bg-blue-50/50 dark:bg-blue-950/30 text-left flex items-center justify-between cursor-pointer shadow-sm hover:shadow transition-all group"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-white dark:bg-slate-800 border border-blue-200 dark:border-blue-800 flex items-center justify-center p-1 shadow-xs shrink-0 ring-2 ring-blue-500/20">
                    <img src="/gotek-logo.png" alt="GoTek" className="w-full h-full object-contain" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-bold text-sm text-slate-900 dark:text-white truncate">
                        GoTek Solutions HQ
                      </p>
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                      Cluster Chính · Enterprise Tier · pgvector 1536d · 24 Nhân sự
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="px-2.5 py-1 rounded-full bg-[#1664ff] text-white text-[11px] font-bold shadow-xs">
                    Đang chọn
                  </span>
                </div>
              </div>

              {/* WS 2: Techcombank Hub */}
              <div
                onClick={() => {
                  showGlobalToast('Đã chuyển sang: Techcombank Corporate Banking Hub');
                  setWorkspaceModalOpen(false);
                }}
                className="w-full p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-blue-400 dark:hover:border-blue-500 bg-white dark:bg-slate-900/80 hover:bg-slate-50 dark:hover:bg-slate-800 text-left flex items-center justify-between cursor-pointer transition-all group"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-rose-600 text-white flex items-center justify-center font-bold text-sm shadow-xs shrink-0">
                    TCB
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-sm text-slate-900 dark:text-slate-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors truncate">
                      Techcombank Corporate Banking
                    </p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                      Fintech Dedicated Cluster · RAG NDA Strict · SLA 2m Handoff
                    </p>
                  </div>
                </div>
                <span className="material-symbols-outlined text-slate-300 dark:text-slate-600 group-hover:text-[#1664ff] dark:group-hover:text-blue-400 text-[20px] transition-colors">
                  arrow_forward
                </span>
              </div>

              {/* WS 3: Vingroup Retail */}
              <div
                onClick={() => {
                  showGlobalToast('Đã chuyển sang: Vingroup Retail CSKH 24/7');
                  setWorkspaceModalOpen(false);
                }}
                className="w-full p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-blue-400 dark:hover:border-blue-500 bg-white dark:bg-slate-900/80 hover:bg-slate-50 dark:hover:bg-slate-800 text-left flex items-center justify-between cursor-pointer transition-all group"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-bold text-sm shadow-xs shrink-0">
                    VIN
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-sm text-slate-900 dark:text-slate-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors truncate">
                      Vingroup Retail CSKH 24/7
                    </p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                      E-Commerce Omni-channel · 8 Kênh live chat · 48 Nhân sự
                    </p>
                  </div>
                </div>
                <span className="material-symbols-outlined text-slate-300 dark:text-slate-600 group-hover:text-[#1664ff] dark:group-hover:text-blue-400 text-[20px] transition-colors">
                  arrow_forward
                </span>
              </div>

              {/* WS 4: Sandbox Staging */}
              <div
                onClick={() => {
                  showGlobalToast('Chuyển sang môi trường thử nghiệm Sandbox');
                  setWorkspaceModalOpen(false);
                }}
                className="w-full p-3.5 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 hover:border-emerald-500 dark:hover:border-emerald-400 bg-white dark:bg-slate-900/50 hover:bg-emerald-50/30 dark:hover:bg-emerald-950/20 text-left flex items-center justify-between cursor-pointer transition-all group"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold text-sm shadow-xs shrink-0">
                    <span className="material-symbols-outlined text-[20px]">science</span>
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-sm text-slate-900 dark:text-slate-100 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors truncate">
                      GoTek Staging & Sandbox
                    </p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                      Môi trường QA & Kiểm thử tự động · Disposable DB Restore
                    </p>
                  </div>
                </div>
                <span className="material-symbols-outlined text-slate-300 dark:text-slate-600 group-hover:text-emerald-500 text-[20px] transition-colors">
                  arrow_forward
                </span>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3">
              <button
                onClick={() => {
                  showGlobalToast('Mở trình tạo không gian làm việc mới');
                  setWorkspaceModalOpen(false);
                }}
                className="px-4 py-2 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 hover:border-[#1664ff] dark:hover:border-blue-400 text-xs font-semibold text-[#1664ff] dark:text-blue-400 hover:bg-blue-50/50 dark:hover:bg-blue-950/30 flex items-center gap-1.5 transition-colors"
                type="button"
              >
                <span className="material-symbols-outlined text-[17px]">add_circle</span>
                <span>Tạo không gian mới</span>
              </button>

              <button
                onClick={() => {
                  handleSelectModule('settings');
                  setWorkspaceModalOpen(false);
                }}
                className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-medium text-slate-700 dark:text-slate-300 transition-colors"
                type="button"
              >
                Quản lý tổ chức
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
