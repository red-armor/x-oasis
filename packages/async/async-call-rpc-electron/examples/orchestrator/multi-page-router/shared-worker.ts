import {
  ElectronUtilityProcessChannel,
  createParticipantProxy,
} from '../../../src/index.js';
import { serviceHost } from '@x-oasis/async-call-rpc';

if (!process.parentPort) {
  throw new Error('parentPort is not available');
}

const SELF_ID = 'shared';

const mainChannel = new ElectronUtilityProcessChannel({
  parentPort: process.parentPort as any,
  description: 'shared→main IPC channel',
});

let configVersion = 0;
const configStore: Record<string, string> = {
  theme: 'dark',
  language: 'zh-CN',
  timeout: '30000',
};

const sharedHandlers = {
  getConfig(key: string): string {
    configVersion++;
    return `config[${key}] = ${
      configStore[key] || 'undefined'
    } (v${configVersion})`;
  },
  setConfig(key: string, value: string): string {
    configVersion++;
    configStore[key] = value;
    return `config[${key}] set to ${value} (v${configVersion})`;
  },
  echo(msg: string): string {
    return `shared echo: ${msg}`;
  },
  onConfigChange(callback: (event: any) => void) {
    const interval = setInterval(() => {
      const keys = Object.keys(configStore);
      const randomKey = keys[Math.floor(Math.random() * keys.length)];
      const oldVal = configStore[randomKey];
      const newVal = `${oldVal}-updated-${Date.now() % 1000}`;
      configStore[randomKey] = newVal;
      configVersion++;

      callback({
        key: randomKey,
        oldValue: oldVal,
        newValue: newVal,
        configVersion,
        timestamp: Date.now(),
      });
    }, 3000);

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
      `[shared-worker] connection from ${conn.peerId} (role=${conn.role})`
    );
    const ch = proxy.getChannelFor(conn.peerId);
    if (ch) {
      serviceHost.registerService(`shared-rpc`, {
        channel: ch,
        serviceHost,
        handlers: sharedHandlers,
      });
      console.log(`[shared-worker] shared-rpc registered for ${conn.peerId}`);
    }
  },
});

console.log('[shared-worker] initialized, waiting for pagelet connections');
