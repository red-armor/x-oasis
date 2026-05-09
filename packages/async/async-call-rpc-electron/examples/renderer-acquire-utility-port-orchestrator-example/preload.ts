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

contextBridge.exposeInMainWorld(
  'orchestratorAPI',
  createOrchestratorAPI(orchestratorClient, {
    sendRpc: (message: string) =>
      (utilityDirectClient as any).ping(message).then(
        (r: any) => r,
        (e: any) => {
          throw e;
        }
      ),
    killUtility: () => (orchestratorClient as any).killUtility(),
  })
);
