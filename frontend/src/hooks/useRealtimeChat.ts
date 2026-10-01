import { useEffect, useState, useRef } from 'react';
import { ChatMessage } from '../types';
import { getStoredToken } from '../api/api';

export interface RealtimeTypingState {
  isTyping: boolean;
  actorId?: string;
  actorType?: 'agent' | 'visitor' | 'system';
}

interface UseRealtimeChatOptions {
  conversationId: string;
  onNewMessage?: (message: ChatMessage) => void;
  onTakeover?: (data: { assignedTo: string; replyOwner: string }) => void;
  onStatusChange?: (data: { status: string }) => void;
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function useRealtimeChat({
  conversationId,
  onNewMessage,
  onTakeover,
  onStatusChange,
}: UseRealtimeChatOptions) {
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [transportType, setTransportType] = useState<'ws' | 'sse' | 'none'>('none');
  const [typingState, setTypingState] = useState<RealtimeTypingState>({ isTyping: false });
  const typingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  const onNewMessageRef = useRef(onNewMessage);
  const onTakeoverRef = useRef(onTakeover);
  const onStatusChangeRef = useRef(onStatusChange);

  useEffect(() => {
    onNewMessageRef.current = onNewMessage;
    onTakeoverRef.current = onTakeover;
    onStatusChangeRef.current = onStatusChange;
  });

  const parseAndDispatchMessage = (messageData: any) => {
    const authorType = messageData.author_type || messageData.author || messageData.senderType || 'visitor';
    let senderType: ChatMessage['senderType'] = 'customer';
    let senderName = messageData.senderName || 'Khách hàng';
    let senderRole = messageData.senderRole;

    if (authorType === 'visitor' || authorType === 'customer') {
      senderType = 'customer';
    } else if (authorType === 'ai') {
      senderType = 'ai';
      senderName = 'GoTek AI Copilot';
      senderRole = 'Neural Core';
    } else if (authorType === 'agent') {
      if (messageData.visibility === 'internal') {
        senderType = 'internal_note';
        senderRole = 'Chỉ nhân viên xem được';
      } else {
        senderType = 'agent';
        senderRole = 'Chuyên viên Hỗ trợ';
      }
    }

    onNewMessageRef.current?.({
      id: messageData.id || `msg-${Date.now()}`,
      clientId: messageData.client_id || messageData.clientId,
      senderType,
      senderName,
      senderRole,
      content: messageData.body || messageData.content,
      timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
    });
  };

  useEffect(() => {
    if (!conversationId) {
      setIsConnected(false);
      setTransportType('none');
      return;
    }

    const isValidUuid = UUID_REGEX.test(conversationId);
    if (!isValidUuid) {
      // Mock conversation
      const timer = setTimeout(() => {
        setIsConnected(true);
        setTransportType('ws');
      }, 100);
      return () => {
        clearTimeout(timer);
        setIsConnected(false);
      };
    }

    // Connect to Backend SSE endpoint for real database conversations
    const streamUrl = `/api/conversations/${encodeURIComponent(conversationId)}/stream`;
    let eventSource: EventSource | null = null;
    let ws: WebSocket | null = null;
    let isCleanedUp = false;

    // Connect via Full-Duplex WebSocket
    try {
      const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const token = getStoredToken();
      const wsUrl = `${wsProtocol}//${window.location.host}/ws?role=staff${token ? `&token=${encodeURIComponent(token)}` : ''}`;
      ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        if (isCleanedUp) return;
        setIsConnected(true);
        setTransportType('ws');
        // Subscribe to current conversation
        ws?.send(JSON.stringify({ type: 'subscribe', conversationId }));
      };

      ws.onmessage = (event: MessageEvent) => {
        if (isCleanedUp) return;
        try {
          const payload = JSON.parse(event.data);
          const type = payload.type || payload.event;

          if (type === 'message:new') {
            parseAndDispatchMessage(payload.data || payload);
          } else if (type === 'typing') {
            const typingData = payload.data || payload;
            setTypingState({
              isTyping: typingData.isTyping,
              actorId: typingData.actorId,
              actorType: typingData.actorType,
            });

            if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
            if (typingData.isTyping) {
              typingTimerRef.current = setTimeout(() => {
                setTypingState({ isTyping: false });
              }, 4000);
            }
          } else if (type === 'conversation:takeover') {
            onTakeoverRef.current?.(payload.data || payload);
          } else if (type === 'conversation:status') {
            onStatusChangeRef.current?.(payload.data || payload);
          } else if (type === 'conversation:ai_resumed') {
            onStatusChangeRef.current?.({ status: 'ai_active', ...(payload.data || payload) });
          }
        } catch (err) {
          console.warn('[WS] Parse error', err);
        }
      };

      ws.onerror = () => {
        // Fallback to SSE if WS fails
        if (!isConnected && !isCleanedUp) {
          startSseFallback();
        }
      };

      ws.onclose = () => {
        wsRef.current = null;
        if (!isCleanedUp) {
          setIsConnected(false);
          setTransportType('none');
        }
      };
    } catch {
      startSseFallback();
    }

    function startSseFallback() {
      if (isCleanedUp || eventSource) return;
      const streamUrl = `/api/inbox/conversations/${encodeURIComponent(conversationId)}/stream`;
      try {
        eventSource = new EventSource(streamUrl, { withCredentials: true });
        eventSource.onopen = () => {
          if (!isCleanedUp) {
            setIsConnected(true);
            setTransportType('sse');
          }
        };

        eventSource.addEventListener('message:new', (event) => {
          if (isCleanedUp) return;
          try {
            parseAndDispatchMessage(JSON.parse(event.data));
          } catch {}
        });

        eventSource.addEventListener('typing', (event) => {
          if (isCleanedUp) return;
          try {
            const typingData = JSON.parse(event.data);
            setTypingState({
              isTyping: typingData.isTyping,
              actorId: typingData.actorId,
              actorType: typingData.actorType,
            });
            if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
            if (typingData.isTyping) {
              typingTimerRef.current = setTimeout(() => setTypingState({ isTyping: false }), 4000);
            }
          } catch {}
        });

        eventSource.addEventListener('conversation:takeover', (event) => {
          if (isCleanedUp) return;
          try { onTakeoverRef.current?.(JSON.parse(event.data)); } catch {}
        });

        eventSource.addEventListener('conversation:status', (event) => {
          if (isCleanedUp) return;
          try { onStatusChangeRef.current?.(JSON.parse(event.data)); } catch {}
        });

        eventSource.onerror = () => {
          if (!isCleanedUp) {
            setIsConnected(false);
            setTransportType('none');
          }
        };
      } catch {
        setIsConnected(false);
        setTransportType('none');
      }
    }

    return () => {
      isCleanedUp = true;
      if (ws) {
        ws.close();
        wsRef.current = null;
      }
      if (eventSource) {
        eventSource.close();
      }
      setIsConnected(false);
      setTransportType('none');
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    };
  }, [conversationId]);

  // Fast Full-Duplex WebSocket Message Sender (with HTTP POST fallback)
  const sendMessageOverSocket = async (
    body: string,
    visibility: 'public' | 'internal' = 'public',
    clientId?: string
  ): Promise<boolean> => {
    if (!conversationId) return false;
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type: 'message:send',
        clientId: clientId || crypto.randomUUID(),
        conversationId,
        body,
        visibility,
      }));
      return true;
    }
    return false;
  };

  // Broadcast typing status via WebSocket (<1ms) with HTTP fallback
  const sendTypingStatus = async (isTyping: boolean) => {
    if (!conversationId || !UUID_REGEX.test(conversationId)) return;
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type: 'typing',
        isTyping,
        conversationId,
      }));
      return;
    }

    try {
      await fetch(`/api/conversations/${encodeURIComponent(conversationId)}/typing`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Gotek-Request': '1' },
        credentials: 'include',
        body: JSON.stringify({ isTyping }),
      });
    } catch {}
  };

  return {
    isConnected,
    transportType,
    typingState,
    sendMessageOverSocket,
    sendTypingStatus,
  };
}
