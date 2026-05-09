import { ipcRenderer } from 'electron';
import { createPageBridge } from '@x-oasis/async-call-rpc-electron';
import { clientHost, serviceHost } from '@x-oasis/async-call-rpc';

const bridge = createPageBridge({
  ipcRenderer,
  channelName: 'app-rpc',
  description: 'page↔utility bridge',
});

const utilityDirectClient = clientHost
  .registerClient('utility-direct', { channel: bridge.channel })
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
