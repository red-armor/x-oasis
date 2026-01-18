// import * as rpc from '../out/base.mjs'
// import { WorkerChannel } from '../utils/web/worker.js'

import { WorkerChannel, serviceHost } from '../dist/async-call-rpc.esm.js';

// 使用 href 而不是 pathname，确保路径正确
const workerUrl = new URL('./browser.worker-worker.js', import.meta.url).href;
console.log('[Main] Worker URL:', workerUrl);

const workerInstance = new Worker(workerUrl, { type: 'module' });

// 监听 Worker 错误
workerInstance.onerror = (error) => {
  console.error('[Main] ❌ Worker 加载失败:', error);
};

// 监听 Worker 消息错误
workerInstance.onmessageerror = (error) => {
  console.error('[Main] ❌ Worker 消息错误:', error);
};
const channel = new WorkerChannel(workerInstance, {
  name: 'worker-main',
});

const impl = {
  mainHello: () => {
    console.log('[Main] mainHello called');
    return 'hello from main test';
  },
};

const service = serviceHost.registerService('test', impl);
service.setChannel(channel);

// setTimeout(() => {
//   const client = clientHost.registerClient('test-worker', {
//     channel,
//   }).createProxy();

//   client.workerHello().then((result) => {
//     console.log('[main] ✅ 成功调用 workerHello，收到结果:', result);
//   });
// }, 1000);

// 确保页面卸载时终止 Worker
window.addEventListener('beforeunload', () => {
  console.log('[Main] Terminating Worker...');
  workerInstance.terminate();
});
