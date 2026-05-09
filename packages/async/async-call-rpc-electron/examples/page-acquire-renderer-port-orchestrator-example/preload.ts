import { ipcRenderer, contextBridge } from 'electron';
import { createPageBridge } from '@x-oasis/async-call-rpc-electron';
import { clientHost, serviceHost } from '@x-oasis/async-call-rpc';

const bridge = createPageBridge({
  ipcRenderer,
  channelName: 'app-rpc',
  description: 'page↔utility bridge',
});

const utilityDirectClient = clientHost
  .registerClient('utility-direct', { channel: bridge.channel })
  .createProxy();

const orchestratorClient = clientHost
  .registerClient('orchestrator', { channel: bridge.ipcChannel })
  .createProxy();

serviceHost.registerService('renderer-direct', {
  channel: bridge.channel,
  serviceHost,
  handlers: {
    greet(msg: string): string {
      return `greeting from renderer page: ${msg}`;
    },
  },
});

const api = {
  connect: () => (orchestratorClient as any).connect(),
  disconnect: () => (orchestratorClient as any).disconnect(),
  simulateLost: () => (orchestratorClient as any).simulateLost(),
  getStatus: () => (orchestratorClient as any).getStatus(),
  killUtility: () => (orchestratorClient as any).killUtility(),
  sendRpc: (message: string) => {
    return (utilityDirectClient as any).ping(message).then(
      (r: any) => r,
      (e: any) => {
        throw e;
      }
    );
  },
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
};

contextBridge.exposeInMainWorld('orchestratorAPI', api);
