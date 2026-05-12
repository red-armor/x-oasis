import { app, BrowserWindow, utilityProcess, ipcMain } from 'electron';
import {
  IPCMainChannel,
  ElectronUtilityProcessChannel,
  ElectronConnectionOrchestrator,
} from '@x-oasis/async-call-rpc-electron';
import { serviceHost, RPCServiceHost } from '@x-oasis/async-call-rpc';
import { join } from 'path';

const PAGES = [
  { id: 'pageA', title: 'Page A', x: 0, color: '#3b82f6' },
  { id: 'pageB', title: 'Page B', x: 920, color: '#8b5cf6' },
  { id: 'pageC', title: 'Page C', x: 460, color: '#10b981' },
] as const;

const PAGELETS = [
  { id: 'pagelet-A', workerFile: 'pagelet-A-worker.js', color: '#3b82f6' },
  { id: 'pagelet-B', workerFile: 'pagelet-B-worker.js', color: '#8b5cf6' },
  { id: 'pagelet-C', workerFile: 'pagelet-C-worker.js', color: '#10b981' },
] as const;

const windows: BrowserWindow[] = [];
const pageIpcChannels: Map<string, IPCMainChannel> = new Map();
const pageletProcs: Map<string, Electron.UtilityProcess> = new Map();
const pageletChannels: Map<string, ElectronUtilityProcessChannel> = new Map();
const webContentsToPageId: Map<number, string> = new Map();

function createPageWindow(
  pageId: string,
  title: string,
  offsetX: number
): IPCMainChannel {
  const win = new BrowserWindow({
    width: 900,
    height: 700,
    x: offsetX,
    y: 0,
    title: `Multi-Pagelet - ${title}`,
    webPreferences: {
      preload: join(__dirname, '../preload/preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  const ipcChannel = new IPCMainChannel({
    channelName: `${pageId}-rpc`,
    webContents: win.webContents,
    description: `main→${pageId} IPC channel`,
  });

  if (process.env.NODE_ENV === 'development') {
    win.loadURL(`http://localhost:5173?pageId=${pageId}`);
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'), {
      query: { pageId },
    });
  }

  windows.push(win);
  pageIpcChannels.set(pageId, ipcChannel);
  webContentsToPageId.set(win.webContents.id, pageId);
  return ipcChannel;
}

