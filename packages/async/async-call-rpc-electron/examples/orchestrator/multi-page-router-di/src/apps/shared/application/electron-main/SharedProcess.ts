import { createId, inject, injectable } from '@x-oasis/di';
import {
  type ChannelReadyInfo,
  type InspectorSnapshot,
  type SpawnInfo,
  type StateChangeEvent,
} from '@x-oasis/async-call-rpc-electron/electron-main/core';
import { UtilityProcessSupervisor } from '@x-oasis/async-call-rpc-electron/electron-main/orchestrator';
import { serviceHost } from '@x-oasis/async-call-rpc/core';
import { ExponentialBackoffPolicy } from '@x-oasis/async-call-rpc/orchestrator';
import { join } from 'path';

import {
  IMainCpServer,
  MainCpServerId,
} from '@/apps/main/application/electron-main/MainCpServer';
import { pidNameRegistry } from '@/services/main-metrics/electron-main/pidNameRegistry';
import { SHARED_PARTICIPANT_ID } from '@/apps/shared/application/common';

export interface ISharedProcess {
  spawn(): Promise<void>;
  /** Latest supervisor snapshot (G3 inspector). Null until spawned. */
  getInspectorSnapshot(): InspectorSnapshot | null;
}

export const SharedProcessId = createId('SharedProcess');

@injectable()
export class SharedProcess implements ISharedProcess {
  private supervisor: UtilityProcessSupervisor | null = null;

  constructor(
    @inject(MainCpServerId) private readonly cpServer: IMainCpServer
  ) {}

  async spawn(): Promise<void> {
    let lastPid: number | null = null;
    this.supervisor = new UtilityProcessSupervisor({
      orchestrator: this.cpServer.getOrchestrator(),
      participantId: SHARED_PARTICIPANT_ID,
      entry: join(__dirname, '../preload/shared-worker.js'),
      role: 'utility',
      // Demo-friendly restart policy — see DaemonProcess for the
      // rationale behind these values.
      restartPolicy: new ExponentialBackoffPolicy({
        initialDelayMs: 500,
        maxDelayMs: 5_000,
        maxRetries: 10,
      }),
      onSpawn: ({ pid, isRestart }: SpawnInfo) => {
        if (isRestart && lastPid !== null) {
          pidNameRegistry.unregisterPid(lastPid);
        }
        pidNameRegistry.registerByPid(pid, 'Shared');
        lastPid = pid;
      },
      onChannelReady: ({ channel }: ChannelReadyInfo) => {
        channel.setServiceHost(serviceHost);
      },
      onStateChange: (event: StateChangeEvent) => {
        console.log(
          `[SharedProcess:state] ${event.prev} → ${event.curr}${
            event.reason ? ` (${event.reason})` : ''
          }`
        );
      },
      logger: (level: string, msg: string) =>
        console.log(`[SharedProcess:${level}] ${msg}`),
    });
    await this.supervisor.start();
    console.log('[SharedProcess] spawned');
  }

  getInspectorSnapshot(): InspectorSnapshot | null {
    return this.supervisor?.getInspectorSnapshot() ?? null;
  }
}
