import { ipcRenderer } from 'electron';
import { createPageBridge } from '@x-oasis/async-call-rpc-electron';
import { clientHost, serviceHost } from '@x-oasis/async-call-rpc';

import { ORCHESTRATOR_CP_CHANNEL_NAME } from '@/apps/main/application/common/cp-config';
import {
  CONNECTION_PARTICIPANT_ID,
  MONITOR_PARTICIPANT_ID,
} from '@/services/pagelet-host/common';
import { CONNECTION_PAGELET_SERVICE_PATH } from '@/apps/connection/application/common';
import { MONITOR_PAGELET_SERVICE_PATH } from '@/apps/monitor/application/common';

const channelName = ORCHESTRATOR_CP_CHANNEL_NAME;

const bridge = createPageBridge({
  ipcRenderer,
  channelName,
  description: `${channelName} bridge`,
  serviceRoutes: {
    [CONNECTION_PAGELET_SERVICE_PATH]: CONNECTION_PARTICIPANT_ID,
    [MONITOR_PAGELET_SERVICE_PATH]: MONITOR_PARTICIPANT_ID,
  },
  defaultPeerId: CONNECTION_PARTICIPANT_ID,
});

clientHost
  .registerClient(CONNECTION_PAGELET_SERVICE_PATH, { channel: bridge.channel })
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
