import { createOrchestratorClient } from '@x-oasis/async-call-rpc-electron/browser';

export const client = createOrchestratorClient({
  directChannelDescription: 'renderer↔preload',
  ipcChannelDescription: 'renderer↔preload:ipc',
});

export const pageletClient = client.getService<any>('pagelet-api');
