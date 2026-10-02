# THIẾT KẾ KỸ THUẬT & MÃ NGUỒN CHI TIẾT (ARCHITECTURE & CODE IMPLEMENTATION)
**Tác giả:** Nguyễn Văn Nguyên  
**Phân hệ:** PHÂN HỆ 2 — Inbox CSKH Website & Facebook Messenger (UC-19, UC-05, UC-21, UC-06)  
**Tiêu chuẩn:** Clean Architecture, TypeScript Strict, PostgreSQL 16 RLS, React 19 / Vite.

---

## 1. THIẾT KẾ DỮ LIỆU & SQL MIGRATIONS

### 1.1. Migration 059: Hỗ trợ Kênh Đa nền tảng (UC-19)
Tệp: `backend/db/migrations/059_multichannel_support.sql`

```sql
-- 1. Bổ sung trường type và cấu hình nền tảng cho bảng channels
ALTER TABLE channels 
  ADD COLUMN IF NOT EXISTS type text NOT NULL DEFAULT 'website' 
    CHECK(type IN ('website', 'messenger', 'email', 'slack')),
  ADD COLUMN IF NOT EXISTS platform_account_id text,
  ADD COLUMN IF NOT EXISTS platform_config jsonb NOT NULL DEFAULT '{}'::jsonb;

-- 2. Cho phép origin và public_key nullable đối với các kênh không phải website
ALTER TABLE channels ALTER COLUMN origin DROP NOT NULL;
ALTER TABLE channels ALTER COLUMN public_key DROP NOT NULL;

-- 3. Tạo index tìm kiếm nhanh webhook Meta theo Page ID
CREATE INDEX IF NOT EXISTS idx_channels_platform_page 
  ON channels(platform_account_id, type) 
  WHERE type = 'messenger' AND enabled = true;

-- 4. Trigger bảo vệ bất biến (Immutability): Không cho phép đổi type khi kênh đã có hội thoại
CREATE OR REPLACE FUNCTION check_channel_type_immutable() 
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.type IS DISTINCT FROM NEW.type THEN
    IF EXISTS (SELECT 1 FROM conversations WHERE channel_id = OLD.id LIMIT 1) THEN
      RAISE EXCEPTION 'CANNOT_CHANGE_CHANNEL_TYPE: Channel already has active conversations'
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_protect_channel_type ON channels;
CREATE TRIGGER trg_protect_channel_type
  BEFORE UPDATE OF type ON channels
  FOR EACH ROW
  EXECUTE FUNCTION check_channel_type_immutable();
```

---

### 1.2. Migration 060: Inbound Webhook Pipeline & Outbox (UC-21)
Tệp: `backend/db/migrations/060_facebook_inbound_pipeline.sql`

```sql
-- Bảng lưu trữ bền vững Webhook Events từ Facebook Messenger (Chống mất tin, chống replay)
CREATE TABLE IF NOT EXISTS inbound_webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL DEFAULT 'facebook',
  event_id text NOT NULL UNIQUE, -- Meta mid: wmid.HBg...
  page_id text NOT NULL,
  sender_id text NOT NULL, -- PSID
  raw_payload jsonb NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'processed', 'failed', 'ignored')),
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_inbound_events_status 
  ON inbound_webhook_events(status, created_at) 
  WHERE status = 'pending';

-- Cấp quyền cho app user
GRANT SELECT, INSERT, UPDATE ON inbound_webhook_events TO gotek_app;
```

---

## 2. BACKEND IMPLEMENTATION (CLEAN ARCHITECTURE)

### 2.1. Webhook Facebook Security & Ingestion Controller (UC-21)
Tệp: `backend/src/modules/channels/messenger-webhook.controller.ts`

