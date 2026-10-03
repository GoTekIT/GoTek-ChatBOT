import type { Request, Response } from 'express';
import { EventEmitter } from 'events';
import type { WebSocket } from 'ws';

export interface RealtimeEvent<T = unknown> {
  id?: string;
  event: string;
  data: T;
  timestamp: string;
}

interface SseClient {
  kind: 'sse';
  id: string;
  workspaceId: string;
  conversationId?: string;
  isVisitor?: boolean;
  userId?: string;
  role?: string;
  channelIds?: Set<string>;
  res: Response;
  req: Request;
}

interface WsClient {
  kind: 'ws';
  id: string;
  workspaceId: string;
  conversationId?: string;
  isVisitor?: boolean;
  userId?: string;
  role?: string;
  channelIds?: Set<string>;
  ws: WebSocket;
}

type RealtimeClient = SseClient | WsClient;

class RealtimeHub extends EventEmitter {
  private clients: Map<string, RealtimeClient> = new Map();
  private heartbeatInterval: NodeJS.Timeout | null = null;

  constructor() {
    super();
    this.setMaxListeners(200);
    this.startHeartbeat();
  }

  /**
   * Keep connections alive by sending standard SSE comments or WS pings every 25 seconds.
   * Prevents proxy/ingress drop-outs (such as Nginx proxy_read_timeout).
   */
  private startHeartbeat() {
    if (this.heartbeatInterval) return;
    this.heartbeatInterval = setInterval(() => {
      const pingComment = `: ping - ${new Date().toISOString()}\n\n`;
      for (const client of this.clients.values()) {
        try {
          if (client.kind === 'sse') {
            client.res.write(pingComment);
          } else if (client.kind === 'ws' && client.ws.readyState === 1) { // 1 = OPEN
            client.ws.ping();
          }
        } catch {
          this.removeClient(client.id);
        }
      }
    }, 25000);

    if (this.heartbeatInterval.unref) {
      this.heartbeatInterval.unref();
    }
  }

