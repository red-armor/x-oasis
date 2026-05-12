import { createId, inject, injectable } from '@x-oasis/di';
import { utilityProcess } from 'electron';
import { ElectronUtilityProcessChannel } from '@x-oasis/async-call-rpc-electron';
import { serviceHost } from '@x-oasis/async-call-rpc';
import { join } from 'path';

import {
  IMainCpServer,
  MainCpServerId,
} from '../../../../../electron-main/MainCpServer';
import { PAGELET_IDS } from '../common';

export interface IPageletProcess {
  spawn(): Promise<void>;
  kill(pageletId: string): void;
}

export const PageletProcessId = createId('PageletProcess');

@injectable()
export class PageletProcess implements IPageletProcess {
  private processes = new Map<string, Electron.UtilityProcess>();

  constructor(
    @inject(MainCpServerId) private readonly cpServer: IMainCpServer
  ) {}

  async spawn(): Promise<void> {
    for (const pageletId of PAGELET_IDS) {
      const workerFileName = `${pageletId}-worker.js`;
      const proc = utilityProcess.fork(
        join(__dirname, `../preload/${workerFileName}`)
      );
      const channel = new ElectronUtilityProcessChannel({
        process: proc,
        description: `main→${pageletId} IPC channel`,
      });
      channel.setServiceHost(serviceHost);

      this.processes.set(pageletId, proc);
      this.cpServer
        .getOrchestrator()
        .registerParticipant(pageletId, channel, 'utility');
    }

    console.log(`[PageletProcess] spawned ${PAGELET_IDS.length} pagelets`);
  }

  kill(pageletId: string): void {
    this.processes.get(pageletId)?.kill();
  }
}
