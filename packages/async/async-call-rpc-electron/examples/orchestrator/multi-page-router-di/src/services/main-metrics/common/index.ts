import type { SupervisorInspectorSnapshot } from '@/apps/daemon/diagnostics/common';

export const MAIN_METRICS_SERVICE_PATH = 'main-metrics';

export interface AppMetric {
  pid: number;
  name: string | null;
  type: string;
  cpu: {
    percentCPUUsage: number;
  };
  memory: {
    workingSetSize: number;
  };
}

export interface IMainMetricsService {
  getAppMetrics(): AppMetric[];
  getMainPid(): number;
  getUtilityPidNames(): Record<number, string>;
  /**
   * Pull the latest UtilityProcessSupervisor inspector snapshots
   * (one per supervised utility process). Daemon's Diagnostics
   * folds the result into the next MonitorSnapshot so the Monitor
   * pagelet's Supervisors tab can render them.
   */
  getSupervisorSnapshots(): SupervisorInspectorSnapshot[];
  /**
   * Push channel for supervisor inspector snapshots. The main process
   * fires on:
   *   1. every supervisor `subscribeStateChange` event (via
   *      AppApplication wiring)
   *   2. a 1s baseline interval (catches in-state mutations like
   *      currentPid changing mid-running)
   *
   * This channel is independent from the daemon-driven
   * MonitorSnapshot push so that supervisor state transitions
   * (restarting/failed) are visible even when the daemon supervisor
   * is itself the one transitioning — the daemon push source is dead
   * during the restart window.
   */
  onSupervisorSnapshotsChanged(
    callback: (snapshots: SupervisorInspectorSnapshot[]) => void
  ): () => void;
}
