import { Registry } from '@x-oasis/di';

import { MainCpServer, MainCpServerId } from './MainCpServer';
import { WindowManager, WindowManagerId } from './WindowManager';
import { SharedProcess, SharedProcessId } from './SharedProcess';
import { DaemonProcess, DaemonProcessId } from './DaemonProcess';
import { PageletProcess, PageletProcessId } from './PageletProcess';
import { AppOrchestrator, AppOrchestratorId } from './AppOrchestrator';
import { AppApplication, AppApplicationId } from './AppApplication';

export default new Registry((bind) => {
  bind(WindowManagerId).to(WindowManager);
  bind(MainCpServerId).to(MainCpServer);
  bind(SharedProcessId).to(SharedProcess);
  bind(DaemonProcessId).to(DaemonProcess);
  bind(PageletProcessId).to(PageletProcess);
  bind(AppOrchestratorId).to(AppOrchestrator);
  bind(AppApplicationId).to(AppApplication);
});
