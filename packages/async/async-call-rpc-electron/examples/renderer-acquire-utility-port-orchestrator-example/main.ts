/**
 * renderer-acquire-utility-port-orchestrator-example — Main Process
 *
 * Demonstrates using ElectronConnectionOrchestrator to wire a direct
 * MessagePort connection between the renderer and a utility process.
 *
 * Old approach (5 manual steps per direction × 2 directions = 10 steps):
 *   - renderer calls acquireUtilityPort() → main creates channel, sends port2
 *     to utility via assignRendererPort(), returns port1 to renderer
 *   - utility calls acquireRendererPort() → main creates channel, sends port2
 *     to renderer via assignUtilityPort(), returns port1 to utility
 *
 * New approach (Orchestrator, 3 lines):
 *   orchestrator.registerParticipant('renderer', ipcChannel)
 *   orchestrator.registerParticipant('utility', utilityChannel)
 *   await orchestrator.connect('renderer', 'utility')
 */

import { app, BrowserWindow, utilityProcess } from 'electron';
import {
  IPCMainChannel,
  ElectronUtilityProcessChannel,
  ElectronConnectionOrchestrator,
} from '@x-oasis/async-call-rpc-electron';
import { join } from 'path';

function createWindow(): IPCMainChannel {
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

  return ipcChannel;
}

app.whenReady().then(async () => {
  // --- Control-plane channels ---
  const ipcChannel = createWindow();

  const utilityProc = utilityProcess.fork(
    join(__dirname, '../preload/utility-worker.js')
  );
  const utilityChannel = new ElectronUtilityProcessChannel({
    process: utilityProc,
    description: 'main→utility IPC channel',
  });

  // --- Orchestrator: connect renderer ↔ utility directly ---
  const orchestrator = new ElectronConnectionOrchestrator({
    logger: (level, msg) => console.log(`[orchestrator:${level}] ${msg}`),
  });

  orchestrator.registerParticipant('renderer', ipcChannel, 'renderer');
  orchestrator.registerParticipant('utility', utilityChannel, 'utility');

  orchestrator.onReady(({ connectionId }) => {
    console.log(`[main] orchestrator READY: ${connectionId}`);
    console.log(
      '[main] renderer and utility are now connected directly via MessagePort'
    );
  });

  const info = await orchestrator.connect('renderer', 'utility');
  console.log(`[main] connection state: ${info.state}`);
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
