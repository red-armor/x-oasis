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

export interface PidNodeJson {
  pid: string;
  ppid: string;
  cpu: string;
  mem: string;
  command: string;
  children: PidNodeJson[];
}

/**
 * Plain JSON shape mirroring `InspectorSnapshot` from
 * `@x-oasis/async-call-rpc-electron`. Duplicated here so we don't pull
 * the electron-only sub-path into the daemon (a node utility process).
 */
export interface SupervisorInspectorSnapshot {
  participantId: string;
  state: string;
  currentPid: number | null;
  restartCount: number;
  orchestratorCount: number;
  restartHistory: ReadonlyArray<{
    triggeredAt: number;
    prevPid: number | null;
    exitCode: number | null;
    reason: string;
    restartCount: number;
    newPid?: number;
    succeededAt?: number;
    failedAt?: number;
  }>;
}

export interface MonitorSnapshot {
  timestamp: number;
  totals: PerformanceTotals;
  processes: ProcessRow[];
  pidTree: PidNodeJson | null;
  /**
   * Pushed periodically by the main process via
   * `IDaemonService.setSupervisorSnapshots`. Empty array until the
   * first push lands.
   */
  supervisorSnapshots: SupervisorInspectorSnapshot[];
}

export interface IDiagnosticsService {
  getPerformanceSnapshot(): Promise<MonitorSnapshot>;
  onPerformanceUpdate(
    callback: (snapshot: MonitorSnapshot) => void
  ): () => void;
}
