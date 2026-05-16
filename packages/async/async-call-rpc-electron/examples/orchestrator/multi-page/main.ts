import { app, BrowserWindow, utilityProcess } from 'electron';
import {
  IPCMainChannel,
  ElectronUtilityProcessChannel,
} from '@x-oasis/async-call-rpc-electron/electron-main/core';
import { ElectronConnectionOrchestrator } from '@x-oasis/async-call-rpc-electron/electron-main/orchestrator';
import { serviceHost, RPCServiceHost } from '@x-oasis/async-call-rpc/core';
import { join } from 'path';

const PAGES = [
  { id: 'pageA', label: 'Page A', color: '#3b82f6' },
  { id: 'pageB', label: 'Page B', color: '#8b5cf6' },
  { id: 'pageC', label: 'Page C', color: '#10b981' },
] as const;

const PAGELETS = [
  { id: 'pagelet-A', workerFile: 'pagelet-A-worker.js', color: '#3b82f6' },
  { id: 'pagelet-B', workerFile: 'pagelet-B-worker.js', color: '#8b5cf6' },
  { id: 'pagelet-C', workerFile: 'pagelet-C-worker.js', color: '#10b981' },
] as const;

const RENDERER_ID = 'renderer';

const pageletProcs: Map<string, Electron.UtilityProcess> = new Map();
const pageletChannels: Map<string, ElectronUtilityProcessChannel> = new Map();

let mainWindow: BrowserWindow;
let rendererIpcChannel: IPCMainChannel;
let activePageId: string = PAGES[0].id;

function getPageletIdForPage(pageId: string): string {
  return `pagelet-${pageId.replace('page', '').toUpperCase()}`;
}

app.whenReady().then(async () => {
  mainWindow = new BrowserWindow({
    width: 1100,
    height: 750,
    title: 'Multi-Page Orchestrator (Single Window)',
    webPreferences: {
      preload: join(__dirname, '../preload/preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  rendererIpcChannel = new IPCMainChannel({
    channelName: 'renderer-rpc',
    webContents: mainWindow.webContents,
    description: 'main→renderer IPC channel',
  });

  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:5173');
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'));
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

  orchestrator.registerParticipant(RENDERER_ID, rendererIpcChannel, 'renderer');

  for (const pagelet of PAGELETS) {
    const channel = pageletChannels.get(pagelet.id)!;
    channel.setServiceHost(serviceHost);
    orchestrator.registerParticipant(pagelet.id, channel, 'utility');
  }

  orchestrator.registerParticipant('shared', sharedChannel, 'utility');
  orchestrator.registerParticipant('daemon', daemonChannel, 'utility');

  orchestrator.registerProxyService(serviceHost);

  const pageServiceHost = new RPCServiceHost();
  rendererIpcChannel.setServiceHost(pageServiceHost);

  pageServiceHost.registerService('orchestrator', {
    channel: rendererIpcChannel,
    serviceHost: pageServiceHost,
    handlers: {
      async connect(): Promise<any> {
        const pageletId = getPageletIdForPage(activePageId);
        try {
          const info = await orchestrator.connect(RENDERER_ID, pageletId);
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
        const pageletId = getPageletIdForPage(activePageId);
        const info = orchestrator.getConnectionInfo(RENDERER_ID, pageletId);
        if (info) {
          await orchestrator.disconnect(info.connectionId);
        }
      },
      simulateLost(): void {
        const pageletId = getPageletIdForPage(activePageId);
        orchestrator.handleParticipantLost(pageletId, 'simulated process exit');
      },
      async getStatus(): Promise<any> {
        const pageletId = getPageletIdForPage(activePageId);
        const info = orchestrator.getConnectionInfo(RENDERER_ID, pageletId);
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
        const pageletId = getPageletIdForPage(activePageId);
        pageletProcs.get(pageletId)?.kill();
      },
      switchPage(pageId: string): void {
        const page = PAGES.find((p) => p.id === pageId);
        if (!page) return;

        const oldPageletId = getPageletIdForPage(activePageId);
        const newPageletId = getPageletIdForPage(pageId);

        if (oldPageletId !== newPageletId) {
          const oldInfo = orchestrator.getConnectionInfo(
            RENDERER_ID,
            oldPageletId
          );
          if (oldInfo) {
            orchestrator.disconnect(oldInfo.connectionId).catch(() => {});
          }
        }

        activePageId = pageId;
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

  console.log('[main] multi-page orchestrator ready (single window)');
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
