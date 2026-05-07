/**
 * utility-acquire-utility-port-orchestrator-example — Utility Worker A
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
  description: 'utility-a→main IPC channel',
});

// --- Direct port channel to utility B (data plane, late-bound by orchestrator) ---
const directChannel = new ElectronMessagePortMainChannel({
  description: 'utility-a↔utility-b direct port',
});

// Register a service that utility B can call over the direct port
serviceHost.registerService('utility-a-direct', {
  channel: directChannel,
  serviceHost,
  handlers: {
    greet(msg: string): string {
      console.log('[utility-a] direct RPC from utility B:', msg);
      return `greeting from utility-a: ${msg}`;
    },
  },
});

// Client to call utility B's services over the direct port
const utilityBDirectClient = clientHost
  .registerClient('utility-b-direct', { channel: directChannel })
  .createProxy();

// --- Orchestrator activation ---
//
// When the orchestrator calls connect(), it delivers a MessagePort here.
// No magic strings — the protocol detail is fully encapsulated in the helper.
registerOrchestratorHandler(mainChannel, (port: any) => {
  console.log('[utility-a] activateConnection — binding direct port');
  directChannel.bindPort(port);

  setTimeout(async () => {
    try {
      const result = await (utilityBDirectClient as any).echo(
        'hello from utility-a via direct port'
      );
      console.log('[utility-a] ✅ direct RPC to utility-b:', result);
    } catch (err) {
      console.error('[utility-a] ❌ direct RPC to utility-b failed:', err);
    }
  }, 500);
});

console.log(
  '[utility-worker-a] utility-acquire-utility-port-orchestrator-example initialized'
);
