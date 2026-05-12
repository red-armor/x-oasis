import { createId, inject, injectable } from '@x-oasis/di';
import { serviceHost } from '@x-oasis/async-call-rpc';

import {
  IWindowManager,
  WindowManagerId,
} from '@/apps/main/application/electron-main/WindowManager';
import {
  IMainCpServer,
  MainCpServerId,
} from '@/apps/main/application/electron-main/MainCpServer';
import {
  IDaemonApplication,
  DaemonApplicationId,
} from '@/apps/daemon/application/node/DaemonApplication';
import {
  ISharedApplication,
  SharedApplicationId,
} from '@/apps/shared/application/node/SharedApplication';
import {
  IConnectionApplication,
  ConnectionApplicationId,
} from '@/apps/connection/application/node/ConnectionApplication';
import {
  IMonitorApplication,
  MonitorApplicationId,
} from '@/apps/monitor/application/electron-main/MonitorApplication';
import { MAIN_RPC_SERVICE_PATH } from '@/services/pagelet-host/common';

export interface IAppApplication {
  start(): Promise<void>;
}

export const AppApplicationId = createId('AppApplication');

@injectable()
export class AppApplication implements IAppApplication {
  constructor(
    @inject(WindowManagerId) private readonly windowManager: IWindowManager,
    @inject(MainCpServerId) private readonly mainCpServer: IMainCpServer,
    @inject(DaemonApplicationId) private readonly daemonApp: IDaemonApplication,
    @inject(SharedApplicationId) private readonly sharedApp: ISharedApplication,
    @inject(ConnectionApplicationId)
    private readonly connectionApp: IConnectionApplication,
    @inject(MonitorApplicationId)
    private readonly monitorApp: IMonitorApplication
  ) {}

  async start(): Promise<void> {
    console.log('[AppApplication] start()');

    this.windowManager.openMainWindow();

    this.mainCpServer.start();

    let mainCallCount = 0;
    serviceHost.registerServiceHandler(MAIN_RPC_SERVICE_PATH, {
      mainPing(msg: string): string {
        mainCallCount++;
        return `pong from main (#${mainCallCount}): ${msg}`;
      },
    });

    await Promise.all([this.sharedApp.start(), this.daemonApp.start()]);

    await this.connectionApp.start();
    await this.monitorApp.start();

    console.log('[AppApplication] start() done');
  }
}
