import {SendAttempts} from './send-attempts';
import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import confetti from 'canvas-confetti';
import { Conversation, ChatMessage } from '../../types';
import { useRealtimeChat } from '../../hooks/useRealtimeChat';
import { api } from '../../api/api';

interface InboxViewProps {
  conversations: Conversation[];
  sources?: Array<{connectionId:string;platform:string;accountName:string;externalAccountId?:string}>;
  onSourceFilterChange?: (platforms:string[],connectionIds:string[])=>void;
  selectedConvId: string;
  setSelectedConvId: (id: string) => void;
  onSendMessage: (convId: string, message: Omit<ChatMessage, 'id' | 'timestamp'>, sentViaWs?: boolean) => Promise<boolean>;
  onTakeover: (convId: string) => void;
  onResolve: (convId: string) => void;
  onResumeAi?: (convId: string) => void;
  onIncomingMessage?: (convId: string, message: ChatMessage) => void;
}

function playNotificationChime() {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(587.33, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.15);
    gain.gain.setValueAtTime(0.08, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.3);
  } catch {}
}

export const InboxView: React.FC<InboxViewProps> = ({
  conversations,
  sources = [],
  onSourceFilterChange,
  selectedConvId,
  setSelectedConvId,
  onSendMessage,
  onTakeover,
  onResolve,
  onResumeAi,
  onIncomingMessage,
}) => {
  // Filter tabs: all, queue (cần handoff), bot (AI đang phục vụ), mine (đã gán)
  const [filterTab, setFilterTab] = useState<'all' | 'queue' | 'bot' | 'mine'>('all');
  const [sourcePlatforms,setSourcePlatforms]=useState<string[]>([]);
  const [sourceConnections,setSourceConnections]=useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [composerMode, setComposerMode] = useState<'public' | 'internal'>('public');
  const [messageText, setMessageText] = useState('');
  const [mediaUrl, setMediaUrl] = useState('');
  const [mediaType, setMediaType] = useState<'image'|'video'|'audio'|'file'>('image');
  const [showMedia, setShowMedia] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [newTagInput, setNewTagInput] = useState('');
  const [showAddTag, setShowAddTag] = useState(false);
  const [expandedCitations, setExpandedCitations] = useState<Record<string, boolean>>({});
  const [hoveredMessageId, setHoveredMessageId] = useState<string | null>(null);
  const [messageReactions, setMessageReactions] = useState<Record<string, string[]>>({});
  const [isAiThinking, setIsAiThinking] = useState(false);

  const [activeTags, setActiveTags] = useState<Record<string, string[]>>({
    'conv-1': ['Enterprise Deal', '🔥 Lead Hot', 'Yêu cầu NDA'],
  });

  const [readConvIds, setReadConvIds] = useState<Set<string>>(new Set(selectedConvId ? [selectedConvId] : []));

  useEffect(() => {
    if (selectedConvId) {
      setReadConvIds((prev) => new Set([...prev, selectedConvId]));
    }
  }, [selectedConvId]);

  // Resizable and Collapsible Columns State
  const [queueWidth, setQueueWidth] = useState<number>(320);
  const [isQueueOpen, setIsQueueOpen] = useState<boolean>(true);
  const [isDraggingQueue, setIsDraggingQueue] = useState<boolean>(false);

  const [dossierWidth, setDossierWidth] = useState<number>(310);
  const [isDossierOpen, setIsDossierOpen] = useState<boolean>(true);
  const [isDraggingDossier, setIsDraggingDossier] = useState<boolean>(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const typingDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Enter can fire repeatedly before the async provider/API round trip returns.
  // Keep a synchronous lock so one composer action creates one client id.
  const sendingRef = useRef(false);
  const attemptsRef = useRef(new SendAttempts());
  const [isSending, setIsSending] = useState(false);

  const activeConv = conversations.find((c) => c.id === selectedConvId) || conversations[0];
  const isStaffActive = Boolean(
    activeConv && (
      activeConv.status === 'in_review' ||
      (activeConv.status as string) === 'open' ||
      activeConv.reply_owner === 'HUMAN_ACTIVE' ||
      activeConv.replyOwner === 'HUMAN_ACTIVE'
    ) && activeConv.status !== 'ai_active'
  );

  // When active conversation is in AI mode, staff can ONLY add internal notes
  useEffect(() => {
    if (!isStaffActive) {
      setComposerMode('internal');
    } else {
      setComposerMode('public');
    }
  }, [activeConv?.id, isStaffActive]);

  // UC-032: Restore draft for current conversation
  useEffect(() => {
    if (!activeConv?.id) {
      setMessageText('');
      return;
    }
    const savedDraft = localStorage.getItem(`gotek_draft_${activeConv.id}`);
    setMessageText(savedDraft || '');
  }, [activeConv?.id]);

  const handleMessageChange = (val: string) => {
    setMessageText(val);
    if (activeConv?.id) {
      if (val.trim()) {
        localStorage.setItem(`gotek_draft_${activeConv.id}`, val);
      } else {
        localStorage.removeItem(`gotek_draft_${activeConv.id}`);
      }
    }
    // Auto-resize textarea
    const ta = textareaRef.current;
    if (ta) {
      ta.style.height = 'auto';
      ta.style.height = Math.min(ta.scrollHeight, 160) + 'px';
    }
    // Debounce typing indicator (300ms) to avoid blocking Vietnamese IME input
    if (isStaffActive) {
      if (typingDebounceRef.current) clearTimeout(typingDebounceRef.current);
      typingDebounceRef.current = setTimeout(() => {
        sendTypingStatus(Boolean(val.trim()));
      }, 300);
    }
  };

  // =========================================================================
  // REALTIME CHAT HOOK (Full-Duplex WebSocket with SSE Fallback)
  // =========================================================================
  const { isConnected, transportType, typingState, sendMessageOverSocket, sendTypingStatus } = useRealtimeChat({
    conversationId: activeConv?.id,
    onNewMessage: (newMsg) => {
      if (activeConv) {
        if (newMsg.senderType === 'customer') {
          playNotificationChime();
        }
        onIncomingMessage?.(activeConv.id, newMsg);
        showToast(`Tin nhắn mới từ ${newMsg.senderName}`);
      }
    },
    onTakeover: (data) => {
      showToast('Đã ghi nhận tiếp quản ca thời gian thực');
      if (activeConv) {
        activeConv.status = 'in_review';
        activeConv.assignedTo = data.assignedTo;
      }
    },
    onStatusChange: (data) => {
      showToast(`Hội thoại đã chuyển trạng thái: ${data.status}`);
      if (activeConv) {
        activeConv.status = data.status as any;
      }
    },
  });

  // Auto-scroll to latest message when conversation or messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeConv?.id, activeConv?.messages?.length]);

  // Subtle Resizer Dragging: Queue
  useEffect(() => {
    if (!isDraggingQueue) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const newWidth = Math.max(260, Math.min(460, e.clientX - rect.left));
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

  // Subtle Resizer Dragging: Dossier
  useEffect(() => {
    if (!isDraggingDossier) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const newWidth = Math.max(260, Math.min(460, rect.right - e.clientX));
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

  // Filter conversations
  const filteredConversations = conversations.filter((c) => {
    const matchesSearch =
      c.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.customerCompany.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.lastMessageSnippet.toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;

    if (filterTab === 'queue') return c.status === 'handoff';
    if (filterTab === 'bot') return c.status === 'ai_active';
    if (filterTab === 'mine') return c.status === 'in_review' || c.status === 'resolved';
    return true;
  });

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2500);
  };

  const copyToClipboard = async (text: string, label = 'văn bản') => {
    try {
      await navigator.clipboard.writeText(text);
      showToast(`Đã sao chép ${label}`);
    } catch {
      showToast(`Không thể sao chép`);
    }
  };

  // Celebration Fireworks on Resolve
  const handleResolveWithConfetti = () => {
    if (!activeConv) return;
    confetti({
      particleCount: 80,
      spread: 60,
      origin: { y: 0.5 },
      colors: ['#1664ff', '#722ed1', '#00f2fe', '#00b42a', '#ffb800'],
    });
    onResolve(activeConv.id);
    showToast('Đã giải quyết phiên hỗ trợ thành công! 🎉');
  };

  const handleSend = async () => {
    if (sendingRef.current || !messageText.trim() || !activeConv) return;
    const text = messageText;
    const isInternal = !isStaffActive || composerMode === 'internal';

    // Block public sending if conversation is still handled by AI
    if (!isStaffActive && composerMode === 'public') {
      showToast('⚠️ Cuộc trò chuyện đang do AI phụ trách. Vui lòng bấm "Chuyển sang Nhân viên chat" để trả lời khách!');
      return;
    }

    sendingRef.current = true;
    setIsSending(true);

    const visibility = isInternal ? 'internal' : 'public';
    const media=mediaUrl.trim()?{type:mediaType,url:mediaUrl.trim()}:undefined;
    const msgClientId = attemptsRef.current.begin(activeConv.id,text,visibility,media);

    try {
      // 1. Send via WebSocket if open (<1ms)
      const isMetaChannel = ['Facebook Messenger', 'Instagram', 'WhatsApp', 'Threads'].includes(activeConv.channel);
      const sentViaWs = isMetaChannel ? false : await sendMessageOverSocket(text, isInternal ? 'internal' : 'public', msgClientId);

      // 2. Dispatch to parent console state
      const saved = await onSendMessage(activeConv.id, {
      clientId: msgClientId,
      senderType: isInternal ? 'internal_note' : 'agent',
      senderName: 'Chuyên viên Hỗ trợ',
      senderAvatar: '',
      content: text,
      ...(media ? {attachments:[media]} : {}),
      }, sentViaWs);

      if (!saved) return;
      attemptsRef.current.confirmed(activeConv.id,text,visibility,msgClientId,media);
      setMessageText('');
      setMediaUrl('');
      setShowMedia(false);
      textareaRef.current?.focus();
    } finally {
      sendingRef.current = false;
      setIsSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Canned Responses / Quick Macros
  const handleMacroInsert = (text: string) => {
    setMessageText((prev) => (prev ? `${prev}\n${text}` : text));
    textareaRef.current?.focus();
    showToast('Đã chèn câu trả lời mẫu');
  };

  // Cinematic AI Rephrase Sparkle
  const handleAiRephrase = () => {
    setIsAiThinking(true);
    setTimeout(() => {
      setIsAiThinking(false);
      if (!messageText.trim()) {
        setMessageText('Kính gửi Quý khách, GoTek đã tiếp nhận yêu cầu và sẽ hỗ trợ giải đáp chi tiết ngay sau đây ạ.');
        showToast('Đã chèn nội dung chào mừng tiêu chuẩn');
        return;
      }
      setMessageText((prev) => `Dạ kính gửi đối tác, GoTek cam kết đáp ứng trọn vẹn yêu cầu kỹ thuật của bên mình: ${prev.trim()}`);
      showToast('Đã trau chuốt câu từ bằng AI');
      textareaRef.current?.focus();
    }, 400);
  };

  const handleToggleReaction = (msgId: string, emoji: string) => {
    setMessageReactions((prev) => {
      const current = prev[msgId] || [];
      const exists = current.includes(emoji);
      const updated = exists ? current.filter((e) => e !== emoji) : [...current, emoji];
      return { ...prev, [msgId]: updated };
    });
  };

  const handleAddTag = async () => {
    if (!newTagInput.trim() || !activeConv) return;
    const current = activeTags[activeConv.id] || activeConv.crmTags || [];
    const updated=[...current, newTagInput.trim()];
    setActiveTags({
      ...activeTags,
      [activeConv.id]: updated,
    });
    try { await api(`/conversations/${activeConv.id}/tags`, 'PUT', {tags: updated}); } catch { showToast('Không lưu được nhãn CRM'); return; }
    setNewTagInput('');
    setShowAddTag(false);
    showToast('Đã thêm nhãn CRM');
  };

  const handleRemoveTag = async (tagToRemove: string) => {
    if (!activeConv) return;
    const current = activeTags[activeConv.id] || activeConv.crmTags || [];
    const updated=current.filter((t) => t !== tagToRemove);
    setActiveTags({
      ...activeTags,
      [activeConv.id]: updated,
    });
    try { await api(`/conversations/${activeConv.id}/tags`, 'PUT', {tags: updated}); } catch { showToast('Không lưu được nhãn CRM'); return; }
    showToast('Đã gỡ nhãn CRM');
  };

  const currentTags = activeConv ? (activeTags[activeConv.id] || activeConv.crmTags || []) : [];

  return (
    <div ref={containerRef} className="flex-1 flex overflow-hidden relative h-full bg-[#f8f9fb] dark:bg-[#080c14] bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(22,100,255,0.05),rgba(255,255,255,0))] dark:bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(22,100,255,0.1),rgba(0,0,0,0))] text-[#1f2329] dark:text-slate-100 select-text transition-colors duration-300">
      {/* Toast Notification */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -15, scale: 0.95 }}
            transition={{ type: 'spring', damping: 20, stiffness: 300 }}
            className="absolute top-4 left-1/2 -translate-x-1/2 z-50 bg-[#1f2329]/95 dark:bg-slate-900/95 backdrop-blur-md text-white text-[13px] px-4 py-2 rounded-xl shadow-2xl flex items-center gap-2 border border-slate-700/80 dark:border-blue-500/40"
          >
            <span className="material-symbols-outlined text-[17px] text-emerald-400">check_circle</span>
            <span className="font-medium">{toastMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ================= COLUMN 1: CONVERSATION QUEUE (Bento Glassmorphism & Spring Expand/Collapse) ================= */}
      <motion.section
        initial={false}
        animate={{
          width: isQueueOpen ? queueWidth : 0,
          opacity: isQueueOpen ? 1 : 0,
        }}
        transition={{ type: 'spring', stiffness: 360, damping: 32 }}
        className="h-full flex flex-col bg-white/75 dark:bg-[#0d131f]/90 backdrop-blur-xl border-r border-slate-200/80 dark:border-slate-800/80 shrink-0 select-none overflow-hidden relative shadow-[4px_0_24px_rgba(0,0,0,0.02)] transition-colors"
        style={{ willChange: 'width, opacity' }}
      >
        <div style={{ width: `${queueWidth}px` }} className="h-full flex flex-col min-w-0">
          {/* Header & Search */}
          <div className="p-3.5 border-b border-slate-200/60 dark:border-slate-800/70 space-y-2.5 bg-white/40 dark:bg-slate-900/40">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="font-bold text-[14.5px] text-[#1f2329] dark:text-slate-100 tracking-tight">Hộp thư CSKH</span>
                <span className="px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/60 text-[#1664ff] dark:text-blue-400 text-[11px] font-bold border border-blue-200/60 dark:border-blue-800/60 shadow-2xs">
                  {conversations.length}
                </span>
              </div>
              <button
                onClick={() => setIsQueueOpen(false)}
                className="w-7 h-7 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center transition-colors cursor-pointer"
                title="Thu gọn danh sách"
                type="button"
              >
                <span className="material-symbols-outlined text-[19px]">chevron_left</span>
              </button>
            </div>

            <div className="flex flex-col gap-2 text-xs">
              <label>Nền tảng
                <select multiple aria-label="Lọc nền tảng" value={sourcePlatforms} className="w-full bg-transparent border rounded p-1" onChange={e=>{
                  const values=Array.from(e.target.selectedOptions,o=>o.value);
                  setSourcePlatforms(values); onSourceFilterChange?.(values,sourceConnections);
                }}>
                  <option value="facebook_messenger">Facebook Messenger</option>
                  <option value="instagram_messaging">Instagram</option>
                  <option value="whatsapp_business">WhatsApp</option>
                </select>
              </label>
              <label>Page / tài khoản
                <select multiple aria-label="Lọc Page hoặc tài khoản" value={sourceConnections} className="w-full bg-transparent border rounded p-1" onChange={e=>{
                  const values=Array.from(e.target.selectedOptions,o=>o.value);
                  setSourceConnections(values); onSourceFilterChange?.(sourcePlatforms,values);
                }}>
                  {sources.map(source=><option key={source.connectionId} value={source.connectionId}>{source.platform === 'facebook_messenger' ? 'Facebook Messenger' : source.platform === 'instagram_messaging' ? 'Instagram' : source.platform === 'whatsapp_business' ? 'WhatsApp' : source.platform} · {source.accountName}{source.externalAccountId ? ` · ${source.externalAccountId}` : ''}</option>)}
                </select>
              </label>
              <button type="button" onClick={()=>{setSourcePlatforms([]);setSourceConnections([]);onSourceFilterChange?.([],[]);}}>Xóa bộ lọc nguồn</button>
            </div>

            {/* Natural Search Input */}
            <div className="relative group">
              <span className="material-symbols-outlined absolute left-2.5 top-2 text-slate-400 dark:text-slate-500 text-[17px] pointer-events-none group-focus-within:text-[#1664ff] dark:group-focus-within:text-blue-400 transition-colors">
                search
              </span>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Tìm hội thoại, khách hàng..."
                className="w-full pl-8 pr-7 py-1.5 bg-slate-100/70 dark:bg-slate-800/80 hover:bg-slate-100/90 dark:hover:bg-slate-800 focus:bg-white dark:focus:bg-[#0e1626] border border-transparent dark:border-slate-700/60 focus:border-[#1664ff]/60 dark:focus:border-blue-500/70 rounded-xl text-[13px] text-[#1f2329] dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-[#1664ff]/15 dark:focus:ring-blue-500/20 transition-all shadow-inner"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[15px]">close</span>
                </button>
              )}
            </div>

            {/* Seamless Filter Tabs with Spring Slider */}
            <div className="grid grid-cols-4 gap-0.5 p-0.5 bg-slate-200/50 dark:bg-slate-800/80 backdrop-blur-sm rounded-xl text-[12px] font-medium relative border border-transparent dark:border-slate-700/50">
              <button
                onClick={() => setFilterTab('all')}
                className={`py-1.5 px-1 rounded-lg text-center transition-all relative z-10 cursor-pointer ${
                  filterTab === 'all' ? 'text-[#1664ff] dark:text-blue-400 font-bold' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                {filterTab === 'all' && (
                  <motion.div
                    layoutId="activeFilterPill"
                    className="absolute inset-0 bg-white dark:bg-slate-700 rounded-lg shadow-sm border border-slate-200/60 dark:border-slate-600 -z-10"
                    transition={{ type: 'spring', damping: 25, stiffness: 350 }}
                  />
                )}
                <span>Tất cả</span>
              </button>

              <button
                onClick={() => setFilterTab('queue')}
                className={`py-1.5 px-1 rounded-lg text-center transition-all flex items-center justify-center gap-1 relative z-10 cursor-pointer ${
                  filterTab === 'queue' ? 'text-[#f53f3f] dark:text-rose-400 font-bold' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                {filterTab === 'queue' && (
                  <motion.div
                    layoutId="activeFilterPill"
                    className="absolute inset-0 bg-white dark:bg-slate-700 rounded-lg shadow-sm border border-slate-200/60 dark:border-slate-600 -z-10"
                    transition={{ type: 'spring', damping: 25, stiffness: 350 }}
                  />
                )}
                <span>Handoff</span>
                <span className="w-1.5 h-1.5 rounded-full bg-[#f53f3f] animate-pulse" />
              </button>

              <button
                onClick={() => setFilterTab('bot')}
                className={`py-1.5 px-1 rounded-lg text-center transition-all relative z-10 cursor-pointer ${
                  filterTab === 'bot' ? 'text-[#722ed1] dark:text-purple-400 font-bold' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                {filterTab === 'bot' && (
                  <motion.div
                    layoutId="activeFilterPill"
                    className="absolute inset-0 bg-white dark:bg-slate-700 rounded-lg shadow-sm border border-slate-200/60 dark:border-slate-600 -z-10"
                    transition={{ type: 'spring', damping: 25, stiffness: 350 }}
                  />
                )}
                <span>AI Bot</span>
              </button>

              <button
                onClick={() => setFilterTab('mine')}
                className={`py-1.5 px-1 rounded-lg text-center transition-all relative z-10 cursor-pointer ${
                  filterTab === 'mine' ? 'text-[#1664ff] dark:text-blue-400 font-bold' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                {filterTab === 'mine' && (
                  <motion.div
                    layoutId="activeFilterPill"
                    className="absolute inset-0 bg-white dark:bg-slate-700 rounded-lg shadow-sm border border-slate-200/60 dark:border-slate-600 -z-10"
                    transition={{ type: 'spring', damping: 25, stiffness: 350 }}
                  />
                )}
                <span>Của tôi</span>
              </button>
            </div>
          </div>

          {/* Conversation Stream - Bento Cards */}
          <div className="flex-1 overflow-y-auto p-2 space-y-1.5 custom-scrollbar">
            {filteredConversations.length === 0 ? (
              <div className="py-16 text-center text-[13px] text-slate-400 dark:text-slate-500">
                <span className="material-symbols-outlined text-[32px] text-slate-300 dark:text-slate-600 block mb-1.5">
                  inbox
                </span>
                Không có hội thoại phù hợp
              </div>
            ) : (
              filteredConversations.map((conv) => {
                const isSelected = conv.id === selectedConvId;
                const isHandoff = conv.status === 'handoff';
                const isAi = conv.status === 'ai_active';
                const isRead = isSelected || readConvIds.has(conv.id);

                return (
                  <article
                    key={conv.id}
                    onClick={() => {
                      setSelectedConvId(conv.id);
                      setReadConvIds((prev) => new Set([...prev, conv.id]));
                    }}
                    className={`group p-3 rounded-xl cursor-pointer transition-all duration-200 relative border ${
                      isSelected
                        ? 'bg-gradient-to-r from-blue-50/90 via-indigo-50/60 to-white dark:from-blue-950/70 dark:via-slate-900 dark:to-slate-900 border-blue-400/80 dark:border-blue-500/80 shadow-sm dark:shadow-[0_0_18px_rgba(22,100,255,0.18)] ring-1 ring-blue-400/30 dark:ring-blue-500/30'
                        : 'bg-white dark:bg-slate-900/90 hover:bg-slate-50 dark:hover:bg-slate-800/80 border-slate-200/80 dark:border-slate-800/80 hover:border-slate-300 dark:hover:border-slate-700 hover:shadow-xs'
                    }`}
                  >
                    {/* Active Left Indicator Bar with Neon Glow */}
                    {isSelected && (
                      <motion.span
                        layoutId="activeConvIndicator"
                        className="absolute left-0 top-2.5 bottom-2.5 w-1 bg-gradient-to-b from-[#1664ff] to-[#722ed1] dark:from-blue-400 dark:to-indigo-400 rounded-r shadow-[0_0_8px_rgba(22,100,255,0.6)]"
                        transition={{ type: 'spring', damping: 25, stiffness: 350 }}
                      />
                    )}

                    <div className="flex items-start gap-2.5">
                      {/* Avatar with Status Dot */}
                      <div className="relative shrink-0 mt-0.5">
                        <img
                          src={conv.customerAvatar}
                          alt={conv.customerName}
                          className="w-10 h-10 rounded-full object-cover border border-slate-200/80 dark:border-slate-700 shadow-xs group-hover:scale-105 transition-transform"
                        />
                        <span
                          className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full ring-2 ring-white dark:ring-slate-900 ${
                            isHandoff ? 'bg-[#f53f3f] animate-ping' : isAi ? 'bg-[#722ed1]' : 'bg-emerald-500'
                          }`}
                        />
                        <span
                          className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full ring-2 ring-white dark:ring-slate-900 ${
                            isHandoff ? 'bg-[#f53f3f]' : isAi ? 'bg-[#722ed1]' : 'bg-emerald-500'
                          }`}
                        />
                      </div>

                      {/* Content details */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1 mb-0.5">
                          <div className="flex items-center gap-1.5 min-w-0">
                            {isRead ? (
                              <span className="inline-flex items-center text-slate-400 dark:text-slate-500 shrink-0" title="Hội thoại đã đọc">
                                <span className="material-symbols-outlined text-[13px] text-emerald-500">done_all</span>
                              </span>
                            ) : (
                              <span className="w-2 h-2 rounded-full bg-[#1664ff] shrink-0 animate-pulse" title="Tin nhắn mới chưa đọc" />
                            )}
                            <h4
                              className={`text-[13.5px] truncate transition-colors ${
                                isSelected
                                  ? 'font-bold text-[#1f2329] dark:text-white'
                                  : isRead
                                    ? 'font-medium text-slate-700 dark:text-slate-200'
                                    : 'font-bold text-slate-900 dark:text-white'
                              }`}
                            >
                              {conv.customerName}
                            </h4>
                          </div>
                          <span className="text-[11px] text-slate-400 dark:text-slate-500 shrink-0 font-medium">
                            {conv.lastMessageTime}
                          </span>
                        </div>

                        <p className="text-[11.5px] text-slate-500 dark:text-slate-400 truncate mb-1 font-medium">
                          {conv.customerCompany}
                        </p>

                        {typingState.isTyping && activeConv?.id === conv.id ? (
                          <p className="text-[12px] text-[#1664ff] dark:text-blue-400 font-semibold line-clamp-1 leading-normal mb-1.5 flex items-center gap-1 animate-pulse">
                            <span className="material-symbols-outlined text-[14px]">edit</span>
                            <span>{typingState.actorType === 'visitor' ? 'Khách' : 'Nhân viên'} đang soạn tin...</span>
                          </p>
                        ) : (
                          <p className="text-[12px] text-slate-600 dark:text-slate-300 line-clamp-1 leading-normal mb-1.5 font-normal">
                            {conv.lastMessageSnippet}
                          </p>
                        )}

                        {/* Status Badges Row */}
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {isRead ? (
                            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 text-[10px] font-medium border border-slate-200/50 dark:border-slate-700/50">
                              Đã đọc
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded-md bg-blue-50 dark:bg-blue-950/60 text-[#1664ff] dark:text-blue-400 text-[10px] font-bold border border-blue-200/70 dark:border-blue-800/60">
                              Chưa đọc
                            </span>
                          )}

                          {isHandoff && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 text-[10.5px] font-semibold border border-rose-200/80 dark:border-rose-800/60 shadow-2xs">
                              <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
                              Cần Handoff
                            </span>
                          )}

                          {isAi && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 text-[10.5px] font-semibold border border-purple-200/80 dark:border-purple-800/60 shadow-2xs">
                              <span className="material-symbols-outlined text-[12px]">smart_toy</span>
                              AI Phục vụ
                            </span>
                          )}

                          {conv.status === 'in_review' && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 text-[10.5px] font-semibold border border-emerald-200/80 dark:border-emerald-800/60 shadow-2xs">
                              Nhân viên xử lý
                            </span>
                          )}

                          <span className="px-2 py-0.5 rounded-md text-[10.5px] text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/50 font-medium ml-auto">
                            {conv.channel}{conv.accountName ? ` · ${conv.accountName}` : ''}
                          </span>
                        </div>
                      </div>
                    </div>
                  </article>
                );
              })
            )}
          </div>
        </div>
      </motion.section>

      {/* ================= RESIZE HANDLE 1: SUBTLE SPLITTER ================= */}
      {isQueueOpen && (
        <div
          onMouseDown={() => setIsDraggingQueue(true)}
          className={`w-1 h-full cursor-col-resize hover:bg-[#1664ff]/40 active:bg-[#1664ff] transition-colors z-20 select-none shrink-0 ${
            isDraggingQueue ? 'bg-[#1664ff]' : 'bg-transparent'
          }`}
          title="Kéo sang trái / phải để chỉnh độ rộng danh sách"
        />
      )}

      {/* Collapsed Queue Restore Button */}
      <AnimatePresence>
        {!isQueueOpen && (
          <motion.button
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            transition={{ type: 'spring', stiffness: 350, damping: 25 }}
            onClick={() => setIsQueueOpen(true)}
            className="bg-white/90 backdrop-blur-md hover:bg-white text-[#1664ff] border-r border-y border-slate-200/80 py-4 px-2 shadow-md z-20 flex flex-col items-center gap-1.5 transition-all group shrink-0 self-center rounded-r-xl cursor-pointer hover:shadow-lg hover:border-blue-400"
            title="Mở rộng danh sách hội thoại"
            type="button"
          >
            <span className="material-symbols-outlined text-[20px] group-hover:scale-110 transition-transform">chevron_right</span>
            <span className="[writing-mode:vertical-rl] text-[11px] font-bold tracking-wider uppercase text-slate-500 group-hover:text-[#1664ff]">
              Hàng chờ
            </span>
          </motion.button>
        )}
      </AnimatePresence>

      {/* ================= COLUMN 2: CHAT CANVAS & THREAD (Fluid Edge-to-Edge) ================= */}
      {!activeConv ? (
        <main className="flex-1 h-full flex flex-col items-center justify-center p-8 text-center bg-[#f8f9fb] dark:bg-[#080c14] text-slate-500">
          <div className="w-16 h-16 rounded-2xl bg-blue-50 dark:bg-blue-950/40 text-[#1664ff] dark:text-blue-400 flex items-center justify-center mb-4 border border-blue-200/60 dark:border-blue-800/60 shadow-xs">
            <span className="material-symbols-outlined text-[32px]">forum</span>
          </div>
          <h3 className="text-base font-bold text-slate-800 dark:text-slate-100 mb-1">
            {conversations.length === 0 ? 'Hộp thư chưa có hội thoại nào' : 'Chọn một cuộc hội thoại'}
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md">
            {conversations.length === 0
              ? 'Tất cả tin nhắn gửi từ Web Widget hoặc các kênh tích hợp sẽ tự động hiển thị tại đây theo thời gian thực từ cơ sở dữ liệu.'
              : 'Chọn một hội thoại từ danh sách bên trái để xem nội dung trao đổi và tiếp quản hỗ trợ.'}
          </p>
        </main>
      ) : (
        <main className="flex-1 h-full flex flex-col bg-[#f8f9fb] dark:bg-[#080c14] relative overflow-hidden min-w-[380px] transition-colors">
        {/* Thread Header Bar - Seamless and Clean */}
        <header className="h-14 px-6 bg-white dark:bg-[#0d131f]/90 border-b border-slate-200/80 dark:border-slate-800/80 flex items-center justify-between shrink-0 z-10 transition-colors">
          {/* Customer Summary Info */}
          <div className="flex items-center gap-3 min-w-0">
            {/* Mobile Back Button (UC-035) */}
            <button
              type="button"
              onClick={() => {
                setIsQueueOpen(true);
                setSelectedConvId('');
              }}
              className="md:hidden -ml-2 mr-0.5 p-1 rounded-lg text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center transition-colors cursor-pointer"
              title="Quay lại danh sách hội thoại"
            >
              <span className="material-symbols-outlined text-[20px]">arrow_back</span>
            </button>

            <div className="relative">
              <img
                src={activeConv.customerAvatar}
                alt={activeConv.customerName}
                className="w-9 h-9 rounded-full object-cover border border-slate-200/80 dark:border-slate-700 shadow-xs"
              />
              <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-slate-900" />
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-[15px] text-[#1f2329] dark:text-slate-100 tracking-tight truncate">
                  {activeConv.customerName}
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10.5px] font-bold bg-blue-50 dark:bg-blue-950/60 text-[#1664ff] dark:text-blue-400 border border-blue-200/70 dark:border-blue-800/60 shadow-2xs">
                  {activeConv.clientTier}
                </span>

                {/* Realtime WebSocket / SSE Indicator Badge */}
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold border transition-colors ${
                  isConnected
                    ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border-emerald-200/80 dark:border-emerald-800/60'
                    : 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border-amber-200/80 dark:border-amber-800/60'
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
                  {isConnected ? (transportType === 'ws' ? '⚡ Realtime WebSocket' : '🟢 Realtime SSE') : 'Đang kết nối...'}
                </span>
              </div>
              <p className="text-[12px] text-slate-500 dark:text-slate-400 truncate flex items-center gap-1.5">
                <span className="font-medium text-slate-700 dark:text-slate-300">{activeConv.customerCompany}</span>
                <span>•</span>
                <a
                  href={activeConv.websiteUrl || undefined}
                  target="_blank"
                  rel="noreferrer"
                  className="text-slate-400 hover:text-[#1664ff] dark:hover:text-blue-400 transition-colors"
                >
                  {activeConv.websiteUrl || 'Website: Chưa cung cấp'}
                </a>
              </p>
            </div>
          </div>

          {/* Quick Action Header Controls: 1 Single Action Button */}
          <div className="flex items-center gap-2 shrink-0">
            {!isStaffActive ? (
              // AI Mode: 1 Nút duy nhất để Chuyển sang Nhân viên chat
              <motion.button
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                type="button"
                onClick={() => onTakeover(activeConv.id)}
                className="px-3.5 py-1.5 bg-[#1664ff] hover:bg-[#3370ff] text-white rounded-lg text-[12.5px] font-semibold flex items-center gap-1.5 shadow-xs transition-all cursor-pointer"
                title="Chuyển sang chế độ Nhân viên tiếp quản và trực tiếp chat với khách hàng"
              >
                <span className="material-symbols-outlined text-[17px]">support_agent</span>
                <span>Chuyển sang Nhân viên chat</span>
                {activeConv.status === 'handoff' && (
                  <span className="px-1.5 py-0.2 text-[10px] bg-amber-400 text-slate-900 font-extrabold rounded-full animate-bounce">Khách chờ</span>
                )}
              </motion.button>
            ) : (
              // Staff Mode: 1 Nút duy nhất để Chuyển lại cho AI
              onResumeAi && (
                <motion.button
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  type="button"
                  onClick={() => onResumeAi(activeConv.id)}
                  className="px-3.5 py-1.5 bg-purple-50 dark:bg-purple-950/60 hover:bg-purple-100 dark:hover:bg-purple-900/60 text-purple-700 dark:text-purple-300 border border-purple-200/80 dark:border-purple-800/60 rounded-lg text-[12.5px] font-semibold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer"
                  title="Bấm để chuyển giao lại cho AI Bot tự động trả lời"
                >
                  <span className="material-symbols-outlined text-[17px] text-purple-600 dark:text-purple-400">smart_toy</span>
                  <span>Chuyển lại cho AI</span>
                </motion.button>
              )
            )}

            {/* Resolve Button with Celebration Confetti */}
            {activeConv.status !== 'resolved' ? (
              <motion.button
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                onClick={handleResolveWithConfetti}
                className="px-3 py-1.5 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-200 border border-slate-200/90 dark:border-slate-700 rounded-lg text-[12.5px] font-semibold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer group"
                type="button"
                title="Đánh dấu đã giải quyết"
              >
                <span className="material-symbols-outlined text-[17px] text-emerald-600 dark:text-emerald-400 group-hover:scale-110 transition-transform">
                  check_circle
                </span>
                <span className="hidden sm:inline">Giải quyết</span>
              </motion.button>
            ) : (
              <span className="px-2.5 py-1 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400 border border-emerald-200/80 dark:border-emerald-800/60 rounded-lg text-[12px] font-semibold flex items-center gap-1">
                <span className="material-symbols-outlined text-[15px]">done_all</span>
                Đã giải quyết
              </span>
            )}

            {/* Toggle Dossier Panel */}
            <button
              onClick={() => setIsDossierOpen(!isDossierOpen)}
              className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
                isDossierOpen
                  ? 'bg-blue-50 dark:bg-blue-950/60 text-[#1664ff] dark:text-blue-400 border-blue-200 dark:border-blue-800'
                  : 'bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-750 hover:text-slate-800 dark:hover:text-white'
              }`}
              title={isDossierOpen ? 'Thu gọn hồ sơ khách hàng' : 'Xem hồ sơ khách hàng'}
              type="button"
            >
              <span className="material-symbols-outlined text-[19px]">person_pin</span>
            </button>
          </div>
        </header>

        {/* ================= MESSAGE STREAM (Natural, Roomy & Interactive) ================= */}
        <div className="flex-1 overflow-y-auto px-6 lg:px-10 py-5 space-y-5 custom-scrollbar">
          {/* Subtle Date Separator */}
          <div className="flex items-center justify-center my-3">
            <span className="px-3 py-0.5 rounded-full bg-slate-200/70 dark:bg-slate-800 text-slate-500 dark:text-slate-400 text-[11.5px] font-medium select-none border border-transparent dark:border-slate-700/60">
              Hôm nay · Phiên hội thoại trực tuyến
            </span>
          </div>

          {activeConv.messages.map((msg) => {
            const isHovered = hoveredMessageId === msg.id;
            const reactions = messageReactions[msg.id] || [];

            // 1. System Events
            if (msg.senderType === 'system_event') {
              return (
                <div key={msg.id} className="flex justify-center my-2.5">
                  <div className="px-3.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-[12px] font-medium flex items-center gap-2 border border-slate-200/60 dark:border-slate-700/60 shadow-xs">
                    <span className="material-symbols-outlined text-[15px] text-[#1664ff] dark:text-blue-400">info</span>
                    <span>{msg.content}</span>
                    <span className="text-slate-400 dark:text-slate-500 text-[11px]">({msg.timestamp})</span>
                  </div>
                </div>
              );
            }

            // 2. Internal Staff Notes - Elegant Linear/Notion Callout
            if (msg.senderType === 'internal_note') {
              return (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2 }}
                  key={msg.id}
                  onMouseEnter={() => setHoveredMessageId(msg.id)}
                  onMouseLeave={() => setHoveredMessageId(null)}
                  className="w-full my-2.5 group relative"
                >
                  <div className="p-3.5 rounded-r-xl border-l-4 border-amber-400 dark:border-amber-500 bg-amber-50/70 dark:bg-amber-950/30 text-slate-700 dark:text-amber-200 text-[13px] transition-colors shadow-xs">
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-1.5 font-semibold text-amber-800 dark:text-amber-300 text-[12.5px]">
                        <span className="material-symbols-outlined text-[16px]">lock</span>
                        <span>Ghi chú nội bộ</span>
                        <span className="font-normal text-amber-700/80 dark:text-amber-400/80 text-[11.5px]">(Chỉ nhân viên xem được)</span>
                      </div>
                      <span className="text-[11.5px] text-amber-700/70 dark:text-amber-400/70 font-medium">{msg.timestamp}</span>
                    </div>
                    <p className="whitespace-pre-wrap leading-relaxed text-slate-800 dark:text-slate-100 font-normal">
                      {msg.content}
                    </p>
                    <div className="text-[11.5px] text-slate-500 dark:text-slate-400 mt-1.5 flex items-center gap-1">
                      <span>Người tạo:</span>
                      <strong className="text-slate-700 dark:text-slate-200">{msg.senderName}</strong>
                    </div>
                  </div>
                </motion.div>
              );
            }

            // 3. AI Copilot Response (Bento Glassmorphism with pgvector Grounding)
            if (msg.senderType === 'ai') {
              const isCitationOpen = expandedCitations[msg.id];

              return (
                <motion.div
                  initial={{ opacity: 0, y: 12, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ duration: 0.25 }}
                  key={msg.id}
                  onMouseEnter={() => setHoveredMessageId(msg.id)}
                  onMouseLeave={() => setHoveredMessageId(null)}
                  className="flex items-start gap-3 max-w-[78%] group relative"
                >
                  {/* AI Avatar with Gradient Glow */}
                  <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-[#1664ff] via-[#4f46e5] to-[#722ed1] flex items-center justify-center text-white shrink-0 shadow-[0_2px_12px_rgba(22,100,255,0.35)] mt-0.5 border border-white/40 dark:border-white/20">
                    <span className="material-symbols-outlined text-[17px] animate-pulse">auto_awesome</span>
                  </div>

                  <div className="flex flex-col items-start min-w-0">
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="text-[12.5px] font-bold text-[#1f2329] dark:text-white tracking-tight">GoTek AI Copilot</span>
                      <span className="px-2 py-0.5 rounded-full bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-950/50 dark:to-blue-950/50 text-[#722ed1] dark:text-purple-300 text-[10px] font-mono font-bold border border-purple-200/80 dark:border-purple-800/60 shadow-2xs flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                        pgvector · 38ms Grounded ✓
                      </span>
                      <span className="text-[11px] text-slate-400 dark:text-slate-500 font-normal">{msg.timestamp}</span>
                    </div>

                    <div className="p-4 rounded-2xl rounded-tl-sm bg-gradient-to-br from-blue-50/90 via-indigo-50/60 to-purple-50/40 dark:from-blue-950/50 dark:via-indigo-950/40 dark:to-slate-900/80 text-slate-800 dark:text-slate-100 text-[13.5px] leading-relaxed whitespace-pre-wrap shadow-[0_4px_20px_rgba(22,100,255,0.06)] dark:shadow-[0_0_20px_rgba(22,100,255,0.12)] border border-blue-200/80 dark:border-blue-500/30 backdrop-blur-md relative">
                      {msg.content}

                      {/* Interactive Grounding Citations Accordion */}
                      {msg.citations && msg.citations.length > 0 && (
                        <div className="mt-3 pt-2.5 border-t border-blue-200/60 dark:border-blue-800/50">
                          <button
                            type="button"
                            onClick={() =>
                              setExpandedCitations((prev) => ({
                                ...prev,
                                [msg.id]: !prev[msg.id],
                              }))
                            }
                            className="flex items-center gap-1.5 text-[12px] font-semibold text-[#1664ff] dark:text-blue-400 hover:text-[#3370ff] dark:hover:text-blue-300 transition-colors cursor-pointer group"
                          >
                            <span className="material-symbols-outlined text-[16px] group-hover:scale-110 transition-transform">menu_book</span>
                            <span>Trích dẫn từ Kho tri thức ({msg.citations.length} nguồn)</span>
                            <motion.span
                              animate={{ rotate: isCitationOpen ? 180 : 0 }}
                              transition={{ duration: 0.2 }}
                              className="material-symbols-outlined text-[16px]"
                            >
                              expand_more
                            </motion.span>
                          </button>

                          <AnimatePresence>
                            {isCitationOpen && (
                              <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                exit={{ opacity: 0, height: 0 }}
                                transition={{ duration: 0.25, ease: 'easeInOut' }}
                                className="mt-2 space-y-1.5 overflow-hidden"
                              >
                                {msg.citations.map((c, i) => (
                                  <div
                                    key={i}
                                    className="p-2 rounded-xl bg-white/90 dark:bg-slate-800/90 border border-blue-100/90 dark:border-blue-900/50 flex items-center justify-between text-[12px] shadow-2xs hover:shadow-xs hover:border-blue-300 dark:hover:border-blue-500/50 transition-all"
                                  >
                                    <div className="flex items-center gap-2 truncate">
                                      <span className="material-symbols-outlined text-emerald-600 dark:text-emerald-400 text-[15px]">
                                        check_circle
                                      </span>
                                      <span className="font-semibold text-slate-800 dark:text-slate-200 truncate">{c.title}</span>
                                      {c.pageOrSection && (
                                        <span className="text-slate-400 dark:text-slate-500">({c.pageOrSection})</span>
                                      )}
                                    </div>
                                    <span className="text-[10px] font-mono text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-1.5 py-0.5 rounded-full font-bold shrink-0 ml-2 border border-emerald-200/60 dark:border-emerald-800/50">
                                      {c.similarity || '98% match'}
                                    </span>
                                  </div>
                                ))}
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      )}
                    </div>

                    {/* Natural Hover Action Bar */}
                    <AnimatePresence>
                      {isHovered && (
                        <motion.div
                          initial={{ opacity: 0, y: 3, scale: 0.95 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: 3, scale: 0.95 }}
                          transition={{ duration: 0.15 }}
                          className="flex items-center gap-1 mt-1 bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm border border-slate-200/80 dark:border-slate-700/80 px-1.5 py-0.5 rounded-lg shadow-xs"
                        >
                          <button
                            onClick={() => copyToClipboard(msg.content, 'tin nhắn AI')}
                            className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition-colors"
                            title="Sao chép nội dung"
                          >
                            <span className="material-symbols-outlined text-[15px]">content_copy</span>
                          </button>
                          <button
                            onClick={() => handleToggleReaction(msg.id, '👍')}
                            className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition-colors"
                            title="Thích"
                          >
                            <span className="material-symbols-outlined text-[15px]">thumb_up</span>
                          </button>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {/* Reactions display */}
                    {reactions.length > 0 && (
                      <div className="flex gap-1 mt-1">
                        {reactions.map((r, i) => (
                          <span key={i} className="px-2 py-0.2 rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs shadow-xs text-slate-700 dark:text-slate-300">
                            {r}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </motion.div>
              );
            }

            // 4. Staff Agent Response (Right-aligned Natural Blue Bubble)
            if (msg.senderType === 'agent') {
              return (
                <motion.div
                  initial={{ opacity: 0, y: 12, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ duration: 0.25 }}
                  key={msg.id}
                  onMouseEnter={() => setHoveredMessageId(msg.id)}
                  onMouseLeave={() => setHoveredMessageId(null)}
                  className="flex items-start justify-end gap-2.5 ml-auto max-w-[72%] group relative"
                >
                  <div className="flex flex-col items-end min-w-0">
                    <div className="flex items-center gap-1.5 mb-1">
                      <span className="text-[11.5px] text-slate-400 dark:text-slate-500 font-normal">{msg.timestamp}</span>
                      <span className="text-[12.5px] font-bold text-[#1f2329] dark:text-slate-200">{msg.senderName}</span>
                    </div>

                    <div className="p-3.5 rounded-2xl rounded-tr-sm bg-[#1664ff] dark:bg-gradient-to-r dark:from-blue-600 dark:to-indigo-600 text-white shadow-xs text-[13.5px] leading-relaxed whitespace-pre-wrap">
                      {msg.content}
                    </div>

                    {/* Status delivery & receipts */}
                    <div className="flex items-center gap-1 mt-1 text-[11px] text-slate-400 dark:text-slate-500 font-normal">
                      <span>{msg.timestamp}</span>
                      <span>·</span>
                      {msg.status === 'read' ? (
                        <span className="inline-flex items-center gap-0.5 text-blue-600 dark:text-blue-400 font-medium" title="Khách đã đọc tin nhắn">
                          <span className="material-symbols-outlined text-[13px]">done_all</span>
                          <span>Đã đọc</span>
                        </span>
                      ) : msg.status === 'delivered' ? (
                        <span className="inline-flex items-center gap-0.5 text-slate-500 dark:text-slate-400 font-medium" title="Đã chuyển đến thiết bị khách">
                          <span className="material-symbols-outlined text-[13px]">done_all</span>
                          <span>Đã nhận</span>
                        </span>
                      ) : msg.status === 'sending' ? (
                        <span className="inline-flex items-center gap-0.5 text-amber-500 font-medium" title="Đang gửi...">
                          <span className="material-symbols-outlined text-[13px] animate-spin">sync</span>
                          <span>Đang gửi</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-0.5 text-slate-400 dark:text-slate-500 font-medium" title="Đã gửi thành công vào hệ thống">
                          <span className="material-symbols-outlined text-[13px]">check</span>
                          <span>Đã gửi</span>
                        </span>
                      )}
                    </div>

                    {/* Natural Hover Action Bar */}
                    <AnimatePresence>
                      {isHovered && (
                        <motion.div
                          initial={{ opacity: 0, y: 3, scale: 0.95 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: 3, scale: 0.95 }}
                          transition={{ duration: 0.15 }}
                          className="flex items-center gap-1 mt-1 bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm border border-slate-200/80 dark:border-slate-700/80 px-1.5 py-0.5 rounded-lg shadow-xs"
                        >
                          <button
                            onClick={() => copyToClipboard(msg.content, 'tin nhắn')}
                            className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition-colors"
                            title="Sao chép"
                          >
                            <span className="material-symbols-outlined text-[15px]">content_copy</span>
                          </button>
                          <button
                            onClick={() => handleToggleReaction(msg.id, '❤️')}
                            className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition-colors"
                            title="Thả tim"
                          >
                            <span className="material-symbols-outlined text-[15px]">favorite</span>
                          </button>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {/* Reactions */}
                    {reactions.length > 0 && (
                      <div className="flex gap-1 mt-1">
                        {reactions.map((r, i) => (
                          <span key={i} className="px-2 py-0.2 rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs shadow-xs text-slate-700 dark:text-slate-300">
                            {r}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  <img
                    src={
                      msg.senderAvatar ||
                      'https://lh3.googleusercontent.com/aida-public/AB6AXuD1-qn1cAT7mTay6n_TifAYhglMmbGsHViz0GRjVAPOCA6fSst4Nd_bqySEpKVWj125vgWZQUowOjx-51pdaBMMB1sKkKbRZLoNRnaBHEfvuYUUiKoT1E6KhQDmYUA0T0TXa7Icz4CnkIWnwMGuK48WG0GSOxypPNugzYG6XCL3iqeLcbbV-0qV5ZtsO5p95yp11TdZTQ7gHuXwjR3_k5Nd28ZfEmGM9GFSr_dJgAuj19uBwXoDFeuP'
                    }
                    alt={msg.senderName}
                    className="w-8 h-8 rounded-full object-cover border border-slate-200/80 dark:border-slate-700 mt-0.5 shadow-xs shrink-0"
                  />
                </motion.div>
              );
            }

            // 5. Customer Message (Left-aligned Soft Bubble)
            return (
              <motion.div
                initial={{ opacity: 0, y: 12, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.25 }}
                key={msg.id}
                onMouseEnter={() => setHoveredMessageId(msg.id)}
                onMouseLeave={() => setHoveredMessageId(null)}
                className="flex items-start gap-2.5 max-w-[72%] group relative"
              >
                <img
                  src={activeConv.customerAvatar}
                  alt={activeConv.customerName}
                  className="w-8 h-8 rounded-full object-cover border border-slate-200/80 dark:border-slate-700 mt-0.5 shadow-xs shrink-0"
                />

                <div className="flex flex-col items-start min-w-0">
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className="text-[12.5px] font-bold text-[#1f2329] dark:text-slate-200">{activeConv.customerName}</span>
                    <span className="text-[11.5px] text-slate-400 dark:text-slate-500 font-normal">{msg.timestamp}</span>
                  </div>

                  <div className="p-3.5 rounded-2xl rounded-tl-sm bg-white dark:bg-slate-800/90 text-slate-800 dark:text-slate-100 border border-slate-200/80 dark:border-slate-700/70 shadow-xs dark:shadow-md text-[13.5px] leading-relaxed whitespace-pre-wrap">
                    {msg.content}
                    {msg.attachments?.map((attachment) => attachment.type === 'image' ? (
                      <img key={attachment.url} src={attachment.url} alt="Tệp ảnh từ khách hàng" className="mt-2 max-w-full max-h-72 rounded-lg object-contain" />
                    ) : attachment.type === 'video' ? (
                      <video key={attachment.url} src={attachment.url} controls className="mt-2 max-w-full max-h-72 rounded-lg" />
                    ) : (
                      <a key={attachment.url} href={attachment.url} target="_blank" rel="noreferrer" className="mt-2 block text-blue-600 underline">Mở tệp đính kèm</a>
                    ))}
                  </div>

                  {/* Customer message receipt */}
                  <div className="flex items-center gap-1 mt-1 text-[11px] text-slate-400 dark:text-slate-500 font-normal">
                    <span>{msg.timestamp}</span>
                    <span>·</span>
                    <span className="inline-flex items-center gap-0.5 text-emerald-600 dark:text-emerald-400 font-medium" title="Đã nhận vào hệ thống">
                      <span className="material-symbols-outlined text-[13px]">done_all</span>
                      <span>Đã nhận</span>
                    </span>
                  </div>

                  {/* Natural Hover Action Bar */}
                  <AnimatePresence>
                    {isHovered && (
                      <motion.div
                        initial={{ opacity: 0, y: 3, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 3, scale: 0.95 }}
                        transition={{ duration: 0.15 }}
                        className="flex items-center gap-1 mt-1 bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm border border-slate-200/80 dark:border-slate-700/80 px-1.5 py-0.5 rounded-lg shadow-xs"
                      >
                        <button
                          onClick={() => copyToClipboard(msg.content, 'tin nhắn khách hàng')}
                          className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition-colors"
                          title="Sao chép"
                        >
                          <span className="material-symbols-outlined text-[15px]">content_copy</span>
                        </button>
                        <button
                          onClick={() => setMessageText(`> "${msg.content.slice(0, 80)}..."\n`)}
                          className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition-colors"
                          title="Trích dẫn trả lời"
                        >
                          <span className="material-symbols-outlined text-[15px]">format_quote</span>
                        </button>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Reactions */}
                  {reactions.length > 0 && (
                    <div className="flex gap-1 mt-1">
                      {reactions.map((r, i) => (
                        <span key={i} className="px-2 py-0.2 rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs shadow-xs text-slate-700 dark:text-slate-300">
                          {r}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </motion.div>
            );
          })}

          {/* Live In-stream Typing Indicator Bubble */}
          <AnimatePresence>
            {typingState.isTyping && (
              <motion.div
                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 5, scale: 0.95 }}
                transition={{ duration: 0.2 }}
                className="flex items-center gap-2 max-w-[70%]"
              >
                <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-[#1664ff] shrink-0 shadow-2xs">
                  <span className="material-symbols-outlined text-[16px]">edit</span>
                </div>
                <div className="px-4 py-2.5 rounded-2xl rounded-tl-sm bg-white dark:bg-slate-800/90 text-slate-700 dark:text-slate-200 border border-slate-200/80 dark:border-slate-700/70 shadow-xs flex items-center gap-2.5">
                  <span className="flex gap-1 items-center">
                    <span className="w-2 h-2 rounded-full bg-[#1664ff] dark:bg-blue-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-2 h-2 rounded-full bg-[#1664ff] dark:bg-blue-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-2 h-2 rounded-full bg-[#1664ff] dark:bg-blue-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                  </span>
                  <span className="text-[12px] font-medium text-slate-600 dark:text-slate-300">
                    {typingState.actorType === 'visitor' ? activeConv.customerName : 'Nhân sự hỗ trợ'} đang soạn tin...
                  </span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div ref={messagesEndRef} />
        </div>

        {/* ================= FLOATING BENTO GLASS COMPOSER ================= */}
        {/* Realtime Typing Indicator Bubble */}
        <AnimatePresence>
          {typingState.isTyping && (
            <motion.div
              initial={{ opacity: 0, y: 8, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className="px-6 py-1 flex items-center gap-2 select-none"
            >
              <div className="flex items-center gap-1.5 bg-white/95 dark:bg-slate-800/95 backdrop-blur-md px-3 py-1 rounded-full border border-blue-200/80 dark:border-blue-700/60 shadow-sm text-xs text-slate-600 dark:text-slate-300">
                <span className="flex gap-1 items-center">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#1664ff] dark:bg-blue-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-[#1664ff] dark:bg-blue-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-[#1664ff] dark:bg-blue-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                </span>
                <span className="text-[11.5px] font-medium text-slate-700 dark:text-slate-200">
                  {typingState.actorType === 'visitor' ? activeConv.customerName : 'Nhân sự hỗ trợ'} đang nhập tin nhắn...
                </span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <footer className="px-4 pb-4 pt-1 bg-transparent shrink-0 select-none">
          <div className="bg-white/90 dark:bg-[#0d131f]/95 backdrop-blur-xl border border-slate-200/90 dark:border-slate-800/90 rounded-2xl shadow-[0_8px_32px_rgba(22,100,255,0.08)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.5)] overflow-hidden transition-all focus-within:border-blue-400 dark:focus-within:border-blue-500 focus-within:shadow-[0_8px_32px_rgba(22,100,255,0.15)]">
            {/* Top Compact Bar: Mode Switcher + Inline Macros + AI Polish */}
            <div className="px-4 pt-2.5 pb-2 flex items-center justify-between gap-2 border-b border-slate-100/90 dark:border-slate-800/80 flex-wrap bg-white/50 dark:bg-slate-900/50">
              <div className="flex items-center gap-2">
                {/* Segmented Mode Switcher */}
                <div className="flex items-center p-0.5 bg-slate-100 dark:bg-slate-800 rounded-xl text-xs font-semibold">
                  <button
                    type="button"
                    onClick={() => {
                      if (!isStaffActive) {
                        showToast('⚠️ Cuộc trò chuyện đang do AI phụ trách. Vui lòng bấm "Chuyển sang Nhân viên chat" ở trên để chat với khách!');
                        return;
                      }
                      setComposerMode('public');
                    }}
                    className={`px-3 py-1 rounded-lg flex items-center gap-1.5 transition-all ${
                      composerMode === 'public' && isStaffActive
                        ? 'bg-white dark:bg-slate-700 text-[#1664ff] dark:text-blue-400 shadow-xs cursor-pointer'
                        : isStaffActive
                          ? 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 cursor-pointer'
                          : 'text-slate-400 dark:text-slate-500 cursor-not-allowed opacity-50'
                    }`}
                    title={!isStaffActive ? 'Chỉ nhân viên tiếp quản mới được chat với khách' : 'Trả lời khách'}
                  >
                    <span className="material-symbols-outlined text-[15px]">
                      {!isStaffActive ? 'lock' : 'chat'}
                    </span>
                    <span>Trả lời khách</span>
                    {!isStaffActive && (
                      <span className="text-[10px] px-1 py-0.2 bg-slate-200 dark:bg-slate-700 text-slate-500 rounded font-normal ml-0.5">Khóa</span>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => setComposerMode('internal')}
                    className={`px-3 py-1 rounded-lg flex items-center gap-1.5 transition-all cursor-pointer ${
                      composerMode === 'internal' || !isStaffActive
                        ? 'bg-amber-600 text-white shadow-xs font-bold'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[15px]">lock</span>
                    <span>Ghi chú nội bộ</span>
                  </button>
                </div>

                {/* Inline Quick Macro Suggestions */}
                <div className="hidden sm:flex items-center gap-1 text-[11.5px] text-slate-500 dark:text-slate-400">
                  <span className="text-slate-400 dark:text-slate-500 font-medium ml-1">Mẫu:</span>
                  <button
                    type="button"
                    onClick={() =>
                      handleMacroInsert(
                        'Kính gửi Quý đối tác, GoTek xin gửi Mẫu Thoả thuận Bảo mật (NDA) tiêu chuẩn. Quý anh/chị vui lòng kiểm tra và ký duyệt ạ.'
                      )
                    }
                    className="px-2 py-0.5 rounded-full bg-slate-100/90 dark:bg-slate-800 hover:bg-blue-50 dark:hover:bg-blue-950/50 hover:text-[#1664ff] dark:hover:text-blue-400 text-slate-700 dark:text-slate-300 transition-colors cursor-pointer border border-transparent hover:border-blue-200 dark:hover:border-blue-800"
                  >
                    📋 NDA
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      handleMacroInsert(
                        'Dự toán gói Enterprise 250 Tổng đài viên: Hỗ trợ Kubernetes On-Premise, cam kết SLA 99.99%, RAG không giới hạn token.'
                      )
                    }
                    className="px-2 py-0.5 rounded-full bg-slate-100/90 dark:bg-slate-800 hover:bg-blue-50 dark:hover:bg-blue-950/50 hover:text-[#1664ff] dark:hover:text-blue-400 text-slate-700 dark:text-slate-300 transition-colors cursor-pointer border border-transparent hover:border-blue-200 dark:hover:border-blue-800"
                  >
                    💰 250 Seats
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      handleMacroInsert(
                        'Chúng tôi đề xuất buổi hội thảo kỹ thuật (Deep-dive Architecture) 30 phút giữa Solution Architect và ban dự án ạ.'
                      )
                    }
                    className="px-2 py-0.5 rounded-full bg-slate-100/90 dark:bg-slate-800 hover:bg-blue-50 dark:hover:bg-blue-950/50 hover:text-[#1664ff] dark:hover:text-blue-400 text-slate-700 dark:text-slate-300 transition-colors cursor-pointer border border-transparent hover:border-blue-200 dark:hover:border-blue-800"
                  >
                    📅 Demo
                  </button>
                </div>
              </div>

              {/* AI Rephrase Sparkle Button with Aurora Rainbow Glow */}
              <motion.button
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.96 }}
                type="button"
                onClick={handleAiRephrase}
                disabled={isAiThinking}
                className="px-3 py-1 rounded-xl bg-gradient-to-r from-blue-50 via-indigo-50 to-purple-50 dark:from-blue-950/60 dark:via-indigo-950/50 dark:to-purple-950/40 hover:from-blue-100 hover:to-purple-100 dark:hover:from-blue-900/60 text-[#1664ff] dark:text-blue-400 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer border border-blue-200/80 dark:border-blue-800/60 shadow-2xs group"
                title="Tự động trau chuốt và làm câu từ lịch sự bằng AI"
              >
                <span className={`material-symbols-outlined text-[16px] text-[#722ed1] dark:text-purple-400 group-hover:scale-110 transition-transform ${isAiThinking ? 'animate-spin' : ''}`}>
                  {isAiThinking ? 'sync' : 'auto_awesome'}
                </span>
                <span className="bg-gradient-to-r from-[#1664ff] to-[#722ed1] dark:from-blue-400 dark:to-purple-400 bg-clip-text text-transparent">
                  {isAiThinking ? 'Đang phân tích...' : 'AI Trau chuốt'}
                </span>
              </motion.button>
            </div>

            {/* Notice bar when in AI Mode */}
            {!isStaffActive && (
              <div className="px-4 py-1.5 bg-amber-50/90 dark:bg-amber-950/40 border-b border-amber-200/60 dark:border-amber-900/40 flex items-center justify-between text-[12px] text-amber-800 dark:text-amber-300">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-[16px] text-amber-600 dark:text-amber-400">lock</span>
                  <span>Chế độ AI đang bật. Bạn chỉ có thể thêm ghi chú nội bộ (Khách không nhìn thấy).</span>
                </div>
                <button
                  type="button"
                  onClick={() => onTakeover(activeConv.id)}
                  className="px-2.5 py-0.5 bg-[#1664ff] hover:bg-[#3370ff] text-white rounded-md text-[11.5px] font-bold flex items-center gap-1 shadow-2xs transition-all cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[14px]">support_agent</span>
                  <span>Chuyển sang Nhân viên chat</span>
                </button>
              </div>
            )}

            {/* Borderless Textarea */}
            <div className="px-4 py-2">
            <textarea
                ref={textareaRef}
                value={messageText}
                onChange={(e) => handleMessageChange(e.target.value)}
                onBlur={() => { if (isStaffActive) sendTypingStatus(false); }}
                onKeyDown={handleKeyDown}
                placeholder={
                  !isStaffActive
                    ? 'AI đang tự động hỗ trợ khách. Bạn chỉ có thể thêm ghi chú nội bộ (Khách không nhìn thấy)...'
                    : composerMode === 'internal'
                      ? 'Nhập ghi chú nội bộ (chỉ nhân viên xem được)...'
                      : 'Nhập nội dung tin nhắn gửi khách hàng... (Nhấn Enter để gửi, Shift+Enter để xuống dòng)'
                }
                className="w-full text-[13.5px] bg-transparent text-[#1f2329] dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 resize-none focus:outline-none leading-relaxed select-text overflow-y-auto"
                style={{ minHeight: '48px', maxHeight: '160px' }}
              />
            </div>

            {/* Action Bar Bottom */}
            <div className="px-4 pb-2.5 pt-0.5 flex items-center justify-between">
              <div className="flex items-center gap-2 text-slate-400 dark:text-slate-500 text-[12px]">
                <button
                  type="button"
                  onClick={() => setShowMedia((value) => !value)}
                  className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-slate-200 transition-colors cursor-pointer"
                  title="Đính kèm tệp tin"
                >
                  <span className="material-symbols-outlined text-[18px]">attach_file</span>
                </button>
                <button
                  type="button"
                  onClick={() => setMessageText((prev) => `${prev} 😊 `)}
                  className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-slate-200 transition-colors cursor-pointer"
                  title="Chèn biểu tượng cảm xúc"
                >
                  <span className="material-symbols-outlined text-[18px]">sentiment_satisfied</span>
                </button>
                <span className="hidden sm:inline text-slate-400 dark:text-slate-500 text-[11.5px]">Nhấn Enter để lưu</span>
              </div>

              {showMedia && <div className="absolute bottom-14 left-4 right-4 z-10 flex gap-2 rounded-lg border border-slate-200 bg-white p-2 shadow-lg dark:border-slate-700 dark:bg-slate-900">
                <select aria-label="Loại tệp Meta" value={mediaType} onChange={(e) => setMediaType(e.target.value as typeof mediaType)} className="rounded border px-2 text-xs dark:bg-slate-800">
                  <option value="image">Ảnh</option><option value="video">Video</option><option value="audio">Audio</option><option value="file">Tệp</option>
                </select>
                <input aria-label="URL media HTTPS" value={mediaUrl} onChange={(e) => setMediaUrl(e.target.value)} placeholder="https://... (URL công khai)" className="min-w-0 flex-1 rounded border px-2 text-xs dark:bg-slate-800" type="url" />
              </div>}

              <motion.button
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.96 }}
                type="button"
                onClick={handleSend}
                disabled={!messageText.trim() || isSending}
                className={`px-4 py-1.5 rounded-xl text-[13px] font-bold flex items-center gap-1.5 transition-all shadow-md cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                  !isStaffActive || composerMode === 'internal'
                    ? 'bg-amber-600 hover:bg-amber-700 text-white shadow-amber-600/20'
                    : 'bg-gradient-to-r from-[#1664ff] to-[#3370ff] hover:from-[#3370ff] hover:to-[#1664ff] text-white shadow-blue-500/25'
                }`}
              >
                <span>{!isStaffActive || composerMode === 'internal' ? 'Lưu ghi chú nội bộ' : 'Gửi tin'}</span>
                <span className="material-symbols-outlined text-[16px]">
                  {!isStaffActive || composerMode === 'internal' ? 'lock' : 'send'}
                </span>
              </motion.button>
            </div>
          </div>
        </footer>
      </main>
      )}

      {/* ================= RESIZE HANDLE 2: SUBTLE SPLITTER ================= */}
      {isDossierOpen && activeConv && (
        <div
          onMouseDown={() => setIsDraggingDossier(true)}
          className={`w-1 h-full cursor-col-resize hover:bg-[#1664ff]/40 active:bg-[#1664ff] transition-colors z-20 select-none shrink-0 ${
            isDraggingDossier ? 'bg-[#1664ff]' : 'bg-transparent'
          }`}
          title="Kéo sang trái / phải để thay đổi độ rộng Hồ sơ khách hàng"
        />
      )}

      {/* ================= COLUMN 3: CUSTOMER DOSSIER (Bento Glassmorphism & Spring Expand/Collapse) ================= */}
      {activeConv && (
      <motion.aside
        initial={false}
        animate={{
          width: isDossierOpen ? dossierWidth : 0,
          opacity: isDossierOpen ? 1 : 0,
        }}
        transition={{ type: 'spring', stiffness: 360, damping: 32 }}
        className="h-full flex flex-col bg-white/75 dark:bg-[#0c1220]/90 backdrop-blur-xl border-l border-slate-200/80 dark:border-slate-800/80 shrink-0 select-none overflow-hidden relative shadow-[-4px_0_24px_rgba(0,0,0,0.02)] dark:shadow-[-4px_0_24px_rgba(0,0,0,0.4)]"
        style={{ willChange: 'width, opacity' }}
      >
        <div style={{ width: `${dossierWidth}px` }} className="h-full flex flex-col overflow-y-auto custom-scrollbar min-w-0">
          {/* Header */}
          <div className="h-14 px-4 border-b border-slate-200/60 dark:border-slate-800/60 flex items-center justify-between shrink-0 bg-white/40 dark:bg-[#0c1220]/60">
            <h4 className="font-bold text-[13.5px] text-[#1f2329] dark:text-slate-100 tracking-tight">Hồ sơ khách hàng</h4>
            <button
              onClick={() => setIsDossierOpen(false)}
              className="w-7 h-7 rounded-lg text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center transition-colors cursor-pointer"
              title="Đóng hồ sơ"
              type="button"
            >
              <span className="material-symbols-outlined text-[18px]">close</span>
            </button>
          </div>

          <div className="p-4 space-y-3.5">
            {/* Customer Avatar & Hero Bento Card */}
            <div className="text-center p-4 rounded-2xl bg-white/80 dark:bg-[#131b2e]/80 border border-slate-200/80 dark:border-slate-800/80 shadow-2xs">
              <img
                src={activeConv.customerAvatar}
                alt={activeConv.customerName}
                className="w-14 h-14 rounded-full mx-auto mb-2 object-cover border-2 border-white dark:border-slate-800 shadow-sm ring-2 ring-blue-500/20"
              />
              <h3 className="font-bold text-[15px] text-[#1f2329] dark:text-slate-100 tracking-tight">{activeConv.customerName}</h3>
              <p className="text-[12px] text-slate-500 dark:text-slate-400 font-medium mb-2">{activeConv.customerCompany}</p>
              <span className="inline-block px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-50 dark:bg-blue-950/60 text-[#1664ff] dark:text-blue-400 border border-blue-200/70 dark:border-blue-800/70 shadow-2xs">
                {activeConv.clientTier}
              </span>
            </div>

            {/* Contact Details Bento Card */}
            <div className="p-3.5 rounded-2xl bg-white/80 dark:bg-[#131b2e]/80 border border-slate-200/80 dark:border-slate-800/80 shadow-2xs space-y-2">
              <h5 className="font-bold text-[11px] text-slate-400 dark:text-slate-400 uppercase tracking-wider">
                Thông tin liên lạc
              </h5>

              {/* Email */}
              <div
                onClick={() => copyToClipboard(activeConv.customerEmail, 'Email')}
                className="group flex items-center justify-between p-1.5 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/60 cursor-pointer transition-colors"
                title="Bấm để sao chép Email"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="material-symbols-outlined text-slate-400 group-hover:text-[#1664ff] dark:group-hover:text-blue-400 text-[16px]">
                    mail
                  </span>
                  <span className="text-[12px] text-slate-700 dark:text-slate-300 font-medium truncate">
                    {activeConv.customerEmail || 'Email: Chưa cung cấp'}
                  </span>
                </div>
                <span className="material-symbols-outlined text-slate-400 opacity-0 group-hover:opacity-100 text-[15px] transition-opacity">
                  content_copy
                </span>
              </div>

              {/* Phone */}
              <div
                onClick={() => copyToClipboard(activeConv.customerPhone, 'Số điện thoại')}
                className="group flex items-center justify-between p-1.5 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/60 cursor-pointer transition-colors"
                title="Bấm để sao chép Số điện thoại"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="material-symbols-outlined text-slate-400 group-hover:text-[#1664ff] dark:group-hover:text-blue-400 text-[16px]">
                    call
                  </span>
                  <span className="text-[12px] text-slate-700 dark:text-slate-300 font-medium truncate">
                    {activeConv.customerPhone || 'Số điện thoại: Chưa cung cấp'}
                  </span>
                </div>
                <span className="material-symbols-outlined text-slate-400 opacity-0 group-hover:opacity-100 text-[15px] transition-opacity">
                  content_copy
                </span>
              </div>

              {/* Location */}
              <div className="flex items-center gap-2.5 p-1.5 text-slate-700 dark:text-slate-300">
                <span className="material-symbols-outlined text-slate-400 text-[16px]">location_on</span>
                <span className="text-[12px] font-medium">{activeConv.customerLocation || 'Địa chỉ: Chưa cung cấp'}</span>
              </div>

              {/* Website */}
              <div className="flex items-center justify-between p-1.5">
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="material-symbols-outlined text-slate-400 text-[16px]">language</span>
                  <a
                    href={activeConv.websiteUrl || undefined}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[12px] text-[#1664ff] dark:text-blue-400 hover:underline font-medium truncate"
                  >
                    {activeConv.websiteUrl || 'Website: Chưa cung cấp'}
                  </a>
                </div>
                <span className="material-symbols-outlined text-slate-400 text-[15px]">open_in_new</span>
              </div>
            </div>

            {/* Session & Device Info Bento Card */}
            <div className="p-3.5 rounded-2xl bg-white/80 dark:bg-[#131b2e]/80 border border-slate-200/80 dark:border-slate-800/80 shadow-2xs space-y-1.5 text-[12px]">
              <h5 className="font-bold text-[11px] text-slate-400 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                Thông tin phiên chat
              </h5>

              <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 py-0.5">
                <span>Kênh tiếp nhận</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">{activeConv.channel}{activeConv.accountName ? ` · ${activeConv.accountName}` : ''}</span>
              </div>

              <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 py-0.5">
                <span>Trang đang xem</span>
                <span className="font-mono text-[11px] text-[#1664ff] dark:text-blue-400 truncate max-w-[150px]" title={activeConv.activeUrl}>
                  {activeConv.activeUrl}
                </span>
              </div>

              <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 py-0.5">
                <span>Thời gian trực tuyến</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">{activeConv.sessionDuration}</span>
              </div>

              <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 py-0.5">
                <span>Thiết bị</span>
                <span className="text-slate-800 dark:text-slate-200 font-medium">{activeConv.deviceInfo}</span>
              </div>
            </div>

            {/* CRM Tags Bento Card */}
            <div className="p-3.5 rounded-2xl bg-white/80 dark:bg-[#131b2e]/80 border border-slate-200/80 dark:border-slate-800/80 shadow-2xs space-y-2">
              <div className="flex items-center justify-between">
                <h5 className="font-bold text-[11px] text-slate-400 dark:text-slate-400 uppercase tracking-wider">Nhãn CRM</h5>
                <button
                  type="button"
                  onClick={() => setShowAddTag(!showAddTag)}
                  className="text-[11.5px] font-bold text-[#1664ff] dark:text-blue-400 hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[15px]">add</span>
                  <span>Thêm nhãn</span>
                </button>
              </div>

              <AnimatePresence>
                {showAddTag && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="flex items-center gap-1.5 pt-1 overflow-hidden"
                  >
                    <input
                      type="text"
                      value={newTagInput}
                      onChange={(e) => setNewTagInput(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleAddTag()}
                      placeholder="Tên nhãn mới..."
                      className="flex-1 px-2.5 py-1 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-[12px] text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:border-[#1664ff]"
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={handleAddTag}
                      className="px-2.5 py-1 bg-[#1664ff] text-white rounded-xl text-[12px] font-semibold hover:bg-[#3370ff] transition-colors cursor-pointer"
                    >
                      Lưu
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="flex flex-wrap gap-1.5 pt-0.5">
                {currentTags.map((tag, i) => (
                  <span
                    key={i}
                    className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800/90 hover:bg-blue-50 dark:hover:bg-blue-900/40 hover:text-[#1664ff] dark:hover:text-blue-400 text-slate-800 dark:text-slate-300 text-[11px] font-medium transition-colors group border border-slate-200/60 dark:border-slate-700/60"
                  >
                    <span>{tag}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveTag(tag)}
                      className="text-slate-400 hover:text-rose-500 font-bold ml-0.5 transition-colors cursor-pointer"
                      title="Gỡ nhãn"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            </div>

            {/* Suggested Knowledge Bento Card */}
            <div className="p-3.5 rounded-2xl bg-white/80 dark:bg-[#131b2e]/80 border border-slate-200/80 dark:border-slate-800/80 shadow-2xs space-y-2">
              <h5 className="font-bold text-[11px] text-slate-400 dark:text-slate-400 uppercase tracking-wider">
                Tri thức AI gợi ý
              </h5>

              {activeConv.ragCitations && activeConv.ragCitations.length > 0 ? (
                <div className="space-y-2">
                  {activeConv.ragCitations.map((doc, idx) => (
                    <motion.div
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      key={idx}
                      className="p-2.5 rounded-xl bg-slate-50/80 dark:bg-[#0c1220]/80 hover:bg-blue-50/70 dark:hover:bg-blue-950/40 border border-slate-200/70 dark:border-slate-800/80 hover:border-blue-300 dark:hover:border-blue-700 transition-all cursor-pointer group shadow-2xs"
                      onClick={() => {
                        handleMacroInsert(`Trích đoạn tri thức [${doc.title}]: ${doc.excerpt}`);
                      }}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-bold text-slate-800 dark:text-slate-200 group-hover:text-[#1664ff] dark:group-hover:text-blue-400 truncate text-[12px]">
                          {doc.title}
                        </span>
                        <span className="text-[9.5px] font-mono text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-1.5 py-0.2 rounded-full font-bold shrink-0 ml-1 border border-emerald-200/60 dark:border-emerald-800/60">
                          {doc.similarity}
                        </span>
                      </div>
                      <p className="text-[11.5px] text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed">
                        {doc.excerpt}
                      </p>
                    </motion.div>
                  ))}
                </div>
              ) : (
                <p className="text-slate-400 text-[12px]">Chưa có tài liệu trích xuất cho ca này.</p>
              )}
            </div>
          </div>
        </div>
      </motion.aside>
      )}
    </div>
  );
};
