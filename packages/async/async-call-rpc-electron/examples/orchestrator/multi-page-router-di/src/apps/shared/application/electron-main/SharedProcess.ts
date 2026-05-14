import { createId, inject, injectable } from '@x-oasis/di';
import {
  UtilityProcessSupervisor,
  type SpawnInfo,
  type ChannelReadyInfo,
} from '@x-oasis/async-call-rpc-electron';
import { serviceHost } from '@x-oasis/async-call-rpc';
import { join } from 'path';

import {
  IMainCpServer,
  MainCpServerId,
} from '@/apps/main/application/electron-main/MainCpServer';
import { pidNameRegistry } from '@/services/main-metrics/electron-main/pidNameRegistry';
import { SHARED_PARTICIPANT_ID } from '@/apps/shared/application/common';

export interface ISharedProcess {
  spawn(): Promise<void>;
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
      logger: (level: string, msg: string) =>
        console.log(`[SharedProcess:${level}] ${msg}`),
    });
    await this.supervisor.start();
    console.log('[SharedProcess] spawned');
  }
}
