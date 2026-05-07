import {
  app,
  BrowserWindow,
  MessageChannelMain,
  utilityProcess,
} from 'electron';
import {
  ElectronUtilityProcessChannel,
  ElectronMessagePortMainChannel,
} from '@x-oasis/async-call-rpc-electron';
import { serviceHost, clientHost } from '@x-oasis/async-call-rpc';
import { join } from 'path';

let utilityClient: any = null;

// --- Main-side direct port channels (late-bound) ---

const utilityInitiatedChannel = new ElectronMessagePortMainChannel({
  description: 'main↔utility (utility-initiated port)',
});

serviceHost.registerService('main-direct-from-utility', {
  channel: utilityInitiatedChannel,
  serviceHost,
  handlers: {
    greet(msg: string): string {
      console.log('[main] direct RPC from utility (utility-initiated):', msg);
      return `greeting from main: ${msg}`;
    },
  },
});

const mainInitiatedChannel = new ElectronMessagePortMainChannel({
  description: 'main↔utility (main-initiated port)',
});

serviceHost.registerService('main-direct-from-main', {
  channel: mainInitiatedChannel,
  serviceHost,
  handlers: {
    hello(msg: string): string {
      console.log('[main] direct RPC from utility (main-initiated):', msg);
      return `hello from main: ${msg}`;
    },
  },
});

const utilityClientViaMainPort = clientHost
  .registerClient('utility-direct-from-main', { channel: mainInitiatedChannel })
  .createProxy();

const utilityClientViaUtilityPort = clientHost
  .registerClient('utility-direct-from-utility', {
    channel: utilityInitiatedChannel,
  })
  .createProxy();

function createWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
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

app.whenReady().then(async () => {
  createWindow();

  const workerPath = join(__dirname, '../preload/utility-worker.js');
  const utility = utilityProcess.fork(workerPath);

  const utilityChannel = new ElectronUtilityProcessChannel({
    process: utility,
    description: 'main→utility RPC',
  });

  utilityClient = clientHost
    .registerClient('utility-api', { channel: utilityChannel })
    .createProxy();

  serviceHost.registerService('main-api', {
    channel: utilityChannel,
    serviceHost,
    handlers: {
      acquireMainPort(): [Electron.MessagePortMain] {
        const { port1, port2 } = new MessageChannelMain();
        console.log('[main] acquireMainPort: utility requested a port to main');
        utilityInitiatedChannel.bindPort(port2);
        return [port1];
      },
    },
  });

  setTimeout(() => {
    const { port1, port2 } = new MessageChannelMain();
    console.log('[main] initiating direct port to utility');
    mainInitiatedChannel.bindPort(port1);
    utilityClient.assignMainPort(port2);
  }, 2000);

  setTimeout(async () => {
    try {
      const result = await utilityClientViaMainPort.ping(
        'hello from main via main-initiated port'
      );
      console.log('[main] ✅ direct RPC to utility (main-initiated):', result);
    } catch (err) {
      console.error(
        '[main] ❌ direct RPC to utility (main-initiated) failed:',
        err
      );
    }

    try {
      const result = await utilityClientViaUtilityPort.echo(
        'hello from main via utility-initiated port'
      );
      console.log(
        '[main] ✅ direct RPC to utility (utility-initiated):',
        result
      );
    } catch (err) {
      console.error(
        '[main] ❌ direct RPC to utility (utility-initiated) failed:',
        err
      );
    }
  }, 4000);

  console.log('[main] All services registered, waiting for port requests...');
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
