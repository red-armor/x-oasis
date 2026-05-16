import type { SupervisorInspectorSnapshot } from '@/apps/daemon/diagnostics/common';

export class MainMetricsService {
  private supervisorProvider: (() => SupervisorInspectorSnapshot[]) | null =
    null;
  private readonly supervisorSnapshotsListeners = new Set<
    (snapshots: SupervisorInspectorSnapshot[]) => void
  >();
  private supervisorBaselineTimer: ReturnType<typeof setInterval> | null = null;

  setSupervisorProvider(provider: () => SupervisorInspectorSnapshot[]): void {
    this.supervisorProvider = provider;
  }

  getSupervisorSnapshots(): SupervisorInspectorSnapshot[] {
    if (!this.supervisorProvider) return [];
    try {
      return this.supervisorProvider();
    } catch {
      return [];
    }
  }

  onSupervisorSnapshotsChanged(
    callback: (snapshots: SupervisorInspectorSnapshot[]) => void
  ): () => void {
    this.supervisorSnapshotsListeners.add(callback);
    this.startSupervisorBaseline();
    return () => {
      this.supervisorSnapshotsListeners.delete(callback);
      if (this.supervisorSnapshotsListeners.size === 0) {
        this.stopSupervisorBaseline();
      }
    };
  }

  triggerSupervisorSnapshotsChanged(): void {
    if (this.supervisorSnapshotsListeners.size === 0) return;
    const snapshots = this.getSupervisorSnapshots();
    for (const cb of this.supervisorSnapshotsListeners) {
      try {
        cb(snapshots);
      } catch {}
    }
  }

  private startSupervisorBaseline(): void {
    if (this.supervisorBaselineTimer) return;
    this.supervisorBaselineTimer = setInterval(() => {
      this.triggerSupervisorSnapshotsChanged();
    }, 1000);
  }

  private stopSupervisorBaseline(): void {
    if (this.supervisorBaselineTimer) {
      clearInterval(this.supervisorBaselineTimer);
      this.supervisorBaselineTimer = null;
    }
  }
}
