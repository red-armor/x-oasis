import { createUtilityParticipant } from '../../../src/index.js';
import { clientHost, serviceHost } from '@x-oasis/async-call-rpc';

if (!process.parentPort) {
  throw new Error('parentPort is not available');
}

const participant = createUtilityParticipant({
  parentPort: process.parentPort as any,
  mainChannelDescription: 'main-pagelet→main IPC channel',
  directChannelDescription: 'main-pagelet↔renderer direct port',
});

const mainClient = clientHost
  .registerClient('main-rpc', { channel: participant.mainChannel })
  .createProxy();

serviceHost.registerService('pagelet-api', {
  channel: participant.directChannel,
  serviceHost,
  handlers: {
    info(): string {
      return `main-pagelet ready (pid=${process.pid})`;
    },
    async callSharedEcho(msg: string): Promise<string> {
      return mainClient.relayToShared('echo', msg);
    },
    async callSharedGetConfig(key: string): Promise<string> {
      return mainClient.relayToShared('getConfig', key);
    },
    async callDaemonEcho(msg: string): Promise<string> {
      return mainClient.relayToDaemon('echo', msg);
    },
    async callDaemonSystemStatus(): Promise<string> {
      return mainClient.relayToDaemon('systemStatus');
    },
    async callMainPing(msg: string): Promise<string> {
      return mainClient.mainPing(msg);
    },
  },
});

console.log('[main-pagelet-worker] initialized');
