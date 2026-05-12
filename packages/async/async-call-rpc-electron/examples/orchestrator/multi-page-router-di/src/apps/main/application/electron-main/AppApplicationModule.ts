import { Registry } from '@x-oasis/di';

import { MainCpServer, MainCpServerId } from './MainCpServer';
import { WindowManager, WindowManagerId } from './WindowManager';
import {
  DaemonProcess,
  DaemonProcessId,
} from '../../../daemon/application/electron-main/DaemonProcess';
import {
  DaemonApplication,
  DaemonApplicationId,
} from '../../../daemon/application/node/DaemonApplication';
import {
  SharedProcess,
  SharedProcessId,
} from '../../../shared/application/electron-main/SharedProcess';
import {
  SharedApplication,
  SharedApplicationId,
} from '../../../shared/application/node/SharedApplication';
import {
  PageletProcess,
  PageletProcessId,
} from '../../../pagelet/application/electron-main/PageletProcess';
import {
  AppOrchestrator,
  AppOrchestratorId,
} from '../../../pagelet/application/electron-main/AppOrchestrator';
import {
  PageletApplication,
  PageletApplicationId,
} from '../../../pagelet/application/node/PageletApplication';
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
