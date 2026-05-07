import { ipcRenderer } from 'electron';
import { IPCRendererChannel } from '@x-oasis/async-call-rpc-electron';

const channel = new IPCRendererChannel({
  channelName: 'app-rpc',
  ipcRenderer,
  projectName: 'utility-acquire-main-port-orchestrator',
  description: 'renderer→main IPC channel',
});

console.log(
  '[preload] utility-acquire-main-port-orchestrator-example initialized'
);

void channel;