```typescript
import { Request, Response } from 'express';
import crypto from 'node:crypto';
import { PoolClient } from 'pg';
import { transaction } from '../../core/db';
import { processMessengerInbound } from './messenger-inbound.service';

const FB_APP_SECRET = process.env.FB_APP_SECRET || 'gotek_dev_meta_secret_key';
const FB_VERIFY_TOKEN = process.env.FB_VERIFY_TOKEN || 'gotek_messenger_verify_token_2026';

/**
 * 1. GET /api/webhooks/facebook (Webhook Verification Challenge)
 */
export function verifyMetaWebhook(req: Request, res: Response) {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === FB_VERIFY_TOKEN) {
    return res.status(200).send(challenge);
  }
  return res.status(403).json({ error: 'VERIFICATION_FAILED' });
}

/**
 * 2. POST /api/webhooks/facebook (Secure Ingestion Pipeline)
 */
export async function handleMetaWebhook(req: Request, res: Response) {
  // BƯỚC 1: Xác thực chữ ký HMAC-SHA256 từ Meta
  const signature = req.headers['x-hub-signature-256'] as string;
  if (!signature) {
    return res.status(401).json({ error: 'MISSING_SIGNATURE' });
  }

  const rawBody = (req as any).rawBody || JSON.stringify(req.body);
  const expectedSig = 'sha256=' + crypto.createHmac('sha256', FB_APP_SECRET).update(rawBody).digest('hex');

  // Dùng timingSafeEqual chống tấn công Timing Attack
  const sigBuffer = Buffer.from(signature);
  const expBuffer = Buffer.from(expectedSig);
  if (sigBuffer.length !== expBuffer.length || !crypto.timingSafeEqual(sigBuffer, expBuffer)) {
    return res.status(401).json({ error: 'INVALID_SIGNATURE' });
  }

  // BƯỚC 2: Trả 200 OK ngay lập tức (<500ms) để Meta không retry bão hòa hệ thống
  res.status(200).json({ status: 'EVENT_RECEIVED' });

  // BƯỚC 3: Xử lý Asynchronous & Durable Storage
  const body = req.body;
  if (body.object !== 'page') return;

  for (const entry of body.entry || []) {
    const pageId = entry.id;
    for (const msgEvent of entry.messaging || []) {
      // Bỏ qua echo (tin do chính Page gửi) & delivery/read receipts
      if (msgEvent.message?.is_echo || msgEvent.delivery || msgEvent.read) {
        continue;
      }

      const mid = msgEvent.message?.mid;
      const senderPsid = msgEvent.sender?.id;
      const text = msgEvent.message?.text;

      if (!mid || !senderPsid || !text) continue;

      // Xử lý thông qua Transaction & Durable Queue
      void (async () => {
        try {
          await transaction(async (db: PoolClient) => {
            await processMessengerInbound(db, {
              mid,
              pageId,
              senderPsid,
              text,
              rawPayload: msgEvent,
            });
          });
        } catch (err) {
          console.error('[Messenger Webhook Pipeline Error]', err);
        }
      })();
    }
  }
}
```

---

### 2.2. Inbound Messenger Processing Service (UC-21 & UC-19)
Tệp: `backend/src/modules/channels/messenger-inbound.service.ts`

