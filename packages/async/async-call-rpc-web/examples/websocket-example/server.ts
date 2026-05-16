/**
 * WebSocket RPC Server for websocket-example
 *
 * Usage:
 *   npx tsx server.ts
 */

import { WebSocketServer } from 'ws';
import { WebSocketChannel } from '@x-oasis/async-call-rpc-web/core';
import { serviceHost } from '@x-oasis/async-call-rpc/core';

const PORT = 3460;

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

      getInfo(): { name: string; version: string; uptime: number } {
        return {
          name: 'WebSocket RPC Server',
          version: '1.0.0',
          uptime: process.uptime(),
        };
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
