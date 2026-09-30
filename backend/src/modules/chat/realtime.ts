import type { Request, Response } from 'express';
import { EventEmitter } from 'events';

export interface RealtimeEvent<T = unknown> {
  id?: string;
  event: string;
  data: T;
  timestamp: string;
}

export type AuthorizeDelivery = (deliver: () => void, conversationId?: string) => Promise<void>;

interface SseClient {
  authorize: AuthorizeDelivery;
  pending: Promise<void>;
  queued: number;
  id: string;
  workspaceId: string;
  conversationId?: string;
  res: Response;
  req: Request;
}

export class RealtimeHub extends EventEmitter {
  private clients: Map<string, SseClient> = new Map();
  private heartbeatInterval: NodeJS.Timeout | null = null;

  constructor() {
    super();
    this.setMaxListeners(200);
    this.startHeartbeat();
  }

  /**
   * Keep connections alive by sending standard SSE comments every 25 seconds.
   * Prevents proxy/ingress drop-outs (such as Nginx proxy_read_timeout).
   */
  private startHeartbeat() {
    if (this.heartbeatInterval) return;
    this.heartbeatInterval = setInterval(() => {
      const pingComment = `: ping - ${new Date().toISOString()}\n\n`;
      for (const client of this.clients.values()) {
        try {
          this.deliverAuthorized(client, () => { client.res.write(pingComment); }, client.conversationId);
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
    authorize: AuthorizeDelivery,
    conversationId?: string
  ): void {
    // Send SSE response headers
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no', // Critical for Nginx reverse proxy streaming
    });

    res.flushHeaders?.();

    const client: SseClient = {
      authorize,
      pending: Promise.resolve(),
      queued: 0,
      id: clientId,
      workspaceId,
      conversationId,
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
   * Remove client and clean up.
   */
  public removeClient(clientId: string): void {
    const client = this.clients.get(clientId);
    if (client) {
      this.clients.delete(clientId);
      try {
        client.res.end();
      } catch {
        // Ignored
      }
      this.clients.delete(clientId);
    }
  }

  private deliverAuthorized(client: SseClient, deliver: () => void, conversationId?: string): void {
    // Bound queued authorization queries for slow consumers; reconnect reloads REST state.
    if (++client.queued > 100) { this.removeClient(client.id); return; }
    client.pending = client.pending.then(async () => {
      if (this.clients.get(client.id) !== client) return;
      await client.authorize(() => {
        if (this.clients.get(client.id) === client) deliver();
      }, conversationId);
    }).catch(() => this.removeClient(client.id)).finally(() => { client.queued--; });
  }

  /**
   * Serialize and send an SSE event to a specific client.
   */
  private sendToClient(client: SseClient, event: RealtimeEvent): void {
    try {
      const payload = `event: ${event.event}\ndata: ${JSON.stringify(event.data)}\nid: ${event.id || Date.now()}\n\n`;
      client.res.write(payload);
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
        this.deliverAuthorized(client, () => this.sendToClient(client, event), conversationId);
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
      const conversationId = data && typeof data === 'object' && 'conversationId' in data
        && typeof data.conversationId === 'string' ? data.conversationId : undefined;
      // Workspace inbox events must identify the conversation whose scope is checked.
      if (client.workspaceId === workspaceId && conversationId &&
          (!client.conversationId || client.conversationId === conversationId)) {
        this.deliverAuthorized(client, () => this.sendToClient(client, event), conversationId);
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
