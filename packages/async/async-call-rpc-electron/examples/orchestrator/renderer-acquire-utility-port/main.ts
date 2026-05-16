import { app, BrowserWindow, utilityProcess } from 'electron';
import {
  IPCMainChannel,
  ElectronUtilityProcessChannel,
} from '@x-oasis/async-call-rpc-electron/electron-main/core';
import { setupMainOrchestrator } from '@x-oasis/async-call-rpc-electron/electron-main/orchestrator';
import { clientHost } from '@x-oasis/async-call-rpc/core';
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

  const { orchestrator } = await setupMainOrchestrator({
    ipcChannel,
    fromId: 'renderer',
    toId: 'utility',
    registerMain: false,
    orchestratorConfig: {
      logger: (level, msg) => console.log(`[orchestrator:${level}] ${msg}`),
      enableStats: true,
      heartbeat: {
        enabled: true,
        intervalMs: 10_000,
        timeoutMs: 5_000,
      },
    },
    handlers: {
      async sendRpc(message: string): Promise<string> {
        const utilityRelayClient = clientHost
          .registerClient('utility-relay', { channel: utilityChannel })
          .createProxy();
        return (utilityRelayClient as any).greetRenderer(message);
      },
      killUtility(): void {
        utilityProc.kill();
      },
    },
    setupParticipants: (orch) => {
      orch.registerParticipant('renderer', ipcChannel, 'renderer');
      orch.registerParticipant('utility', utilityChannel, 'utility');
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
