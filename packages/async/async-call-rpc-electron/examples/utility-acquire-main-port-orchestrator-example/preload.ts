import { ipcRenderer, contextBridge } from 'electron';
import { IPCRendererChannel } from '@x-oasis/async-call-rpc-electron';
import { clientHost } from '@x-oasis/async-call-rpc';
import { createOrchestratorAPI } from '@shared-ui/createOrchestratorAPI';

const ipcChannel = new IPCRendererChannel({
  channelName: 'app-rpc',
  ipcRenderer,
  projectName: 'utility-acquire-main-port-orchestrator',
  description: 'renderer→main IPC channel',
});

const orchestratorClient = clientHost
  .registerClient('orchestrator', { channel: ipcChannel })
  .createProxy();

contextBridge.exposeInMainWorld(
  'orchestratorAPI',
  createOrchestratorAPI(orchestratorClient, {
    sendRpc: (message: string) => (orchestratorClient as any).sendRpc(message),
  })
);
