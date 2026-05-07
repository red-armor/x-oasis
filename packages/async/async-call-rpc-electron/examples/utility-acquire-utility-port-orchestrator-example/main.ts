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

function sendToRenderer(channel: string, ...args: any[]) {
  mainWindow?.webContents.send(channel, ...args);
}

app.whenReady().then(async () => {
  const ipcChannel = createWindow();

  const utilityA = utilityProcess.fork(
    join(__dirname, '../preload/utility-worker-a.js')
  );
  const utilityAChannel = new ElectronUtilityProcessChannel({
    process: utilityA,
    description: 'main→utility-a IPC channel',
  });

  const utilityB = utilityProcess.fork(
    join(__dirname, '../preload/utility-worker-b.js')
  );
  const utilityBChannel = new ElectronUtilityProcessChannel({
    process: utilityB,
    description: 'main→utility-b IPC channel',
  });

  const orchestrator = new ElectronConnectionOrchestrator({
    logger: (level, msg) => console.log(`[orchestrator:${level}] ${msg}`),
    enableStats: true,
  });

  orchestrator.registerParticipant('utility-a', utilityAChannel, 'utility');
  orchestrator.registerParticipant('utility-b', utilityBChannel, 'utility');

  // Register orchestrator service for RPC calls
  serviceHost.registerService('orchestrator', {
    channel: ipcChannel,
    serviceHost,
    handlers: {
      async connect(): Promise<any> {
        try {
          const info = await orchestrator.connect('utility-a', 'utility-b');
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
        const info = orchestrator.getConnectionInfo('utility-a', 'utility-b');
        if (info) {
          await orchestrator.disconnect(info.connectionId);
        }
      },
      simulateLost(): void {
        orchestrator.handleParticipantLost(
          'utility-b',
          'simulated process exit'
        );
      },
      async getStatus(): Promise<any> {
        const info = orchestrator.getConnectionInfo('utility-a', 'utility-b');
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
    },
  });

  // Forward orchestrator events to renderer via sendToRenderer
  orchestrator.onStateChange((event) => {
    sendToRenderer('orchestrator:stateChange', event);
  });
  orchestrator.onReady((event) => {
    sendToRenderer('orchestrator:ready', event);
  });
  orchestrator.onDisconnected((event) => {
    sendToRenderer('orchestrator:disconnected', event);
  });
  orchestrator.onReconnecting((event) => {
    sendToRenderer('orchestrator:reconnecting', event);
  });
  orchestrator.onReconnected((event) => {
    sendToRenderer('orchestrator:reconnected', event);
  });
  orchestrator.onReconnectFailed((event) => {
    sendToRenderer('orchestrator:reconnectFailed', event);
  });
  orchestrator.onClosed((event) => {
    sendToRenderer('orchestrator:closed', event);
  });

  const info = await orchestrator.connect('utility-a', 'utility-b');
  console.log(`[main] initial connection state: ${info.state}`);
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
