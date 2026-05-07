/**
 * utility-acquire-main-port-orchestrator-example — Utility Worker
 *
 * Launched by main process via utilityProcess.fork().
 *
 * The orchestrator delivers a MessagePort by calling the participant's
 * `activateConnection` handler.  `registerOrchestratorHandler` wires this up
 * without any magic strings on the user side.
 */

import {
  ElectronUtilityProcessChannel,
  ElectronMessagePortMainChannel,
  registerOrchestratorHandler,
} from '../../src/index.js';
import { serviceHost, clientHost } from '@x-oasis/async-call-rpc';

if (!process.parentPort) {
  throw new Error('parentPort is not available');
}

// --- RPC channel to main process (control plane) ---
const mainChannel = new ElectronUtilityProcessChannel({
  parentPort: process.parentPort as any,
  description: 'utility→main IPC channel',
});

// --- Direct port channel to main (data plane, late-bound by orchestrator) ---
const directChannel = new ElectronMessagePortMainChannel({
  description: 'utility↔main direct port',
});

// Register a service that main can call over the direct port
serviceHost.registerService('utility-direct', {
  channel: directChannel,
  serviceHost,
  handlers: {
    ping(msg: string): string {
      console.log('[utility] direct RPC from main:', msg);
      return `pong from utility: ${msg}`;
    },
  },
});

// Client to call main services over the direct port
const mainDirectClient = clientHost
  .registerClient('main-direct', { channel: directChannel })
  .createProxy();

// --- Orchestrator activation ---
//
// When the orchestrator calls connect(), it delivers a MessagePort here.
// No magic strings — the protocol detail is fully encapsulated in the helper.
registerOrchestratorHandler(mainChannel, (port: any) => {
  console.log('[utility] activateConnection — binding direct port');
  directChannel.bindPort(port);

  setTimeout(async () => {
    try {
      const result = await (mainDirectClient as any).greet(
        'hello from utility via direct port'
      );
      console.log('[utility] ✅ direct RPC to main:', result);
    } catch (err) {
      console.error('[utility] ❌ direct RPC to main failed:', err);
    }
  }, 500);
});

console.log(
  '[utility-worker] utility-acquire-main-port-orchestrator-example initialized'
);
