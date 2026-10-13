import { NextRequest } from 'next/server';
import { registerClient, unregisterClient } from '@/lib/realtimeBroadcaster';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const clientId = 'client_' + Math.random().toString(36).substring(2, 9) + '_' + Date.now();

  const stream = new ReadableStream({
    start(controller) {
      registerClient(clientId, controller);

      // Send initial connection event
      const encoder = new TextEncoder();
      controller.enqueue(
        encoder.encode(`event: connected\ndata: ${JSON.stringify({ clientId, timestamp: Date.now() })}\n\n`)
      );

      // Send heartbeat ping every 25 seconds to keep connection alive
      const pingInterval = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`event: ping\ndata: ${Date.now()}\n\n`));
        } catch {
          clearInterval(pingInterval);
          unregisterClient(clientId);
        }
      }, 25000);

      req.signal.addEventListener('abort', () => {
        clearInterval(pingInterval);
        unregisterClient(clientId);
      });
    },
    cancel() {
      unregisterClient(clientId);
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no'
    }
  });
}