app.whenReady().then(async () => {
  ipcMain.on('get-channel-name', (event) => {
    const pageId = webContentsToPageId.get(event.sender.id) || 'pageA';
    event.returnValue = `${pageId}-rpc`;
  });

  for (const page of PAGES) {
    createPageWindow(page.id, page.title, page.x);
  }

  const sharedProc = utilityProcess.fork(
    join(__dirname, '../preload/shared-worker.js')
  );
  const sharedChannel = new ElectronUtilityProcessChannel({
    process: sharedProc,
    description: 'main→shared IPC channel',
  });

  const daemonProc = utilityProcess.fork(
    join(__dirname, '../preload/daemon-worker.js')
  );
  const daemonChannel = new ElectronUtilityProcessChannel({
    process: daemonProc,
    description: 'main→daemon IPC channel',
  });

  for (const pagelet of PAGELETS) {
    const proc = utilityProcess.fork(
      join(__dirname, `../preload/${pagelet.workerFile}`)
    );
    const channel = new ElectronUtilityProcessChannel({
      process: proc,
      description: `main→${pagelet.id} IPC channel`,
    });
    pageletProcs.set(pagelet.id, proc);
    pageletChannels.set(pagelet.id, channel);
  }

  let mainCallCount = 0;
  serviceHost.registerServiceHandler('main-rpc', {
    mainPing(msg: string): string {
      mainCallCount++;
      return `pong from main (#${mainCallCount}): ${msg}`;
    },
  });

  const orchestrator = new ElectronConnectionOrchestrator({
    logger: (level, msg) => console.log(`[orchestrator:${level}] ${msg}`),
    enableStats: true,
    heartbeat: {
      enabled: true,
      intervalMs: 10_000,
      timeoutMs: 5_000,
    },
  });

  for (const page of PAGES) {
    const ipcChannel = pageIpcChannels.get(page.id)!;
    orchestrator.registerParticipant(page.id, ipcChannel, 'renderer');
  }

  for (const pagelet of PAGELETS) {
    const channel = pageletChannels.get(pagelet.id)!;
    channel.setServiceHost(serviceHost);
    orchestrator.registerParticipant(pagelet.id, channel, 'utility');
  }

  orchestrator.registerParticipant('shared', sharedChannel, 'utility');
  orchestrator.registerParticipant('daemon', daemonChannel, 'utility');

  orchestrator.registerProxyService(serviceHost);

  for (const [pageId, ipcChannel] of pageIpcChannels) {
    const pageletId = `pagelet-${pageId.replace('page', '').toUpperCase()}`;

    const pageServiceHost = new RPCServiceHost();
    ipcChannel.setServiceHost(pageServiceHost);

    pageServiceHost.registerService('orchestrator', {
      channel: ipcChannel,
      serviceHost: pageServiceHost,
      handlers: {
        async connect(): Promise<any> {
          try {
            const info = await orchestrator.connect(pageId, pageletId);
            return {
              connectionId: info.connectionId,
              fromId: info.fromId,
              toId: info.toId,
              state: info.state,
              lastStateChangedAt: info.lastStateChangedAt,
              error: info.error?.message,
            };
          } catch (err: any) {
            return { error: err.message };
          }
        },
        async disconnect(): Promise<void> {
          const info = orchestrator.getConnectionInfo(pageId, pageletId);
          if (info) {
            await orchestrator.disconnect(info.connectionId);
          }
        },
        simulateLost(): void {
          orchestrator.handleParticipantLost(
            pageletId,
            'simulated process exit'
          );
        },
        async getStatus(): Promise<any> {
          const info = orchestrator.getConnectionInfo(pageId, pageletId);
          if (!info) return null;
          const stats = orchestrator.getConnectionStats(info.connectionId);
          return {
            connectionId: info.connectionId,
            fromId: info.fromId,
            toId: info.toId,
            state: info.state,
            lastStateChangedAt: info.lastStateChangedAt,
            error: info.error?.message,
            isReady: info.isReady,
            stats: stats
              ? {
                  totalRpcCalls: stats.totalRpcCalls,
                  successfulCalls: stats.successfulCalls,
                  failedCalls: stats.failedCalls,
                  avgLatencyMs: stats.avgLatencyMs,
                  totalReconnects: stats.totalReconnects,
                }
              : null,
          };
        },
        killUtility(): void {
          pageletProcs.get(pageletId)?.kill();
        },
        onStateChange(remoteCallback: (event: any) => void) {
          orchestrator.onStateChange((event) => remoteCallback(event));
        },
        onReady(remoteCallback: (event: any) => void) {
          orchestrator.onReady((event) => remoteCallback(event));
        },
        onDisconnected(remoteCallback: (event: any) => void) {
          orchestrator.onDisconnected((event) => remoteCallback(event));
        },
        onReconnecting(remoteCallback: (event: any) => void) {
          orchestrator.onReconnecting((event) => remoteCallback(event));
        },
        onReconnected(remoteCallback: (event: any) => void) {
          orchestrator.onReconnected((event) => remoteCallback(event));
        },
        onReconnectFailed(remoteCallback: (event: any) => void) {
          orchestrator.onReconnectFailed((event) => remoteCallback(event));
        },
        onClosed(remoteCallback: (event: any) => void) {
          orchestrator.onClosed((event) => remoteCallback(event));
        },
      },
    });
  }

  console.log('[main] multi-pagelet orchestrator ready');
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
