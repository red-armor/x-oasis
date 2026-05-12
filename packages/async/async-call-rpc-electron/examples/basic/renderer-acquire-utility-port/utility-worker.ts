/**
 * @x-oasis/async-call-rpc-electron — Utility Worker
 *
 * Launched by main process via utilityProcess.fork().
 *
 * Port channels:
 * - acquireRendererPort (utility-initiated): utility acquires port1,
 *   renderer gets port2 via assignUtilityPort. The port is wrapped in
 *   ElectronMessagePortMainChannel for full RPC support.
 * - assignRendererPort (renderer-initiated): renderer acquires port1,
 *   utility gets port2 via this handler. Same wrapping applies.
 */

import {
  ElectronUtilityProcessChannel,
  ElectronMessagePortMainChannel,
} from '../../../src/index.js';
import { clientHost, serviceHost } from '@x-oasis/async-call-rpc';

// --- RPC channel to main process ---
const mainChannel = new ElectronUtilityProcessChannel({
  parentPort: process.parentPort as any,
  description: 'utility→main RPC',
});

const mainClient = clientHost
  .registerClient('main-api', { channel: mainChannel })
  .createProxy();

// --- Direct port channels to renderer (late-bound) ---

// Channel for the renderer-initiated port (will be bound in assignRendererPort)
const rendererInitiatedChannel = new ElectronMessagePortMainChannel({
  description: 'utility↔renderer (renderer-initiated port)',
});

// Register a service that renderer can call over this direct port
serviceHost.registerService('utility-direct-from-renderer', {
  channel: rendererInitiatedChannel,
  serviceHost,
  handlers: {
    ping(msg: string): string {
      console.log(
        '[utility] direct RPC from renderer (renderer-initiated):',
        msg
      );
      return `pong from utility: ${msg}`;
    },
  },
});

// Channel for the utility-initiated port (will be bound after acquireRendererPort)
const utilityInitiatedChannel = new ElectronMessagePortMainChannel({
  description: 'utility↔renderer (utility-initiated port)',
});

// Register a service that renderer can call over this direct port too
serviceHost.registerService('utility-direct-from-utility', {
  channel: utilityInitiatedChannel,
  serviceHost,
  handlers: {
    echo(msg: string): string {
      console.log(
        '[utility] direct RPC from renderer (utility-initiated):',
        msg
      );
      return `echo from utility: ${msg}`;
    },
  },
});

// Client to call renderer services over the utility-initiated port
const rendererClientViaUtilityPort = clientHost
  .registerClient('renderer-direct-from-utility', {
    channel: utilityInitiatedChannel,
  })
  .createProxy();

// --- Service for main to call ---
serviceHost.registerService('utility-api', {
  channel: mainChannel,
  serviceHost,
  handlers: {
    /**
     * assignRendererPort — called by main when renderer requests acquireUtilityPort.
     * Binds the received port to rendererInitiatedChannel for RPC.
     */
    assignRendererPort(port: any) {
      console.log('[utility] assignRendererPort: binding port for RPC');
      rendererInitiatedChannel.bindPort(port);
    },
  },
});

// --- Utility-initiated flow: acquire a direct port to renderer ---
mainClient.acquireRendererPort().then(async (ports: any) => {
  const [port] = ports as [any];
  console.log('[utility] acquireRendererPort: binding port for RPC');
  utilityInitiatedChannel.bindPort(port);

  // Verify: call renderer's service over the direct port
  try {
    const result = await rendererClientViaUtilityPort.greet(
      'hello from utility via direct port'
    );
    console.log(
      '[utility] ✅ direct RPC to renderer (utility-initiated):',
      result
    );
  } catch (err) {
    console.error('[utility] ❌ direct RPC to renderer failed:', err);
  }
});
