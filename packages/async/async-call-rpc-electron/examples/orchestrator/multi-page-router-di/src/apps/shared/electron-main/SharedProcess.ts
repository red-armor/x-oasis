import { createId, inject, injectable } from '@x-oasis/di';
import { utilityProcess } from 'electron';
import { ElectronUtilityProcessChannel } from '@x-oasis/async-call-rpc-electron';
import { serviceHost } from '@x-oasis/async-call-rpc';
import { join } from 'path';

import {
  IMainCpServer,
  MainCpServerId,
} from '../../../../electron-main/MainCpServer';
import { SHARED_PARTICIPANT_ID } from '../common';

export interface ISharedProcess {
  spawn(): Promise<void>;
}

export const SharedProcessId = createId('SharedProcess');

@injectable()
export class SharedProcess implements ISharedProcess {
  constructor(
    @inject(MainCpServerId) private readonly cpServer: IMainCpServer
  ) {}

  async spawn(): Promise<void> {
    const proc = utilityProcess.fork(
      join(__dirname, '../preload/shared-worker.js')
    );
    const channel = new ElectronUtilityProcessChannel({
      process: proc,
      description: 'main→shared IPC channel',
    });
    channel.setServiceHost(serviceHost);

    this.cpServer
      .getOrchestrator()
      .registerParticipant(SHARED_PARTICIPANT_ID, channel, 'utility');

    console.log('[SharedProcess] spawned');
  }
}
