import { createId, inject, injectable } from '@x-oasis/di';
import { serviceHost } from '@x-oasis/async-call-rpc';

import { IWindowManager, WindowManagerId } from './WindowManager';
import { IMainCpServer, MainCpServerId } from './MainCpServer';
import {
  IDaemonApplication,
  DaemonApplicationId,
} from '../../../daemon/application/node/DaemonApplication';
import {
  ISharedApplication,
  SharedApplicationId,
} from '../../../shared/application/node/SharedApplication';
import {
  IConnectionApplication,
  ConnectionApplicationId,
} from '../../../connection/application/node/ConnectionApplication';
import { MAIN_RPC_SERVICE_PATH } from '../../../../services/pagelet-host/common';

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
    private readonly connectionApp: IConnectionApplication
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

    console.log('[AppApplication] start() done');
  }
}
