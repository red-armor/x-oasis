import { createOrchestratorClient } from '@x-oasis/async-call-rpc-electron/browser';
import { IPageletService } from '@/services/pagelet-host/common';

export const client = createOrchestratorClient({
  directChannelDescription: 'renderer↔preload',
  ipcChannelDescription: 'renderer↔preload:ipc',
});

export const pageletClient = client.getService<IPageletService>('pagelet-api');
