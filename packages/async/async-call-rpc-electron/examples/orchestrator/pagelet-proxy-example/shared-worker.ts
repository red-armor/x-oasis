import { createUtilityParticipant } from '../../../src/index.js';

if (!process.parentPort) {
  throw new Error('parentPort is not available');
}

const participant = createUtilityParticipant({
  parentPort: process.parentPort as any,
  mainChannelDescription: 'shared→main IPC channel',
  directChannelDescription: 'shared↔pagelet direct port',
});

let configVersion = 0;

const sharedHandlers = {
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
};

participant.registerControlService('shared-rpc', sharedHandlers);

participant.registerService('shared-rpc', sharedHandlers);

console.log('[shared-worker] initialized');
