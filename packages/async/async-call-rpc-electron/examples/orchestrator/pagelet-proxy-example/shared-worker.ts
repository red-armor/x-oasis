import { ElectronUtilityProcessChannel } from '../../../src/index.js';
import { serviceHost } from '@x-oasis/async-call-rpc';

if (!process.parentPort) {
  throw new Error('parentPort is not available');
}

const mainChannel = new ElectronUtilityProcessChannel({
  parentPort: process.parentPort as any,
  description: 'shared→main IPC channel',
});

let configVersion = 0;

serviceHost.registerService('shared-rpc', {
  channel: mainChannel,
  serviceHost,
  handlers: {
    getConfig(key: string): string {
      configVersion++;
      return `config[${key}] = value-v${configVersion}`;
    },
    getSharedState(): { pid: number; uptime: number; configVersion: number } {
      return {
        pid: process.pid,
        uptime: Math.floor(process.uptime() * 1000),
        configVersion,
      };
    },
    echo(msg: string): string {
      return `shared echo: ${msg}`;
    },
  },
});

console.log('[shared-worker] initialized');
