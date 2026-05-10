import { ipcRenderer } from 'electron';
import { createPageBridge } from '@x-oasis/async-call-rpc-electron';

const bridge = createPageBridge({
  ipcRenderer,
  channelName: 'app-rpc',
  description: 'page↔main bridge',
});
