import { app, BrowserWindow, ipcMain, utilityProcess } from 'electron';
import {
  IPCMainChannel,
  ElectronUtilityProcessChannel,
  ElectronConnectionOrchestrator,
} from '@x-oasis/async-call-rpc-electron';
import { serviceHost } from '@x-oasis/async-call-rpc';
import { join } from 'path';

let mainWindow: BrowserWindow | null = null;
let settingWindow: BrowserWindow | null = null;

function createMainWindow(): IPCMainChannel {
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      preload: join(__dirname, '../preload/preload-a.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  const ipcChannel = new IPCMainChannel({
    channelName: 'app-rpc',
    webContents: mainWindow.webContents,
    description: 'main→windowA IPC channel',
  });

  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:5173');
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
    if (settingWindow && !settingWindow.isDestroyed()) {
      settingWindow.close();
    }
  });

  return ipcChannel;
}

let settingIpcChannel: IPCMainChannel | null = null;

function createSettingWindow(): void {
  if (settingWindow && !settingWindow.isDestroyed()) {
    settingWindow.focus();
    return;
  }

  settingWindow = new BrowserWindow({
    width: 900,
    height: 700,
    parent: mainWindow || undefined,
    webPreferences: {
      preload: join(__dirname, '../preload/preload-b.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  settingIpcChannel = new IPCMainChannel({
    channelName: 'setting-rpc',
    webContents: settingWindow.webContents,
    description: 'main→windowB IPC channel',
  });

  if (process.env.NODE_ENV === 'development') {
    settingWindow.loadURL('http://localhost:5173/setting.html');
  } else {
    settingWindow.loadFile(join(__dirname, '../renderer/setting.html'));
  }

  settingWindow.on('closed', () => {
    settingWindow = null;
    settingIpcChannel = null;
  });

  if (orchestrator && settingIpcChannel) {
    setupSettingOrchestrator(settingIpcChannel);
  }
}

let orchestrator: ElectronConnectionOrchestrator | null = null;
let pageletProc: Electron.UtilityProcess | null = null;
let currentTheme = 'light';

app.whenReady().then(async () => {
  const mainIpcChannel = createMainWindow();

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

  pageletProc = utilityProcess.fork(
    join(__dirname, '../preload/setting-pagelet-worker.js')
  );
  const pageletChannel = new ElectronUtilityProcessChannel({
    process: pageletProc,
    description: 'main→setting-pagelet IPC channel',
  });

  serviceHost.registerServiceHandler('main-rpc', {
    changeMainWindowTheme(theme: string): string {
      currentTheme = theme;
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('theme-change', theme);
      }
      return `theme changed to ${theme}`;
    },
    getCurrentTheme(): string {
      return currentTheme;
    },
  });

  pageletChannel.setServiceHost(serviceHost);

  orchestrator = new ElectronConnectionOrchestrator({
    logger: (level, msg) => console.log(`[orchestrator:${level}] ${msg}`),
    enableStats: true,
    heartbeat: {
      enabled: true,
      intervalMs: 10_000,
      timeoutMs: 5_000,
    },
  });

  orchestrator.registerParticipant(
    'setting-pagelet',
    pageletChannel,
    'utility'
  );
  orchestrator.registerParticipant('shared', sharedChannel, 'utility');
  orchestrator.registerParticipant('daemon', daemonChannel, 'utility');

  orchestrator.registerProxyService(serviceHost);

  sharedChannel.setServiceHost(serviceHost);
  daemonChannel.setServiceHost(serviceHost);

  ipcMain.handle('open-setting-window', () => {
    createSettingWindow();
  });

  console.log(
    '[main] orchestrator ready, setting-pagelet will self-connect to shared/daemon/renderer'
  );
});

function setupSettingOrchestrator(settingIpc: IPCMainChannel): void {
  if (!orchestrator) return;

  orchestrator.registerParticipant('setting-renderer', settingIpc, 'renderer');

  settingIpc.setServiceHost(serviceHost);

  serviceHost.registerService('orchestrator', {
    channel: settingIpc,
    serviceHost,
    handlers: {
      async connect(): Promise<any> {
        try {
          const info = await orchestrator!.connect(
            'setting-pagelet',
            'setting-renderer'
          );
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
        const info = orchestrator!.getConnectionInfo(
          'setting-pagelet',
          'setting-renderer'
        );
        if (info) {
          await orchestrator!.disconnect(info.connectionId);
        }
      },
      simulateLost(): void {
        orchestrator!.handleParticipantLost(
          'setting-pagelet',
          'simulated process exit'
        );
      },
      async getStatus(): Promise<any> {
        const info = orchestrator!.getConnectionInfo(
          'setting-pagelet',
          'setting-renderer'
        );
        if (!info) return null;
        const stats = orchestrator!.getConnectionStats(info.connectionId);
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
        if (pageletProc) pageletProc.kill();
      },
      onStateChange(remoteCallback: (event: any) => void) {
        orchestrator!.onStateChange((event) => remoteCallback(event));
      },
      onReady(remoteCallback: (event: any) => void) {
        orchestrator!.onReady((event) => remoteCallback(event));
      },
      onDisconnected(remoteCallback: (event: any) => void) {
        orchestrator!.onDisconnected((event) => remoteCallback(event));
      },
      onReconnecting(remoteCallback: (event: any) => void) {
        orchestrator!.onReconnecting((event) => remoteCallback(event));
      },
      onReconnected(remoteCallback: (event: any) => void) {
        orchestrator!.onReconnected((event) => remoteCallback(event));
      },
      onReconnectFailed(remoteCallback: (event: any) => void) {
        orchestrator!.onReconnectFailed((event) => remoteCallback(event));
      },
      onClosed(remoteCallback: (event: any) => void) {
        orchestrator!.onClosed((event) => remoteCallback(event));
      },
    },
  });
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
