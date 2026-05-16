/**
 * Preload script — runs in renderer's sandboxed preload context.
 *
 * Port channels:
 * - acquireUtilityPort (renderer-initiated): renderer acquires port1,
 *   utility gets port2 via assignRendererPort. The port is wrapped in
 *   RPCMessageChannel for full RPC support.
 * - assignUtilityPort (utility-initiated): utility acquires port1,
 *   renderer gets port2 via this handler. Same wrapping applies.
 */

import { ipcRenderer } from 'electron';
import { IPCRendererChannel } from '@x-oasis/async-call-rpc-electron/electron-browser/core';
import { RPCMessageChannel } from '@x-oasis/async-call-rpc-web/core';
import { clientHost, serviceHost } from '@x-oasis/async-call-rpc/core';

// --- RPC channel to main process ---
const mainChannel = new IPCRendererChannel({
  channelName: 'app-rpc',
  ipcRenderer,
  projectName: 'my-electron-app',
  description: 'renderer→main RPC channel',
});

const api = clientHost
  .registerClient('api', { channel: mainChannel })
  .createProxy();

// --- Direct port channels to utility (late-bound) ---

// Channel for the utility-initiated port (will be bound in assignUtilityPort)
const utilityInitiatedChannel = new RPCMessageChannel({
  description: 'renderer↔utility (utility-initiated port)',
});

// Register a service that utility can call over this direct port
serviceHost.registerService('renderer-direct-from-utility', {
  channel: utilityInitiatedChannel,
  serviceHost,
  handlers: {
    greet(msg: string): string {
      console.log(
        '[renderer] direct RPC from utility (utility-initiated):',
        msg
      );
      return `greeting from renderer: ${msg}`;
    },
  },
});

// Channel for the renderer-initiated port (will be bound after acquireUtilityPort)
const rendererInitiatedChannel = new RPCMessageChannel({
  description: 'renderer↔utility (renderer-initiated port)',
});

// Register a service that utility can call over this direct port too
serviceHost.registerService('renderer-direct-from-renderer', {
  channel: rendererInitiatedChannel,
  serviceHost,
  handlers: {
    hello(msg: string): string {
      console.log(
        '[renderer] direct RPC from utility (renderer-initiated):',
        msg
      );
      return `hello from renderer: ${msg}`;
    },
  },
});

// Client to call utility services over the renderer-initiated port
const utilityClientViaRendererPort = clientHost
  .registerClient('utility-direct-from-renderer', {
    channel: rendererInitiatedChannel,
  })
  .createProxy();

// --- Service for main to call ---
serviceHost.registerService('renderer-api', {
  channel: mainChannel,
  serviceHost,
  handlers: {
    /**
     * assignUtilityPort — called by main when utility requests acquireRendererPort.
     * Binds the received port to utilityInitiatedChannel for RPC.
     */
    assignUtilityPort(port: MessagePort) {
      console.log('[renderer] assignUtilityPort: binding port for RPC');
      utilityInitiatedChannel.bindPort(port);
    },
  },
});

// --- Renderer-initiated flow: acquire a direct port to utility ---
api.acquireUtilityPort().then(async (ports: any) => {
  const [port] = ports as [MessagePort];
  console.log('[renderer] acquireUtilityPort: binding port for RPC');
  rendererInitiatedChannel.bindPort(port);

  // Verify: call utility's service over the direct port
  try {
    const result = await utilityClientViaRendererPort.ping(
      'hello from renderer via direct port'
    );
    console.log(
      '[renderer] ✅ direct RPC to utility (renderer-initiated):',
      result
    );
  } catch (err) {
    console.error('[renderer] ❌ direct RPC to utility failed:', err);
  }
});
