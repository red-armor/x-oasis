import { createOrchestratorClient } from '@x-oasis/async-call-rpc-electron/browser';
import {
  IPageletService,
  PAGELET_SERVICE_PATH,
  IMonitorPageletService,
  MONITOR_PAGELET_SERVICE_PATH,
} from '@/services/pagelet-host/common';

export const client = createOrchestratorClient({
  directChannelDescription: 'renderer↔preload',
  ipcChannelDescription: 'renderer↔preload:ipc',
});

export const connectionPageletClient = client.getService(
  PAGELET_SERVICE_PATH
) as IPageletService;

export const monitorPageletClient = client.getService(
  MONITOR_PAGELET_SERVICE_PATH
) as unknown as IMonitorPageletService;
