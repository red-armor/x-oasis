/**
 * Mock RPC Server
 *
 * This server implements the FileService interface and runs on port 3456.
 * It uses ws to handle WebSocket connections and @x-oasis/async-call-rpc for RPC.
 */

import http from 'http';
import { WebSocketServer } from 'ws';
import { WebSocketChannel, serviceHost } from '@x-oasis/async-call-rpc';

// Service interface
interface FileService {
  readFile(path: string): Promise<string>;
  writeFile(path: string, content: string): Promise<void>;
  listFiles(dir: string): Promise<string[]>;
  getFileSize(path: string): Promise<number>;
}

// Mock file system
const mockFiles: Record<string, string> = {
  '/src/index.ts': 'export function hello() { return "world"; }',
  '/src/app.tsx':
    'import React from "react";\n\nexport function App() { return <h1>Hello</h1>; }',
  '/README.md': '# My Project\n\nThis is a sample project.',
  '/package.json': '{"name": "example", "version": "1.0.0"}',
};

// Implementation
const fileService: FileService = {
  async readFile(path: string): Promise<string> {
    await new Promise((resolve) => setTimeout(resolve, 100)); // Simulate network latency
    return mockFiles[path] || `File not found: ${path}`;
  },

  async writeFile(path: string, content: string): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, 150));
    mockFiles[path] = content;
    console.log(`[Server] Wrote to ${path}`);
  },

  async listFiles(dir: string): Promise<string[]> {
    await new Promise((resolve) => setTimeout(resolve, 100));
    return Object.keys(mockFiles)
      .filter((path) => path.startsWith(dir))
      .map((path) => path.replace(dir, '').replace(/^\//, ''));
  },

  async getFileSize(path: string): Promise<number> {
    await new Promise((resolve) => setTimeout(resolve, 50));
    const content = mockFiles[path];
    return content ? content.length : 0;
  },
};

// Set up WebSocket server
const httpServer = http.createServer();
const wss = new WebSocketServer({ server: httpServer });

wss.on('connection', (ws) => {
  console.log('[Server] Client connected');

  const channel = new WebSocketChannel(ws as any, {
    name: 'file-service-channel',
  });

  // Register the service
  serviceHost.registerServer(channel, fileService, 'file-service');

  ws.on('close', () => {
    console.log('[Server] Client disconnected');
  });
});

const PORT = 3456;
httpServer.listen(PORT, () => {
  console.log(`[Server] WebSocket server running on ws://localhost:${PORT}`);
});
