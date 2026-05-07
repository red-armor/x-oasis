/**
 * utility-acquire-utility-port-orchestrator-example — Utility Worker B
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
  description: 'utility-b→main IPC channel',
});

// --- Direct port channel to utility A (data plane, late-bound by orchestrator) ---
const directChannel = new ElectronMessagePortMainChannel({
  description: 'utility-b↔utility-a direct port',
});

// Register a service that utility A can call over the direct port
serviceHost.registerService('utility-b-direct', {
  channel: directChannel,
  serviceHost,
  handlers: {
    echo(msg: string): string {
      console.log('[utility-b] direct RPC from utility A:', msg);
      return `echo from utility-b: ${msg}`;
    },
  },
});

// Client to call utility A's services over the direct port
const utilityADirectClient = clientHost
  .registerClient('utility-a-direct', { channel: directChannel })
  .createProxy();

// --- Orchestrator activation ---
//
// When the orchestrator calls connect(), it delivers a MessagePort here.
// No magic strings — the protocol detail is fully encapsulated in the helper.
registerOrchestratorHandler(mainChannel, (port: any) => {
  console.log('[utility-b] activateConnection — binding direct port');
  directChannel.bindPort(port);

  setTimeout(async () => {
    try {
      const result = await (utilityADirectClient as any).greet(
        'hello from utility-b via direct port'
      );
      console.log('[utility-b] ✅ direct RPC to utility-a:', result);
    } catch (err) {
      console.error('[utility-b] ❌ direct RPC to utility-a failed:', err);
    }
  }, 1000);
});

console.log(
  '[utility-worker-b] utility-acquire-utility-port-orchestrator-example initialized'
);
