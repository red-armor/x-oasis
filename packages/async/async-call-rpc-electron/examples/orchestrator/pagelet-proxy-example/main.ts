import { app, BrowserWindow, utilityProcess } from 'electron';
import {
  IPCMainChannel,
  ElectronUtilityProcessChannel,
  ElectronConnectionOrchestrator,
} from '@x-oasis/async-call-rpc-electron';
import { serviceHost, clientHost } from '@x-oasis/async-call-rpc';
import { join } from 'path';

let mainWindow: BrowserWindow | null = null;

function createWindow(): IPCMainChannel {
  mainWindow = new BrowserWindow({
    width: 1100,
    height: 850,
    webPreferences: {
      preload: join(__dirname, '../preload/preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  const ipcChannel = new IPCMainChannel({
    channelName: 'app-rpc',
    webContents: mainWindow.webContents,
    description: 'main→renderer IPC channel',
  });

  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:5173');
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'));
  }

  return ipcChannel;
}

app.whenReady().then(async () => {
  const ipcChannel = createWindow();

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

  const pageletProc = utilityProcess.fork(
    join(__dirname, '../preload/main-pagelet-worker.js')
  );
  const pageletChannel = new ElectronUtilityProcessChannel({
    process: pageletProc,
    description: 'main→main-pagelet IPC channel',
  });

  const sharedClient = clientHost
    .registerClient('shared-rpc', { channel: sharedChannel })
    .createProxy();

  const daemonClient = clientHost
    .registerClient('daemon-rpc', { channel: daemonChannel })
    .createProxy();

  let mainCallCount = 0;

  serviceHost.registerService('main-rpc', {
    channel: pageletChannel,
    serviceHost,
    handlers: {
      mainPing(msg: string): string {
        mainCallCount++;
        return `pong from main (#${mainCallCount}): ${msg}`;
      },
      async relayToShared(method: string, ...args: any[]): Promise<any> {
        return (sharedClient as any)[method](...args);
      },
      async relayToDaemon(method: string, ...args: any[]): Promise<any> {
        return (daemonClient as any)[method](...args);
      },
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

  orchestrator.registerParticipant('renderer', ipcChannel, 'renderer');
  orchestrator.registerParticipant('main-pagelet', pageletChannel, 'utility');

  serviceHost.registerService('orchestrator', {
    channel: ipcChannel,
    serviceHost,
    handlers: {
      async connect(): Promise<any> {
        try {
          const info = await orchestrator.connect('main-pagelet', 'renderer');
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
        const info = orchestrator.getConnectionInfo('main-pagelet', 'renderer');
        if (info) {
          await orchestrator.disconnect(info.connectionId);
        }
      },
      simulateLost(): void {
        orchestrator.handleParticipantLost(
          'main-pagelet',
          'simulated process exit'
        );
      },
      async getStatus(): Promise<any> {
        const info = orchestrator.getConnectionInfo('main-pagelet', 'renderer');
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
        pageletProc.kill();
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

  await orchestrator.connect('main-pagelet', 'renderer');
  console.log('[main] main-pagelet ↔ renderer connected');
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
