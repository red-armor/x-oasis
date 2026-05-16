import { createUtilityParticipant } from '../../../src/index.js';
import { clientHost } from '@x-oasis/async-call-rpc/core';

if (!process.parentPort) {
  throw new Error('parentPort is not available');
}

const participant = createUtilityParticipant({
  parentPort: process.parentPort as any,
  mainChannelDescription: 'setting-pagelet→main IPC channel',
  directChannelDescription: 'setting-pagelet↔setting-renderer direct port',
});

const mainClient = clientHost
  .registerClient('main-rpc', { channel: participant.mainChannel })
  .createProxy();

participant.registerService('setting-api', {
  info(): string {
    return `setting-pagelet ready (pid=${process.pid})`;
  },
  async getTheme(): Promise<string> {
    return mainClient.relayToShared('getTheme');
  },
  async setTheme(theme: string): Promise<string> {
    await mainClient.relayToShared('setTheme', theme);
    return mainClient.changeMainWindowTheme(theme);
  },
  async getSharedConfig(key: string): Promise<string> {
    return mainClient.relayToShared('getConfig', key);
  },
  async getSharedState(): Promise<any> {
    return mainClient.relayToShared('getSharedState');
  },
  async getSystemStatus(): Promise<string> {
    return mainClient.relayToDaemon('systemStatus');
  },
  async getDaemonInfo(): Promise<any> {
    return mainClient.relayToDaemon('getDaemonInfo');
  },
  async echoShared(msg: string): Promise<string> {
    return mainClient.relayToShared('echo', msg);
  },
  async echoDaemon(msg: string): Promise<string> {
    return mainClient.relayToDaemon('echo', msg);
  },
  async changeMainWindowTheme(theme: string): Promise<string> {
    return mainClient.changeMainWindowTheme(theme);
  },
  async getCurrentTheme(): Promise<string> {
    return mainClient.getCurrentTheme();
  },
});

console.log('[setting-pagelet-worker] initialized');
