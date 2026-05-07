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
  description: 'utility-b→main IPC channel',
});

const directChannel = new ElectronMessagePortMainChannel({
  description: 'utility-b↔utility-a direct port',
});

let callCount = 0;

serviceHost.registerService('utility-b-direct', {
  channel: directChannel,
  serviceHost,
  handlers: {
    echo(msg: string): string {
      callCount++;
      return `echo from utility-b (#${callCount}): ${msg}`;
    },
  },
});

const utilityADirectClient = clientHost
  .registerClient('utility-a-direct', { channel: directChannel })
  .createProxy();

registerOrchestratorHandler(mainChannel, (port: any) => {
  directChannel.bindPort(port);
});

console.log('[utility-worker-b] initialized');
