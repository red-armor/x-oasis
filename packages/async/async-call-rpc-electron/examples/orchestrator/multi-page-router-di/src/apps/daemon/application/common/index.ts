import type { SupervisorInspectorSnapshot } from '@/apps/daemon/diagnostics/common';

export const DAEMON_PARTICIPANT_ID = 'daemon';

export const DAEMON_SERVICE_PATH = 'daemon-rpc';

export interface IDaemonService {
  echo(msg: string): Promise<string>;
  systemStatus(): Promise<string>;
  getPerformanceSnapshot(): Promise<any>;
  onPerformanceUpdate(callback: (snapshot: any) => void): Promise<() => void>;
  /**
   * Push the latest supervisor inspector snapshots from main into the
   * daemon. The daemon caches them and folds them into the next
   * MonitorSnapshot. Call site: AppApplication 2-second push loop.
   */
  setSupervisorSnapshots(
    snapshots: SupervisorInspectorSnapshot[]
  ): Promise<void>;
}
