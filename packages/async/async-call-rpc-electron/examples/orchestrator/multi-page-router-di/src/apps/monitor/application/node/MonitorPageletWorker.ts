import { createId, injectable } from '@x-oasis/di';
import {
  ElectronUtilityProcessChannel,
  createParticipantProxy,
} from '@x-oasis/async-call-rpc-electron';
import { clientHost, serviceHost } from '@x-oasis/async-call-rpc';

import {
  MONITOR_PAGELET_SERVICE_PATH,
  RENDERER_PARTICIPANT_ID,
} from '@/services/pagelet-host/common';
import {
  DAEMON_SERVICE_PATH,
  IDaemonService,
} from '@/apps/daemon/application/common';

export const MonitorPageletWorkerId = createId('MonitorPageletWorker');

@injectable()
export class MonitorPageletWorker {
  private daemonClient: IDaemonService | null = null;

  async boot(): Promise<void> {
    if (!process.parentPort) {
      throw new Error('parentPort is not available');
    }

    const mainChannel = new ElectronUtilityProcessChannel({
      parentPort: process.parentPort as any,
      description: 'monitor→main IPC channel',
    });

    const proxy = createParticipantProxy({
      selfId: 'monitor',
      controlChannel: mainChannel,
      onConnection: (conn) => {
        console.log(
          `[monitor-worker] connection: ${conn.connectionId}, peer=${conn.peerId}, role=${conn.role}`
        );
        const ch = proxy.getChannelFor(conn.peerId);
        if (ch && conn.peerId === RENDERER_PARTICIPANT_ID) {
          serviceHost.registerService(MONITOR_PAGELET_SERVICE_PATH, {
            channel: ch,
            serviceHost,
            handlers: {
              info: (): string => `monitor-pagelet ready (pid=${process.pid})`,
              getSnapshot: (): any =>
                this.daemonClient?.getPerformanceSnapshot(),
              onPerformanceUpdate: (callback: (snapshot: any) => void) =>
                this.daemonClient?.onPerformanceUpdate(callback),
            },
          });
          console.log(
            `[monitor-worker] ${MONITOR_PAGELET_SERVICE_PATH} registered on ${conn.peerId} channel`
          );
        }
      },
    });

    const daemonConn = await proxy.connect('daemon');

    this.daemonClient = clientHost
      .registerClient(DAEMON_SERVICE_PATH, {
        channel: daemonConn.getChannel(),
      })
      .createProxy() as unknown as IDaemonService;

    console.log(
      '[monitor-worker] connected to daemon, waiting for renderer to connect'
    );
  }
}