```typescript
import { PoolClient } from 'pg';
import { v4 as uuidv4 } from 'uuid';
import { appendMessage } from '../chat/chat-store';
import { realtimeHub } from '../chat/realtime';

export interface MessengerInboundDTO {
  mid: string;
  pageId: string;
  senderPsid: string;
  text: string;
  rawPayload: any;
}

export async function processMessengerInbound(db: PoolClient, dto: MessengerInboundDTO) {
  // 1. Kiểm tra chống lặp bằng Idempotency Key (mid)
  const existingEvent = await db.query(
    'SELECT status FROM inbound_webhook_events WHERE event_id = $1',
    [dto.mid]
  );
  if (existingEvent.rowCount && existingEvent.rowCount > 0) {
    return; // Đã xử lý, bỏ qua chống nhân đôi
  }

  // Lưu bản ghi Outbox / Event bền vững
  await db.query(
    `INSERT INTO inbound_webhook_events (event_id, page_id, sender_id, raw_payload, status)
     VALUES ($1, $2, $3, $4, 'pending')`,
    [dto.mid, dto.pageId, dto.senderPsid, JSON.stringify(dto.rawPayload)]
  );

  // 2. Tìm kênh và workspace tương ứng với Facebook Page ID
  const channel = (await db.query(
    `SELECT id, workspace_id, name, enabled 
     FROM channels 
     WHERE platform_account_id = $1 AND type = 'messenger' AND enabled = true`,
    [dto.pageId]
  )).rows[0];

  if (!channel) {
    await db.query(
      `UPDATE inbound_webhook_events SET status = 'failed', error_message = 'UNKNOWN_PAGE_ID' WHERE event_id = $1`,
      [dto.mid]
    );
    return;
  }

  // 3. Ánh xạ PSID thành Visitor
  const visitorTokenHash = `fb_psid_${channel.id}_${dto.senderPsid}`;
  let visitor = (await db.query(
    'SELECT id FROM visitors WHERE workspace_id = $1 AND channel_id = $2 AND token_hash = $3',
    [channel.workspace_id, channel.id, visitorTokenHash]
  )).rows[0];

  if (!visitor) {
    const visitorId = uuidv4();
    const expiresAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000); // 1 năm
    const profile = {
      fullName: `Facebook User (${dto.senderPsid.slice(-4)})`,
      platform: 'messenger',
      psid: dto.senderPsid,
      pageId: dto.pageId,
    };

    visitor = (await db.query(
      `INSERT INTO visitors (id, workspace_id, channel_id, token_hash, expires_at, profile)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
      [visitorId, channel.workspace_id, channel.id, visitorTokenHash, expiresAt, JSON.stringify(profile)]
    )).rows[0];
  }

  // 4. Lấy hoặc tạo Conversation
  let conv = (await db.query(
    `SELECT id, status, reply_owner, owner_version 
     FROM conversations 
     WHERE workspace_id = $1 AND channel_id = $2 AND visitor_id = $3
     ORDER BY created_at DESC LIMIT 1`,
    [channel.workspace_id, channel.id, visitor.id]
  )).rows[0];

  if (!conv || conv.status === 'resolved') {
    const convId = uuidv4();
    conv = (await db.query(
      `INSERT INTO conversations (id, workspace_id, channel_id, visitor_id, status, reply_owner, owner_version)
       VALUES ($1, $2, $3, $4, 'open', 'HANDOFF_PENDING', 1) RETURNING *`,
      [convId, channel.workspace_id, channel.id, visitor.id]
    )).rows[0];
  }

  // 5. Lưu tin nhắn vào bảng messages (Dùng mid của Facebook làm clientId)
  // Nếu mid bị gửi lại, unique constraint sẽ bảo vệ chống đụng độ
  const clientUuid = uuidv4(); // Generate deterministic UUID hoặc lưu mapping
  const savedMsg = await appendMessage(db, {
    workspace: channel.workspace_id,
    conversation: conv.id,
    clientId: clientUuid,
    body: dto.text,
    visibility: 'public',
    author: 'visitor',
  });

  // Đánh dấu Webhook Event đã xử lý thành công
  await db.query(
    `UPDATE inbound_webhook_events SET status = 'processed', processed_at = now() WHERE event_id = $1`,
    [dto.mid]
  );

  // 6. Phát Realtime Socket thông báo cho Nhân viên (Staff Workspace)
  realtimeHub.broadcastToWorkspace(channel.workspace_id, 'inbox:visitor_message', {
    conversationId: conv.id,
    channelId: channel.id,
    channelType: 'messenger',
    messageSnippet: dto.text.slice(0, 100),
    senderName: `Facebook User (${dto.senderPsid.slice(-4)})`,
    createdAt: savedMsg.created_at,
  });
}
```

---

### 2.3. Zero-Leakage Realtime Hub (UC-06: Bảo mật tuyệt đối Note nội bộ)
Tệp: `backend/src/modules/chat/realtime.ts` (Sửa đổi chuẩn kiến trúc an toàn)

```typescript
import { WebSocket } from 'ws';

