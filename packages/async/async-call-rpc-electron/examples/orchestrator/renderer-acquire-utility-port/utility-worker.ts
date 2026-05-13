import { createUtilityParticipant } from '../../../src/index.js';

if (!process.parentPort) {
  throw new Error('parentPort is not available');
}

const participant = createUtilityParticipant({
  parentPort: process.parentPort as any,
  mainChannelDescription: 'utility→main IPC channel',
  directChannelDescription: 'utility↔renderer direct port',
});

const rendererService = participant.getProxy<any>('renderer-direct');

let callCount = 0;

participant.registerService('utility-direct', {
  ping(msg: string): string {
    callCount++;
    console.log(`[utility] RPC #${callCount} from renderer:`, msg);
    return `pong from utility (#${callCount}): ${msg}`;
  },
  trace(): { pid: number; uptime: number; callCount: number } {
    return {
      pid: process.pid,
      uptime: Math.floor(process.uptime() * 1000),
      callCount,
    };
  },
  echo(msg: string): string {
    return `echo: ${msg}`;
  },
});

participant.registerControlService('utility-relay', {
  async greetRenderer(msg: string): Promise<string> {
    console.log('[utility] → calling renderer.greet() via DIRECT port...');
    const result = await rendererService.greet(msg);
    console.log('[utility] ← got response via DIRECT port:', result);
    return result;
  },
});

console.log('[utility-worker] initialized');
