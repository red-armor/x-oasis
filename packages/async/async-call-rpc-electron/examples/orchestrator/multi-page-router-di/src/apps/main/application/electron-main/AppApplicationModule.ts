import { Registry } from '@x-oasis/di';

import {
  MainCpServer,
  MainCpServerId,
} from '@/apps/main/application/electron-main/MainCpServer';
import {
  WindowManager,
  WindowManagerId,
} from '@/apps/main/application/electron-main/WindowManager';
import {
  DaemonProcess,
  DaemonProcessId,
} from '@/apps/daemon/application/electron-main/DaemonProcess';
import {
  DaemonApplication,
  DaemonApplicationId,
} from '@/apps/daemon/application/node/DaemonApplication';
import {
  SharedProcess,
  SharedProcessId,
} from '@/apps/shared/application/electron-main/SharedProcess';
import {
  SharedApplication,
  SharedApplicationId,
} from '@/apps/shared/application/node/SharedApplication';
import {
  PageletProcess,
  PageletProcessId,
} from '@/services/pagelet-host/electron-main/PageletProcess';
import {
  AppOrchestrator,
  AppOrchestratorId,
} from '@/services/pagelet-host/electron-main/AppOrchestrator';
import {
  ConnectionApplication,
  ConnectionApplicationId,
} from '@/apps/connection/application/node/ConnectionApplication';
import {
  MonitorApplication,
  MonitorApplicationId,
} from '@/apps/monitor/application/electron-main/MonitorApplication';
import {
  AppApplication,
  AppApplicationId,
} from '@/apps/main/application/electron-main/AppApplication';

export default new Registry((bind) => {
  bind(WindowManagerId).to(WindowManager);
  bind(MainCpServerId).to(MainCpServer);

  bind(DaemonProcessId).to(DaemonProcess);
  bind(DaemonApplicationId).to(DaemonApplication);

  bind(SharedProcessId).to(SharedProcess);
  bind(SharedApplicationId).to(SharedApplication);

  bind(PageletProcessId).to(PageletProcess);
  bind(AppOrchestratorId).to(AppOrchestrator);
  bind(ConnectionApplicationId).to(ConnectionApplication);
  bind(MonitorApplicationId).to(MonitorApplication);

  bind(AppApplicationId).to(AppApplication);
});
