import React, { useState, useEffect, useRef } from 'react';
import { Conversation, ChatMessage } from '../../types';

interface InboxViewProps {
  conversations: Conversation[];
  selectedConvId: string;
  setSelectedConvId: (id: string) => void;
  onSendMessage: (convId: string, message: Omit<ChatMessage, 'id' | 'timestamp'>) => void;
  onTakeover: (convId: string) => void;
  onResolve: (convId: string) => void;
}

export const InboxView: React.FC<InboxViewProps> = ({
  conversations,
  selectedConvId,
  setSelectedConvId,
  onSendMessage,
  onTakeover,
  onResolve,
}) => {
  const [filterTab, setFilterTab] = useState<'mine' | 'bot' | 'queue'>('mine');
  const [searchQuery, setSearchQuery] = useState('');
  const [composerMode, setComposerMode] = useState<'public' | 'internal'>('public');
  const [messageText, setMessageText] = useState('');
  const [copiedNotification, setCopiedNotification] = useState<string | null>(null);
  const [newTagInput, setNewTagInput] = useState('');
  const [showAddTag, setShowAddTag] = useState(false);
  const [activeTags, setActiveTags] = useState<Record<string, string[]>>({
    'conv-1': ['Enterprise Deal', '🔥 Lead Hot', 'Yêu cầu NDA'],
  });

  // Resizing and Collapsible Columns State
  const [queueWidth, setQueueWidth] = useState<number>(320);
  const [isQueueOpen, setIsQueueOpen] = useState<boolean>(true);
  const [isDraggingQueue, setIsDraggingQueue] = useState<boolean>(false);

  const [dossierWidth, setDossierWidth] = useState<number>(320);
  const [isDossierOpen, setIsDossierOpen] = useState<boolean>(true);
  const [isDraggingDossier, setIsDraggingDossier] = useState<boolean>(false);

  // Vertical Composer Height Resizing
  const [composerHeight, setComposerHeight] = useState<number>(85);
  const [isDraggingComposer, setIsDraggingComposer] = useState<boolean>(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const composerRef = useRef<HTMLElement>(null);

  const activeConv = conversations.find((c) => c.id === selectedConvId) || conversations[0];

  // Dragging logic for Queue resizer
  useEffect(() => {
    if (!isDraggingQueue) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current) return;
      const containerRect = containerRef.current.getBoundingClientRect();
      const newWidth = Math.max(200, Math.min(500, e.clientX - containerRect.left));
      setQueueWidth(newWidth);
    };

    const handleMouseUp = () => {
      setIsDraggingQueue(false);
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
  }, [isDraggingQueue]);

  // Dragging logic for Dossier resizer
  useEffect(() => {
    if (!isDraggingDossier) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current) return;
      const containerRect = containerRef.current.getBoundingClientRect();
      const newWidth = Math.max(240, Math.min(550, containerRect.right - e.clientX));
      setDossierWidth(newWidth);
    };

    const handleMouseUp = () => {
      setIsDraggingDossier(false);
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
  }, [isDraggingDossier]);

  // Dragging logic for Composer vertical resizer
  useEffect(() => {
    if (!isDraggingComposer) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!composerRef.current) return;
      const rect = composerRef.current.getBoundingClientRect();
      const newHeight = Math.max(65, Math.min(360, rect.bottom - e.clientY - 90));
      setComposerHeight(newHeight);
    };

    const handleMouseUp = () => {
      setIsDraggingComposer(false);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    document.body.style.cursor = 'row-resize';
    document.body.style.userSelect = 'none';
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isDraggingComposer]);

  // Filter conversations
  const filteredConversations = conversations.filter((c) => {
    const matchesSearch =
      c.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.customerCompany.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.lastMessageSnippet.toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;

    if (filterTab === 'mine') return true;
    if (filterTab === 'bot') return c.status === 'ai_active';
    if (filterTab === 'queue') return c.status === 'handoff';
    return true;
  });

  const handleSend = () => {
    if (!messageText.trim() || !activeConv) return;

    if (composerMode === 'internal') {
      onSendMessage(activeConv.id, {
        senderType: 'internal_note',
        senderName: 'Alex Rivera (Staff Agent)',
        content: messageText,
      });
    } else {
      onSendMessage(activeConv.id, {
        senderType: 'agent',
        senderName: 'Alex Rivera (Staff Agent)',
        senderAvatar:
          'https://lh3.googleusercontent.com/aida-public/AB6AXuD1-qn1cAT7mTay6n_TifAYhglMmbGsHViz0GRjVAPOCA6fSst4Nd_bqySEpKVWj125vgWZQUowOjx-51pdaBMMB1sKkKbRZLoNRnaBHEfvuYUUiKoT1E6KhQDmYUA0T0TXa7Icz4CnkIWnwMGuK48WG0GSOxypPNugzYG6XCL3iqeLcbbV-0qV5ZtsO5p95yp11TdZTQ7gHuXwjR3_k5Nd28ZfEmGM9GFSr_dJgAuj19uBwXoDFeuP',
        content: messageText,
      });
    }

    setMessageText('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleMacroInsert = (macro: string) => {
    let macroText = '';
    if (macro === '/mẫu-nda-fsi') {
      macroText = 'Kính gửi Quý Khối CNTT, chúng tôi xin gửi Mẫu Thoả thuận Bảo mật Tiêu chuẩn (GoTek Non-Disclosure Agreement for Financial Services). Quý anh/chị vui lòng kiểm tra và phản hồi bản ký số qua cổng bảo mật.';
    } else if (macro === '/báo-giá-enterprise-250') {
      macroText = 'Dự toán gói Enterprise Dedicated 250 Tổng đài viên: Hỗ trợ triển khai Kubernetes On-Premise, cam kết SLA 99.99%, tích hợp RAG không giới hạn token, đơn giá chiết khấu theo khung ngân hàng.';
    } else if (macro === '/dat-lich-demo-technical') {
      macroText = 'Chúng tôi đề xuất buổi hội thảo kỹ thuật (Deep-dive Architecture Session) 30 phút giữa Solution Architect GoTek và ban dự án trong tuần này.';
    }
    setMessageText((prev) => (prev ? `${prev}\n${macroText}` : macroText));
  };

  const handleAiRephrase = () => {
    if (!messageText.trim()) {
      setMessageText('Kính gửi anh Tuấn, GoTek đã tiếp nhận đề xuất bảo mật và sẵn sàng đồng hành cùng Techcombank trong dự án triển khai hệ thống AI Agent Contact Center.');
      return;
    }
    setMessageText(
      (prev) => `Kính gửi đối tác, GoTek cam kết đáp ứng trọn vẹn yêu cầu kỹ thuật: ${prev.trim()}`
    );
  };

  const showToast = (msg: string) => {
    setCopiedNotification(msg);
    setTimeout(() => setCopiedNotification(null), 3000);
  };

  const handleAddTag = () => {
    if (!newTagInput.trim() || !activeConv) return;
    const current = activeTags[activeConv.id] || activeConv.crmTags || [];
    setActiveTags({
      ...activeTags,
      [activeConv.id]: [...current, newTagInput.trim()],
    });
    setNewTagInput('');
    setShowAddTag(false);
  };

  const currentTags = activeTags[activeConv?.id] || activeConv?.crmTags || [];

  return (
    <div ref={containerRef} className="flex-1 flex overflow-hidden relative h-full select-text">
      {/* Toast Notification */}
      {copiedNotification && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 bg-[#131b2e] text-white text-xs px-4 py-2 rounded-lg shadow-lg flex items-center gap-2 animate-in fade-in slide-in-from-top-2">
          <span className="material-symbols-outlined text-[16px] text-emerald-400">check_circle</span>
          <span>{copiedNotification}</span>
        </div>
      )}

      {/* ================= COLUMN 1: CONVERSATION LIST (Resizable & Collapsible) ================= */}
      {isQueueOpen && (
        <section
          style={{ width: `${queueWidth}px` }}
          className="h-full flex flex-col bg-white border-r border-[#c7c4d8]/70 shrink-0 select-none overflow-hidden animate-in slide-in-from-left-4 duration-150"
        >
          {/* Search & Filters */}
          <div className="p-3 border-b border-[#c7c4d8]/60 space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-bold text-[#131b2e] uppercase tracking-wider">
                Hàng chờ hội thoại
              </span>
              <button
                onClick={() => {
                  setIsQueueOpen(false);
                  showToast('Đã thu gọn Hàng chờ');
                }}
                className="p-1 rounded text-[#777587] hover:text-[#131b2e] hover:bg-[#f2f3ff]"
                title="Thu gọn Hàng chờ"
                type="button"
              >
                <span className="material-symbols-outlined text-[16px]">chevron_left</span>
              </button>
            </div>

            <div className="relative">
              <span className="material-symbols-outlined absolute left-2.5 top-2 text-[#777587] text-base">
                search
              </span>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Filter conversations..."
                className="w-full pl-8 pr-7 py-1.5 bg-[#f2f3ff] border border-[#c7c4d8]/70 rounded text-xs text-[#131b2e] placeholder:text-[#777587] focus:outline-none focus:border-[#4f46e5]"
              />
              <button className="absolute right-2 top-2 text-[#777587] hover:text-[#131b2e]">
                <span className="material-symbols-outlined text-base">filter_list</span>
              </button>
            </div>

            {/* 3 Filter Tabs with Badges */}
            <div className="grid grid-cols-3 gap-1 bg-[#eaedff] p-1 rounded-lg">
              <button
                onClick={() => setFilterTab('mine')}
                className={`py-1 px-1.5 rounded text-center text-xs font-semibold flex items-center justify-center gap-1 transition-all ${
                  filterTab === 'mine'
                    ? 'bg-white text-[#3525cd] shadow-xs'
                    : 'text-[#464555] hover:text-[#131b2e]'
                }`}
              >
                <span>Mine</span>
                <span className="px-1.5 py-0.2 bg-[#4f46e5] text-white rounded-full text-[10px]">
                  4
                </span>
              </button>
              <button
                onClick={() => setFilterTab('bot')}
                className={`py-1 px-1.5 rounded text-center text-xs font-semibold flex items-center justify-center gap-1 transition-all ${
                  filterTab === 'bot'
                    ? 'bg-white text-[#3525cd] shadow-xs'
                    : 'text-[#464555] hover:text-[#131b2e]'
                }`}
              >
                <span>AI Bot</span>
                <span className="px-1.5 py-0.2 bg-[#e2e7ff] text-[#464555] rounded-full text-[10px]">
                  18
                </span>
              </button>
              <button
                onClick={() => setFilterTab('queue')}
                className={`py-1 px-1.5 rounded text-center text-xs font-semibold flex items-center justify-center gap-1 transition-all ${
                  filterTab === 'queue'
                    ? 'bg-white text-[#3525cd] shadow-xs'
                    : 'text-[#464555] hover:text-[#131b2e]'
                }`}
              >
                <span>Queue</span>
                <span className="px-1.5 py-0.2 bg-[#e2e7ff] text-[#464555] rounded-full text-[10px]">
                  3
                </span>
              </button>
            </div>
          </div>

          {/* Conversation Stream List */}
          <div className="flex-1 overflow-y-auto divide-y divide-[#c7c4d8]/40 custom-scrollbar">
            {filteredConversations.map((conv) => {
              const isSelected = conv.id === selectedConvId;
              return (
                <article
                  key={conv.id}
                  onClick={() => setSelectedConvId(conv.id)}
                  className={`p-3 relative cursor-pointer transition-colors duration-150 group ${
                    isSelected
                      ? 'bg-[#f2f3ff] border-l-4 border-l-[#4f46e5]'
                      : 'bg-white hover:bg-[#f2f3ff]/60'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2 mb-1.5">
                    <div className="flex items-center gap-2 overflow-hidden">
                      <img
                        src={conv.customerAvatar}
                        alt={conv.customerName}
                        referrerPolicy="no-referrer"
                        className="w-8 h-8 rounded-full object-cover shrink-0 border border-[#c7c4d8]"
                      />
                      <div className="truncate">
                        <p className="font-semibold text-xs text-[#131b2e] truncate">
                          {conv.customerName}
                        </p>
                        <p className="text-[11px] text-[#464555] truncate">
                          {conv.customerCompany}
                        </p>
                      </div>
                    </div>
                    <span className="text-[11px] text-[#777587] shrink-0 font-mono">
                      {conv.lastMessageTime}
                    </span>
                  </div>

                  {/* Preview text */}
                  <p className="text-xs text-[#464555] line-clamp-1 mb-2">
                    {conv.lastMessageSnippet}
                  </p>

                  {/* Badges & origin channel */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <span className="px-1.5 py-0.5 rounded bg-[#eaedff] text-[#464555] text-[10px] flex items-center gap-1">
                        <span className="material-symbols-outlined text-[12px]">
                          {conv.channel === 'Widget'
                            ? 'language'
                            : conv.channel === 'Slack App'
                            ? 'hub'
                            : conv.channel === 'Email'
                            ? 'mail'
                            : 'chat'}
                        </span>
                        <span>{conv.channel}</span>
                      </span>

                      {conv.status === 'handoff' && (
                        <span className="px-2 py-0.5 rounded-full bg-[#ffdad6] text-[#ba1a1a] text-[10px] font-bold flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#ba1a1a] animate-ping"></span>
                          <span>Handoff</span>
                        </span>
                      )}

                      {conv.status === 'ai_active' && (
                        <span className="px-2 py-0.5 rounded-full bg-[#eaedff] text-[#3525cd] text-[10px] font-semibold flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#3525cd]"></span>
                          <span>AI Active</span>
                        </span>
                      )}

                      {conv.status === 'in_review' && (
                        <span className="px-2 py-0.5 rounded-full bg-[#eaedff] text-[#464555] text-[10px]">
                          In Review
                        </span>
                      )}

                      {conv.status === 'resolved' && (
                        <span className="px-2 py-0.5 rounded-full bg-slate-100 text-[#777587] text-[10px]">
                          Resolved
                        </span>
                      )}
                    </div>

                    {/* SLA Tracker */}
                    {conv.slaCountdown && (
                      <div
                        className={`flex items-center gap-1 font-mono text-[10px] font-bold px-1.5 py-0.5 rounded ${
                          conv.slaUrgent
                            ? 'text-[#ba1a1a] bg-[#ffdad6]/60 animate-pulse'
                            : 'text-[#005338] bg-emerald-50'
                        }`}
                      >
                        <span className="material-symbols-outlined text-[12px]">timer</span>
                        <span>{conv.slaCountdown}</span>
                      </div>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      )}

      {/* ================= RESIZE HANDLE 1: BETWEEN QUEUE & CHAT ================= */}
      {isQueueOpen && (
        <div
          onMouseDown={() => setIsDraggingQueue(true)}
          className={`w-1.5 h-full cursor-col-resize hover:bg-[#4f46e5]/40 transition-colors z-20 flex items-center justify-center select-none group shrink-0 ${
            isDraggingQueue ? 'bg-[#4f46e5]' : 'bg-transparent'
          }`}
          title="Kéo sang trái / phải để chỉnh độ rộng hàng chờ"
        >
          <div className="w-0.5 h-8 rounded-full bg-[#c7c4d8] group-hover:bg-[#4f46e5] group-hover:scale-y-125 transition-all"></div>
        </div>
      )}

      {/* Docked mini-toggle when Queue is collapsed */}
      {!isQueueOpen && (
        <button
          onClick={() => {
            setIsQueueOpen(true);
            showToast('Đã mở lại Hàng chờ (Queue)');
          }}
          className="bg-white hover:bg-[#eaedff] text-[#3525cd] border border-l-0 border-[#c7c4d8] py-3 px-1.5 rounded-r-lg shadow-sm z-20 flex flex-col items-center gap-1 transition-all group shrink-0 self-center"
          title="Mở Hàng chờ (Queue)"
          type="button"
        >
          <span className="material-symbols-outlined text-[18px] group-hover:scale-110 transition-transform">
            chevron_right
          </span>
          <span className="[writing-mode:vertical-rl] text-[10px] font-bold tracking-wider uppercase text-[#464555] group-hover:text-[#3525cd]">
            Queue
          </span>
        </button>
      )}

      {/* ================= COLUMN 2: COMMUNICATION HUB (Fluid flex-1) ================= */}
      <main className="flex-1 h-full flex flex-col bg-[#faf8ff] relative overflow-hidden min-w-[320px]">
        {/* Thread Header Bar */}
        <section className="h-14 px-4 sm:px-6 bg-white border-b border-[#c7c4d8]/70 flex items-center justify-between shrink-0 shadow-xs z-10">
          <div className="flex items-center gap-3 min-w-0">
            <img
              src={activeConv.customerAvatar}
              alt={activeConv.customerName}
              referrerPolicy="no-referrer"
              className="w-9 h-9 rounded-full object-cover border border-[#c7c4d8] shrink-0"
            />
            <div className="min-w-0 truncate">
              <div className="flex items-center gap-2">
                <h2 className="font-bold text-sm text-[#131b2e] truncate">
                  {activeConv.customerName}
                </h2>
                <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-bold border border-amber-300 shrink-0">
                  {activeConv.clientTier}
                </span>
              </div>
              <div className="flex items-center gap-2 text-[#464555] text-xs truncate">
                <span>{activeConv.customerCompany}</span>
                <span className="text-[#c7c4d8]">•</span>
                <a
                  href={activeConv.websiteUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[#3525cd] hover:underline flex items-center gap-0.5 text-[11px] truncate"
                >
                  {activeConv.websiteUrl.replace('https://', '')}
                  <span className="material-symbols-outlined text-[11px]">open_in_new</span>
                </a>
                <span className="text-[#c7c4d8]">•</span>
                <span className="text-[#ba1a1a] font-semibold flex items-center gap-1 text-[11px] shrink-0">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#ba1a1a]"></span>
                  AI Triaged: Escalation Requested
                </span>
              </div>
            </div>
          </div>

          {/* Action Buttons & Column Visibility Toggles */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Toggle Queue Button */}
            <button
              onClick={() => {
                const nextState = !isQueueOpen;
                setIsQueueOpen(nextState);
                showToast(nextState ? 'Đã hiện Hàng chờ (Queue)' : 'Đã ẩn Hàng chờ (Queue)');
              }}
              className={`px-2 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 border transition-all ${
                !isQueueOpen
                  ? 'bg-[#eaedff] text-[#3525cd] border-[#3525cd]/40'
                  : 'bg-white text-[#464555] border-[#c7c4d8] hover:text-[#131b2e] hover:bg-[#f2f3ff]'
              }`}
              title={isQueueOpen ? 'Ẩn Hàng chờ (Queue)' : 'Hiện Hàng chờ (Queue)'}
              type="button"
            >
              <span className="material-symbols-outlined text-[16px]">
                {isQueueOpen ? 'view_sidebar' : 'menu_open'}
              </span>
              <span className="hidden xl:inline">{isQueueOpen ? 'Hide Queue' : 'Queue'}</span>
            </button>

            {/* Takeover Button */}
            <button
              onClick={() => onTakeover(activeConv.id)}
              className="hidden sm:flex px-3 py-1.5 rounded-lg bg-[#4f46e5] hover:bg-[#4338ca] text-white text-xs font-semibold items-center gap-1.5 shadow-sm transition-all duration-150 active:scale-[0.98]"
              type="button"
            >
              <span className="material-symbols-outlined text-base">pan_tool</span>
              <span>Takeover</span>
            </button>

            {/* Resolve Button */}
            <button
              onClick={() => onResolve(activeConv.id)}
              className="px-3 py-1.5 rounded-lg bg-white hover:bg-[#f2f3ff] text-[#131b2e] border border-[#c7c4d8] text-xs font-medium flex items-center gap-1.5 transition-colors"
              type="button"
            >
              <span className="material-symbols-outlined text-base text-emerald-700">check_circle</span>
              <span>Resolve</span>
            </button>

            {/* TOGGLE DOSSIER BUTTON */}
            <button
              onClick={() => {
                const nextState = !isDossierOpen;
                setIsDossierOpen(nextState);
                showToast(nextState ? 'Đã hiện Client & Session Dossier' : 'Đã ẩn Client & Session Dossier');
              }}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 border transition-all ${
                isDossierOpen
                  ? 'bg-[#eaedff] text-[#3525cd] border-[#3525cd]/40'
                  : 'bg-white text-[#464555] border-[#c7c4d8] hover:text-[#131b2e] hover:bg-[#f2f3ff]'
              }`}
              title={isDossierOpen ? 'Ẩn Client & Session Dossier' : 'Hiện Client & Session Dossier'}
              type="button"
            >
              <span className="material-symbols-outlined text-[17px]">
                {isDossierOpen ? 'dock_to_right' : 'badge'}
              </span>
              <span className="hidden md:inline">
                {isDossierOpen ? 'Hide Dossier' : 'Client Dossier'}
              </span>
            </button>
          </div>
        </section>

        {/* Scrollable Message Interaction Stream */}
        <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 space-y-4 custom-scrollbar">
          {/* Day Timestamp Separator */}
          <div className="flex items-center justify-center my-2">
            <div className="px-3 py-1 rounded-full bg-[#eaedff] border border-[#c7c4d8]/60 text-[11px] font-semibold text-[#777587] uppercase tracking-wider font-mono">
              Today, March 30 • Session #TK-88412
            </div>
          </div>

          {activeConv.messages.map((msg) => {
            // Internal Note
            if (msg.senderType === 'internal_note') {
              return (
                <div
                  key={msg.id}
                  className="w-full my-3 p-3.5 rounded-xl bg-amber-50 border border-amber-300 text-amber-950 shadow-xs relative"
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-amber-700 text-base">
                        lock
                      </span>
                      <span className="px-2 py-0.5 rounded bg-amber-200 text-amber-900 text-[10px] font-bold tracking-wide">
                        Internal Note - Chỉ nhân viên thấy
                      </span>
                      <span className="text-[11px] text-amber-800">By {msg.senderName}</span>
                    </div>
                    <span className="text-[11px] text-amber-700 font-mono">{msg.timestamp}</span>
                  </div>
                  <p className="text-xs text-amber-900 pl-6 leading-relaxed whitespace-pre-wrap">
                    {msg.content}
                  </p>
                </div>
              );
            }

            // Customer Message (Left-aligned)
            if (msg.senderType === 'customer') {
              return (
                <div key={msg.id} className="flex items-start gap-3 max-w-2xl">
                  {msg.senderAvatar ? (
                    <img
                      src={msg.senderAvatar}
                      alt={msg.senderName}
                      referrerPolicy="no-referrer"
                      className="w-8 h-8 rounded-full object-cover shrink-0 border border-[#c7c4d8] mt-0.5"
                    />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-xs font-bold text-slate-700 mt-0.5">
                      {msg.senderName[0]}
                    </div>
                  )}
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-xs text-[#131b2e]">{msg.senderName}</span>
                      <span className="text-[11px] text-[#777587] font-mono">{msg.timestamp}</span>
                    </div>
                    <div className="p-3.5 rounded-xl bg-white border border-[#c7c4d8]/70 text-[#131b2e] shadow-xs text-xs leading-relaxed">
                      {msg.content}
                    </div>
                  </div>
                </div>
              );
            }

            // Grounded AI Response
            if (msg.senderType === 'ai') {
              return (
                <div key={msg.id} className="flex items-start gap-3 max-w-2xl ml-6">
                  <div className="w-8 h-8 rounded-full bg-[#4f46e5] text-white flex items-center justify-center shrink-0 mt-0.5 shadow-sm">
                    <span className="material-symbols-outlined text-base">smart_toy</span>
                  </div>
                  <div className="space-y-1 flex-1">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-xs text-[#3525cd]">{msg.senderName}</span>
                        <span className="px-1.5 py-0.2 bg-[#eaedff] text-[#3525cd] rounded text-[10px] font-bold">
                          Grounded AI
                        </span>
                        <span className="text-[11px] text-[#777587] font-mono">{msg.timestamp}</span>
                      </div>
                      <button
                        onClick={() => showToast('AI Grounding telemetry verified with 1536d vector match')}
                        className="text-[11px] text-[#777587] hover:text-[#3525cd] transition-colors flex items-center gap-0.5"
                        type="button"
                      >
                        <span className="material-symbols-outlined text-[13px]">verified</span>
                        <span>Grounding Check</span>
                      </button>
                    </div>

                    <div className="p-4 rounded-xl bg-white border border-indigo-200 shadow-sm space-y-3 text-xs text-[#131b2e]">
                      <div className="leading-relaxed whitespace-pre-wrap">{msg.content}</div>

                      {/* Verified Citation Chips */}
                      {msg.citations && msg.citations.length > 0 && (
                        <div className="pt-2 border-t border-[#c7c4d8]/40">
                          <p className="text-[10px] font-semibold text-[#777587] mb-1.5 flex items-center gap-1">
                            <span className="material-symbols-outlined text-[12px] text-[#3525cd]">
                              verified
                            </span>
                            <span>Verified Knowledge Sources ({msg.citations.length})</span>
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {msg.citations.map((cite, i) => (
                              <button
                                key={i}
                                onClick={() => showToast(`Opened Citation: ${cite.title}`)}
                                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#eaedff] text-[#3525cd] hover:bg-[#e2e7ff] border border-[#c7c4d8]/70 text-[11px] font-medium transition-colors"
                                type="button"
                              >
                                <span className="material-symbols-outlined text-[13px]">description</span>
                                <span>{cite.title}</span>
                                {cite.pageOrSection && (
                                  <span className="text-[#777587]">{cite.pageOrSection}</span>
                                )}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            }

            // Human Staff Agent Response (Right-aligned, Indigo)
            if (msg.senderType === 'agent') {
              return (
                <div key={msg.id} className="flex items-start justify-end gap-3 max-w-2xl ml-auto">
                  <div className="space-y-1 text-right flex-1">
                    <div className="flex items-center justify-end gap-2">
                      <span className="text-[11px] text-[#777587] font-mono">{msg.timestamp}</span>
                      <span className="font-bold text-xs text-[#3525cd]">{msg.senderName}</span>
                    </div>
                    <div className="p-3.5 rounded-xl bg-[#4f46e5] text-white shadow-xs text-xs text-left leading-relaxed">
                      {msg.content}
                    </div>
                  </div>
                  {msg.senderAvatar ? (
                    <img
                      src={msg.senderAvatar}
                      alt={msg.senderName}
                      referrerPolicy="no-referrer"
                      className="w-8 h-8 rounded-full object-cover shrink-0 border border-[#4f46e5] mt-0.5"
                    />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-[#3525cd] text-white flex items-center justify-center text-xs font-bold mt-0.5">
                      AR
                    </div>
                  )}
                </div>
              );
            }

            return null;
          })}
        </div>

        {/* ================= COMPOSER SECTION (Vertically Resizable) ================= */}
        <footer
          ref={composerRef}
          className="bg-white border-t border-[#c7c4d8]/70 shrink-0 relative flex flex-col shadow-xs"
        >
          {/* Vertical Resize Drag Handle */}
          <div
            onMouseDown={() => setIsDraggingComposer(true)}
            className={`w-full h-2 cursor-row-resize hover:bg-[#4f46e5]/30 transition-colors flex items-center justify-center group select-none ${
              isDraggingComposer ? 'bg-[#4f46e5]/40' : 'bg-transparent'
            }`}
            title="Kéo lên / xuống để chỉnh độ cao khung nhập tin nhắn"
          >
            <div className="w-12 h-1 rounded-full bg-[#c7c4d8] group-hover:bg-[#4f46e5] group-hover:w-16 transition-all"></div>
          </div>

          <div className="p-3 sm:p-4 pt-1">
            <div
              className={`border rounded-xl overflow-hidden shadow-xs transition-all ${
                composerMode === 'internal'
                  ? 'border-amber-400 bg-amber-50/40'
                  : 'border-[#c7c4d8] bg-white focus-within:border-[#4f46e5] focus-within:ring-1 focus-within:ring-[#4f46e5]'
              }`}
            >
              {/* Mode Toggle Bar: Public Reply vs Internal Note */}
              <div className="flex items-center justify-between px-3 py-1.5 bg-[#f2f3ff] border-b border-[#c7c4d8]/60">
                <div className="flex items-center gap-1 bg-[#eaedff] p-0.5 rounded-lg">
                  <button
                    onClick={() => setComposerMode('public')}
                    className={`px-3 py-1 rounded text-xs font-semibold flex items-center gap-1.5 transition-all ${
                      composerMode === 'public'
                        ? 'bg-white text-[#3525cd] shadow-xs'
                        : 'text-[#464555] hover:text-[#131b2e]'
                    }`}
                    type="button"
                  >
                    <span className="material-symbols-outlined text-[13px]">reply</span>
                    <span>Public Reply</span>
                  </button>
                  <button
                    onClick={() => setComposerMode('internal')}
                    className={`px-3 py-1 rounded text-xs font-semibold flex items-center gap-1.5 transition-all ${
                      composerMode === 'internal'
                        ? 'bg-amber-200 text-amber-900 shadow-xs'
                        : 'text-[#464555] hover:text-[#131b2e]'
                    }`}
                    type="button"
                  >
                    <span className="material-symbols-outlined text-[13px]">lock</span>
                    <span>Internal Note</span>
                  </button>
                </div>

                <span className="text-[10px] font-mono text-[#777587] hidden sm:inline">
                  Channel: {activeConv.customerCompany} ({activeConv.channel} Encrypted)
                </span>
              </div>

              {/* Quick Canned Responses / Macros */}
              <div className="px-3 py-1.5 bg-white flex items-center gap-2 border-b border-[#c7c4d8]/40 overflow-x-auto text-xs custom-scrollbar">
                <span className="text-[#777587] font-semibold text-[11px] shrink-0 flex items-center gap-1">
                  <span className="material-symbols-outlined text-xs">bolt</span>
                  <span>Macros:</span>
                </span>
                <button
                  onClick={() => handleMacroInsert('/mẫu-nda-fsi')}
                  className="px-2 py-0.5 rounded bg-[#eaedff] hover:bg-[#e2e7ff] text-[#3525cd] font-mono text-[11px] transition-colors whitespace-nowrap"
                  type="button"
                >
                  /mẫu-nda-fsi
                </button>
                <button
                  onClick={() => handleMacroInsert('/báo-giá-enterprise-250')}
                  className="px-2 py-0.5 rounded bg-[#eaedff] hover:bg-[#e2e7ff] text-[#3525cd] font-mono text-[11px] transition-colors whitespace-nowrap"
                  type="button"
                >
                  /báo-giá-enterprise-250
                </button>
                <button
                  onClick={() => handleMacroInsert('/dat-lich-demo-technical')}
                  className="px-2 py-0.5 rounded bg-[#eaedff] hover:bg-[#e2e7ff] text-[#464555] font-mono text-[11px] transition-colors whitespace-nowrap"
                  type="button"
                >
                  /dat-lich-demo-technical
                </button>
              </div>

              {/* Dynamic Resizable Textarea */}
              <div className={`p-2.5 ${composerMode === 'internal' ? 'bg-amber-50/60' : 'bg-white'}`}>
                <textarea
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  onKeyDown={handleKeyDown}
                  style={{ height: `${composerHeight}px` }}
                  placeholder={
                    composerMode === 'internal'
                      ? "Ghi chú nội bộ cho Alex Rivera và team (Khách hàng KHÔNG nhìn thấy nội dung này)..."
                      : `Nhập câu trả lời cho anh ${activeConv.customerName}... (Gõ '/' để chèn macro hoặc '@' để tag đồng đội)`
                  }
                  className="w-full bg-transparent border-0 text-xs text-[#131b2e] placeholder:text-[#777587] resize-none focus:outline-none transition-all"
                />
              </div>

              {/* Formatting & Action Tool Bar */}
              <div className="px-3 py-2 bg-[#f2f3ff] flex items-center justify-between border-t border-[#c7c4d8]/40">
                <div className="flex items-center gap-1 text-[#464555]">
                  <button
                    onClick={() => setMessageText((p) => `**${p}**`)}
                    className="p-1 hover:bg-[#eaedff] hover:text-[#131b2e] rounded"
                    title="Bold"
                    type="button"
                  >
                    <span className="material-symbols-outlined text-base">format_bold</span>
                  </button>
                  <button
                    onClick={() => setMessageText((p) => `_${p}_`)}
                    className="p-1 hover:bg-[#eaedff] hover:text-[#131b2e] rounded"
                    title="Italic"
                    type="button"
                  >
                    <span className="material-symbols-outlined text-base">format_italic</span>
                  </button>
                  <button
                    onClick={() => showToast('Knowledge Base Selector open')}
                    className="p-1 hover:bg-[#eaedff] hover:text-[#131b2e] rounded"
                    title="Insert Knowledge Article"
                    type="button"
                  >
                    <span className="material-symbols-outlined text-base">library_books</span>
                  </button>
                  <button
                    onClick={() => showToast('Document Attachment ready')}
                    className="p-1 hover:bg-[#eaedff] hover:text-[#131b2e] rounded"
                    title="Attach Document"
                    type="button"
                  >
                    <span className="material-symbols-outlined text-base">attach_file</span>
                  </button>
                  <button
                    onClick={handleAiRephrase}
                    className="px-2 py-0.5 bg-[#4f46e5]/10 text-[#4f46e5] hover:bg-[#4f46e5]/20 rounded text-[11px] font-semibold flex items-center gap-1"
                    title="AI Tone Polish"
                    type="button"
                  >
                    <span className="material-symbols-outlined text-[13px]">auto_awesome</span>
                    <span>AI Rephrase</span>
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <span className="font-mono text-[10px] text-[#777587] hidden sm:inline">
                    Press ↵ Enter to send
                  </span>
                  <button
                    onClick={handleSend}
                    disabled={!messageText.trim()}
                    className={`px-4 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-all active:scale-[0.98] ${
                      composerMode === 'internal'
                        ? 'bg-amber-600 hover:bg-amber-700 text-white'
                        : 'bg-[#3525cd] hover:bg-[#4f46e5] text-white disabled:opacity-40'
                    }`}
                    type="button"
                  >
                    <span>{composerMode === 'internal' ? 'Save Note' : 'Send'}</span>
                    <span className="material-symbols-outlined text-sm">
                      {composerMode === 'internal' ? 'lock' : 'send'}
                    </span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </footer>
      </main>

      {/* ================= RESIZE HANDLE 2: BETWEEN CHAT & DOSSIER ================= */}
      {isDossierOpen && (
        <div
          onMouseDown={() => setIsDraggingDossier(true)}
          className={`w-1.5 h-full cursor-col-resize hover:bg-[#4f46e5]/40 transition-colors z-20 flex items-center justify-center select-none group shrink-0 ${
            isDraggingDossier ? 'bg-[#4f46e5]' : 'bg-transparent'
          }`}
          title="Kéo sang trái / phải để thay đổi độ rộng Client Dossier"
        >
          <div className="w-0.5 h-8 rounded-full bg-[#c7c4d8] group-hover:bg-[#4f46e5] group-hover:scale-y-125 transition-all"></div>
        </div>
      )}

      {/* ================= COLUMN 3: CUSTOMER & SESSION DOSSIER PANEL (Collapsible & Resizable) ================= */}
      {isDossierOpen && (
        <aside
          style={{ width: `${dossierWidth}px` }}
          className="h-full flex flex-col bg-white border-l border-[#c7c4d8]/70 shrink-0 select-none overflow-y-auto animate-in slide-in-from-right-4 duration-150 custom-scrollbar"
        >
          {/* Panel Header */}
          <div className="p-3 border-b border-[#c7c4d8]/60 flex items-center justify-between bg-white sticky top-0 z-10">
            <div className="flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[#3525cd] text-[18px]">badge</span>
              <h3 className="font-bold text-xs text-[#131b2e]">Client & Session Dossier</h3>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => showToast(`Chiều rộng hiện tại: ${dossierWidth}px`)}
                className="p-1 rounded text-[#777587] hover:text-[#131b2e] hover:bg-[#f2f3ff]"
                title="Thông tin chiều rộng"
                type="button"
              >
                <span className="material-symbols-outlined text-base">info</span>
              </button>
              {/* Close / Hide Button */}
              <button
                onClick={() => {
                  setIsDossierOpen(false);
                  showToast('Đã ẩn Client & Session Dossier');
                }}
                className="p-1 rounded text-[#777587] hover:text-[#ba1a1a] hover:bg-red-50 transition-colors"
                title="Đóng / Ẩn Dossier"
                type="button"
              >
                <span className="material-symbols-outlined text-base">close</span>
              </button>
            </div>
          </div>

          <div className="p-4 space-y-5 text-xs overflow-x-hidden">
            {/* Section 1: Customer Profile Overview */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-bold text-[#777587] uppercase tracking-wider">
                  Profile Information
                </span>
                <span className="material-symbols-outlined text-xs text-[#777587]">badge</span>
              </div>
              <div className="space-y-2 bg-[#f2f3ff] p-3 rounded-lg border border-[#c7c4d8]/60">
                <div className="flex justify-between items-start">
                  <span className="text-[#777587]">Full Name:</span>
                  <span className="font-semibold text-[#131b2e]">{activeConv.customerName}</span>
                </div>
                <div className="flex justify-between items-start">
                  <span className="text-[#777587]">Email:</span>
                  <a
                    href={`mailto:${activeConv.customerEmail}`}
                    className="text-[#3525cd] hover:underline font-mono text-[11px] truncate max-w-[150px]"
                  >
                    {activeConv.customerEmail}
                  </a>
                </div>
                <div className="flex justify-between items-start">
                  <span className="text-[#777587]">Phone:</span>
                  <span className="font-mono text-[#131b2e] text-[11px]">{activeConv.customerPhone}</span>
                </div>
                <div className="flex justify-between items-start">
                  <span className="text-[#777587]">Organization:</span>
                  <span className="font-medium text-[#131b2e]">{activeConv.customerCompany}</span>
                </div>
                <div className="flex justify-between items-start">
                  <span className="text-[#777587]">Location:</span>
                  <span className="text-[#131b2e] flex items-center gap-1">
                    <span className="material-symbols-outlined text-xs text-[#777587]">location_on</span>
                    {activeConv.customerLocation}
                  </span>
                </div>
              </div>
            </div>

            {/* Section 2: Current Session Telemetry */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-bold text-[#777587] uppercase tracking-wider">
                  Live Session Telemetry
                </span>
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              </div>
              <div className="space-y-2 border border-[#c7c4d8]/60 rounded-lg p-3 bg-white">
                <div>
                  <p className="text-[10px] text-[#777587] mb-0.5">Active Viewing URL:</p>
                  <div className="p-1.5 bg-[#eaedff] rounded font-mono text-[11px] text-[#3525cd] truncate flex items-center gap-1">
                    <span className="material-symbols-outlined text-xs">link</span>
                    <span className="truncate">{activeConv.activeUrl}</span>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <div className="p-2 bg-[#f2f3ff] rounded">
                    <p className="text-[10px] text-[#777587]">Session Duration</p>
                    <p className="font-mono text-xs font-semibold text-[#131b2e]">
                      {activeConv.sessionDuration}
                    </p>
                  </div>
                  <div className="p-2 bg-[#f2f3ff] rounded">
                    <p className="text-[10px] text-[#777587]">IP / Device</p>
                    <p className="font-mono text-xs text-[#131b2e] truncate">
                      {activeConv.deviceInfo}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Section 3: AI RAG Context & Citations */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-bold text-[#777587] uppercase tracking-wider">
                  RAG Retrieval Score
                </span>
                <span className="font-mono text-[11px] text-[#3525cd] font-bold">
                  {activeConv.ragMatchScore} Match
                </span>
              </div>
              <div className="space-y-2">
                {activeConv.ragCitations.map((cite, idx) => (
                  <div
                    key={idx}
                    className="p-2.5 rounded-lg border border-[#c7c4d8]/60 bg-[#f2f3ff] text-xs space-y-1"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-[#131b2e] truncate flex items-center gap-1">
                        <span className="material-symbols-outlined text-xs text-emerald-600">
                          task_alt
                        </span>
                        <span className="truncate">{cite.title}</span>
                      </span>
                      <span className="font-mono text-[10px] text-emerald-700 font-bold shrink-0">
                        {cite.similarity}
                      </span>
                    </div>
                    <p className="text-[#777587] text-[11px] line-clamp-2">
                      {cite.excerpt}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Section 4: CRM Taxonomy & Tags */}
            <div>
              <span className="text-[10px] font-bold text-[#777587] uppercase tracking-wider block mb-2">
                CRM Taxonomy & Tags
              </span>
              <div className="flex flex-wrap gap-1.5 mb-3">
                {currentTags.map((tag, i) => (
                  <span
                    key={i}
                    className="px-2 py-0.5 rounded-md bg-purple-100 text-purple-800 text-[11px] font-semibold border border-purple-200"
                  >
                    {tag}
                  </span>
                ))}

                {showAddTag ? (
                  <div className="flex items-center gap-1">
                    <input
                      type="text"
                      value={newTagInput}
                      onChange={(e) => setNewTagInput(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleAddTag()}
                      placeholder="Tag..."
                      className="px-1.5 py-0.5 text-[11px] border border-[#c7c4d8] rounded w-20 bg-white"
                      autoFocus
                    />
                    <button
                      onClick={handleAddTag}
                      className="text-xs bg-[#4f46e5] text-white px-1.5 py-0.5 rounded"
                    >
                      ✓
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setShowAddTag(true)}
                    className="px-2 py-0.5 rounded-md bg-[#eaedff] text-[#464555] hover:text-[#131b2e] text-[11px]"
                  >
                    + Thêm tag
                  </button>
                )}
              </div>

              {/* Quick Action Buttons: Sync CRM & Create Ticket */}
              <div className="space-y-2 pt-2 border-t border-[#c7c4d8]/40">
                <button
                  onClick={() => showToast('Synced customer record and RAG transcript to HubSpot CRM!')}
                  className="w-full py-2 px-3 rounded-lg bg-[#eaedff] hover:bg-[#e2e7ff] text-[#131b2e] font-semibold text-xs border border-[#c7c4d8]/70 flex items-center justify-center gap-2 transition-colors"
                  type="button"
                >
                  <span className="material-symbols-outlined text-base text-[#3525cd]">sync</span>
                  <span>Sync to HubSpot CRM</span>
                </button>
                <button
                  onClick={() => showToast('Issue #TK-88412 created on Jira Enterprise Board')}
                  className="w-full py-2 px-3 rounded-lg bg-[#eaedff] hover:bg-[#e2e7ff] text-[#131b2e] font-semibold text-xs border border-[#c7c4d8]/70 flex items-center justify-center gap-2 transition-colors"
                  type="button"
                >
                  <span className="material-symbols-outlined text-base text-[#6b38d4]">
                    confirmation_number
                  </span>
                  <span>Create Jira / Linear Ticket</span>
                </button>
              </div>
            </div>
          </div>
        </aside>
      )}

      {/* Docked mini-toggle when Dossier is hidden */}
      {!isDossierOpen && (
        <button
          onClick={() => {
            setIsDossierOpen(true);
            showToast('Đã mở lại Client & Session Dossier');
          }}
          className="bg-white hover:bg-[#eaedff] text-[#3525cd] border border-r-0 border-[#c7c4d8] py-3 px-1.5 rounded-l-lg shadow-sm z-20 flex flex-col items-center gap-1 transition-all group shrink-0 self-center"
          title="Mở Client & Session Dossier"
          type="button"
        >
          <span className="material-symbols-outlined text-[18px] group-hover:scale-110 transition-transform">
            chevron_left
          </span>
          <span className="[writing-mode:vertical-rl] text-[10px] font-bold tracking-wider uppercase text-[#464555] group-hover:text-[#3525cd]">
            Dossier
          </span>
        </button>
      )}
    </div>
  );
};
