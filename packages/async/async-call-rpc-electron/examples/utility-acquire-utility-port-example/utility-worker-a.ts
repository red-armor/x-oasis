/**
 * @x-oasis/async-call-rpc-electron — Utility Worker A
 *
 * Launched by main process via utilityProcess.fork().
 *
 * Port channels:
 * - acquireUtilityBPort (utility-A-initiated): utility A acquires port1,
 *   utility B gets port2 via assignUtilityAPort.
 * - assignUtilityBPort (utility-B-initiated): utility B acquires port1,
 *   utility A gets port2 via this handler.
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
  description: 'utility-a→main RPC',
});

const mainClient = clientHost
  .registerClient('main-for-utility-a', { channel: mainChannel })
  .createProxy();

// --- Direct port channels to utility B (late-bound) ---

const aInitiatedChannel = new ElectronMessagePortMainChannel({
  description: 'utility-a↔utility-b (A-initiated port)',
});

serviceHost.registerService('utility-a-direct-from-a', {
  channel: aInitiatedChannel,
  serviceHost,
  handlers: {
    greet(msg: string): string {
      console.log('[utility-a] direct RPC from utility B (A-initiated):', msg);
      return `greeting from utility-a: ${msg}`;
    },
  },
});

const bInitiatedChannel = new ElectronMessagePortMainChannel({
  description: 'utility-a↔utility-b (B-initiated port)',
});

serviceHost.registerService('utility-a-direct-from-b', {
  channel: bInitiatedChannel,
  serviceHost,
  handlers: {
    hello(msg: string): string {
      console.log('[utility-a] direct RPC from utility B (B-initiated):', msg);
      return `hello from utility-a: ${msg}`;
    },
  },
});

const utilityBClientViaAPort = clientHost
  .registerClient('utility-b-direct-from-a', { channel: aInitiatedChannel })
  .createProxy();

const utilityBClientViaBPort = clientHost
  .registerClient('utility-b-direct-from-b', { channel: bInitiatedChannel })
  .createProxy();

// --- Service for main to call ---
serviceHost.registerService('utility-a-api', {
  channel: mainChannel,
  serviceHost,
  handlers: {
    /**
     * assignUtilityBPort — called by main when utility B requests acquireUtilityAPort.
     * Binds the received port to bInitiatedChannel for RPC.
     */
    assignUtilityBPort(port: any) {
      console.log('[utility-a] assignUtilityBPort: binding port for RPC');
      bInitiatedChannel.bindPort(port);
    },
  },
});

// --- Utility A-initiated flow: acquire a direct port to utility B ---
setTimeout(async () => {
  try {
    const ports = await mainClient.acquireUtilityBPort();
    const [port] = ports as [any];
    console.log('[utility-a] acquireUtilityBPort: binding port for RPC');
    aInitiatedChannel.bindPort(port);

    // Verify: call utility B's service over the direct port
    try {
      const result = await utilityBClientViaAPort.echo(
        'hello from utility-a via A-initiated port'
      );
      console.log(
        '[utility-a] ✅ direct RPC to utility B (A-initiated):',
        result
      );
    } catch (err) {
      console.error(
        '[utility-a] ❌ direct RPC to utility B (A-initiated) failed:',
        err
      );
    }
  } catch (err) {
    console.error('[utility-a] ❌ acquireUtilityBPort failed:', err);
  }
}, 1000);

// Verify B-initiated RPC after port arrives
setTimeout(async () => {
  try {
    const result = await utilityBClientViaBPort.ping(
      'hello from utility-a via B-initiated port'
    );
    console.log(
      '[utility-a] ✅ direct RPC to utility B (B-initiated):',
      result
    );
  } catch (err) {
    console.error(
      '[utility-a] ❌ direct RPC to utility B (B-initiated) failed:',
      err
    );
  }
}, 5000);
