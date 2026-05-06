import { ipcRenderer, contextBridge } from 'electron';
import { IPCRendererChannel } from '@x-oasis/async-call-rpc-electron';
import { clientHost } from '@x-oasis/async-call-rpc';

const channel = new IPCRendererChannel({
  channelName: 'app-rpc',
  ipcRenderer,
  projectName: 'my-electron-app',
  description: 'renderer→main RPC channel',
});

const api = clientHost.registerClient('api', { channel }).createProxy();

contextBridge.exposeInMainWorld('api', {
  acquirePort: (...args: unknown[]) => api.acquirePort(...args),
});

api.acquirePort().then((port) => {
  console.log('port ', port);
});
