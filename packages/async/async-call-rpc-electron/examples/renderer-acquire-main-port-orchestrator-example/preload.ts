import { ipcRenderer, contextBridge } from 'electron';
import {
  IPCRendererChannel,
  registerOrchestratorHandler,
} from '@x-oasis/async-call-rpc-electron';
import { RPCMessageChannel } from '@x-oasis/async-call-rpc-web';
import { clientHost, serviceHost } from '@x-oasis/async-call-rpc';

const ipcChannel = new IPCRendererChannel({
  channelName: 'app-rpc',
  ipcRenderer,
  projectName: 'renderer-acquire-main-port-orchestrator',
  description: 'renderer→main IPC channel',
});

const directChannel = new RPCMessageChannel({
  description: 'renderer↔main direct port',
});

serviceHost.registerService('renderer-direct', {
  channel: directChannel,
  serviceHost,
  handlers: {
    ping(msg: string): string {
      return `pong from renderer: ${msg}`;
    },
  },
});

const mainDirectClient = clientHost
  .registerClient('main-direct', { channel: directChannel })
  .createProxy();

registerOrchestratorHandler(ipcChannel, (port: MessagePort) => {
  directChannel.bindPort(port);
});

contextBridge.exposeInMainWorld('orchestratorAPI', {
  connect: () => ipcRenderer.invoke('orchestrator:connect'),
  disconnect: () => ipcRenderer.invoke('orchestrator:disconnect'),
  simulateLost: () => ipcRenderer.invoke('orchestrator:simulateLost'),
  getStatus: () => ipcRenderer.invoke('orchestrator:getStatus'),
  sendRpc: (message: string) => {
    return (mainDirectClient as any).greet(message).then(
      (r: any) => r,
      (e: any) => {
        throw e;
      }
    );
  },
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
