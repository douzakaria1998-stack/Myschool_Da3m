// Server-side Realtime Broadcaster for multi-device synchronization
// Manages connected SSE (Server-Sent Events) clients and broadcasts INSERT, UPDATE, DELETE events

type Client = {
  id: string;
  controller: ReadableStreamDefaultController;
};

// Global in-memory client list across requests in the same Node.js process
const globalClients: Map<string, Client> = (global as any).__da3m_sse_clients__ || new Map();
(global as any).__da3m_sse_clients__ = globalClients;

export interface RealtimeGroupEvent {
  eventType: 'INSERT' | 'UPDATE' | 'DELETE';
  groupId: string;
  groupMeta?: any;
  groupSheet?: any;
  timestamp: number;
  originClientId?: string;
}

export function registerClient(id: string, controller: ReadableStreamDefaultController) {
  globalClients.set(id, { id, controller });
}

export function unregisterClient(id: string) {
  globalClients.delete(id);
}

export function broadcastGroupEvent(event: RealtimeGroupEvent) {
  const message = `event: group_change\ndata: ${JSON.stringify(event)}\n\n`;
  const encoder = new TextEncoder();
  const encoded = encoder.encode(message);

  for (const [id, client] of globalClients.entries()) {
    try {
      client.controller.enqueue(encoded);
    } catch (err) {
      // Client connection dropped
      globalClients.delete(id);
    }
  }
}

export function getConnectedClientCount(): number {
  return globalClients.size;
}
