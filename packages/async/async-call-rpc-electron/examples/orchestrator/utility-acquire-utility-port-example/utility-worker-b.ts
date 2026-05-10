import { createUtilityParticipant } from '../../../src/index.js';

if (!process.parentPort) {
  throw new Error('parentPort is not available');
}

const participant = createUtilityParticipant({
  parentPort: process.parentPort as any,
  mainChannelDescription: 'utility-b→main IPC channel',
  directChannelDescription: 'utility-b↔utility-a direct port',
});

const utilityAService = participant.getService<any>('utility-a-direct');

let callCount = 0;

participant.registerService('utility-b-direct', {
  echo(msg: string): string {
    callCount++;
    console.log('[utility-b] echo() called via DIRECT port, responding');
    return `echo from utility-b (#${callCount}): ${msg}`;
  },
  async pingA(msg: string): Promise<string> {
    console.log('[utility-b] → direct port → utility-a.greet()');
    const fromA = await utilityAService.greet(msg);
    console.log('[utility-b] ← direct port ← utility-a:', fromA);
    return fromA;
  },
});

console.log('[utility-worker-b] initialized');
