import { app, BrowserWindow, utilityProcess } from 'electron';
import {
  IPCMainChannel,
  ElectronUtilityProcessChannel,
  setupMainOrchestrator,
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

  const utilityProc = utilityProcess.fork(
    join(__dirname, '../preload/utility-worker.js')
  );
  const utilityChannel = new ElectronUtilityProcessChannel({
    process: utilityProc,
    description: 'main→utility IPC channel',
  });

  const { orchestrator, mainDirectChannel } = await setupMainOrchestrator({
    ipcChannel,
    fromId: 'main',
    toId: 'utility',
    orchestratorConfig: {
      logger: (level, msg) => console.log(`[orchestrator:${level}] ${msg}`),
      enableStats: true,
    },
    handlers: {
      async sendRpc(_args: any, message: string): Promise<any> {
        try {
          const utilityDirectClient = clientHost
            .registerClient('utility-direct', { channel: mainDirectChannel! })
            .createProxy();
          const result = await (utilityDirectClient as any).ping(message);
          return { success: true, result };
        } catch (err: any) {
          return { success: false, error: err.message };
        }
      },
    },
    setupParticipants: (orch) => {
      orch.registerParticipant('utility', utilityChannel, 'utility');
    },
  });

  let callCount = 0;

  serviceHost.registerService('main-direct', {
    channel: mainDirectChannel!,
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

  const info = await orchestrator.connect('main', 'utility');
  console.log(`[main] initial connection state: ${info.state}`);
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
