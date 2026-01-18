// import * as rpc from '../out/base.mjs'
// import { WorkerChannel } from '../utils/web/worker.js'

import { WorkerChannel, rpcServiceHost } from '../dist/async-call-rpc.esm.js';

console.log('[Main] Script loaded, creating Worker...');
const workerInstance = new Worker(
  new URL('./browser.worker-worker.js', import.meta.url).pathname,
  { type: 'module' }
);

const channel = new WorkerChannel(workerInstance);

const impl = {
  mainHello: () => {
    console.log('[Main] mainHello called');
    return 'hello from main test';
  },
};

const service = rpcServiceHost.registerService('test', impl);
service.setChannel(channel);

// 确保页面卸载时终止 Worker
window.addEventListener('beforeunload', () => {
  console.log('[Main] Terminating Worker...');
  workerInstance.terminate();
});
