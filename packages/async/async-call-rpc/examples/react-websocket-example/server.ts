/**
 * WebSocket RPC Server for react-websocket-example
 *
 * Usage:
 *   npx tsx server.ts
 */

import { WebSocketServer } from 'ws';
import { WebSocketChannel, serviceHost } from '@x-oasis/async-call-rpc';

const PORT = 3456;

const wss = new WebSocketServer({ port: PORT });

wss.on('listening', () => {
  console.log(`WebSocket RPC server listening on ws://localhost:${PORT}`);
});

wss.on('connection', (ws) => {
  console.log('[Server] Client connected');

  const channel = new WebSocketChannel(ws as any, {
    name: 'ws-server',
    connected: true,
  });

  channel.activate();

  serviceHost.registerService('api', {
    channel,
    serviceHost,
    handlers: {
      echo(message: string): string {
        console.log(`[Server] echo: ${message}`);
        return `Echo: ${message}`;
      },

      now(): number {
        return Date.now();
      },

      getCurrentUser(): { id: string; name: string; timestamp: number } {
        return {
          id: 'user-001',
          name: 'Demo User',
          timestamp: Date.now(),
        };
      },

      onUserStatusChanged(callback: (status: string) => void) {
        const statuses = ['online', 'away', 'busy', 'online'];
        let i = 0;
        const interval = setInterval(() => {
          if (i < statuses.length) {
            callback(statuses[i]);
            i++;
          } else {
            clearInterval(interval);
          }
        }, 3000);
      },
    },
  });

  ws.on('close', () => {
    console.log('[Server] Client disconnected');
    channel.disconnect();
  });
});

process.on('SIGINT', () => {
  console.log('\nShutting down...');
  wss.close(() => process.exit(0));
});
