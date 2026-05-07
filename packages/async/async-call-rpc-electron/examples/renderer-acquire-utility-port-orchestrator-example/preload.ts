/**
 * renderer-acquire-utility-port-orchestrator-example — Preload Script
 *
 * Runs in the renderer's sandboxed preload context.
 *
 * The orchestrator delivers a MessagePort by calling the participant's
 * `activateConnection` handler.  `registerOrchestratorHandler` wires this up
 * without any magic strings on the user side.
 */

import { ipcRenderer } from 'electron';
import {
  IPCRendererChannel,
  registerOrchestratorHandler,
} from '@x-oasis/async-call-rpc-electron';
import { RPCMessageChannel } from '@x-oasis/async-call-rpc-web';
import { clientHost, serviceHost } from '@x-oasis/async-call-rpc';

// --- IPC channel to main process (control plane) ---
const ipcChannel = new IPCRendererChannel({
  channelName: 'app-rpc',
  ipcRenderer,
  projectName: 'renderer-acquire-utility-port-orchestrator',
  description: 'renderer→main IPC channel',
});

// --- Direct MessagePort channel to utility (data plane, late-bound) ---
const directChannel = new RPCMessageChannel({
  description: 'renderer↔utility direct port',
});

// Register a service that utility can call over the direct port
serviceHost.registerService('renderer-direct', {
  channel: directChannel,
  serviceHost,
  handlers: {
    greet(msg: string): string {
      console.log('[renderer] direct RPC from utility:', msg);
      return `greeting from renderer: ${msg}`;
    },
  },
});

// Client to call utility services over the direct port
const utilityDirectClient = clientHost
  .registerClient('utility-direct', { channel: directChannel })
  .createProxy();

// --- Orchestrator activation ---
//
// When the orchestrator calls connect(), it delivers a MessagePort here.
// No magic strings — the protocol detail is fully encapsulated in the helper.
registerOrchestratorHandler(ipcChannel, (port: MessagePort) => {
  console.log('[renderer] activateConnection — binding direct port');
  directChannel.bindPort(port);

  setTimeout(async () => {
    try {
      const result = await (utilityDirectClient as any).ping(
        'hello from renderer via direct port'
      );
      console.log('[renderer] ✅ direct RPC to utility:', result);
    } catch (err) {
      console.error('[renderer] ❌ direct RPC to utility failed:', err);
    }
  }, 500);
});

console.log(
  '[preload] renderer-acquire-utility-port-orchestrator-example initialized'
);
