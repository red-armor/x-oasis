/**
 * Web Worker Thread Example
 *
 * Runs inside a Web Worker. Provides RPC services to the main thread
 * and can also call main-thread services.
 */

import { WorkerChannel, serviceHost, clientHost } from '../src/index';

// ---- Set up the channel (using `self` as the worker global) ----

const channel = new WorkerChannel(self, { name: 'worker-thread' });

// Register services for the main thread to call
const service = serviceHost.registerService('worker', {
  ping: () => 'pong',
  fibonacci: (n: number): number => {
    if (n <= 1) return n;
    let a = 0,
      b = 1;
    for (let i = 2; i <= n; i++) {
      [a, b] = [b, a + b];
    }
    return b;
  },
});
service.setChannel(channel);

// Call the main thread's service
setTimeout(async () => {
  const mainProxy = clientHost.registerClient('main', { channel }).createProxy<{
    getTimestamp(): Promise<number>;
    getTitle(): Promise<string>;
  }>();

  try {
    const ts = await mainProxy.getTimestamp();
    console.log('[Worker] Main thread timestamp:', ts);

    const title = await mainProxy.getTitle();
    console.log('[Worker] Page title:', title);
  } catch (err) {
    console.error('[Worker] Failed to call main:', err);
  }
}, 300);
