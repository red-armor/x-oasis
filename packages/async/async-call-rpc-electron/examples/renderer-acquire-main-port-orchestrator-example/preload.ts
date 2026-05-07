/**
 * renderer-acquire-main-port-orchestrator-example — Preload Script
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
  projectName: 'renderer-acquire-main-port-orchestrator',
  description: 'renderer→main IPC channel',
});

// --- Direct MessagePort channel to main (data plane, late-bound) ---
const directChannel = new RPCMessageChannel({
  description: 'renderer↔main direct port',
});

// Register a service that main can call over the direct port
serviceHost.registerService('renderer-direct', {
  channel: directChannel,
  serviceHost,
  handlers: {
    ping(msg: string): string {
      console.log('[renderer] direct RPC from main:', msg);
      return `pong from renderer: ${msg}`;
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
registerOrchestratorHandler(ipcChannel, (port: MessagePort) => {
  console.log('[renderer] activateConnection — binding direct port');
  directChannel.bindPort(port);

  setTimeout(async () => {
    try {
      const result = await (mainDirectClient as any).greet(
        'hello from renderer via direct port'
      );
      console.log('[renderer] ✅ direct RPC to main:', result);
    } catch (err) {
      console.error('[renderer] ❌ direct RPC to main failed:', err);
    }
  }, 500);
});

console.log(
  '[preload] renderer-acquire-main-port-orchestrator-example initialized'
);
