/**
 * Node.js WebSocket Server Example
 *
 * Demonstrates how to set up an RPC server over WebSocket
 * with the `createContext` feature.
 *
 * Usage:
 *   npx tsx examples/node.websocket.server.ts
 *
 * Then open test-websocket.html via a static file server.
 */

import { WebSocketServer } from 'ws';
import { WebSocketChannel, serviceHost } from '../src/index';

const PORT = 3456;

// Define the service implementation
const serverImpl = {
  now: () => Date.now(),
  echo: (x: unknown) => x,
  add: (a: number, b: number) => a + b,
  greet: (name: string) =>
    `Hello, ${name}! The time is ${new Date().toLocaleTimeString()}.`,
};

// Start the server
const wss = new WebSocketServer({ port: PORT });

wss.on('listening', () => {
  console.log(`WebSocket RPC server listening on ws://localhost:${PORT}`);
});

wss.on('connection', (ws) => {
  console.log('[Server] Client connected');

  // Create a channel with createContext — each request gets sender info
  const channel = new WebSocketChannel(ws as any, {
    name: 'ws-server',
    connected: true,
    createContext: ({ requestPath, methodName }) => ({
      requestPath,
      methodName,
      timestamp: Date.now(),
    }),
  });

  channel.activate();

  const service = serviceHost.registerService('server', serverImpl);
  service.setChannel(channel);

  ws.on('close', () => {
    console.log('[Server] Client disconnected');
    channel.disconnect(); // triggers subscription cleanup
  });
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\nShutting down...');
  wss.close(() => process.exit(0));
});
