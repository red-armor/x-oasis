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
  projectName: 'renderer-acquire-utility-port-orchestrator',
  description: 'renderer→main IPC channel',
});

const directChannel = new RPCMessageChannel({
  description: 'renderer↔utility direct port',
});

serviceHost.registerService('renderer-direct', {
  channel: directChannel,
  serviceHost,
  handlers: {
    greet(msg: string): string {
      return `greeting from renderer: ${msg}`;
    },
  },
});

const utilityDirectClient = clientHost
  .registerClient('utility-direct', { channel: directChannel })
  .createProxy();

const orchestratorClient = clientHost
  .registerClient('orchestrator', { channel: ipcChannel })
  .createProxy();

registerOrchestratorHandler(ipcChannel, (port: MessagePort) => {
  directChannel.bindPort(port);
});

contextBridge.exposeInMainWorld('orchestratorAPI', {
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
});
