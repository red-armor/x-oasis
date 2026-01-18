// import * as rpc from '../out/base.mjs'
// import { WorkerChannel } from '../utils/web/worker.js'

import { WorkerChannel, serviceHost } from '../dist/async-call-rpc.esm.js';

console.log('[Main] Script loaded, creating Worker...');

// 使用 href 而不是 pathname，确保路径正确
const workerUrl = new URL('./browser.worker-worker.js', import.meta.url).href;
console.log('[Main] Worker URL:', workerUrl);

let workerInstance;
try {
  workerInstance = new Worker(workerUrl, { type: 'module' });
} catch (error) {
  console.error('[Main] ❌ 创建 Worker 实例失败:', error);
  console.error('  错误详情:', error.message);
  throw error;
}

// 检测 Worker 是否加载成功
let workerLoaded = false;

// 设置加载超时（5秒）
const workerLoadTimeout = setTimeout(() => {
  if (!workerLoaded) {
    console.error('[Main] ❌ Worker 加载超时！可能的原因：');
    console.error('  1. Worker 文件路径错误');
    console.error('  2. Worker 文件中有语法错误');
    console.error('  3. Worker 文件导入的模块无法解析');
    console.error('  4. 需要使用 HTTP 服务器（不能使用 file:// 协议）');
  }
}, 5000);

// 监听 Worker 错误
workerInstance.onerror = (error) => {
  console.error('[Main] ❌ Worker 加载失败:', error);
  console.error('  错误对象:', error);
  console.error('  错误信息:', error.message || '无错误消息');
  console.error('  错误文件:', error.filename || '未知文件');
  console.error('  错误行号:', error.lineno || '未知行号');
  console.error('  错误列号:', error.colno || '未知列号');
  console.error('  可能的解决方案:');
  console.error('    1. 检查 Worker 文件路径是否正确');
  console.error('    2. 确保使用 HTTP 服务器（不能使用 file:// 协议）');
  console.error('    3. 检查 Worker 文件中的模块导入是否正确');
  console.error('    4. 检查浏览器控制台是否有更详细的错误信息');
  clearTimeout(workerLoadTimeout);
};

// 监听 Worker 消息错误
workerInstance.onmessageerror = (error) => {
  console.error('[Main] ❌ Worker 消息错误:', error);
  clearTimeout(workerLoadTimeout);
};

// 监听 Worker 消息（用于确认加载成功）
workerInstance.onmessage = (event) => {
  if (event.data && event.data.type === 'worker-ready') {
    workerLoaded = true;
    clearTimeout(workerLoadTimeout);
    console.log('[Main] ✅ Worker 加载成功！');
  }
};

console.log('[Main] Worker 实例已创建，等待加载...');
console.log('[Main] Worker 状态:', {
  url: workerUrl,
  type: 'module',
});

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

// 确保页面卸载时终止 Worker
window.addEventListener('beforeunload', () => {
  console.log('[Main] Terminating Worker...');
  workerInstance.terminate();
});
