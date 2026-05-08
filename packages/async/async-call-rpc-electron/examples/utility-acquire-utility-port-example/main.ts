import {
  app,
  BrowserWindow,
  MessageChannelMain,
  utilityProcess,
} from 'electron';
import { ElectronUtilityProcessChannel } from '@x-oasis/async-call-rpc-electron';
import { serviceHost, clientHost } from '@x-oasis/async-call-rpc';
import { join } from 'path';

let utilityAClient: any = null;
let utilityBClient: any = null;

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

  // 1. Create utility process A
  const utilityA = utilityProcess.fork(
    join(__dirname, '../preload/utility-worker-a.js')
  );
  const utilityAChannel = new ElectronUtilityProcessChannel({
    process: utilityA,
    description: 'main→utility-a RPC',
  });
  utilityAClient = clientHost
    .registerClient('utility-a-api', { channel: utilityAChannel })
    .createProxy();

  // 2. Create utility process B
  const utilityB = utilityProcess.fork(
    join(__dirname, '../preload/utility-worker-b.js')
  );
  const utilityBChannel = new ElectronUtilityProcessChannel({
    process: utilityB,
    description: 'main→utility-b RPC',
  });
  utilityBClient = clientHost
    .registerClient('utility-b-api', { channel: utilityBChannel })
    .createProxy();

  // 3. Register service for utility A (broker: A→B port exchange)
  serviceHost.registerService('main-for-utility-a', {
    channel: utilityAChannel,
    serviceHost,
    handlers: {
      /**
       * acquireUtilityBPort — triggered by utility A.
       *
       * Creates a MessageChannel port pair:
       * - port1 is returned to utility A (the caller)
       * - port2 is assigned to utility B
       */
      acquireUtilityBPort(): [Electron.MessagePortMain] {
        const { port1, port2 } = new MessageChannelMain();
        console.log(
          '[main] acquireUtilityBPort: utility A requested a port to utility B'
        );
        utilityBClient.assignUtilityAPort(port2);
        return [port1];
      },
    },
  });

  // 4. Register service for utility B (broker: B→A port exchange)
  serviceHost.registerService('main-for-utility-b', {
    channel: utilityBChannel,
    serviceHost,
    handlers: {
      /**
       * acquireUtilityAPort — triggered by utility B.
       *
       * Creates a MessageChannel port pair:
       * - port1 is returned to utility B (the caller)
       * - port2 is assigned to utility A
       */
      acquireUtilityAPort(): [Electron.MessagePortMain] {
        const { port1, port2 } = new MessageChannelMain();
        console.log(
          '[main] acquireUtilityAPort: utility B requested a port to utility A'
        );
        utilityAClient.assignUtilityBPort(port2);
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
