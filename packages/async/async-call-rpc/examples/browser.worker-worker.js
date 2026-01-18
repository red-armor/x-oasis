// import * as rpc from '../out/base.mjs'
// import { WorkerChannel } from '../utils/web/worker.js'

// 使用静态 import（Worker 文件已经是 ES module）
import { WorkerChannel, clientHost } from '../dist/async-call-rpc.esm.js';

// console.log('[Worker] ✅ Worker 脚本开始执行...');
// console.log('[Worker] 当前 URL:', import.meta.url);
// console.log('[Worker] self 类型:', typeof self);
// console.log('[Worker] self.postMessage 类型:', typeof self.postMessage);

// console.log('[Worker] ✅ 模块导入成功');
// console.log('[Worker] WorkerChannel:', WorkerChannel);
// console.log('[Worker] rpcClientHost:', clientHost);

try {
  // 在 Worker 内部，WorkerChannel 需要使用 self（Worker 的全局对象）
  // self 在 Worker 中就是 Worker 全局对象，有 postMessage 和 addEventListener 方法
  // console.log('[Worker] 创建 WorkerChannel...');
  const channel = new WorkerChannel(self, {
    name: 'worker-worker',
  });
  // console.log('[Worker] ✅ WorkerChannel 创建成功');

  // console.log('[Worker] 注册 Client...');
  const client = clientHost
    .registerClient('test', {
      channel,
    })
    .createProxy();
  // console.log('[Worker] ✅ Client 注册成功:', client);

  // 发送加载成功消息给主线程
  // self.postMessage({ type: 'worker-ready', message: 'Worker loaded successfully' });
  // console.log('[Worker] ✅ 已通知主线程 Worker 加载成功');

  // // 测试调用主线程的方法
  // console.log('[Worker] 测试调用 mainHello...');
  client
    .mainHello()
    .then((result) => {
      console.log('[Worker] ✅ 成功调用 mainHello，收到结果:', result);
    })
    .catch((error) => {
      console.error('[Worker] ❌ 调用 mainHello 失败:', error);
      console.error('[Worker] 错误详情:', error.message);
      console.error('[Worker] 错误堆栈:', error.stack);
    });
} catch (error) {
  // console.error('[Worker] ❌ Worker 初始化失败:', error);
  // console.error('[Worker] 错误类型:', error?.constructor?.name);
  // console.error('[Worker] 错误消息:', error?.message);
  // console.error('[Worker] 错误堆栈:', error?.stack);
  // console.error('[Worker] 可能的解决方案:');
  // console.error('  1. 检查模块路径是否正确');
  // console.error('  2. 确保使用 HTTP 服务器（不能使用 file:// 协议）');
  // console.error('  3. 检查 dist/async-call-rpc.esm.js 文件是否存在');
  // console.error('  4. 检查浏览器控制台是否有模块加载错误');
  // console.error('  5. 检查 Worker 文件路径是否正确');
  // // 即使出错也尝试通知主线程
  // try {
  //   self.postMessage({
  //     type: 'worker-error',
  //     error: error?.message || String(error),
  //     stack: error?.stack
  //   });
  // } catch (postError) {
  //   console.error('[Worker] ❌ 无法发送错误消息给主线程:', postError);
  // }
}
