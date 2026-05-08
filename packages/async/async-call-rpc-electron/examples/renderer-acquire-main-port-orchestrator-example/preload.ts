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
  sendRpc: (message: string) => {
    return (mainDirectClient as any).greet(message).then(
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
