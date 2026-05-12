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

participant.registerControlService('shared-rpc', sharedHandlers);

participant.registerService('shared-rpc', sharedHandlers);

console.log('[shared-worker] initialized with subscription support');
