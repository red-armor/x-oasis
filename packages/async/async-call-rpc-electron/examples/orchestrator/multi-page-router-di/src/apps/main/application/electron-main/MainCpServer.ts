import { createId, inject, injectable } from '@x-oasis/di';
import {
  IPCMainChannel,
  ElectronConnectionOrchestrator,
} from '@x-oasis/async-call-rpc-electron';
import { serviceHost } from '@x-oasis/async-call-rpc';

import { IWindowManager, WindowManagerId } from './WindowManager';
import { ORCHESTRATOR_CP_CHANNEL_NAME } from '../common/cp-config';
import { RENDERER_PARTICIPANT_ID } from '../../../../services/pagelet-host/common';

export interface IMainCpServer {
  start(): void;
  getOrchestrator(): ElectronConnectionOrchestrator;
  getRendererIpcChannel(): IPCMainChannel;
}

export const MainCpServerId = createId('MainCpServer');

@injectable()
export class MainCpServer implements IMainCpServer {
  private orchestrator!: ElectronConnectionOrchestrator;
  private rendererIpcChannel!: IPCMainChannel;

  constructor(
    @inject(WindowManagerId) private readonly windowManager: IWindowManager
  ) {}

  start(): void {
    const win = this.windowManager.getMainWindow();
    if (!win)
      throw new Error(
        'WindowManager must openMainWindow before MainCpServer.start()'
      );

    this.rendererIpcChannel = new IPCMainChannel({
      channelName: ORCHESTRATOR_CP_CHANNEL_NAME,
      webContents: win.webContents,
      description: 'main→renderer IPC channel',
    });

    this.orchestrator = new ElectronConnectionOrchestrator({
      logger: (level, msg) => console.log(`[orchestrator:${level}] ${msg}`),
      enableStats: true,
      heartbeat: {
        enabled: true,
        intervalMs: 10_000,
        timeoutMs: 5_000,
      },
    });

    this.orchestrator.registerParticipant(
      RENDERER_PARTICIPANT_ID,
      this.rendererIpcChannel,
      'renderer'
    );

    this.orchestrator.registerProxyService(serviceHost);

    console.log('[MainCpServer] started');
  }

  getOrchestrator(): ElectronConnectionOrchestrator {
    return this.orchestrator;
  }

  getRendererIpcChannel(): IPCMainChannel {
    return this.rendererIpcChannel;
  }
}
