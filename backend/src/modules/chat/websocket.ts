import type { Server as HttpServer, IncomingMessage } from 'node:http';
import { WebSocketServer, WebSocket } from 'ws';
import { pool, transaction, scope } from '../../core/db.js';
import { digest, uuid } from '../../core/security.js';
import { realtimeHub } from './realtime.js';
import { appendMessage, takeover } from './chat-store.js';
import { enqueueJob } from '../jobs/jobs.js';

interface ClientContext {
  clientId: string;
  isVisitor: boolean;
  workspaceId: string;
  conversationId?: string;
  userId?: string;
  visitorId?: string;
  userName?: string;
  role?: string;
  channelIds?: Set<string>;
}

export function initWebSocketServer(server: HttpServer): WebSocketServer {
  const wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', (ws: WebSocket, req: IncomingMessage) => {
    let ctx: ClientContext | null = null;
    const clientId = uuid();
    const pendingFrames: (Buffer | string)[] = [];
    let isReady = false;

    const processFrame = async (data: Buffer | string, clientCtx: ClientContext) => {
      try {
        const raw = typeof data === 'string' ? data : data.toString('utf8');
        const msg = JSON.parse(raw);

        switch (msg.type || msg.event) {
          case 'ping': {
            ws.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
            break;
          }

          case 'subscribe': {
            if (msg.conversationId) {
              // SECURITY: For staff clients, check if they have permission to access the conversation's channel
              if (!clientCtx.isVisitor && clientCtx.userId) {
                const hasAccess = await transaction(async db => {
                  await scope(db, clientCtx.workspaceId);
                  const accessCheck = await db.query(
                    `SELECT c.id, c.channel_id FROM conversations c
                     JOIN channels h ON h.id = c.channel_id
                     WHERE c.workspace_id = $1 AND c.id = $2 AND h.enabled
                       AND ($3::boolean OR EXISTS (SELECT 1 FROM channel_members m WHERE m.workspace_id = c.workspace_id AND m.channel_id = c.channel_id AND m.user_id = $4))`,
                    [clientCtx.workspaceId, msg.conversationId, ['Owner', 'Admin'].includes(clientCtx.role || ''), clientCtx.userId]
                  );
                  return (accessCheck.rowCount ?? 0) > 0;
                });
                if (!hasAccess) {
                  ws.send(JSON.stringify({
                    type: 'error',
                    code: 'FORBIDDEN',
                    message: 'Không có quyền truy cập hội thoại này',
                  }));
                  break;
                }
              }

              clientCtx.conversationId = msg.conversationId;
              realtimeHub.updateClientConversation(clientId, msg.conversationId);
              ws.send(JSON.stringify({
                type: 'subscribed',
                conversationId: msg.conversationId,
                timestamp: new Date().toISOString(),
              }));
            }
            break;
          }

          case 'typing': {
            const convId = clientCtx.isVisitor ? clientCtx.conversationId : (msg.conversationId || clientCtx.conversationId);
            if (convId) {
              realtimeHub.broadcastToConversation(convId, 'typing', {
                conversationId: convId,
                actorId: clientCtx.isVisitor ? clientCtx.visitorId : clientCtx.userId,
                actorType: clientCtx.isVisitor ? 'visitor' : 'agent',
                isTyping: Boolean(msg.isTyping),
                timestamp: new Date().toISOString(),
              });
            }
            break;
          }

          case 'message:send': {
            // SECURITY: Re-verify that staff user still has an active membership
            if (!clientCtx.isVisitor && clientCtx.userId) {
              const isMemActive = await transaction(async db => {
                await scope(db, clientCtx.workspaceId);
                const checkMem = await db.query(
                  'SELECT 1 FROM memberships WHERE workspace_id = $1 AND user_id = $2 AND active',
                  [clientCtx.workspaceId, clientCtx.userId]
                );
                return (checkMem.rowCount ?? 0) > 0;
              });
              if (!isMemActive) {
                ws.send(JSON.stringify({
                  type: 'error',
                  code: 'UNAUTHENTICATED',
                  message: 'Phiên làm việc đã bị thu hồi hoặc tài khoản bị vô hiệu hóa',
                }));
                ws.close(4003, 'Unauthorized: Revoked session');
                return;
              }
            }

            const body = typeof msg.body === 'string' ? msg.body.trim() : '';
            if (!body || body.length > 10000) {
              ws.send(JSON.stringify({
                type: 'error',
                code: 'INVALID_BODY',
                message: 'Nội dung tin nhắn không hợp lệ',
              }));
              return;
            }

            const convId = clientCtx.isVisitor ? clientCtx.conversationId : (msg.conversationId || clientCtx.conversationId);
            if (!convId) {
              ws.send(JSON.stringify({
                type: 'error',
                code: 'MISSING_CONVERSATION',
                message: 'Không tìm thấy cuộc hội thoại',
              }));
              return;
            }

            const msgClientId = msg.clientId || uuid();
            const visibility = (clientCtx.isVisitor || msg.visibility !== 'internal') ? 'public' : 'internal';
            const author = clientCtx.isVisitor ? 'visitor' : 'agent';
            const actor = clientCtx.isVisitor ? undefined : clientCtx.userId;
            const msgId = uuid();
            const nowIso = new Date().toISOString();

            // 1. ASYNCHRONOUS DATABASE PERSISTENCE & BROADCAST
            void (async () => {
              try {
                await transaction(async (db) => {
                  // Scope transaction to current tenant workspace for RLS isolation
                  await scope(db, clientCtx.workspaceId);

                  // Verify conversation ownership
                  const c = (await db.query(
                    'SELECT id, reply_owner, owner_version, status, assigned_to, channel_id FROM conversations WHERE id=$1 AND workspace_id=$2 FOR UPDATE',
                    [convId, clientCtx.workspaceId]
                  )).rows[0];

                  if (!c) throw new Error('CONVERSATION_NOT_FOUND');

                  // If staff sends public message, auto-takeover if not already assigned or not human active
                  if (!clientCtx.isVisitor && visibility === 'public' && (c.reply_owner !== 'HUMAN_ACTIVE' || c.assigned_to !== clientCtx.userId)) {
                    await takeover(db, clientCtx.workspaceId, convId, clientCtx.userId!, c.owner_version);
                    realtimeHub.broadcastToConversation(convId, 'conversation:takeover', {
                      conversationId: convId,
                      assignedTo: clientCtx.userId,
                      replyOwner: 'HUMAN_ACTIVE',
                      ownerVersion: c.owner_version + 1,
                    });
                    realtimeHub.broadcastToWorkspace(clientCtx.workspaceId, 'inbox:takeover', {
                      conversationId: convId,
                      assignedTo: clientCtx.userId,
                    }, { channelId: c.channel_id });
                  }

                  const savedMessage = await appendMessage(db, {
                    workspace: clientCtx.workspaceId,
                    conversation: convId,
                    clientId: msgClientId,
                    messageId: msgId,
                    body,
                    author,
                    actor,
                    visibility,
                  });

                  // Send confirmation ACK back to sender with confirmed sequence
                  ws.send(JSON.stringify({
                    type: 'message:ack',
                    clientId: msgClientId,
                    id: msgId,
                    sequence: savedMessage.sequence,
                    createdAt: savedMessage.created_at,
                  }));

                  // Broadcast real-time message event with real sequence
                  realtimeHub.broadcastToConversation(convId, 'message:new', {
                    id: msgId,
                    workspace_id: clientCtx.workspaceId,
                    conversation_id: convId,
                    client_id: msgClientId,
                    clientId: msgClientId,
                    sequence: savedMessage.sequence,
                    author_type: author,
                    actor_id: actor ?? null,
                    visibility,
                    body,
                    created_at: savedMessage.created_at,
                  });

                  // Broadcast summary to workspace inbox
                  realtimeHub.broadcastToWorkspace(clientCtx.workspaceId, clientCtx.isVisitor ? 'inbox:visitor_message' : 'inbox:message_sent', {
                    conversationId: convId,
                    messageSnippet: body.slice(0, 100),
                    author,
                    visibility,
                    createdAt: savedMessage.created_at,
                  }, { channelId: c.channel_id });

                  // If visitor and AI is active, enqueue AI job
                  if (clientCtx.isVisitor && c.reply_owner === 'AI_ACTIVE') {
                    await enqueueJob(db, clientCtx.workspaceId, {
                      kind: 'ai.reply',
                      key: `conversation:${convId}:message:${savedMessage.id}`,
                      payload: {
                        conversationId: convId,
                        messageId: savedMessage.id,
                        ownerVersion: c.owner_version,
                        requireGrounded: true,
                      },
                      external: false,
                    });
                  }
                });
              } catch (persistErr: any) {
                console.error('[WebSocket] Background persistence error:', persistErr?.message || persistErr);
                ws.send(JSON.stringify({
                  type: 'message:persist_error',
                  clientId: msgClientId,
                  id: msgId,
                  message: persistErr?.message || 'Lỗi lưu tin nhắn vào cơ sở dữ liệu',
                }));
              }
            })();
            break;
          }

          default:
            break;
        }
      } catch (err: any) {
        console.error('[WebSocket] Message handling error:', err);
        ws.send(JSON.stringify({
          type: 'error',
          message: err.message || 'Lỗi xử lý tin nhắn socket',
        }));
      }
    };

    // 1. ATTACH MESSAGE LISTENER IMMEDIATELY to prevent dropped frames during async auth
    ws.on('message', async (data: Buffer | string) => {
      if (!isReady || !ctx) {
        pendingFrames.push(data);
        return;
      }
      await processFrame(data, ctx);
    });

    // 2. ASYNCHRONOUS AUTHENTICATION
    void (async () => {
      try {
        const url = new URL(req.url || '', 'http://127.0.0.1');
        const token = url.searchParams.get('token');
        const roleParam = url.searchParams.get('role');

        // Determine client role: visitor or staff
        let role = roleParam;
        if (!role) {
          if (token && !req.headers.cookie?.includes('gotek_session')) {
            role = 'visitor';
          } else {
            role = 'staff';
          }
        }

        // Authenticate Visitor or Staff
        if (role === 'visitor') {
          if (!token) {
            ws.close(4001, 'Unauthorized: Missing visitor token');
            return;
          }

          const vRow = (await pool.query(
            `SELECT v.id, v.workspace_id, c.id AS conversation_id, v.channel_id,
                    c.status, c.reply_owner, c.owner_version
             FROM visitors v
             JOIN conversations c ON c.visitor_id = v.id AND c.workspace_id = v.workspace_id
             WHERE v.token_hash = $1 AND v.expires_at > now()
             ORDER BY c.created_at DESC LIMIT 1`,
            [digest(token)]
          )).rows[0];

          if (!vRow) {
            ws.close(4001, 'Unauthorized: Invalid or expired visitor token');
            return;
          }

          ctx = {
            clientId,
            isVisitor: true,
            workspaceId: vRow.workspace_id,
            conversationId: vRow.conversation_id,
            visitorId: vRow.id,
          };

          realtimeHub.registerWs(clientId, ctx.workspaceId, ws, ctx.conversationId, true);
          console.log(`[WebSocket] 🟢 Visitor connected (${clientId}) - Conv: ${vRow.conversation_id}, Workspace: ${vRow.workspace_id}`);

          ws.send(JSON.stringify({
            type: 'system:ready',
            role: 'visitor',
            conversationId: vRow.conversation_id,
            replyOwner: vRow.reply_owner,
            ownerVersion: vRow.owner_version,
            timestamp: new Date().toISOString(),
          }));
        } else {
          // Staff Authentication (via query token, Bearer Token, or Cookie)
          let sessionToken = token;
          if (!sessionToken && req.headers.authorization?.startsWith('Bearer ')) {
            sessionToken = req.headers.authorization.substring(7).trim();
          }
          if (!sessionToken && req.headers.cookie) {
            const match = req.headers.cookie.match(/gotek_session=([^;]+)/);
            if (match) sessionToken = decodeURIComponent(match[1]);
          }

          if (!sessionToken) {
            console.warn(`[WebSocket] ⚠️ Unauthorized connection attempt: Missing staff session`);
            ws.close(4001, 'Unauthorized: Missing staff session');
            return;
          }

          const sRow = (await pool.query(
            `SELECT s.user_id, s.workspace_id, m.role, u.full_name
             FROM sessions s
             JOIN memberships m ON m.user_id = s.user_id AND m.workspace_id = s.workspace_id AND m.active
             JOIN users u ON u.id = s.user_id
             WHERE s.token_hash = $1 AND s.expires_at > now()`,
            [digest(sessionToken)]
          )).rows[0];

          if (!sRow) {
            console.warn(`[WebSocket] ⚠️ Unauthorized connection attempt: Invalid staff session`);
            ws.close(4001, 'Unauthorized: Invalid staff session');
            return;
          }

          const channelIds = await transaction(async db => {
            await scope(db, sRow.workspace_id);
            const channelsRes = await db.query(
              'SELECT channel_id FROM channel_members WHERE workspace_id = $1 AND user_id = $2',
              [sRow.workspace_id, sRow.user_id]
            );
            return channelsRes.rows.map(r => r.channel_id);
          });

          ctx = {
            clientId,
            isVisitor: false,
            workspaceId: sRow.workspace_id,
            userId: sRow.user_id,
            userName: sRow.full_name,
            role: sRow.role,
            channelIds: new Set(channelIds),
          };

          realtimeHub.registerWs(clientId, ctx.workspaceId, ws, undefined, false, ctx.userId, ctx.role, channelIds);
          console.log(`[WebSocket] 🟢 Staff connected (${clientId}) - User: ${sRow.full_name} (${sRow.user_id}), Workspace: ${sRow.workspace_id}, Role: ${sRow.role}, Channels: ${channelIds.length}`);

          ws.send(JSON.stringify({
            type: 'system:ready',
            role: 'staff',
            userId: sRow.user_id,
            workspaceId: sRow.workspace_id,
            name: sRow.full_name,
            timestamp: new Date().toISOString(),
          }));
        }

        ws.on('close', () => {
          console.log(`[WebSocket] ⚪ Disconnected (${clientId})`);
        });

        // Authentication succeeded: drain queued frames immediately
        isReady = true;
        for (const queued of pendingFrames) {
          await processFrame(queued, ctx);
        }
      } catch (connErr) {
        console.error('[WebSocket] Connection initialization error:', connErr);
        ws.close(1011, 'Internal Server Error');
      }
    })();
  });

  return wss;
}
