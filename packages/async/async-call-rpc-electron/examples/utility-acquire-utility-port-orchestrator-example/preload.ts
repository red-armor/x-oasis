import { contextBridge, ipcRenderer } from 'electron';
import { IPCRendererChannel } from '@x-oasis/async-call-rpc-electron';
import { clientHost } from '@x-oasis/async-call-rpc';

const ipcChannel = new IPCRendererChannel({
  channelName: 'app-rpc',
  ipcRenderer,
  projectName: 'utility-acquire-utility-port-orchestrator',
  description: 'renderer→main IPC channel',
});

const orchestratorClient = clientHost
  .registerClient('orchestrator', { channel: ipcChannel })
  .createProxy();

contextBridge.exposeInMainWorld('orchestratorAPI', {
  connect: () => (orchestratorClient as any).connect(),
  disconnect: () => (orchestratorClient as any).disconnect(),
  simulateLost: () => (orchestratorClient as any).simulateLost(),
  getStatus: () => (orchestratorClient as any).getStatus(),
  sendRpc: (_message: string) =>
    Promise.resolve({
      success: false,
      error: 'Direct RPC from renderer not available — utility↔utility only',
    }),
  onStateChange: (callback: (event: any) => void) => {
    const listener = (_ev: any, data: any) => callback(data);
    ipcRenderer.on('orchestrator:stateChange', listener);
    return () =>
      ipcRenderer.removeListener('orchestrator:stateChange', listener);
  },
  onReady: (callback: (event: any) => void) => {
    const listener = (_ev: any, data: any) => callback(data);
    ipcRenderer.on('orchestrator:ready', listener);
    return () => ipcRenderer.removeListener('orchestrator:ready', listener);
  },
  onDisconnected: (callback: (event: any) => void) => {
    const listener = (_ev: any, data: any) => callback(data);
    ipcRenderer.on('orchestrator:disconnected', listener);
    return () =>
      ipcRenderer.removeListener('orchestrator:disconnected', listener);
  },
  onReconnecting: (callback: (event: any) => void) => {
    const listener = (_ev: any, data: any) => callback(data);
    ipcRenderer.on('orchestrator:reconnecting', listener);
    return () =>
      ipcRenderer.removeListener('orchestrator:reconnecting', listener);
  },
  onReconnected: (callback: (event: any) => void) => {
    const listener = (_ev: any, data: any) => callback(data);
    ipcRenderer.on('orchestrator:reconnected', listener);
    return () =>
      ipcRenderer.removeListener('orchestrator:reconnected', listener);
  },
  onReconnectFailed: (callback: (event: any) => void) => {
    const listener = (_ev: any, data: any) => callback(data);
    ipcRenderer.on('orchestrator:reconnectFailed', listener);
    return () =>
      ipcRenderer.removeListener('orchestrator:reconnectFailed', listener);
  },
  onClosed: (callback: (event: any) => void) => {
    const listener = (_ev: any, data: any) => callback(data);
    ipcRenderer.on('orchestrator:closed', listener);
    return () => ipcRenderer.removeListener('orchestrator:closed', listener);
  },
});