  /**
   * Register a new SSE subscriber connection.
   */
  public register(
    clientId: string,
    workspaceId: string,
    res: Response,
    req: Request,
    conversationId?: string,
    isVisitor = false,
    userId?: string,
    role?: string,
    channelIds?: string[]
  ): void {
    // Send SSE response headers
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no', // Critical for Nginx reverse proxy streaming
      'Access-Control-Allow-Origin': req.get('origin') || '*',
    });

    res.flushHeaders?.();

    const client: SseClient = {
      kind: 'sse',
      id: clientId,
      workspaceId,
      conversationId,
      isVisitor,
      userId,
      role,
      channelIds: channelIds ? new Set(channelIds) : undefined,
      res,
      req,
    };

    this.clients.set(clientId, client);

    // Send initial connected acknowledgement event
    this.sendToClient(client, {
      event: 'system:connected',
      data: {
        clientId,
        workspaceId,
        conversationId: conversationId || null,
        message: 'GoTek Realtime Event Stream Connected',
      },
      timestamp: new Date().toISOString(),
    });

    // Cleanup on client disconnection
    req.on('close', () => {
      this.removeClient(clientId);
    });

    req.on('error', () => {
      this.removeClient(clientId);
    });
  }

  /**
   * Register a new WebSocket subscriber connection.
   */
  public registerWs(
    clientId: string,
    workspaceId: string,
    ws: WebSocket,
    conversationId?: string,
    isVisitor = false,
    userId?: string,
    role?: string,
    channelIds?: string[]
  ): void {
    const client: WsClient = {
      kind: 'ws',
      id: clientId,
      workspaceId,
      conversationId,
      isVisitor,
      userId,
      role,
      channelIds: channelIds ? new Set(channelIds) : undefined,
      ws,
    };

    this.clients.set(clientId, client);

    // Send initial connected acknowledgement
    this.sendToClient(client, {
      event: 'system:connected',
      data: {
        clientId,
        workspaceId,
        conversationId: conversationId || null,
        message: 'GoTek Realtime WebSocket Connected',
      },
      timestamp: new Date().toISOString(),
    });

    ws.on('close', () => {
      this.removeClient(clientId);
    });

    ws.on('error', () => {
      this.removeClient(clientId);
    });
  }

  /**
   * Update active conversation subscription for a client.
   */
  public updateClientConversation(clientId: string, conversationId: string): void {
    const client = this.clients.get(clientId);
    if (client) {
      client.conversationId = conversationId;
    }
  }

  /**
   * Evict channel membership from an active user connection.
   */
  public evictChannel(workspaceId: string, channelId: string, userId: string): void {
    for (const client of this.clients.values()) {
      if (client.workspaceId === workspaceId && client.userId === userId) {
        if (client.channelIds) {
          client.channelIds.delete(channelId);
        }
      }
    }
  }

  /**
   * Disconnect any open streams for a user when their membership is revoked or deactivated.
   */
  public disconnectUser(workspaceId: string, userId: string, reason = 'REVOKED'): void {
    for (const client of Array.from(this.clients.values())) {
      if (client.workspaceId === workspaceId && client.userId === userId) {
        try {
          if (client.kind === 'ws' && client.ws.readyState === 1) {
            client.ws.send(JSON.stringify({
              type: 'system:revoked',
              event: 'system:revoked',
              reason,
              timestamp: new Date().toISOString()
            }));
            client.ws.close(4003, `Unauthorized: ${reason}`);
          } else if (client.kind === 'sse') {
            client.res.write(`event: system:revoked\ndata: ${JSON.stringify({ reason })}\n\n`);
            client.res.end();
          }
        } catch {
          // Ignored
        }
        this.clients.delete(client.id);
      }
    }
  }

  /**
   * Remove client and clean up.
   */
  public removeClient(clientId: string): void {
    const client = this.clients.get(clientId);
    if (client) {
      try {
        if (client.kind === 'sse') {
          client.res.end();
        } else if (client.kind === 'ws' && client.ws.readyState === 1) {
          client.ws.close();
        }
      } catch {
        // Ignored
      }
      this.clients.delete(clientId);
    }
  }

  /**
   * Serialize and send an event to a specific client.
   */
  private sendToClient(client: RealtimeClient, event: RealtimeEvent): void {
    try {
      if (client.kind === 'sse') {
        const payload = `event: ${event.event}\ndata: ${JSON.stringify(event.data)}\nid: ${event.id || Date.now()}\n\n`;
        client.res.write(payload);
      } else if (client.kind === 'ws') {
        if (client.ws.readyState === 1) { // WebSocket.OPEN
          client.ws.send(JSON.stringify({
            event: event.event,
            type: event.event,
            data: event.data,
            id: event.id || Date.now(),
            timestamp: event.timestamp,
          }));
        }
      }
    } catch {
      this.removeClient(client.id);
    }
  }

  /**
   * Broadcast an event to all subscribers of a specific conversation (both staff & visitor).
   */
  public broadcastToConversation<T>(
    conversationId: string,
    eventName: string,
    data: T
  ): void {
    const event: RealtimeEvent<T> = {
      event: eventName,
      data,
      timestamp: new Date().toISOString(),
    };

    for (const client of this.clients.values()) {
      if (client.conversationId === conversationId) {
        // SECURITY: Never leak internal staff notes to public website visitors
        if (client.isVisitor && (data as any)?.visibility === 'internal') {
          continue;
        }
        this.sendToClient(client, event);
      }
    }
  }

  /**
   * Broadcast an event to all staff in a workspace (e.g. for inbox list counters, SLA alerts).
   * Supports channel-scoped filtering: if channelId is specified, Agents outside that channel will not receive the snippet/event.
   */
  public broadcastToWorkspace<T>(
    workspaceId: string,
    eventName: string,
    data: T,
    options?: { channelId?: string }
  ): void {
    const event: RealtimeEvent<T> = {
      event: eventName,
      data,
      timestamp: new Date().toISOString(),
    };

    for (const client of this.clients.values()) {
      if (client.workspaceId === workspaceId && !client.isVisitor) {
        // Channel-scoping rule: Agents only receive if they are members of the channel
        if (options?.channelId && client.role === 'Agent') {
          if (!client.channelIds?.has(options.channelId)) {
            continue;
          }
        }
        this.sendToClient(client, event);
      }
    }
  }

  /**
   * Stream LLM/AI tokens chunk-by-chunk to the active conversation client.
   */
  public streamAiChunk(
    conversationId: string,
    messageId: string,
    chunk: string,
    isComplete: boolean = false
  ): void {
    this.broadcastToConversation(conversationId, 'ai:token', {
      messageId,
      chunk,
      isComplete,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Count active subscribers.
   */
  public getClientCount(): number {
    return this.clients.size;
  }
}

// Export singleton instance
export const realtimeHub = new RealtimeHub();
