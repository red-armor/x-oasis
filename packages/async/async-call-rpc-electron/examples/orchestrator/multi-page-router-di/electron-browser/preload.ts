import { ipcRenderer } from 'electron';
import { createPageBridge } from '@x-oasis/async-call-rpc-electron';
import { clientHost, serviceHost } from '@x-oasis/async-call-rpc';

import { ORCHESTRATOR_CP_CHANNEL_NAME } from '../common/cp-config';
import { PAGELET_SERVICE_PATH } from '../src/apps/pagelet/application/common';

const channelName = ORCHESTRATOR_CP_CHANNEL_NAME;

const bridge = createPageBridge({
  ipcRenderer,
  channelName,
  description: `${channelName} bridge`,
});

clientHost
  .registerClient(PAGELET_SERVICE_PATH, { channel: bridge.channel })
  .createProxy();

serviceHost.registerService('renderer-direct', {
  channel: bridge.channel,
  serviceHost,
  handlers: {
    greet(msg: string): string {
      return `greeting from renderer: ${msg}`;
    },
  },
});
