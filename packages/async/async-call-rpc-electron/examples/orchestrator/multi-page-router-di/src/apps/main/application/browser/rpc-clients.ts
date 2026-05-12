import { createOrchestratorClient } from '@x-oasis/async-call-rpc-electron/browser';
import { clientHost } from '@x-oasis/async-call-rpc';
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

export const monitorPageletClient = clientHost
  .registerClient(MONITOR_PAGELET_SERVICE_PATH, { channel: client.ipcChannel })
  .createProxy() as unknown as IMonitorPageletService;
