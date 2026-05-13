import { createId, inject, injectable } from '@x-oasis/di';
import {
  IPCMainChannel,
  ElectronConnectionOrchestrator,
} from '@x-oasis/async-call-rpc-electron';
import { serviceHost } from '@x-oasis/async-call-rpc';
import { BrowserWindow } from 'electron';

import {
  IWindowManager,
  WindowManagerId,
} from '@/apps/main/application/electron-main/WindowManager';
import { ORCHESTRATOR_CP_CHANNEL_NAME } from '@/apps/main/application/common/cp-config';
import { RENDERER_PARTICIPANT_ID } from '@/services/pagelet-host/common';

export interface IMainCpServer {
  start(): void;
  getOrchestrator(): ElectronConnectionOrchestrator;
  getRendererIpcChannel(): IPCMainChannel;
  registerSettingWindow(win: BrowserWindow): IPCMainChannel;
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

  registerSettingWindow(win: BrowserWindow): IPCMainChannel {
    const settingIpcChannel = new IPCMainChannel({
      channelName: 'setting-rpc',
      webContents: win.webContents,
      description: 'main→setting-renderer IPC channel',
    });

    this.orchestrator.registerParticipant(
      'setting-renderer',
      settingIpcChannel,
      'renderer'
    );

    settingIpcChannel.setServiceHost(serviceHost);

    console.log('[MainCpServer] setting window registered');

    return settingIpcChannel;
  }
}
