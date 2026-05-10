import { createUtilityParticipant } from '../../src/index.js';

if (!process.parentPort) {
  throw new Error('parentPort is not available');
}

const participant = createUtilityParticipant({
  parentPort: process.parentPort as any,
  mainChannelDescription: 'utility→main IPC channel',
  directChannelDescription: 'utility↔main direct port',
});

const mainDirectClient = participant.getService<any>('main-direct');

let callCount = 0;

participant.registerService('utility-direct', {
  ping(msg: string): string {
    callCount++;
    return `pong from utility (#${callCount}): ${msg}`;
  },
  trace(): { pid: number; uptime: number; callCount: number } {
    return {
      pid: process.pid,
      uptime: Math.floor(process.uptime() * 1000),
      callCount,
    };
  },
});

console.log('[utility-worker] initialized');
