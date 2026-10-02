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
  res: Response;
  req: Request;
}

interface WsClient {
  kind: 'ws';
  id: string;
  workspaceId: string;
  conversationId?: string;
  isVisitor?: boolean;
  ws: WebSocket;
  isAlive: boolean;
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
   * Dead-Socket Reaper terminates unresponsive zombie sockets to prevent memory leaks.
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
            if (client.isAlive === false) {
              // Unresponsive zombie connection: terminate and reclaim memory
              try { client.ws.terminate(); } catch {}
              this.removeClient(client.id);
              continue;
            }
            client.isAlive = false;
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
    isVisitor = false
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
    isVisitor = false
  ): void {
    const client: WsClient = {
      kind: 'ws',
      id: clientId,
      workspaceId,
      conversationId,
      isVisitor,
      ws,
      isAlive: true,
    };

    this.clients.set(clientId, client);

    ws.on('pong', () => {
      client.isAlive = true;
    });

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
        // SECURITY: Never leak internal staff notes or private data to public website visitors (Zero Leakage)
        if (client.isVisitor) {
          const d = data as any;
          if (
            d?.visibility === 'internal' ||
            d?.author_type === 'internal_note' ||
            d?.senderType === 'internal_note' ||
            d?.author === 'internal_note' ||
            d?.message?.visibility === 'internal' ||
            eventName === 'note:new' ||
            eventName === 'internal_note'
          ) {
            continue;
          }
        }
        this.sendToClient(client, event);
      }
    }
  }

  /**
   * Broadcast an event to all staff in a workspace (e.g. for inbox list counters, SLA alerts).
   */
  public broadcastToWorkspace<T>(
    workspaceId: string,
    eventName: string,
    data: T
  ): void {
    const event: RealtimeEvent<T> = {
      event: eventName,
      data,
      timestamp: new Date().toISOString(),
    };

    for (const client of this.clients.values()) {
      if (client.workspaceId === workspaceId) {
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
