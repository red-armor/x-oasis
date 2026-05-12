export const DIAGNOSTICS_SERVICE_PATH = 'monitor-rpc';

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

export interface IDiagnosticsService {
  getPerformanceSnapshot(): MonitorSnapshot;
  onPerformanceUpdate(
    callback: (snapshot: MonitorSnapshot) => void
  ): () => void;
}
