import { ipcRenderer, contextBridge } from 'electron';
import {
  IPCRendererChannel,
  registerOrchestratorHandler,
} from '@x-oasis/async-call-rpc-electron';
import { RPCMessageChannel } from '@x-oasis/async-call-rpc-web';
import { clientHost, serviceHost } from '@x-oasis/async-call-rpc';
import { createOrchestratorAPI } from '@shared-ui/createOrchestratorAPI';

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

contextBridge.exposeInMainWorld(
  'orchestratorAPI',
  createOrchestratorAPI(orchestratorClient, {
    sendRpc: (message: string) =>
      (mainDirectClient as any).greet(message).then(
        (r: any) => r,
        (e: any) => {
          throw e;
        }
      ),
  })
);
