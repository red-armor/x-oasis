/**
 * renderer-acquire-utility-port-orchestrator-example — Utility Worker
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

// --- Direct port channel to renderer (data plane, late-bound by orchestrator) ---
const directChannel = new ElectronMessagePortMainChannel({
  description: 'utility↔renderer direct port',
});

// Register a service that renderer can call over the direct port
serviceHost.registerService('utility-direct', {
  channel: directChannel,
  serviceHost,
  handlers: {
    ping(msg: string): string {
      console.log('[utility] direct RPC from renderer:', msg);
      return `pong from utility: ${msg}`;
    },
  },
});

// Client to call renderer services over the direct port
const rendererDirectClient = clientHost
  .registerClient('renderer-direct', { channel: directChannel })
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
      const result = await (rendererDirectClient as any).greet(
        'hello from utility via direct port'
      );
      console.log('[utility] ✅ direct RPC to renderer:', result);
    } catch (err) {
      console.error('[utility] ❌ direct RPC to renderer failed:', err);
    }
  }, 500);
});

console.log(
  '[utility-worker] renderer-acquire-utility-port-orchestrator-example initialized'
);