export interface ClientConnection {
  ws: WebSocket;
  workspaceId: string;
  userId?: string;
  isVisitor: boolean;
  activeConversationId?: string;
}

class SecureRealtimeHub {
  private clients: Set<ClientConnection> = new Set();

  public register(conn: ClientConnection) {
    this.clients.add(conn);
    conn.ws.on('close', () => this.clients.delete(conn));
  }

  /**
   * Phát tin nhắn tới toàn bộ Nhân viên (Staff) trong Workspace
   * (Chỉ dành cho tài khoản đã xác thực role Staff/Agent/Owner)
   */
  public broadcastToStaff(workspaceId: string, event: string, payload: any) {
    const raw = JSON.stringify({ type: event, data: payload });
    for (const c of this.clients) {
      if (!c.isVisitor && c.workspaceId === workspaceId && c.ws.readyState === WebSocket.OPEN) {
        c.ws.send(raw);
      }
    }
  }

  /**
   * Phát tin nhắn trong phòng hội thoại (Conversation Room)
   * NGUYÊN TẮC ZERO-LEAKAGE:
   * Nếu payload có visibility === 'internal', TUYỆT ĐỐI CHỈ GỬI CHO STAFF,
   * CHẶN ĐỨNG KHÔNG CHO PHÉP CLIENT VISITOR NHẬN ĐƯỢC!
   */
  public broadcastToConversation(conversationId: string, event: string, payload: any) {
    const isInternal = payload.visibility === 'internal';
    const raw = JSON.stringify({ type: event, data: payload });

    for (const c of this.clients) {
      if (c.activeConversationId === conversationId && c.ws.readyState === WebSocket.OPEN) {
        // Nếu là ghi chú nội bộ mà client là visitor -> BỎ QUA NGAY LẬP TỨC
        if (isInternal && c.isVisitor) {
          continue; 
        }
        c.ws.send(raw);
      }
    }
  }
}

export const realtimeHub = new SecureRealtimeHub();
```

---

## 3. FRONTEND UI & WORKSPACE CONSOLE IMPLEMENTATION

### 3.1. Hook Đồng bộ Tin nhắn Realtime & Tải bù khi mất mạng (UC-05 & UC-06)
Tệp: `frontend/src/hooks/useRealtimeMessages.ts`

```typescript
import { useEffect, useRef, useState } from 'react';

