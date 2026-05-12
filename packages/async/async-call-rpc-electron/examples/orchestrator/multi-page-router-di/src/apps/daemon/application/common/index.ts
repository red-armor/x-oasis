export const DAEMON_PARTICIPANT_ID = 'daemon';

export const DAEMON_SERVICE_PATH = 'daemon-rpc';

export interface IDaemonService {
  echo(msg: string): Promise<string>;
  systemStatus(): Promise<string>;
}

export interface ProcessRow {
  pid: number;
  name: string | null;
  type: string;
  cpu: number;
  memory: number;
}

export interface PerformanceTotals {
  cpu: number;
  memory: number;
}

export interface MonitorSnapshot {
  timestamp: number;
  totals: PerformanceTotals;
  processes: ProcessRow[];
}

export const MONITOR_SERVICE_PATH = 'monitor-rpc';

export interface IMonitorService {
  getPerformanceSnapshot(): Promise<MonitorSnapshot>;
  onPerformanceUpdate(
    callback: (snapshot: MonitorSnapshot) => void
  ): () => void;
}
