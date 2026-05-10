import { ElectronUtilityProcessChannel } from '../../../src/index.js';
import { serviceHost } from '@x-oasis/async-call-rpc';

if (!process.parentPort) {
  throw new Error('parentPort is not available');
}

const mainChannel = new ElectronUtilityProcessChannel({
  parentPort: process.parentPort as any,
  description: 'daemon→main IPC channel',
});

let monitorCount = 0;

serviceHost.registerService('daemon-rpc', {
  channel: mainChannel,
  serviceHost,
  handlers: {
    systemStatus(): string {
      monitorCount++;
      return `system OK (#${monitorCount}), uptime=${Math.floor(
        process.uptime()
      )}s`;
    },
    getDaemonInfo(): { pid: number; uptime: number; monitorCount: number } {
      return {
        pid: process.pid,
        uptime: Math.floor(process.uptime() * 1000),
        monitorCount,
      };
    },
    echo(msg: string): string {
      return `daemon echo: ${msg}`;
    },
  },
});

console.log('[daemon-worker] initialized');
