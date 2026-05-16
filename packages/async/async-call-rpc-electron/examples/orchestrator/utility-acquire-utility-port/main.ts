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

  const { orchestrator } = await setupMainOrchestrator({
    ipcChannel,
    fromId: 'utility-a',
    toId: 'utility-b',
    registerMain: false,
    orchestratorConfig: {
      logger: (level, msg) => console.log(`[orchestrator:${level}] ${msg}`),
      enableStats: true,
    },
    handlers: {
      async sendRpc(message: string): Promise<string> {
        const utilityARelayClient = clientHost
          .registerClient('utility-a-relay', { channel: utilityAChannel })
          .createProxy();
        return (utilityARelayClient as any).pingPong(message);
      },
    },
    setupParticipants: (orch) => {
      orch.registerParticipant('utility-a', utilityAChannel, 'utility');
      orch.registerParticipant('utility-b', utilityBChannel, 'utility');
    },
  });

  const info = await orchestrator.connect('utility-a', 'utility-b');
  console.log(`[main] initial connection state: ${info.state}`);
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
