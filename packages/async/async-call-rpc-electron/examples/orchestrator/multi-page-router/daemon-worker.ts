import {
  ElectronUtilityProcessChannel,
  createParticipantProxy,
} from '../../../src/index.js';
import { serviceHost } from '@x-oasis/async-call-rpc/core';

if (!process.parentPort) {
  throw new Error('parentPort is not available');
}

const SELF_ID = 'daemon';

const mainChannel = new ElectronUtilityProcessChannel({
  parentPort: process.parentPort as any,
  description: 'daemon→main IPC channel',
});

let monitorCount = 0;

const daemonHandlers = {
  systemStatus(): string {
    monitorCount++;
    return `system OK (#${monitorCount}), uptime=${Math.floor(
      process.uptime()
    )}s`;
  },
  echo(msg: string): string {
    return `daemon echo: ${msg}`;
  },
  onSystemStatusChange(callback: (status: any) => void) {
    const interval = setInterval(() => {
      const status = {
        timestamp: Date.now(),
        uptime: Math.floor(process.uptime()),
        memoryUsage: process.memoryUsage(),
        monitorCount,
      };
      callback(status);
    }, 2000);

    return () => {
      clearInterval(interval);
    };
  },
  onLogEvent(callback: (log: any) => void) {
    const levels = ['INFO', 'WARN', 'DEBUG', 'ERROR'] as const;
    const messages = [
      'Health check passed',
      'Connection established',
      'Cache updated',
      'Request processed',
    ];

    const interval = setInterval(() => {
      const log = {
        timestamp: new Date().toISOString(),
        level: levels[Math.floor(Math.random() * levels.length)],
        message: messages[Math.floor(Math.random() * messages.length)],
        pid: process.pid,
      };
      callback(log);
    }, 1500);

    return () => {
      clearInterval(interval);
    };
  },
};

const proxy = createParticipantProxy({
  selfId: SELF_ID,
  controlChannel: mainChannel,
  onConnection: (conn) => {
    console.log(
      `[daemon-worker] connection from ${conn.peerId} (role=${conn.role})`
    );
    const ch = proxy.getChannelFor(conn.peerId);
    if (ch) {
      serviceHost.registerService(`daemon-rpc`, {
        channel: ch,
        serviceHost,
        handlers: daemonHandlers,
      });
      console.log(`[daemon-worker] daemon-rpc registered for ${conn.peerId}`);
    }
  },
});

console.log('[daemon-worker] initialized, waiting for pagelet connections');
