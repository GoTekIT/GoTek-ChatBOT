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

  // Sidebar resizer & collapse state
  const [sidebarWidth, setSidebarWidth] = useState<number>(256);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(false);
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
    <div className="h-screen w-screen overflow-hidden flex flex-col bg-[#faf8ff] text-[#131b2e] antialiased">
      {/* Global Toast */}
      {toastMessage && (
        <div className="fixed top-4 right-4 z-50 bg-[#131b2e] text-white text-xs px-4 py-2.5 rounded-lg shadow-xl flex items-center gap-2 border border-[#4f46e5] animate-in fade-in slide-in-from-top-2">
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

            {/* Draggable Resizer between Sidebar & Content */}
            {!isSidebarCollapsed && (
              <div
                onMouseDown={() => setIsDraggingSidebar(true)}
                className={`w-1.5 h-full cursor-col-resize hover:bg-[#4f46e5]/40 transition-colors z-20 flex items-center justify-center select-none group shrink-0 ${
                  isDraggingSidebar ? 'bg-[#4f46e5]' : 'bg-transparent'
                }`}
                title="Kéo sang trái / phải để thay đổi độ rộng Sidebar"
              >
                <div className="w-0.5 h-8 rounded-full bg-[#c7c4d8] group-hover:bg-[#4f46e5] group-hover:scale-y-125 transition-all"></div>
              </div>
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

      {/* Switch Workspace Modal */}
      {workspaceModalOpen && (
        <div
          onClick={() => setWorkspaceModalOpen(false)}
          className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-100"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-xl border border-[#c7c4d8] shadow-2xl max-w-sm w-full p-4 space-y-3"
          >
            <div className="flex items-center justify-between pb-2 border-b border-[#eaedff]">
              <h3 className="font-bold text-xs text-[#131b2e]">Chuyển đổi không gian làm việc</h3>
              <button
                onClick={() => setWorkspaceModalOpen(false)}
                className="text-[#777587] hover:text-[#131b2e]"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>
            <div className="space-y-1 text-xs">
              <button
                onClick={() => {
                  showGlobalToast('Đã chọn: Không gian chính (Enterprise Tier)');
                  setWorkspaceModalOpen(false);
                }}
                className="w-full p-2.5 rounded-lg border border-[#3525cd] bg-[#eaedff]/30 text-left flex items-center justify-between"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded bg-white border border-[#c7c4d8]/70 flex items-center justify-center p-0.5 shadow-xs">
                    <img src="/gotek-logo.png" alt="GoTek" className="w-full h-full object-contain" />
                  </div>
                  <div>
                    <p className="font-bold text-[#131b2e]">GoTek Solutions HQ</p>
                    <p className="text-[10px] text-[#3525cd]">Gói Doanh Nghiệp (Enterprise)</p>
                  </div>
                </div>
                <span className="text-[#3525cd] font-bold text-[11px]">Đang chọn</span>
              </button>

              <button
                onClick={() => {
                  showGlobalToast('Chuyển sang môi trường thử nghiệm Sandbox');
                  setWorkspaceModalOpen(false);
                }}
                className="w-full p-2.5 rounded-lg border border-[#c7c4d8] hover:bg-[#f2f3ff] text-left flex items-center justify-between transition-colors"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded bg-[#059669] text-white flex items-center justify-center font-bold text-xs">
                    S
                  </div>
                  <div>
                    <p className="font-semibold text-[#131b2e]">GoTek Staging Sandbox</p>
                    <p className="text-[10px] text-[#777587]">Cluster Kiểm Thử Riêng</p>
                  </div>
                </div>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
