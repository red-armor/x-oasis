/**
 * WebSocket RPC Server for react-full-app
 *
 * Provides services for TasksPanel and StatusPanel.
 *
 * Usage:
 *   npx tsx server.ts
 */

import { WebSocketServer } from 'ws';
import { serviceHost } from '@x-oasis/async-call-rpc';
import { WebSocketChannel } from '@x-oasis/async-call-rpc-web';

const PORT = 3456;

interface Task {
  id: number;
  title: string;
  completed: boolean;
}

const tasks: Task[] = [];
let nextId = 1;

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
      getTasks(): Task[] {
        return tasks;
      },

      addTask(title: string): Task {
        const task: Task = { id: nextId++, title, completed: false };
        tasks.push(task);
        console.log(`[Server] Task added: ${title}`);
        return task;
      },

      onServerStatusChanged(callback: (status: string) => void) {
        const statuses = [
          'online',
          'syncing',
          'online',
          'maintenance',
          'online',
        ];
        let i = 0;
        const interval = setInterval(() => {
          if (i < statuses.length) {
            callback(statuses[i]);
            i++;
          } else {
            clearInterval(interval);
          }
        }, 5000);
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
