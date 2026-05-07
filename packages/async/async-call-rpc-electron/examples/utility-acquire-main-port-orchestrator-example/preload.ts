import { ipcRenderer, contextBridge } from 'electron';

contextBridge.exposeInMainWorld('orchestratorAPI', {
  connect: () => ipcRenderer.invoke('orchestrator:connect'),
  disconnect: () => ipcRenderer.invoke('orchestrator:disconnect'),
  simulateLost: () => ipcRenderer.invoke('orchestrator:simulateLost'),
  getStatus: () => ipcRenderer.invoke('orchestrator:getStatus'),
  sendRpc: (message: string) =>
    ipcRenderer.invoke('orchestrator:sendRpc', message),
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
