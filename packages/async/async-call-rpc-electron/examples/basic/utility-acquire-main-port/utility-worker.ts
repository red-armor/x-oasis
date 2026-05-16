/**
 * @x-oasis/async-call-rpc-electron — Utility Worker
 *
 * Launched by main process via utilityProcess.fork().
 *
 * Port channels:
 * - acquireMainPort (utility-initiated): utility acquires port1,
 *   main gets port2 and binds it locally.
 * - assignMainPort (main-initiated): main creates port, keeps port1,
 *   utility gets port2 via this handler.
 */

import {
  ElectronUtilityProcessChannel,
  ElectronMessagePortMainChannel,
} from '@x-oasis/async-call-rpc-electron/electron-main/core';
import { clientHost, serviceHost } from '@x-oasis/async-call-rpc/core';

// --- RPC channel to main process ---
if (!process.parentPort) {
  throw new Error('parentPort is not available');
}

const mainChannel = new ElectronUtilityProcessChannel({
  parentPort: process.parentPort as any,
  description: 'utility→main RPC',
});

const mainClient = clientHost
  .registerClient('main-api', { channel: mainChannel })
  .createProxy();

// --- Direct port channels to main (late-bound) ---

// Channel for the main-initiated port (will be bound in assignMainPort)
const mainInitiatedChannel = new ElectronMessagePortMainChannel({
  description: 'utility↔main (main-initiated port)',
});

serviceHost.registerService('utility-direct-from-main', {
  channel: mainInitiatedChannel,
  serviceHost,
  handlers: {
    ping(msg: string): string {
      console.log('[utility] direct RPC from main (main-initiated):', msg);
      return `pong from utility: ${msg}`;
    },
  },
});

// Channel for the utility-initiated port (will be bound after acquireMainPort)
const utilityInitiatedChannel = new ElectronMessagePortMainChannel({
  description: 'utility↔main (utility-initiated port)',
});

serviceHost.registerService('utility-direct-from-utility', {
  channel: utilityInitiatedChannel,
  serviceHost,
  handlers: {
    echo(msg: string): string {
      console.log('[utility] direct RPC from main (utility-initiated):', msg);
      return `echo from utility: ${msg}`;
    },
  },
});

// Client to call main services over the utility-initiated port
const mainClientViaUtilityPort = clientHost
  .registerClient('main-direct-from-utility', {
    channel: utilityInitiatedChannel,
  })
  .createProxy();

const mainClientViaMainPort = clientHost
  .registerClient('main-direct-from-main', {
    channel: mainInitiatedChannel,
  })
  .createProxy();

// --- Service for main to call ---
serviceHost.registerService('utility-api', {
  channel: mainChannel,
  serviceHost,
  handlers: {
    assignMainPort(port: any) {
      console.log('[utility] assignMainPort: binding port for RPC');
      mainInitiatedChannel.bindPort(port);
    },
  },
});

// --- Utility-initiated flow: acquire a direct port to main ---
setTimeout(async () => {
  try {
    const ports = await mainClient.acquireMainPort();
    const [port] = ports as [any];
    console.log('[utility] acquireMainPort: binding port for RPC');
    utilityInitiatedChannel.bindPort(port);

    // Verify: call main's service over the direct port
    try {
      const result = await mainClientViaUtilityPort.greet(
        'hello from utility via direct port'
      );
      console.log(
        '[utility] ✅ direct RPC to main (utility-initiated):',
        result
      );
    } catch (err) {
      console.error(
        '[utility] ❌ direct RPC to main (utility-initiated) failed:',
        err
      );
    }
  } catch (err) {
    console.error('[utility] ❌ acquireMainPort failed:', err);
  }
}, 1000);

// Verify main-initiated RPC after port arrives
setTimeout(async () => {
  try {
    const result = await mainClientViaMainPort.hello(
      'hello from utility via main-initiated port'
    );
    console.log('[utility] ✅ direct RPC to main (main-initiated):', result);
  } catch (err) {
    console.error(
      '[utility] ❌ direct RPC to main (main-initiated) failed:',
      err
    );
  }
}, 5000);
