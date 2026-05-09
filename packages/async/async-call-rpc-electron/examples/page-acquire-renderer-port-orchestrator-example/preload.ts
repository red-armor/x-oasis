import { ipcRenderer, contextBridge } from 'electron';
import { createPageBridge } from '@x-oasis/async-call-rpc-electron';
import { clientHost, serviceHost } from '@x-oasis/async-call-rpc';
import { createOrchestratorAPI } from '@shared-ui/createOrchestratorAPI';

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
