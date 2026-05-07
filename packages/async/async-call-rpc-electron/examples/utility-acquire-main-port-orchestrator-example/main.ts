import { app, BrowserWindow, utilityProcess, ipcMain } from 'electron';
import {
  ElectronUtilityProcessChannel,
  ElectronConnectionOrchestrator,
  ElectronMessagePortMainChannel,
} from '@x-oasis/async-call-rpc-electron';
import { serviceHost, clientHost } from '@x-oasis/async-call-rpc';
import { join } from 'path';

let mainWindow: BrowserWindow | null = null;

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1100,
    height: 850,
    webPreferences: {
      preload: join(__dirname, '../preload/preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'));
  }
}

function sendToRenderer(channel: string, ...args: any[]) {
  mainWindow?.webContents.send(channel, ...args);
}

app.whenReady().then(async () => {
  createWindow();

  const workerPath = join(__dirname, '../preload/utility-worker.js');
  const utilityProc = utilityProcess.fork(workerPath);

  const utilityChannel = new ElectronUtilityProcessChannel({
    process: utilityProc,
    description: 'main→utility IPC channel',
  });

  const mainDirectChannel = new ElectronMessagePortMainChannel({
    description: 'main↔utility direct port',
  });

  let callCount = 0;

  serviceHost.registerService('main-direct', {
    channel: mainDirectChannel,
    serviceHost,
    handlers: {
      greet(msg: string): string {
        callCount++;
        return `hello from main (#${callCount}): ${msg}`;
      },
      trace(): { pid: number; uptime: number; callCount: number } {
        return {
          pid: process.pid,
          uptime: Math.floor(process.uptime() * 1000),
          callCount,
        };
      },
    },
  });

  const utilityDirectClient = clientHost
    .registerClient('utility-direct', { channel: mainDirectChannel })
    .createProxy();

  const orchestrator = new ElectronConnectionOrchestrator({
    logger: (level, msg) => console.log(`[orchestrator:${level}] ${msg}`),
    enableStats: true,
  });

  const mainParticipantChannel = {
    makeRequest(requestPath: string, methodName: string, port: any) {
      if (methodName === 'activateConnection' && port) {
        mainDirectChannel.bindPort(port);
      }
      return { promise: Promise.resolve(), seqId: 0 };
    },
    send: () => {},
    on: () => () => {},
    activate: () => {},
    disconnect: () => {},
    onDidConnected: () => {},
    onDidDisconnected: () => {},
  } as any;

  orchestrator.registerParticipant('main', mainParticipantChannel, 'process');
  orchestrator.registerParticipant('utility', utilityChannel, 'utility');

  orchestrator.onStateChange((event) =>
    sendToRenderer('orchestrator:stateChange', event)
  );
  orchestrator.onReady((event) => sendToRenderer('orchestrator:ready', event));
  orchestrator.onDisconnected((event) =>
    sendToRenderer('orchestrator:disconnected', event)
  );
  orchestrator.onReconnecting((event) =>
    sendToRenderer('orchestrator:reconnecting', event)
  );
  orchestrator.onReconnected((event) =>
    sendToRenderer('orchestrator:reconnected', event)
  );
  orchestrator.onReconnectFailed((event) =>
    sendToRenderer('orchestrator:reconnectFailed', event)
  );
  orchestrator.onClosed((event) =>
    sendToRenderer('orchestrator:closed', event)
  );

  ipcMain.handle('orchestrator:connect', async () => {
    try {
      const info = await orchestrator.connect('main', 'utility');
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
  });

  ipcMain.handle('orchestrator:disconnect', async () => {
    const info = orchestrator.getConnectionInfo('main', 'utility');
    if (info) await orchestrator.disconnect(info.connectionId);
  });

  ipcMain.handle('orchestrator:simulateLost', async () => {
    orchestrator.handleParticipantLost('utility', 'simulated process exit');
  });

  ipcMain.handle('orchestrator:getStatus', async () => {
    const info = orchestrator.getConnectionInfo('main', 'utility');
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
  });

  ipcMain.handle('orchestrator:sendRpc', async (_e, message: string) => {
    try {
      const result = await (utilityDirectClient as any).ping(message);
      return { success: true, result };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  const info = await orchestrator.connect('main', 'utility');
  console.log(`[main] initial connection state: ${info.state}`);
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
