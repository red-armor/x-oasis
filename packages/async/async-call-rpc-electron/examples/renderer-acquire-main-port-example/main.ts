import { app, BrowserWindow, MessageChannelMain } from 'electron';
import { IPCMainChannel } from '@x-oasis/async-call-rpc-electron';
import { serviceHost, clientHost } from '@x-oasis/async-call-rpc';
import { join } from 'path';

let mainWindow: BrowserWindow | null = null;

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: join(__dirname, '../preload/preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  const channel = new IPCMainChannel({
    channelName: 'app-rpc',
    webContents: mainWindow.webContents,
    description: 'main→renderer RPC channel',
  });

  const client = clientHost.registerClient('api', { channel }).createProxy();

  const count = 0;

  serviceHost.registerService('api', {
    channel,
    serviceHost,
    handlers: {
      acquirePort(): [Electron.MessagePortMain] {
        const { port1, port2 } = new MessageChannelMain();
        client.assignPort(port2);
        return [port1];
      },
    },
  });

  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'));
  }
}

app.whenReady().then(() => {
  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
