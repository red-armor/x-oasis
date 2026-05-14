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
}
