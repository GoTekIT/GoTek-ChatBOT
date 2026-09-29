import type { Request, Response } from 'express';
import { EventEmitter } from 'events';

export interface RealtimeEvent<T = unknown> {
  id?: string;
  event: string;
  data: T;
  timestamp: string;
}

interface SseClient {
  id: string;
  workspaceId: string;
  conversationId?: string;
  res: Response;
  req: Request;
}

class RealtimeHub extends EventEmitter {
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
          client.res.write(pingComment);
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
    conversationId?: string
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
      try {
        client.res.end();
      } catch {
        // Ignored
      }
      this.clients.delete(clientId);
    }
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
