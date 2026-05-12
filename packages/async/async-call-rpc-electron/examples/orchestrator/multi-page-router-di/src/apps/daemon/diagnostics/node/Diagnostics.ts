import { MonitorSnapshot, ProcessRow } from '../common/types';

export class Diagnostics {
  private listeners: Set<(snapshot: MonitorSnapshot) => void> = new Set();
  private interval: ReturnType<typeof setInterval> | null = null;

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

  private startRoutine(): void {
    if (this.interval) return;
    this.interval = setInterval(() => {
      const snapshot = this.collectSnapshot();
      for (const cb of this.listeners) {
        try {
          cb(snapshot);
        } catch {}
      }
    }, 2000);
  }

  private stopRoutine(): void {
    if (this.interval && this.listeners.size === 0) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }

  getPerformanceSnapshot(): MonitorSnapshot {
    return this.collectSnapshot();
  }

  onPerformanceUpdate(
    callback: (snapshot: MonitorSnapshot) => void
  ): () => void {
    this.listeners.add(callback);
    this.startRoutine();
    return () => {
      this.listeners.delete(callback);
      this.stopRoutine();
    };
  }
}
