import { Registry } from '@x-oasis/di';

import { MainCpServer, MainCpServerId } from './MainCpServer';
import { WindowManager, WindowManagerId } from './WindowManager';
import {
  DaemonProcess,
  DaemonProcessId,
} from '../src/apps/daemon/electron-main/DaemonProcess';
import {
  DaemonApplication,
  DaemonApplicationId,
} from '../src/apps/daemon/application/DaemonApplication';
import {
  SharedProcess,
  SharedProcessId,
} from '../src/apps/shared/electron-main/SharedProcess';
import {
  SharedApplication,
  SharedApplicationId,
} from '../src/apps/shared/application/SharedApplication';
import {
  PageletProcess,
  PageletProcessId,
} from '../src/apps/pagelet/electron-main/PageletProcess';
import {
  AppOrchestrator,
  AppOrchestratorId,
} from '../src/apps/pagelet/electron-main/AppOrchestrator';
import {
  PageletApplication,
  PageletApplicationId,
} from '../src/apps/pagelet/application/PageletApplication';
import { AppApplication, AppApplicationId } from './AppApplication';

export default new Registry((bind) => {
  bind(WindowManagerId).to(WindowManager);
  bind(MainCpServerId).to(MainCpServer);

  bind(DaemonProcessId).to(DaemonProcess);
  bind(DaemonApplicationId).to(DaemonApplication);

  bind(SharedProcessId).to(SharedProcess);
  bind(SharedApplicationId).to(SharedApplication);

  bind(PageletProcessId).to(PageletProcess);
  bind(AppOrchestratorId).to(AppOrchestrator);
  bind(PageletApplicationId).to(PageletApplication);

  bind(AppApplicationId).to(AppApplication);
});
