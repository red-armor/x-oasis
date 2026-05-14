import { createId, inject, injectable } from '@x-oasis/di';
import {
  UtilityProcessSupervisor,
  type ChannelReadyInfo,
  type InspectorSnapshot,
  type SpawnInfo,
  type StateChangeEvent,
} from '@x-oasis/async-call-rpc-electron';
import { serviceHost } from '@x-oasis/async-call-rpc';
import { join } from 'path';

import {
  IMainCpServer,
  MainCpServerId,
} from '@/apps/main/application/electron-main/MainCpServer';
import { pidNameRegistry } from '@/services/main-metrics/electron-main/pidNameRegistry';
import { DAEMON_PARTICIPANT_ID } from '@/apps/daemon/application/common';

export interface IDaemonProcess {
  spawn(): Promise<void>;
  /** Latest supervisor snapshot (G3 inspector). Null until spawned. */
  getInspectorSnapshot(): InspectorSnapshot | null;
}

export const DaemonProcessId = createId('DaemonProcess');

@injectable()
export class DaemonProcess implements IDaemonProcess {
  private supervisor: UtilityProcessSupervisor | null = null;

  constructor(
    @inject(MainCpServerId) private readonly cpServer: IMainCpServer
  ) {}

  async spawn(): Promise<void> {
    let lastPid: number | null = null;
    this.supervisor = new UtilityProcessSupervisor({
      orchestrator: this.cpServer.getOrchestrator(),
      participantId: DAEMON_PARTICIPANT_ID,
      entry: join(__dirname, '../preload/daemon-worker.js'),
      role: 'utility',
      onSpawn: ({ pid, isRestart }: SpawnInfo) => {
        if (isRestart && lastPid !== null) {
          pidNameRegistry.unregisterPid(lastPid);
        }
        pidNameRegistry.registerByPid(pid, 'Daemon');
        lastPid = pid;
      },
      onChannelReady: ({ channel }: ChannelReadyInfo) => {
        // Bind the global serviceHost so daemon-initiated calls (e.g. the
        // diagnostics pull for `getSupervisorSnapshots` / `getAppMetrics`
        // via MainMetricsService) reach main's registered handlers.
        channel.setServiceHost(serviceHost);
      },
      onStateChange: (event: StateChangeEvent) => {
        console.log(
          `[DaemonProcess:state] ${event.prev} → ${event.curr}${
            event.reason ? ` (${event.reason})` : ''
          }`
        );
      },
      logger: (level: string, msg: string) =>
        console.log(`[DaemonProcess:${level}] ${msg}`),
    });
    await this.supervisor.start();
    console.log('[DaemonProcess] spawned');
  }

  getInspectorSnapshot(): InspectorSnapshot | null {
    return this.supervisor?.getInspectorSnapshot() ?? null;
  }
}
