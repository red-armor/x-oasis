import { createId, inject, injectable } from '@x-oasis/di';
import { serviceHost } from '@x-oasis/async-call-rpc';

import { IWindowManager, WindowManagerId } from './WindowManager';
import { IMainCpServer, MainCpServerId } from './MainCpServer';
import { ISharedProcess, SharedProcessId } from './SharedProcess';
import { IDaemonProcess, DaemonProcessId } from './DaemonProcess';
import { IPageletProcess, PageletProcessId } from './PageletProcess';
import { IAppOrchestrator, AppOrchestratorId } from './AppOrchestrator';
import { MAIN_RPC_SERVICE_PATH } from '../common/types';

export interface IAppApplication {
  start(): Promise<void>;
}

export const AppApplicationId = createId('AppApplication');

@injectable()
export class AppApplication implements IAppApplication {
  constructor(
    @inject(WindowManagerId) private readonly windowManager: IWindowManager,
    @inject(MainCpServerId) private readonly mainCpServer: IMainCpServer,
    @inject(SharedProcessId) private readonly sharedProcess: ISharedProcess,
    @inject(DaemonProcessId) private readonly daemonProcess: IDaemonProcess,
    @inject(PageletProcessId) private readonly pageletProcess: IPageletProcess,
    @inject(AppOrchestratorId)
    private readonly appOrchestrator: IAppOrchestrator
  ) {}

  async start(): Promise<void> {
    console.log('[AppApplication] start()');

    // Step 1: Open window first (MainCpServer needs webContents)
    this.windowManager.openMainWindow();

    // Step 2: Stand up the cp channel + orchestrator
    this.mainCpServer.start();

    // Step 3: Register main-rpc service BEFORE spawning (workers use it on boot)
    let mainCallCount = 0;
    serviceHost.registerServiceHandler(MAIN_RPC_SERVICE_PATH, {
      mainPing(msg: string): string {
        mainCallCount++;
        return `pong from main (#${mainCallCount}): ${msg}`;
      },
    });

    // Step 4: Spawn shared and daemon utilities (global singletons)
    await Promise.all([this.sharedProcess.spawn(), this.daemonProcess.spawn()]);

    // Step 5: Spawn pagelet utilities
    await this.pageletProcess.spawn();

    // Step 6: Register orchestrator service on renderer channel
    this.appOrchestrator.registerOrchestratorService();

    console.log('[AppApplication] start() done');
  }
}
