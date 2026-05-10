import { createUtilityParticipant } from '../../../src/index.js';

if (!process.parentPort) {
  throw new Error('parentPort is not available');
}

const participant = createUtilityParticipant({
  parentPort: process.parentPort as any,
  mainChannelDescription: 'daemon→main IPC channel',
  directChannelDescription: 'daemon↔pagelet direct port',
});

let monitorCount = 0;

const daemonHandlers = {
  systemStatus(): string {
    monitorCount++;
    return `system OK (#${monitorCount}), uptime=${Math.floor(
      process.uptime()
    )}s`;
  },
  getDaemonInfo(): { pid: number; uptime: number; monitorCount: number } {
    return {
      pid: process.pid,
      uptime: Math.floor(process.uptime() * 1000),
      monitorCount,
    };
  },
  echo(msg: string): string {
    return `daemon echo: ${msg}`;
  },
};

participant.registerControlService('daemon-rpc', daemonHandlers);

participant.registerService('daemon-rpc', daemonHandlers);

console.log('[daemon-worker] initialized');
