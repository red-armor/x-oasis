import { contextBridge, ipcRenderer } from 'electron';
import { IPCRendererChannel } from '@x-oasis/async-call-rpc-electron';
import { clientHost } from '@x-oasis/async-call-rpc';
import { createOrchestratorAPI } from '@shared-ui/createOrchestratorAPI';

const ipcChannel = new IPCRendererChannel({
  channelName: 'app-rpc',
  ipcRenderer,
  projectName: 'utility-acquire-utility-port-orchestrator',
  description: 'renderer→main IPC channel',
});

const orchestratorClient = clientHost
  .registerClient('orchestrator', { channel: ipcChannel })
  .createProxy();

contextBridge.exposeInMainWorld(
  'orchestratorAPI',
  createOrchestratorAPI(orchestratorClient, {
    sendRpc: (_message: string) =>
      Promise.resolve({
        success: false,
        error: 'Direct RPC from renderer not available — utility↔utility only',
      }),
  })
);
