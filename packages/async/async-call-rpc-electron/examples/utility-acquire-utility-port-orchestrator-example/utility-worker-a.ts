import {
  ElectronUtilityProcessChannel,
  ElectronMessagePortMainChannel,
  registerOrchestratorHandler,
} from '../../src/index.js';
import { serviceHost, clientHost } from '@x-oasis/async-call-rpc';

if (!process.parentPort) {
  throw new Error('parentPort is not available');
}

const mainChannel = new ElectronUtilityProcessChannel({
  parentPort: process.parentPort as any,
  description: 'utility-a→main IPC channel',
});

const directChannel = new ElectronMessagePortMainChannel({
  description: 'utility-a↔utility-b direct port',
});

let callCount = 0;

serviceHost.registerService('utility-a-direct', {
  channel: directChannel,
  serviceHost,
  handlers: {
    greet(msg: string): string {
      callCount++;
      return `greeting from utility-a (#${callCount}): ${msg}`;
    },
    trace(): { pid: number; uptime: number; callCount: number } {
      return {
        pid: process.pid,
        uptime: Math.floor(process.uptime() * 1000),
        callCount,
      };
    },
  },
});

const utilityBDirectClient = clientHost
  .registerClient('utility-b-direct', { channel: directChannel })
  .createProxy();

registerOrchestratorHandler(mainChannel, (port: any) => {
  directChannel.bindPort(port);
});

console.log('[utility-worker-a] initialized');
