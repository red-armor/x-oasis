import {
  app,
  BrowserWindow,
  MessageChannelMain,
  utilityProcess,
} from 'electron';
import {
  IPCMainChannel,
  ElectronUtilityProcessChannel,
} from '@x-oasis/async-call-rpc-electron';
import { serviceHost, clientHost } from '@x-oasis/async-call-rpc';
import { join } from 'path';

let rendererClient: any = null;
let utilityClient: any = null;

function createUtilityProcess(): {
  channel: ElectronUtilityProcessChannel;
  client: any;
} {
  const utility = utilityProcess.fork(
    join(__dirname, '../preload/utility-worker.js')
  );

  const channel = new ElectronUtilityProcessChannel({
    process: utility,
    description: 'main→utility RPC',
  });

  const client = clientHost
    .registerClient('utility-api', { channel })
    .createProxy();

  return { channel, client };
}

function createWindow(): {
  channel: IPCMainChannel;
  client: any;
} {
  const mainWindow = new BrowserWindow({
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

  const client = clientHost
    .registerClient('renderer-api', { channel })
    .createProxy();

  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'));
  }

  return { channel, client };
}

app.whenReady().then(async () => {
  // 1. Create renderer window and RPC channel
  const { channel: rendererChannel, client: rClient } = createWindow();
  rendererClient = rClient;

  // 2. Create utility process and RPC channel
  const { channel: utilityChannel, client: uClient } = createUtilityProcess();
  utilityClient = uClient;

  // 3. Register service for renderer (renderer calls these methods via RPC)
  serviceHost.registerService('api', {
    channel: rendererChannel,
    serviceHost,
    handlers: {
      /**
       * acquireUtilityPort — triggered by renderer.
       *
       * Creates a MessageChannel port pair:
       * - port1 is returned to the renderer (the caller)
       * - port2 is assigned to the utility process
       *
       * After this, renderer and utility can communicate directly via ports.
       */
      acquireUtilityPort(): [Electron.MessagePortMain] {
        const { port1, port2 } = new MessageChannelMain();
        console.log(
          '[main] acquireUtilityPort: renderer requested a port to utility'
        );
        // Send port2 to utility process
        utilityClient.assignRendererPort(port2);
        // Return port1 to renderer
        return [port1];
      },
    },
  });

  // 4. Register service for utility (utility calls these methods via RPC)
  serviceHost.registerService('main-api', {
    channel: utilityChannel,
    serviceHost,
    handlers: {
      /**
       * acquireRendererPort — triggered by utility.
       *
       * Creates a MessageChannel port pair:
       * - port1 is returned to the utility process (the caller)
       * - port2 is assigned to the renderer
       *
       * After this, utility and renderer can communicate directly via ports.
       */
      acquireRendererPort(): [Electron.MessagePortMain] {
        const { port1, port2 } = new MessageChannelMain();
        console.log(
          '[main] acquireRendererPort: utility requested a port to renderer'
        );
        // Send port2 to renderer
        rendererClient.assignUtilityPort(port2);
        // Return port1 to utility
        return [port1];
      },
    },
  });

  console.log('[main] All services registered, waiting for port requests...');
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
