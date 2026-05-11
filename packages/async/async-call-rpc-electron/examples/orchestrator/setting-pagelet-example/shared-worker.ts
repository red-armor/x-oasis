import { createUtilityParticipant } from '../../../src/index.js';

if (!process.parentPort) {
  throw new Error('parentPort is not available');
}

const participant = createUtilityParticipant({
  parentPort: process.parentPort as any,
  mainChannelDescription: 'shared→main IPC channel',
  directChannelDescription: 'shared↔setting-pagelet direct port',
});

let currentTheme = 'light';

const sharedHandlers = {
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
};

participant.registerControlService('shared-rpc', sharedHandlers);

participant.registerService('shared-rpc', sharedHandlers);

console.log('[shared-worker] initialized with direct data-plane support');