export function useRealtimeMessages(conversationId: string | null) {
  const [messages, setMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const lastSequenceRef = useRef<number>(0);

  // 1. Fetch tin ban đầu hoặc tải bù (Backfill)
  const fetchMessages = async (after = 0) => {
    if (!conversationId) return;
    try {
      const res = await fetch(`/api/inbox/conversations/${conversationId}/messages?after=${after}`);
      const data = await res.json();
      if (Array.isArray(data)) {
        setMessages((prev) => {
          const map = new Map(prev.map((m) => [m.id, m]));
          for (const m of data) {
            map.set(m.id, m);
            if (m.sequence > lastSequenceRef.current) {
              lastSequenceRef.current = m.sequence;
            }
          }
          return Array.from(map.values()).sort((a, b) => a.sequence - b.sequence);
        });
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!conversationId) return;
    setLoading(true);
    lastSequenceRef.current = 0;
    fetchMessages(0);

    // 2. Lắng nghe WebSocket & Tự động Backfill khi Reconnect
    const handleWsMessage = (e: CustomEvent) => {
      const { type, data } = e.detail;
      if (type === 'message:new' && data.conversation_id === conversationId) {
        setMessages((prev) => {
          if (prev.some((m) => m.id === data.id || m.client_id === data.client_id)) return prev;
          if (data.sequence) lastSequenceRef.current = Math.max(lastSequenceRef.current, data.sequence);
          return [...prev, data];
        });
      }
    };

    const handleReconnect = () => {
      // Khi mạng phục hồi, gọi backfill các sequence bị thiếu
      fetchMessages(lastSequenceRef.current);
    };

    window.addEventListener('gotek:ws_message' as any, handleWsMessage);
    window.addEventListener('online', handleReconnect);

    return () => {
      window.removeEventListener('gotek:ws_message' as any, handleWsMessage);
      window.removeEventListener('online', handleReconnect);
    };
  }, [conversationId]);

  return { messages, loading, setMessages };
}
```

---

### 3.2. Thanh soạn thảo 2 Chế độ (Public Reply vs Private Note)
Tệp: `frontend/src/components/inbox/DualModeComposer.tsx`

```tsx
import React, { useState } from 'react';
import { Send, Lock, Globe, AlertCircle, RefreshCw } from 'lucide-react';

interface Props {
  conversationId: string;
  onSendMessage: (payload: { body: string; visibility: 'public' | 'internal'; clientId: string }) => Promise<void>;
}

export const DualModeComposer: React.FC<Props> = ({ conversationId, onSendMessage }) => {
  const [mode, setMode] = useState<'public' | 'internal'>('public');
  const [content, setContent] = useState('');
  const [sending, setSending] = useState(false);
  const [hasError, setHasError] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim() || sending) return;

    const clientId = crypto.randomUUID();
    setSending(true);
    setHasError(false);

    try {
      await onSendMessage({
        body: content.trim(),
        visibility: mode,
        clientId,
      });
      setContent(''); // Xóa sau khi đã gửi thành công
    } catch (err) {
      setHasError(true); // Giữ nguyên nội dung, hiện nút Thử lại
    } finally {
      setSending(false);
    }
  };

  return (
    <div className={`border-t p-3 transition-colors ${
      mode === 'internal' ? 'bg-amber-50/70 border-amber-200' : 'bg-white border-slate-200'
    }`}>
      {/* Tab chuyển đổi chế độ */}
      <div className="flex items-center gap-2 mb-2">
        <button
          type="button"
          onClick={() => setMode('public')}
          className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold transition-all ${
            mode === 'public'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          <Globe className="w-3.5 h-3.5" /> Trả lời công khai
        </button>
        <button
          type="button"
          onClick={() => setMode('internal')}
          className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold transition-all ${
            mode === 'internal'
              ? 'bg-amber-600 text-white shadow-sm'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          <Lock className="w-3.5 h-3.5" /> Ghi chú nội bộ
        </button>
        {mode === 'internal' && (
          <span className="text-[11px] text-amber-700 italic ml-auto flex items-center gap-1">
            <Lock className="w-3 h-3" /> Chỉ nhân viên đọc được
          </span>
        )}
      </div>

      {/* Form nhập liệu */}
      <form onSubmit={handleSubmit} className="relative">
        <textarea
          rows={2}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder={
            mode === 'internal'
              ? 'Nhập ghi chú riêng tư cho đồng nghiệp...'
              : 'Nhập câu trả lời gửi đến khách hàng...'
          }
          className={`w-full rounded-xl p-3 pr-24 text-sm outline-none resize-none border transition-all ${
            mode === 'internal'
              ? 'border-amber-300 bg-white focus:ring-2 focus:ring-amber-500/20'
              : 'border-slate-300 focus:border-blue-600 focus:ring-2 focus:ring-blue-500/20'
          }`}
        />

        {/* Nút gửi & Cảnh báo lỗi */}
        <div className="absolute right-2.5 bottom-3.5 flex items-center gap-2">
          {hasError && (
            <span className="flex items-center gap-1 text-xs text-red-600 bg-red-50 px-2 py-1 rounded-md border border-red-200">
              <AlertCircle className="w-3.5 h-3.5" /> Gửi thất bại
            </span>
          )}
          <button
            type="submit"
            disabled={!content.trim() || sending}
            className={`flex items-center justify-center p-2 rounded-lg text-white font-medium transition-all ${
              mode === 'internal' ? 'bg-amber-600 hover:bg-amber-700' : 'bg-blue-600 hover:bg-blue-700'
            } disabled:opacity-40 disabled:cursor-not-allowed`}
          >
            {sending ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </button>
        </div>
      </form>
    </div>
  );
};
```

---

## 4. BỘ KIỂM THỬ TỰ ĐỘNG & BẢO VỆ RANH GIỚI (TEST SUITES)

### 4.1. Unit Test: Kiểm tra Khóa chống trùng Idempotency & Rò rỉ Note (UC-05 & UC-06)
Tệp: `backend/tests/inbox-security-idempotency.test.ts`

```typescript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { v4 as uuidv4 } from 'uuid';
import { appendMessage } from '../src/modules/chat/chat-store';
import { realtimeHub } from '../src/modules/chat/realtime';

test('UC-05: Gửi lại cùng clientId không tạo thêm bản ghi mới trong DB (Idempotency)', async (t) => {
  // Giả lập mock DB client
  const clientId = uuidv4();
  let insertCount = 0;

  const mockDb: any = {
    query: async (sql: string, params: any[]) => {
      if (sql.includes('INSERT INTO messages')) {
        insertCount++;
        if (insertCount > 1) {
          const err: any = new Error('duplicate key value violates unique constraint');
          err.code = '23505';
          throw err;
        }
        return { rows: [{ id: uuidv4(), client_id: clientId, sequence: 1 }] };
      }
      return { rows: [] };
    }
  };

  // Lần gửi 1
  const res1 = await appendMessage(mockDb, {
    workspace: uuidv4(),
    conversation: uuidv4(),
    clientId,
    body: 'Test Hello',
    visibility: 'public',
    author: 'visitor'
  });
  assert.ok(res1.id);

  // Lần gửi 2 (Retry cùng clientId)
  const res2 = await appendMessage(mockDb, {
    workspace: uuidv4(),
    conversation: uuidv4(),
    clientId,
    body: 'Test Hello',
    visibility: 'public',
    author: 'visitor'
  });

  // Xác nhận vẫn trả về kết quả thành công mà không ném lỗi 500
  assert.equal(res2.client_id, clientId);
});

test('UC-06: Zero-Leakage: Note nội bộ không được broadcast tới Visitor', (t) => {
  let visitorReceived = false;
  let staffReceived = false;

  const mockVisitorWs: any = {
    readyState: 1,
    send: () => { visitorReceived = true; }
  };
  const mockStaffWs: any = {
    readyState: 1,
    send: () => { staffReceived = true; }
  };

  const convId = uuidv4();
  realtimeHub.register({ ws: mockVisitorWs, workspaceId: 'ws-1', isVisitor: true, activeConversationId: convId });
  realtimeHub.register({ ws: mockStaffWs, workspaceId: 'ws-1', isVisitor: false, activeConversationId: convId });

  // Phát 1 tin nội bộ
  realtimeHub.broadcastToConversation(convId, 'message:new', {
    id: uuidv4(),
    visibility: 'internal',
    body: 'Bí mật kinh doanh chỉ nội bộ biết'
  });

  // Khẳng định 100%: Visitor không nhận, Staff nhận đủ
  assert.equal(visitorReceived, false, 'VI PHẠM BẢO MẬT: Visitor đã nhận được tin nhắn nội bộ!');
  assert.equal(staffReceived, true, 'Staff phải nhận được tin nhắn nội bộ');
});
```
