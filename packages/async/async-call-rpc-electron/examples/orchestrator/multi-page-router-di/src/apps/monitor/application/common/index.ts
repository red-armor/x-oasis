import type {
  ProcessRow,
  PerformanceTotals,
  MonitorSnapshot,
  SupervisorInspectorSnapshot,
  IDiagnosticsService,
} from '@/apps/daemon/diagnostics/common';

export type {
  ProcessRow,
  PerformanceTotals,
  MonitorSnapshot,
  SupervisorInspectorSnapshot,
  IDiagnosticsService,
};

export const MONITOR_PAGELET_SERVICE_PATH = 'monitor-pagelet-api';

export interface IMonitorPageletService {
  info(): Promise<string>;
  getSnapshot(): Promise<any>;
  onPerformanceUpdate(callback: (snapshot: any) => void): () => void;
  onSupervisorSnapshotsChanged(
    callback: (snapshots: SupervisorInspectorSnapshot[]) => void
  ): () => void;
}
