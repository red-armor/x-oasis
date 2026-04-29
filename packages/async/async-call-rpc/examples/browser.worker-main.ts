/**
 * Web Worker Main Thread Example
 *
 * Demonstrates bidirectional RPC between main thread and a Web Worker.
 *
 * Usage:
 *   1. Build the project:  pnpm run build
 *   2. Serve this dir:     npx serve examples
 *   3. Open test-worker.html in a browser
 */

import { WorkerChannel, serviceHost, clientHost } from '../src/index';

// ---- Create the Worker ----

const workerUrl = new URL('./browser.worker-worker.ts', import.meta.url).href;
const worker = new Worker(workerUrl, { type: 'module' });

worker.onerror = (e) => console.error('[Main] Worker error:', e);

// ---- Set up the channel ----

const channel = new WorkerChannel(worker, { name: 'main-thread' });

// Register a service that the worker can call
const service = serviceHost.registerService('main', {
  getTimestamp: () => Date.now(),
  getTitle: () => document.title,
});
service.setChannel(channel);

// Create a proxy to call the worker's service
setTimeout(async () => {
  const workerProxy = clientHost
    .registerClient('worker', { channel })
    .createProxy<{
      fibonacci(n: number): Promise<number>;
      ping(): Promise<string>;
    }>();

  try {
    const pong = await workerProxy.ping();
    console.log('[Main] ping():', pong);

    const fib = await workerProxy.fibonacci(10);
    console.log('[Main] fibonacci(10):', fib);
  } catch (err) {
    console.error('[Main] RPC call failed:', err);
  }
}, 500);

// Cleanup on page unload
window.addEventListener('beforeunload', () => worker.terminate());
