import { createId, injectable } from '@x-oasis/di';
import {
  ElectronUtilityProcessChannel,
  createParticipantProxy,
} from '@x-oasis/async-call-rpc-electron';
import { serviceHost } from '@x-oasis/async-call-rpc';

import { DAEMON_SERVICE_PATH } from '../common/types';

export interface IDaemonWorker {
  boot(): void;
}

export const DaemonWorkerId = createId('DaemonWorker');

@injectable()
export class DaemonWorker implements IDaemonWorker {
  private monitorCount = 0;

  boot(): void {
    if (!process.parentPort) {
      throw new Error('parentPort is not available');
    }

    const SELF_ID = 'daemon';
    const mainChannel = new ElectronUtilityProcessChannel({
      parentPort: process.parentPort as any,
      description: 'daemon→main IPC channel',
    });

    const handlers = {
      systemStatus: (): string => {
        this.monitorCount++;
        return `system OK (#${this.monitorCount}), uptime=${Math.floor(
          process.uptime()
        )}s`;
      },
      echo: (msg: string): string => `daemon echo: ${msg}`,
      onSystemStatusChange: (callback: (status: any) => void) => {
        const interval = setInterval(() => {
          callback({
            timestamp: Date.now(),
            uptime: Math.floor(process.uptime()),
            memoryUsage: process.memoryUsage(),
            monitorCount: this.monitorCount,
          });
        }, 2000);
        return () => clearInterval(interval);
      },
      onLogEvent: (callback: (log: any) => void) => {
        const levels = ['INFO', 'WARN', 'DEBUG', 'ERROR'] as const;
        const messages = [
          'Health check passed',
          'Connection established',
          'Cache updated',
          'Request processed',
        ];
        const interval = setInterval(() => {
          callback({
            timestamp: new Date().toISOString(),
            level: levels[Math.floor(Math.random() * levels.length)],
            message: messages[Math.floor(Math.random() * messages.length)],
            pid: process.pid,
          });
        }, 1500);
        return () => clearInterval(interval);
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
          serviceHost.registerService(DAEMON_SERVICE_PATH, {
            channel: ch,
            serviceHost,
            handlers,
          });
          console.log(
            `[daemon-worker] ${DAEMON_SERVICE_PATH} registered for ${conn.peerId}`
          );
        }
      },
    });

    console.log('[daemon-worker] initialized, waiting for pagelet connections');
  }
}
