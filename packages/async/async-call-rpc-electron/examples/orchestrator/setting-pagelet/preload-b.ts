import { ipcRenderer } from 'electron';
import { createPageBridge } from '@x-oasis/async-call-rpc-electron';
import { clientHost, serviceHost } from '@x-oasis/async-call-rpc';

const bridge = createPageBridge({
  ipcRenderer,
  channelName: 'setting-rpc',
  description: 'setting-page↔setting-pagelet bridge',
});

bridge.channel.setServiceHost(serviceHost);

clientHost
  .registerClient('setting-api', { channel: bridge.channel })
  .createProxy();
