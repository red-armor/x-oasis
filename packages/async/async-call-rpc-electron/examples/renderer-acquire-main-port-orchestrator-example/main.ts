/**
 * renderer-acquire-main-port-orchestrator-example — Main Process
 *
 * Demonstrates using ElectronConnectionOrchestrator to wire a direct
 * MessagePort connection between the renderer and the main process.
 *
 * Old approach (5 manual steps):
 *   1. new MessageChannelMain()
 *   2. bind port1 locally (mainInitiatedChannel.bindPort)
 *   3. call client.assignPort(port2) over IPC to deliver port2 to renderer
 *   4. renderer calls acquirePort() and binds the returned port
 *   5. main calls client.triggerAssign() to push port2 to renderer
 *
 * New approach (Orchestrator, 3 lines in app.whenReady):
 *   orchestrator.registerParticipant('main-direct', ...)
 *   orchestrator.registerParticipant('renderer', ...)
 *   await orchestrator.connect('main-direct', 'renderer')
 */

import { app, BrowserWindow } from 'electron';
import {
  IPCMainChannel,
  ElectronConnectionOrchestrator,
  ElectronMessagePortMainChannel,
} from '@x-oasis/async-call-rpc-electron';
import { serviceHost, clientHost } from '@x-oasis/async-call-rpc';
import { join } from 'path';

function createWindow(): { window: BrowserWindow; ipcChannel: IPCMainChannel } {
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
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
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'));
  }

  return { window: mainWindow, ipcChannel };
}

app.whenReady().then(async () => {
  const { ipcChannel } = createWindow();

  // --- Direct port channel: main side (late-bound by orchestrator) ---
  const mainDirectChannel = new ElectronMessagePortMainChannel({
    description: 'main↔renderer direct port',
  });

  // Register a service that renderer can call over the direct port
  serviceHost.registerService('main-direct', {
    channel: mainDirectChannel,
    serviceHost,
    handlers: {
      greet(msg: string): string {
        console.log('[main] direct RPC from renderer:', msg);
        return `hello from main: ${msg}`;
      },
    },
  });

  // Client to call renderer services over the direct port
  const rendererDirectClient = clientHost
    .registerClient('renderer-direct', { channel: mainDirectChannel })
    .createProxy();

  // --- Orchestrator wires the connection automatically ---
  const orchestrator = new ElectronConnectionOrchestrator({
    logger: (level, msg) => console.log(`[orchestrator:${level}] ${msg}`),
  });

  // The orchestrator needs a "virtual" participant for the main-side port.
  // We use a thin wrapper channel that receives the RPC call from activateParticipant
  // and binds the received port locally.
  const mainParticipantChannel = {
    makeRequest(requestPath: string, methodName: string, port: any) {
      // Orchestrator calls makeRequest(ORCHESTRATOR_SERVICE_PATH, 'activateConnection', port)
      if (methodName === 'activateConnection' && port) {
        console.log('[main] activateConnection received — binding direct port');
        mainDirectChannel.bindPort(port);
      }
      // Return a mock Deferred that resolves immediately for local participants
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
  orchestrator.registerParticipant('renderer', ipcChannel, 'renderer');

  orchestrator.onReady(async ({ connectionId }) => {
    console.log(`[main] orchestrator READY: ${connectionId}`);

    // Verify: call renderer's service over the direct port
    setTimeout(async () => {
      try {
        const result = await (rendererDirectClient as any).ping(
          'hello from main via direct port'
        );
        console.log('[main] ✅ direct RPC to renderer:', result);
      } catch (err) {
        console.error('[main] ❌ direct RPC to renderer failed:', err);
      }
    }, 1000);
  });

  const info = await orchestrator.connect('main', 'renderer');
  console.log(`[main] connection state: ${info.state}`);
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
