/**
 * @x-oasis/async-call-rpc-electron — Utility Worker B
 *
 * Launched by main process via utilityProcess.fork().
 *
 * Port channels:
 * - acquireUtilityAPort (utility-B-initiated): utility B acquires port1,
 *   utility A gets port2 via assignUtilityBPort.
 * - assignUtilityAPort (utility-A-initiated): utility A acquires port1,
 *   utility B gets port2 via this handler.
 */

import {
  ElectronUtilityProcessChannel,
  ElectronMessagePortMainChannel,
} from '@x-oasis/async-call-rpc-electron';
import { clientHost, serviceHost } from '@x-oasis/async-call-rpc';

// --- RPC channel to main process ---
if (!process.parentPort) {
  throw new Error('parentPort is not available');
}

const mainChannel = new ElectronUtilityProcessChannel({
  parentPort: process.parentPort as any,
  description: 'utility-b→main RPC',
});

const mainClient = clientHost
  .registerClient('main-for-utility-b', { channel: mainChannel })
  .createProxy();

// --- Direct port channels to utility A (late-bound) ---

const aInitiatedChannel = new ElectronMessagePortMainChannel({
  description: 'utility-b↔utility-a (A-initiated port)',
});

serviceHost.registerService('utility-b-direct-from-a', {
  channel: aInitiatedChannel,
  serviceHost,
  handlers: {
    echo(msg: string): string {
      console.log('[utility-b] direct RPC from utility A (A-initiated):', msg);
      return `echo from utility-b: ${msg}`;
    },
  },
});

const bInitiatedChannel = new ElectronMessagePortMainChannel({
  description: 'utility-b↔utility-a (B-initiated port)',
});

serviceHost.registerService('utility-b-direct-from-b', {
  channel: bInitiatedChannel,
  serviceHost,
  handlers: {
    ping(msg: string): string {
      console.log('[utility-b] direct RPC from utility A (B-initiated):', msg);
      return `pong from utility-b: ${msg}`;
    },
  },
});

const utilityAClientViaBPort = clientHost
  .registerClient('utility-a-direct-from-b', { channel: bInitiatedChannel })
  .createProxy();

const utilityAClientViaAPort = clientHost
  .registerClient('utility-a-direct-from-a', { channel: aInitiatedChannel })
  .createProxy();

// --- Service for main to call ---
serviceHost.registerService('utility-b-api', {
  channel: mainChannel,
  serviceHost,
  handlers: {
    /**
     * assignUtilityAPort — called by main when utility A requests acquireUtilityBPort.
     * Binds the received port to aInitiatedChannel for RPC.
     */
    assignUtilityAPort(port: any) {
      console.log('[utility-b] assignUtilityAPort: binding port for RPC');
      aInitiatedChannel.bindPort(port);
    },
  },
});

// --- Utility B-initiated flow: acquire a direct port to utility A ---
setTimeout(async () => {
  try {
    const ports = await mainClient.acquireUtilityAPort();
    const [port] = ports as [any];
    console.log('[utility-b] acquireUtilityAPort: binding port for RPC');
    bInitiatedChannel.bindPort(port);

    // Verify: call utility A's service over the direct port
    try {
      const result = await utilityAClientViaBPort.hello(
        'hello from utility-b via B-initiated port'
      );
      console.log(
        '[utility-b] ✅ direct RPC to utility A (B-initiated):',
        result
      );
    } catch (err) {
      console.error(
        '[utility-b] ❌ direct RPC to utility A (B-initiated) failed:',
        err
      );
    }
  } catch (err) {
    console.error('[utility-b] ❌ acquireUtilityAPort failed:', err);
  }
}, 3000);

// Verify A-initiated RPC after port arrives
setTimeout(async () => {
  try {
    const result = await utilityAClientViaAPort.greet(
      'hello from utility-b via A-initiated port'
    );
    console.log(
      '[utility-b] ✅ direct RPC to utility A (A-initiated):',
      result
    );
  } catch (err) {
    console.error(
      '[utility-b] ❌ direct RPC to utility A (A-initiated) failed:',
      err
    );
  }
}, 5000);
