/**
 * Mock RPC Server
 *
 * This server implements the FileService interface and runs on port 3456.
 * It uses ws to handle WebSocket connections and @x-oasis/async-call-rpc for RPC.
 *
 * IMPORTANT: The RPC framework passes only `body[0]` to each handler,
 * so every method must accept a single parameter. For multi-argument
 * methods, wrap the arguments in an object.
 */

import { WebSocketServer } from 'ws';
import { WebSocketChannel } from '@x-oasis/async-call-rpc-web/core';
import { serviceHost } from '@x-oasis/async-call-rpc/core';

// Mock file system
const mockFiles: Record<string, string> = {
  '/src/index.ts': 'export function hello() { return "world"; }',
  '/src/app.tsx':
    'import React from "react";\n\nexport function App() { return <h1>Hello</h1>; }',
  '/README.md': '# My Project\n\nThis is a sample project.',
  '/package.json': '{"name": "example", "version": "1.0.0"}',
};

// Set up WebSocket server
const wss = new WebSocketServer({ port: 3456 });

wss.on('listening', () => {
  console.log('[Server] WebSocket server running on ws://localhost:3456');
});

wss.on('connection', (ws) => {
  console.log('[Server] Client connected');

  const channel = new WebSocketChannel(ws as any, {
    name: 'file-service-channel',
    connected: true,
  });

  channel.activate();

  // Register the service using the real API.
  // Each handler receives exactly ONE argument (the first element of
  // the wire body array). Multi-arg methods use an object parameter.
  serviceHost.registerService('file-service', {
    channel,
    serviceHost,
    handlers: {
      async readFile(path: string): Promise<string> {
        await new Promise((resolve) => setTimeout(resolve, 100));
        return mockFiles[path] || `File not found: ${path}`;
      },

      async writeFile(params: {
        path: string;
        content: string;
      }): Promise<void> {
        const { path, content } = params;
        await new Promise((resolve) => setTimeout(resolve, 150));
        mockFiles[path] = content;
        console.log(`[Server] Wrote to ${path}`);
      },

      async listFiles(dir: string): Promise<string[]> {
        await new Promise((resolve) => setTimeout(resolve, 100));
        return Object.keys(mockFiles)
          .filter((p) => p.startsWith(dir))
          .map((p) => p.replace(dir, '').replace(/^\//, ''));
      },

      async getFileSize(path: string): Promise<number> {
        await new Promise((resolve) => setTimeout(resolve, 50));
        const content = mockFiles[path];
        return content ? content.length : 0;
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
