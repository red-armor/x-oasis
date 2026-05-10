import { ElectronUtilityProcessChannel } from '../../../src/index.js';
import { serviceHost } from '@x-oasis/async-call-rpc';

if (!process.parentPort) {
  throw new Error('parentPort is not available');
}

const mainChannel = new ElectronUtilityProcessChannel({
  parentPort: process.parentPort as any,
  description: 'shared→main IPC channel',
});

let currentTheme = 'light';

serviceHost.registerService('shared-rpc', {
  channel: mainChannel,
  serviceHost,
  handlers: {
    getTheme(): string {
      return currentTheme;
    },
    setTheme(theme: string): string {
      currentTheme = theme;
      return `theme set to ${theme}`;
    },
    getConfig(key: string): string {
      return `config[${key}] = ${key === 'theme' ? currentTheme : 'default'}`;
    },
    getSharedState(): { pid: number; uptime: number; theme: string } {
      return {
        pid: process.pid,
        uptime: Math.floor(process.uptime() * 1000),
        theme: currentTheme,
      };
    },
    echo(msg: string): string {
      return `shared echo: ${msg}`;
    },
  },
});

console.log('[shared-worker] initialized');
