import {
  ElectronUtilityProcessChannel,
  ElectronMessagePortMainChannel,
  registerOrchestratorHandler,
} from '../../../src/index.js';
import { serviceHost, clientHost } from '@x-oasis/async-call-rpc';

if (!process.parentPort) {
  throw new Error('parentPort is not available');
}

const mainChannel = new ElectronUtilityProcessChannel({
  parentPort: process.parentPort as any,
  description: 'utility→main IPC channel',
});

const directChannel = new ElectronMessagePortMainChannel({
  description: 'utility↔renderer direct port',
});

let callCount = 0;

serviceHost.registerService('utility-direct', {
  channel: directChannel,
  serviceHost,
  handlers: {
    ping(msg: string): string {
      callCount++;
      console.log(`[utility] RPC #${callCount} from renderer:`, msg);
      return `pong from utility (#${callCount}): ${msg}`;
    },
    trace(): { pid: number; uptime: number; callCount: number } {
      return {
        pid: process.pid,
        uptime: Math.floor(process.uptime() * 1000),
        callCount,
      };
    },
    echo(msg: string): string {
      return `echo: ${msg}`;
    },
  },
});

const rendererDirectClient = clientHost
  .registerClient('renderer-direct', { channel: directChannel })
  .createProxy();

registerOrchestratorHandler(mainChannel, (port: any) => {
  directChannel.bindPort(port, { rebind: true });

  setTimeout(async () => {
    try {
      const result = await (rendererDirectClient as any).greet(
        'hello from utility via direct port'
      );
      console.log('[utility] direct RPC to renderer:', result);
    } catch (err) {
      console.error('[utility] direct RPC to renderer failed:', err);
    }
  }, 500);
});

console.log('[utility-worker] initialized');
