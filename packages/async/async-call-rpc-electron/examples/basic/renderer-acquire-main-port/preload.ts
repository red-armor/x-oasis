import { ipcRenderer } from 'electron';
import { IPCRendererChannel } from '@x-oasis/async-call-rpc-electron';
import { clientHost, serviceHost } from '@x-oasis/async-call-rpc';

const channel = new IPCRendererChannel({
  channelName: 'app-rpc',
  ipcRenderer,
  projectName: 'my-electron-app',
  description: 'renderer→main RPC channel',
});

const api = clientHost.registerClient('api', { channel }).createProxy();

serviceHost.registerService('renderer-api', {
  channel,
  serviceHost,
  handlers: {
    assignPort(port: Electron.MessagePortMain) {
      console.log('assign port', port);
    },
  },
});

// contextBridge.exposeInMainWorld('api', {
//   acquirePort: (...args: unknown[]) => api.acquirePort(...args),
// });

api.acquirePort().then((port) => {
  console.log('port ', port);
});
