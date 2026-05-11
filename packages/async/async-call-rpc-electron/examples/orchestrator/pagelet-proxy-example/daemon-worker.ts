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

const activeEventCallbacks = new Map<string, Set<(data: any) => void>>();

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
  onSystemStatusChange(callback: (status: any) => void) {
    const eventId = `status-${Date.now()}`;
    if (!activeEventCallbacks.has('status')) {
      activeEventCallbacks.set('status', new Set());
    }
    activeEventCallbacks.get('status')!.add(callback);

    const interval = setInterval(() => {
      const status = {
        eventId,
        timestamp: Date.now(),
        uptime: Math.floor(process.uptime()),
        memoryUsage: process.memoryUsage(),
        monitorCount,
      };
      callback(status);
    }, 2000);

    const cleanup = () => {
      clearInterval(interval);
      activeEventCallbacks.get('status')?.delete(callback);
    };

    return cleanup;
  },
  onLogEvent(callback: (log: any) => void) {
    const eventId = `log-${Date.now()}`;
    if (!activeEventCallbacks.has('log')) {
      activeEventCallbacks.set('log', new Set());
    }
    activeEventCallbacks.get('log')!.add(callback);

    const levels = ['INFO', 'WARN', 'DEBUG', 'ERROR'] as const;
    const messages = [
      'Health check passed',
      'Connection established',
      'Cache updated',
      'Request processed',
      'Background task completed',
    ];

    const interval = setInterval(() => {
      const log = {
        eventId,
        timestamp: new Date().toISOString(),
        level: levels[Math.floor(Math.random() * levels.length)],
        message: messages[Math.floor(Math.random() * messages.length)],
        pid: process.pid,
      };
      callback(log);
    }, 1500);

    const cleanup = () => {
      clearInterval(interval);
      activeEventCallbacks.get('log')?.delete(callback);
    };

    return cleanup;
  },
  watchCpuUsage() {
    return {
      subscribe(observer: {
        next?: (value: any) => void;
        error?: (err: Error) => void;
        complete?: () => void;
      }) {
        let tick = 0;
        const interval = setInterval(() => {
          tick++;
          const usage = {
            tick,
            timestamp: Date.now(),
            cpu: Math.random() * 100,
            memory: process.memoryUsage(),
          };
          observer.next?.(usage);
        }, 1000);

        return {
          unsubscribe: () => {
            clearInterval(interval);
          },
        };
      },
    };
  },
};

participant.registerControlService('daemon-rpc', daemonHandlers);

participant.registerService('daemon-rpc', daemonHandlers);

console.log('[daemon-worker] initialized with subscription support');
