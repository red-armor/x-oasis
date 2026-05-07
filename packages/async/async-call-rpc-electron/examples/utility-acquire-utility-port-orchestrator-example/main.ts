/**
 * utility-acquire-utility-port-orchestrator-example — Main Process
 *
 * Demonstrates using ElectronConnectionOrchestrator to wire a direct
 * MessagePort connection between two utility processes (A ↔ B).
 *
 * Old approach (10 manual steps across 2 directions):
 *   - utility A calls acquireUtilityBPort() → main creates MessageChannelMain,
 *     sends port2 to utility B via assignUtilityAPort(), returns port1 to A
 *   - utility B calls acquireUtilityAPort() → main creates MessageChannelMain,
 *     sends port2 to utility A via assignUtilityBPort(), returns port1 to B
 *
 * New approach (Orchestrator, 3 lines):
 *   orchestrator.registerParticipant('utility-a', utilityAChannel)
 *   orchestrator.registerParticipant('utility-b', utilityBChannel)
 *   await orchestrator.connect('utility-a', 'utility-b')
 *
 * The orchestrator handles:
 *   1. Creating MessageChannelMain()
 *   2. Sending port1 to utility-a with { __orchestrator: 'activateConnection' }
 *   3. Sending port2 to utility-b with { __orchestrator: 'activateConnection' }
 *   4. Transitioning to READY state
 */

import { app, BrowserWindow, utilityProcess } from 'electron';
import {
  ElectronUtilityProcessChannel,
  ElectronConnectionOrchestrator,
} from '@x-oasis/async-call-rpc-electron';
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

  // --- Control-plane channels to both utility processes ---
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

  // --- Orchestrator: connect utility-a ↔ utility-b directly ---
  const orchestrator = new ElectronConnectionOrchestrator({
    logger: (level, msg) => console.log(`[orchestrator:${level}] ${msg}`),
  });

  orchestrator.registerParticipant('utility-a', utilityAChannel, 'utility');
  orchestrator.registerParticipant('utility-b', utilityBChannel, 'utility');

  orchestrator.onReady(({ connectionId }) => {
    console.log(`[main] orchestrator READY: ${connectionId}`);
    console.log(
      '[main] utility-a and utility-b are now connected directly via MessagePort'
    );
  });

  const info = await orchestrator.connect('utility-a', 'utility-b');
  console.log(`[main] connection state: ${info.state}`);
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
