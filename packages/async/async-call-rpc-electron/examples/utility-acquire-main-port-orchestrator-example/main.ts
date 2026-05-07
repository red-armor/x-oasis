/**
 * utility-acquire-main-port-orchestrator-example — Main Process
 *
 * Demonstrates using ElectronConnectionOrchestrator to wire a direct
 * MessagePort connection between a utility process and the main process.
 *
 * Old approach:
 *   - utility calls acquireMainPort() over IPC
 *   - main creates MessageChannelMain, binds port2 locally, returns port1 to utility
 *   - main uses setTimeout to push a "main-initiated" port to utility via assignMainPort()
 *
 * New approach (Orchestrator):
 *   orchestrator.registerParticipant('main', mainParticipantChannel)
 *   orchestrator.registerParticipant('utility', utilityChannel)
 *   await orchestrator.connect('main', 'utility')   ← one call does it all
 */

import { app, BrowserWindow, utilityProcess } from 'electron';
import {
  ElectronUtilityProcessChannel,
  ElectronConnectionOrchestrator,
  ElectronMessagePortMainChannel,
} from '@x-oasis/async-call-rpc-electron';
import { serviceHost, clientHost } from '@x-oasis/async-call-rpc';
import { join } from 'path';

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

  // --- Utility process channel (control plane) ---
  const workerPath = join(__dirname, '../preload/utility-worker.js');
  const utilityProc = utilityProcess.fork(workerPath);

  const utilityChannel = new ElectronUtilityProcessChannel({
    process: utilityProc,
    description: 'main→utility IPC channel',
  });

  // --- Direct port channel: main side (late-bound by orchestrator) ---
  const mainDirectChannel = new ElectronMessagePortMainChannel({
    description: 'main↔utility direct port',
  });

  // Register a service that utility can call over the direct port
  serviceHost.registerService('main-direct', {
    channel: mainDirectChannel,
    serviceHost,
    handlers: {
      greet(msg: string): string {
        console.log('[main] direct RPC from utility:', msg);
        return `hello from main: ${msg}`;
      },
    },
  });

  // Client to call utility services over the direct port
  const utilityDirectClient = clientHost
    .registerClient('utility-direct', { channel: mainDirectChannel })
    .createProxy();

  // --- Orchestrator wires the connection ---
  const orchestrator = new ElectronConnectionOrchestrator({
    logger: (level, msg) => console.log(`[orchestrator:${level}] ${msg}`),
  });

  // Thin wrapper so orchestrator can deliver the port to main's local channel.
  const mainParticipantChannel = {
    send(data: any, transfer?: any[]) {
      if (data?.__orchestrator === 'activateConnection' && transfer?.length) {
        const port = transfer[0];
        console.log('[main] activateConnection received — binding direct port');
        mainDirectChannel.bindPort(port);
      }
    },
    on: () => () => {},
    activate: () => {},
    disconnect: () => {},
    onDidConnected: () => {},
    onDidDisconnected: () => {},
  } as any;

  orchestrator.registerParticipant('main', mainParticipantChannel, 'process');
  orchestrator.registerParticipant('utility', utilityChannel, 'utility');

  orchestrator.onReady(async ({ connectionId }) => {
    console.log(`[main] orchestrator READY: ${connectionId}`);

    // Verify: call utility's service over the direct port
    setTimeout(async () => {
      try {
        const result = await (utilityDirectClient as any).ping(
          'hello from main via direct port'
        );
        console.log('[main] ✅ direct RPC to utility:', result);
      } catch (err) {
        console.error('[main] ❌ direct RPC to utility failed:', err);
      }
    }, 1000);
  });

  const info = await orchestrator.connect('main', 'utility');
  console.log(`[main] connection state: ${info.state}`);
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
