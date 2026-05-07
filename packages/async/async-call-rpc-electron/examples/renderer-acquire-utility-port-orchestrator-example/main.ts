import { app, BrowserWindow, utilityProcess } from 'electron';
import {
  IPCMainChannel,
  ElectronUtilityProcessChannel,
  ElectronConnectionOrchestrator,
} from '@x-oasis/async-call-rpc-electron';
import { serviceHost } from '@x-oasis/async-call-rpc';
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
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'));
  }

  return ipcChannel;
}

app.whenReady().then(async () => {
  const ipcChannel = createWindow();

  const utilityProc = utilityProcess.fork(
    join(__dirname, '../preload/utility-worker.js')
  );
  const utilityChannel = new ElectronUtilityProcessChannel({
    process: utilityProc,
    description: 'main→utility IPC channel',
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
  orchestrator.registerParticipant('utility', utilityChannel, 'utility');

  serviceHost.registerService('orchestrator', {
    channel: ipcChannel,
    serviceHost,
    handlers: {
      async connect(): Promise<any> {
        try {
          const info = await orchestrator.connect('renderer', 'utility');
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
        const info = orchestrator.getConnectionInfo('renderer', 'utility');
        if (info) {
          await orchestrator.disconnect(info.connectionId);
        }
      },
      simulateLost(): void {
        orchestrator.handleParticipantLost('utility', 'simulated process exit');
      },
      async getStatus(): Promise<any> {
        const info = orchestrator.getConnectionInfo('renderer', 'utility');
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
        utilityProc.kill();
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

  const info = await orchestrator.connect('renderer', 'utility');
  console.log(`[main] initial connection state: ${info.state}`);
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
