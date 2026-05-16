import { createId, inject, injectable } from '@x-oasis/di';
import { serviceHost, clientHost } from '@x-oasis/async-call-rpc/core';
import {
  PageletWorker,
  PageletWorkerConfigId,
  IPageletWorkerConfig,
} from '@/services/pagelet-host/node/PageletWorker';
import {
  MONITOR_PAGELET_SERVICE_PATH,
  type SupervisorInspectorSnapshot,
} from '@/apps/monitor/application/common';
import { IDaemonService } from '@/apps/daemon/application/common';
import {
  MAIN_METRICS_SERVICE_PATH,
  type IMainMetricsService,
} from '@/services/main-metrics/common';

export const MonitorPageletWorkerId = createId('MonitorPageletWorker');

type SnapshotCallback = (snapshot: unknown) => void;
type SupervisorSnapshotCallback = (
  snapshots: SupervisorInspectorSnapshot[]
) => void;

@injectable()
export class MonitorPageletWorker extends PageletWorker {
  /**
   * Renderer-supplied performance-update callbacks. We keep our own
   * registry (instead of forwarding straight to daemon) so we can
   * re-subscribe them against the daemon every time the daemon
   * channel reconnects (daemon kill -9 → supervisor respawn → channel
   * `bindPort({rebind:true})` → channel.onDidConnected fires here).
   *
   * Without this, the renderer's one-shot subscription dies with the
   * old daemon process and the SupervisorsPanel daemon card freezes
   * on the old PID.
   */
  private readonly snapshotListeners = new Set<SnapshotCallback>();
  private daemonSubscriptionAttached = false;

  /**
   * Independent push-channel subscribers for supervisor inspector
   * snapshots, sourced from main (not from daemon) — see
   * IMainMetricsService.onSupervisorSnapshotsChanged for why
   * this lives on a separate path. Same renderer-side fan-out pattern
   * as snapshotListeners: we register exactly once with main
   * and re-broadcast to every renderer subscriber.
   */
  private readonly supervisorSnapshotListeners =
    new Set<SupervisorSnapshotCallback>();
  private mainMetricsClient: IMainMetricsService | null = null;
  private mainSupervisorSubscriptionAttached = false;
  private latestSupervisorSnapshots: SupervisorInspectorSnapshot[] | null =
    null;

  constructor(@inject(PageletWorkerConfigId) config: IPageletWorkerConfig) {
    super(config);
  }

  override async boot(): Promise<void> {
    await super.boot();
    this.attachDaemonReconnectHandler();
    this.attachMainSupervisorSubscription();
  }

  /**
   * Register a single subscription against
   * IMainMetricsService.onSupervisorSnapshotsChanged (over the
   * pagelet→main channel) and fan out every payload to renderer-side
   * subscribers. Re-subscribes on mainChannel.onDidConnected for
   * symmetry with the daemon path.
   */
  private attachMainSupervisorSubscription(): void {
    if (this.mainSupervisorSubscriptionAttached) return;
    if (!this.mainChannel) return;
    this.mainSupervisorSubscriptionAttached = true;

    this.mainMetricsClient = clientHost
      .registerClient(MAIN_METRICS_SERVICE_PATH, {
        channel: this.mainChannel,
      })
      .createProxy() as unknown as IMainMetricsService;

    const subscribe = (): void => {
      try {
        this.mainMetricsClient?.onSupervisorSnapshotsChanged(
          (snapshots: SupervisorInspectorSnapshot[]) => {
            this.latestSupervisorSnapshots = snapshots;
            for (const cb of this.supervisorSnapshotListeners) {
              try {
                cb(snapshots);
              } catch (err) {
                console.warn(
                  `[monitor-worker] supervisor snapshot listener threw: ${
                    err instanceof Error ? err.message : String(err)
                  }`
                );
              }
            }
          }
        );
      } catch (err) {
        console.warn(
          `[monitor-worker] main supervisor subscribe failed: ${
            err instanceof Error ? err.message : String(err)
          }`
        );
      }
    };

    subscribe();
    this.mainChannel.onDidConnected(() => {
      console.log(
        `[monitor-worker] main channel reconnected — re-subscribing supervisor snapshots`
      );
      subscribe();
    });
  }

  /**
   * Wire daemonChannel.onDidConnected so that whenever the daemon
   * channel reconnects (after a daemon utility-process restart) we
   * re-establish every active onPerformanceUpdate subscription.
   */
  private attachDaemonReconnectHandler(): void {
    if (this.daemonSubscriptionAttached) return;
    if (!this.daemonChannel) return;
    this.daemonSubscriptionAttached = true;
    this.daemonChannel.onDidConnected(() => {
      if (this.snapshotListeners.size === 0) return;
      console.log(
        `[monitor-worker] daemon channel reconnected — re-subscribing ` +
          `${this.snapshotListeners.size} snapshot listener(s)`
      );
      for (const cb of this.snapshotListeners) {
        try {
          (this.daemonClient as IDaemonService)?.onPerformanceUpdate(cb);
        } catch (err) {
          console.warn(
            `[monitor-worker] re-subscribe failed: ${
              err instanceof Error ? err.message : String(err)
            }`
          );
        }
      }
    });
  }

  protected override onRendererConnection(channel: any): void {
    serviceHost.registerService(MONITOR_PAGELET_SERVICE_PATH, {
      channel,
      serviceHost,
      handlers: {
        info: (): string => `monitor-pagelet ready (pid=${process.pid})`,
        getSnapshot: (): unknown =>
          (this.daemonClient as IDaemonService)?.getPerformanceSnapshot(),
        onPerformanceUpdate: (callback: SnapshotCallback) => {
          this.snapshotListeners.add(callback);
          (this.daemonClient as IDaemonService)?.onPerformanceUpdate(callback);
          return () => {
            this.snapshotListeners.delete(callback);
          };
        },
        onSupervisorSnapshotsChanged: (
          callback: SupervisorSnapshotCallback
        ) => {
          this.supervisorSnapshotListeners.add(callback);
          if (this.latestSupervisorSnapshots !== null) {
            try {
              callback(this.latestSupervisorSnapshots);
            } catch (err) {
              console.warn(
                `[monitor-worker] supervisor replay to new subscriber threw: ${
                  err instanceof Error ? err.message : String(err)
                }`
              );
            }
          }
          return () => {
            this.supervisorSnapshotListeners.delete(callback);
          };
        },
      },
    });
  }
}
