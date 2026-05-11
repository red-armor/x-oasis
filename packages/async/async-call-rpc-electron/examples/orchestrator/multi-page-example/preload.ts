import { ipcRenderer, contextBridge } from 'electron';
import { createPageBridge } from '@x-oasis/async-call-rpc-electron';
import { clientHost, serviceHost } from '@x-oasis/async-call-rpc';

const channelName = 'renderer-rpc';

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
      return `greeting from renderer: ${msg}`;
    },
  },
});

contextBridge.exposeInMainWorld('pageSwitchApi', {
  switchPage: (pageId: string) => ipcRenderer.send('switch-page', pageId),
  onPageSwitched: (callback: (pageId: string) => void) => {
    ipcRenderer.on('page-switched', (_event, pageId) => callback(pageId));
    return () => {
      ipcRenderer.removeListener(
        'page-switched',
        (_event: any, pageId: string) => callback(pageId)
      );
    };
  },
});
