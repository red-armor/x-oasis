import { app, BrowserWindow } from 'electron';
import { IPCMainChannel } from '@x-oasis/async-call-rpc-electron/electron-main/core';
import { setupMainOrchestrator } from '@x-oasis/async-call-rpc-electron/electron-main/orchestrator';
import { serviceHost, clientHost } from '@x-oasis/async-call-rpc/core';
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

  let callCount = 0;

  // Setup orchestrator using abstraction
  const { orchestrator, mainDirectChannel } = await setupMainOrchestrator({
    ipcChannel,
    fromId: 'main',
    toId: 'renderer',
    orchestratorConfig: {
      logger: (level, msg) => console.log(`[orchestrator:${level}] ${msg}`),
      enableStats: true,
    },
    setupParticipants: (orch) => {
      orch.registerParticipant('renderer', ipcChannel, 'renderer');
    },
  });

  // Register main-process services
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

  // Create client to communicate with renderer
  clientHost
    .registerClient('renderer-direct', { channel: mainDirectChannel })
    .createProxy();

  // Establish initial connection
  const info = await orchestrator.connect('main', 'renderer');
  console.log(`[main] initial connection state: ${info.state}`);
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
