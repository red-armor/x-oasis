import { createId, inject, injectable } from '@x-oasis/di';
import { utilityProcess } from 'electron';
import { ElectronUtilityProcessChannel } from '@x-oasis/async-call-rpc-electron';
import { serviceHost } from '@x-oasis/async-call-rpc';
import { join } from 'path';

import {
  IMainCpServer,
  MainCpServerId,
} from '../../../../../electron-main/MainCpServer';
import { DAEMON_PARTICIPANT_ID } from '../common';

export interface IDaemonProcess {
  spawn(): Promise<void>;
}

export const DaemonProcessId = createId('DaemonProcess');

@injectable()
export class DaemonProcess implements IDaemonProcess {
  constructor(
    @inject(MainCpServerId) private readonly cpServer: IMainCpServer
  ) {}

  async spawn(): Promise<void> {
    const proc = utilityProcess.fork(
      join(__dirname, '../preload/daemon-worker.js')
    );
    const channel = new ElectronUtilityProcessChannel({
      process: proc,
      description: 'main→daemon IPC channel',
    });
    channel.setServiceHost(serviceHost);

    this.cpServer
      .getOrchestrator()
      .registerParticipant(DAEMON_PARTICIPANT_ID, channel, 'utility');

    console.log('[DaemonProcess] spawned');
  }
}
