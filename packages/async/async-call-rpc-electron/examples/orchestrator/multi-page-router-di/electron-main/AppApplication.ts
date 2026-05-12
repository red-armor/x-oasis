import { createId, inject, injectable } from '@x-oasis/di';
import { serviceHost } from '@x-oasis/async-call-rpc';

import { IWindowManager, WindowManagerId } from './WindowManager';
import { IMainCpServer, MainCpServerId } from './MainCpServer';
import {
  IDaemonApplication,
  DaemonApplicationId,
} from '../src/apps/daemon/application/DaemonApplication';
import {
  ISharedApplication,
  SharedApplicationId,
} from '../src/apps/shared/application/SharedApplication';
import {
  IPageletApplication,
  PageletApplicationId,
} from '../src/apps/pagelet/application/PageletApplication';
import { MAIN_RPC_SERVICE_PATH } from '../src/apps/pagelet/common';

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
    @inject(PageletApplicationId)
    private readonly pageletApp: IPageletApplication
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

    await this.pageletApp.start();

    console.log('[AppApplication] start() done');
  }
}
