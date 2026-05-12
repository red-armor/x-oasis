import { createId, injectable } from '@x-oasis/di';
import {
  ElectronUtilityProcessChannel,
  createParticipantProxy,
} from '@x-oasis/async-call-rpc-electron';
import { serviceHost } from '@x-oasis/async-call-rpc';

import {
  DAEMON_SERVICE_PATH,
  MONITOR_SERVICE_PATH,
  MonitorSnapshot,
  ProcessRow,
} from '@/apps/daemon/application/common';

export interface IDaemonWorker {
  boot(): void;
}

export const DaemonWorkerId = createId('DaemonWorker');

@injectable()
export class DaemonWorker implements IDaemonWorker {
  private monitorCount = 0;
  private performanceListeners: Set<(snapshot: MonitorSnapshot) => void> =
    new Set();
  private snapshotInterval: ReturnType<typeof setInterval> | null = null;

  private collectSnapshot(): MonitorSnapshot {
    const memUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();

    const mainProcess: ProcessRow = {
      pid: process.pid,
      name: 'daemon',
      type: 'Utility',
      cpu: +(cpuUsage.user / 1000).toFixed(2),
      memory: +(memUsage.rss / 1024 / 1024).toFixed(2),
    };

    const simulatedProcesses: ProcessRow[] = [
      mainProcess,
      {
        pid: process.pid + 1,
        name: 'gc-worker',
        type: 'Utility',
        cpu: +(Math.random() * 5).toFixed(2),
        memory: +((memUsage.heapUsed / 1024 / 1024) * 0.3).toFixed(2),
      },
      {
        pid: process.pid + 2,
        name: 'log-collector',
        type: 'Utility',
        cpu: +(Math.random() * 3).toFixed(2),
        memory: +(Math.random() * 20 + 5).toFixed(2),
      },
      {
        pid: process.pid + 3,
        name: 'health-checker',
        type: 'Utility',
        cpu: +(Math.random() * 2).toFixed(2),
        memory: +(Math.random() * 10 + 3).toFixed(2),
      },
    ];

    const totalCpu = simulatedProcesses.reduce((s, p) => s + p.cpu, 0);
    const totalMem = simulatedProcesses.reduce((s, p) => s + p.memory, 0);

    return {
      timestamp: Date.now(),
      totals: {
        cpu: +totalCpu.toFixed(2),
        memory: +totalMem.toFixed(2),
      },
      processes: simulatedProcesses,
    };
  }

  private startPerformanceRoutine(): void {
    if (this.snapshotInterval) return;
    this.snapshotInterval = setInterval(() => {
      const snapshot = this.collectSnapshot();
      for (const cb of this.performanceListeners) {
        try {
          cb(snapshot);
        } catch {}
      }
    }, 2000);
  }

  private stopPerformanceRoutine(): void {
    if (this.snapshotInterval && this.performanceListeners.size === 0) {
      clearInterval(this.snapshotInterval);
      this.snapshotInterval = null;
    }
  }

  boot(): void {
    if (!process.parentPort) {
      throw new Error('parentPort is not available');
    }

    const SELF_ID = 'daemon';
    const mainChannel = new ElectronUtilityProcessChannel({
      parentPort: process.parentPort as any,
      description: 'daemon→main IPC channel',
    });

    const daemonHandlers = {
      systemStatus: (): string => {
        this.monitorCount++;
        return `system OK (#${this.monitorCount}), uptime=${Math.floor(
          process.uptime()
        )}s`;
      },
      echo: (msg: string): string => `daemon echo: ${msg}`,
      onSystemStatusChange: (callback: (status: any) => void) => {
        const interval = setInterval(() => {
          callback({
            timestamp: Date.now(),
            uptime: Math.floor(process.uptime()),
            memoryUsage: process.memoryUsage(),
            monitorCount: this.monitorCount,
          });
        }, 2000);
        return () => clearInterval(interval);
      },
      onLogEvent: (callback: (log: any) => void) => {
        const levels = ['INFO', 'WARN', 'DEBUG', 'ERROR'] as const;
        const messages = [
          'Health check passed',
          'Connection established',
          'Cache updated',
          'Request processed',
        ];
        const interval = setInterval(() => {
          callback({
            timestamp: new Date().toISOString(),
            level: levels[Math.floor(Math.random() * levels.length)],
            message: messages[Math.floor(Math.random() * messages.length)],
            pid: process.pid,
          });
        }, 1500);
        return () => clearInterval(interval);
      },
    };

    const monitorHandlers = {
      getPerformanceSnapshot: (): MonitorSnapshot => {
        return this.collectSnapshot();
      },
      onPerformanceUpdate: (callback: (snapshot: MonitorSnapshot) => void) => {
        this.performanceListeners.add(callback);
        this.startPerformanceRoutine();
        return () => {
          this.performanceListeners.delete(callback);
          this.stopPerformanceRoutine();
        };
      },
    };

    const proxy = createParticipantProxy({
      selfId: SELF_ID,
      controlChannel: mainChannel,
      onConnection: (conn) => {
        console.log(
          `[daemon-worker] connection from ${conn.peerId} (role=${conn.role})`
        );
        const ch = proxy.getChannelFor(conn.peerId);
        if (ch) {
          serviceHost.registerService(DAEMON_SERVICE_PATH, {
            channel: ch,
            serviceHost,
            handlers: daemonHandlers,
          });
          serviceHost.registerService(MONITOR_SERVICE_PATH, {
            channel: ch,
            serviceHost,
            handlers: monitorHandlers,
          });
          console.log(
            `[daemon-worker] ${DAEMON_SERVICE_PATH} + ${MONITOR_SERVICE_PATH} registered for ${conn.peerId}`
          );
        }
      },
    });

    console.log('[daemon-worker] initialized, waiting for pagelet connections');
  }
}
