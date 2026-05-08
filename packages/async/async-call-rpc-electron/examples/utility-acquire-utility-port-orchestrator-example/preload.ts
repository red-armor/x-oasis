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
    const { unsubscribe } = (orchestratorClient as any).onStateChange(callback);
    return unsubscribe;
  },
  onReady: (callback: (event: any) => void) => {
    const { unsubscribe } = (orchestratorClient as any).onReady(callback);
    return unsubscribe;
  },
  onDisconnected: (callback: (event: any) => void) => {
    const { unsubscribe } = (orchestratorClient as any).onDisconnected(
      callback
    );
    return unsubscribe;
  },
  onReconnecting: (callback: (event: any) => void) => {
    const { unsubscribe } = (orchestratorClient as any).onReconnecting(
      callback
    );
    return unsubscribe;
  },
  onReconnected: (callback: (event: any) => void) => {
    const { unsubscribe } = (orchestratorClient as any).onReconnected(callback);
    return unsubscribe;
  },
  onReconnectFailed: (callback: (event: any) => void) => {
    const { unsubscribe } = (orchestratorClient as any).onReconnectFailed(
      callback
    );
    return unsubscribe;
  },
  onClosed: (callback: (event: any) => void) => {
    const { unsubscribe } = (orchestratorClient as any).onClosed(callback);
    return unsubscribe;
  },
});
