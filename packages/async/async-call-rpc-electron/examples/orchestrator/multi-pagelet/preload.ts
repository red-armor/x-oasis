import { ipcRenderer } from 'electron';
import { createPageBridge } from '@x-oasis/async-call-rpc-electron/electron-browser/core';
import { clientHost, serviceHost } from '@x-oasis/async-call-rpc/core';

const channelName: string = ipcRenderer.sendSync('get-channel-name');

const bridge = createPageBridge({
  ipcRenderer,
  channelName,
  description: `${channelName} bridge`,
});

clientHost
  .registerClient('pagelet-api', { channel: bridge.channel })
  .createProxy();

serviceHost.registerService('renderer-direct', {
  channel: bridge.channel,
  serviceHost,
  handlers: {
    greet(msg: string): string {
      return `greeting from ${channelName}: ${msg}`;
    },
  },
});
