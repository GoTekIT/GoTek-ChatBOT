import { useEffect, useState, useRef } from 'react';
import { ChatMessage } from '../types';

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
  const [typingState, setTypingState] = useState<RealtimeTypingState>({ isTyping: false });
  const typingTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!conversationId) return;

    // Check if conversationId is a valid Postgres UUID
    const isValidUuid = UUID_REGEX.test(conversationId);
    if (!isValidUuid) {
      // For mock/demo conversations (e.g. conv-1), simulate local realtime readiness
      // and do not spam backend with non-UUID requests that cause 404s
      const timer = setTimeout(() => setIsConnected(true), 200);
      return () => {
        clearTimeout(timer);
        setIsConnected(false);
      };
    }

    // Connect to Backend SSE endpoint for real database conversations
    const streamUrl = `/api/inbox/conversations/${encodeURIComponent(conversationId)}/stream`;
    let eventSource: EventSource | null = null;
    let errorCount = 0;

    try {
      eventSource = new EventSource(streamUrl, { withCredentials: true });

      eventSource.addEventListener('system:connected', () => {
        setIsConnected(true);
        errorCount = 0;
      });

      eventSource.addEventListener('message:new', (event) => {
        try {
          const messageData = JSON.parse(event.data);
          onNewMessage?.({
            id: messageData.id || `msg-${Date.now()}`,
            senderType: messageData.author_type || messageData.senderType || 'visitor',
            senderName: messageData.author_type === 'ai' ? 'GoTek AI Copilot' : messageData.senderName || 'Khách hàng',
            content: messageData.body || messageData.content,
            timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
          });
        } catch (err) {
          console.warn('Realtime message parse error', err);
        }
      });

      eventSource.addEventListener('typing', (event) => {
        try {
          const typingData = JSON.parse(event.data);
          setTypingState({
            isTyping: typingData.isTyping,
            actorId: typingData.actorId,
            actorType: typingData.actorType,
          });

          // Automatically clear typing after 4 seconds of inactivity
          if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
          if (typingData.isTyping) {
            typingTimerRef.current = setTimeout(() => {
              setTypingState({ isTyping: false });
            }, 4000);
          }
        } catch {
          // Ignored
        }
      });

      eventSource.addEventListener('conversation:takeover', (event) => {
        try {
          const data = JSON.parse(event.data);
          onTakeover?.(data);
        } catch {
          // Ignored
        }
      });

      eventSource.addEventListener('conversation:status', (event) => {
        try {
          const data = JSON.parse(event.data);
          onStatusChange?.(data);
        } catch {
          // Ignored
        }
      });

      eventSource.onerror = () => {
        setIsConnected(false);
        errorCount++;
        // If the conversation is not found on backend (404) or server fails repeatedly,
        // close the EventSource to prevent browser from entering an infinite retry spam loop
        if (errorCount >= 2 && eventSource) {
          eventSource.close();
        }
      };
    } catch {
      setIsConnected(false);
    }

    return () => {
      if (eventSource) {
        eventSource.close();
      }
      setIsConnected(false);
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    };
  }, [conversationId, onNewMessage, onTakeover, onStatusChange]);

  // Function to broadcast typing status from current client to backend
  const sendTypingStatus = async (isTyping: boolean) => {
    if (!conversationId || !UUID_REGEX.test(conversationId)) return;
    try {
      await fetch(`/api/inbox/conversations/${encodeURIComponent(conversationId)}/typing`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ isTyping }),
      });
    } catch {
      // Best-effort
    }
  };

  return {
    isConnected,
    typingState,
    sendTypingStatus,
  };
}
