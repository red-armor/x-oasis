import { createUtilityParticipant } from '../../../src/index.js';

if (!process.parentPort) {
  throw new Error('parentPort is not available');
}

const participant = createUtilityParticipant({
  parentPort: process.parentPort as any,
  mainChannelDescription: 'utility-a→main IPC channel',
  directChannelDescription: 'utility-a↔utility-b direct port',
});

const utilityBService = participant.getService<any>('utility-b-direct');

let callCount = 0;

participant.registerService('utility-a-direct', {
  greet(msg: string): string {
    callCount++;
    return `greeting from utility-a (#${callCount}): ${msg}`;
  },
  trace(): { pid: number; uptime: number; callCount: number } {
    return {
      pid: process.pid,
      uptime: Math.floor(process.uptime() * 1000),
      callCount,
    };
  },
});

participant.registerControlService('utility-a-relay', {
  async relayToB(msg: string): Promise<string> {
    console.log('[utility-a] → calling utility-b.echo() via DIRECT port...');
    const result = await utilityBService.echo(msg);
    console.log('[utility-a] ← got response via DIRECT port:', result);
    return result;
  },
  async pingPong(msg: string): Promise<string> {
    console.log('[utility-a] → direct port → utility-b.echo()');
    const fromB = await utilityBService.echo(msg);
    console.log('[utility-a] ← direct port ← utility-b:', fromB);
    const fromA = `greeting from utility-a (#${++callCount}): ${msg}`;
    return `utility-a →(direct)→ utility-b: "${fromB}" | utility-a: "${fromA}"`;
  },
});

console.log('[utility-worker-a] initialized');
