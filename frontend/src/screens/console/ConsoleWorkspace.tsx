import React, { useState, useEffect } from 'react';
import { ConsoleModule, SettingsSubTab, KnowledgeDocument, StaffMember, Conversation, ChatMessage } from '../../types';
import { TopNav } from '../../components/TopNav';
import { Sidebar } from '../../components/Sidebar';
import { InboxView } from '../../components/inbox/InboxView';
import { KnowledgeBaseView } from '../../components/knowledge/KnowledgeBaseView';
import { MembersSettings } from '../settings/MembersSettings';
import { AuditSettings } from '../settings/AuditSettings';
import {can, canOpenModule} from '../../services/authorization';
import { CustomerWidgetView } from '../../components/widget/CustomerWidgetView';
import { ChannelsView } from '../../components/channels/ChannelsView';
import { AnalyticsView } from '../../components/analytics/AnalyticsView';
import { CommandPalette } from '../../components/modals/CommandPalette';
import { navigate } from '../../hooks/usePath';
import { api } from '../../api/api';

function mapDbConversation(c: any, messages: ChatMessage[] = []): Conversation {
  return {
    id: c.id,
    customerName: `Khách vãng lai #${c.id.slice(0, 6)}`,
    customerCompany: `Kênh: ${c.channel_name || 'Website Live Widget'}`,
    customerEmail: '—',
    customerPhone: '—',
    customerLocation: 'Việt Nam',
    customerAvatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&auto=format&fit=crop&q=80',
    clientTier: 'Enterprise Prospect',
    websiteUrl: c.channel_name || 'Website Live Widget',
    lastMessageSnippet: c.last_message || (c.status === 'open' ? 'Hội thoại đang mở' : 'Hội thoại đã kết thúc'),
    lastMessageTime: c.last_message_at 
      ? new Date(c.last_message_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      : c.updated_at 
      ? new Date(c.updated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      : 'Vừa xong',
    unreadCount: 0,
    channel: 'Widget',
    status: c.reply_owner === 'HANDOFF_PENDING' 
      ? 'handoff' 
      : c.reply_owner === 'AI_ACTIVE' 
      ? 'ai_active' 
      : c.status === 'resolved' 
      ? 'resolved' 
      : 'in_review',
    assignedTo: c.assigned_to || undefined,
    slaCountdown: '< 2m',
    slaUrgent: c.reply_owner === 'HANDOFF_PENDING',
    activeUrl: 'https://gotek.vn',
    sessionDuration: '—',
    deviceInfo: 'Web Browser',
    ragMatchScore: '100%',
    ragCitations: [],
    crmTags: [],
    messages,
  };
}

function mapDbMessage(m: any): ChatMessage {
  const isInternal = m.visibility === 'internal';
  const isVisitor = m.author_type === 'visitor';
  const isAi = m.author_type === 'ai';
  return {
    id: m.id,
    senderType: isInternal ? 'internal_note' : isVisitor ? 'customer' : isAi ? 'ai' : 'agent',
    senderName: isInternal ? 'Ghi chú nội bộ' : isVisitor ? 'Khách hàng' : isAi ? 'GoTek AI' : 'Nhân viên hỗ trợ',
    senderAvatar: isAi 
      ? undefined 
      : isVisitor 
      ? 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&auto=format&fit=crop&q=80' 
      : undefined,
    senderRole: isAi ? 'AI Copilot' : isVisitor ? 'Khách vãng lai' : 'Chuyên viên hỗ trợ',
    timestamp: new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    content: m.body,
  };
}

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
  const [documents, setDocuments] = useState<KnowledgeDocument[]>([]);
  const [staffList, setStaffList] = useState<StaffMember[]>([]);

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConvId, setSelectedConvId] = useState<string>('');
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
    if (!canOpenModule(me, mod)) { showGlobalToast('Bạn không có quyền truy cập chức năng này.'); return; }
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

  // Real Database Loading for Conversations, Messages, Staff, and Knowledge Documents
  const loadConversations = async () => {
    try {
      const list = await api('/conversations');
      setConversations((prev) => {
        const mapped = list.map((c: any) => {
          const existing = prev.find((p) => p.id === c.id);
          return mapDbConversation(c, existing?.messages || []);
        });
        return mapped;
      });
      if (list.length > 0) {
        setSelectedConvId((prev) => (prev && list.some((c: any) => c.id === prev) ? prev : list[0].id));
      }
    } catch (e) {
      console.error('Failed to load conversations from db:', e);
    }
  };

  useEffect(() => {
    void loadConversations();
    const interval = setInterval(loadConversations, 4000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!selectedConvId) return;
    let alive = true;
    const fetchMessages = async () => {
      try {
        const rawMsgs = await api(`/conversations/${selectedConvId}/messages`);
        if (!alive) return;
        const mappedMsgs = rawMsgs.map(mapDbMessage);
        setConversations((prev) =>
          prev.map((c) => (c.id === selectedConvId ? { ...c, messages: mappedMsgs } : c))
        );
      } catch (e) {
        console.error('Failed to fetch messages:', e);
      }
    };
    void fetchMessages();
    const interval = setInterval(fetchMessages, 3000);
    return () => {
      alive = false;
      clearInterval(interval);
    };
  }, [selectedConvId]);

  useEffect(() => {
    api('/members')
      .then((members: any[]) => {
        setStaffList(
          members.map((m: any) => ({
            id: m.id,
            name: m.full_name,
            email: m.email,
            avatarUrl: '',
            role: m.role.toLowerCase() as any,
            roleTitle: m.role,
            status: m.active ? 'online' : 'offline',
            statusText: m.active ? 'Đang hoạt động' : 'Đã vô hiệu',
            activeChats: 0,
            maxChats: 10,
            assignedChannels: [],
            lastActive: 'Hôm nay',
            locationInfo: 'Việt Nam',
          }))
        );
      })
      .catch(() => {});

    api('/knowledge/items?limit=100')
      .then((res: any) => {
        const items = Array.isArray(res) ? res : res.items || [];
        setDocuments(
          items.map((i: any) => ({
            id: i.id,
            title: i.title,
            size: '12 KB',
            hash: i.draft_version_id || i.id,
            cosineSim: 1.0,
            sourceType: (i.source_type?.toLowerCase() || 'doc') as any,
            publicationStatus: (i.state?.toLowerCase() || 'draft') as any,
            audience: i.audience || 'INTERNAL',
            audienceDesc: i.audience === 'PUBLIC' ? 'Công khai' : 'Nội bộ',
            chunksCount: 1,
            matchScore: '100%',
            lastUpdated: i.updated_at ? new Date(i.updated_at).toLocaleDateString('vi-VN') : 'Mới',
            updatedBy: 'Hệ thống',
          }))
        );
      })
      .catch(() => {});
  }, []);

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

  // Real Database Chat actions
  const handleSendMessage = async (
    convId: string,
    message: Omit<ChatMessage, 'id' | 'timestamp'>
  ) => {
    try {
      const visibility = message.senderType === 'internal_note' ? 'internal' : 'public';
      const clientId = crypto.randomUUID();
      const saved = await api(`/conversations/${convId}/messages`, 'POST', {
        clientId,
        body: message.content,
        visibility,
      });
      const newMsg = mapDbMessage(saved);
      setConversations((prev) =>
        prev.map((c) => {
          if (c.id === convId) {
            return {
              ...c,
              lastMessageSnippet: message.content.slice(0, 80),
              lastMessageTime: 'Vừa xong',
              messages: [...c.messages.filter((m) => m.id !== newMsg.id), newMsg],
            };
          }
          return c;
        })
      );
      showGlobalToast(visibility === 'internal' ? 'Đã lưu ghi chú nội bộ' : 'Đã gửi phản hồi đến khách hàng');
    } catch (e: any) {
      showGlobalToast(`Lỗi gửi: ${e.message || 'Không thể gửi'}`);
    }
  };

  const handleTakeover = async (convId: string) => {
    try {
      const target = conversations.find((c) => c.id === convId);
      await api(`/conversations/${convId}/takeover`, 'POST', {
        version: (target as any)?.owner_version || 1,
      });
      showGlobalToast('Bạn đã tiếp quản hội thoại thành công');
      await loadConversations();
    } catch (e: any) {
      showGlobalToast(`Lỗi tiếp quản: ${e.message || 'Không thể tiếp quản'}`);
    }
  };

  const handleResolve = async (convId: string) => {
    try {
      await api(`/conversations/${convId}/status`, 'PATCH', { status: 'resolved' });
      showGlobalToast('Hội thoại đã được đánh dấu giải quyết');
      await loadConversations();
    } catch (e: any) {
      showGlobalToast(`Lỗi: ${e.message || 'Không thể cập nhật'}`);
    }
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
        onOpenAuditLogs={() => { if (can(me, 'audit.read')) setIsAuditModalOpen(true); }}
        me={me}
        onLogout={onLogout}
      />

      {/* Main Workspace Frame */}
      <div className="flex flex-1 overflow-hidden relative">
        {activeModule !== 'widget-demo' ? (
          <>
            {/* Left Sidebar */}
            <Sidebar
              authorization={me}
              workspaceName={me?.workspaces?.find((w: any) => w.id === me.workspaceId)?.name}
              activeModule={activeModule}
              setActiveModule={handleSelectModule}
              settingsSubTab={settingsSubTab}
              setSettingsSubTab={setSettingsSubTab}
              onOpenAuditLogs={() => { if (can(me, 'audit.read')) setIsAuditModalOpen(true); }}
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

            {/* Content Viewport: deny direct URLs as well as menu navigation. */}
            {!canOpenModule(me, activeModule) && <main className="p-6" role="alert">Bạn không có quyền truy cập chức năng này. <button onClick={() => handleSelectModule('inbox')}>Về hộp thư</button></main>}
            {activeModule === 'inbox' && canOpenModule(me, 'inbox') && (
              <InboxView
                conversations={conversations}
                selectedConvId={selectedConvId}
                setSelectedConvId={setSelectedConvId}
                onSendMessage={handleSendMessage}
                onTakeover={handleTakeover}
                onResolve={handleResolve}
              />
            )}

            {activeModule === 'knowledge' && canOpenModule(me, 'knowledge') && (
              <KnowledgeBaseView
                authorization={me}
                documents={documents}
                onAddDocument={handleAddDocument}
                onUpdateDocument={handleUpdateDocument}
                onDeleteDocument={handleDeleteDocument}
              />
            )}

            {activeModule === 'settings' && canOpenModule(me, 'settings') && (
              <main className="flex-1 overflow-y-auto p-6 space-y-4"><MembersSettings authorization={me} onChange={async () => { await onRefresh?.(); }} /></main>
            )}

            {activeModule === 'channels' && canOpenModule(me, 'channels') && <ChannelsView />}
            {activeModule === 'analytics' && canOpenModule(me, 'analytics') && <AnalyticsView />}
          </>
        ) : (
          /* Live Customer Widget View */
          canOpenModule(me, 'widget-demo') ? <CustomerWidgetView onBackToConsole={() => handleSelectModule('inbox')} /> : <p role="alert">Bạn không có quyền cấu hình widget.</p>
        )}
      </div>

      {/* Command Palette (⌘K) */}
      <CommandPalette
        authorization={me}
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        documents={can(me, 'knowledge.manage') ? documents : []}
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
      {isAuditModalOpen && can(me, 'audit.read') && <div className="fixed inset-0 z-50 bg-black/40 p-8 overflow-auto"><div className="panel bg-white p-6"><button onClick={() => setIsAuditModalOpen(false)}>Đóng nhật ký</button><AuditSettings /></div></div>}

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
                Tài khoản đăng nhập: <strong className="text-slate-900 dark:text-slate-200">{me?.user?.email || 'Chưa xác định'}</strong>
              </span>
              <span className="px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 font-semibold border border-emerald-200/80 dark:border-emerald-800/50">
                {me?.role}
              </span>
            </div>

            {/* Workspaces List */}
            <div className="space-y-2.5 max-h-[360px] overflow-y-auto pr-1">
              {me?.workspaces?.map((workspace: any) => <button key={workspace.id} type="button"
                className="w-full p-3.5 rounded-xl border text-left"
                disabled={workspace.id === me.workspaceId}
                onClick={async () => { try { await onSwitchWorkspace?.(workspace.id); setWorkspaceModalOpen(false); } catch { showGlobalToast('Không thể chuyển workspace.'); } }}>
                {workspace.name} · {workspace.role} {workspace.id === me.workspaceId ? '· Đang chọn' : ''}
              </button>)}
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
