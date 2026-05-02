/**
 * parent.ts — 父进程入口
 *
 * 使用 child_process.fork() 创建子进程，通过 NodeProcessChannel 建立
 * 双向 RPC 通信。父进程同时扮演两个角色：
 *   - 服务端：暴露 getTimestamp / getEnv 方法供子进程调用
 *   - 客户端：调用子进程的 compute / ping / fibonacci 方法
 */

import { fork } from 'child_process';
import { resolve } from 'path';
import { NodeProcessChannel } from '../../src/index';
import { clientHost, serviceHost } from '@x-oasis/async-call-rpc';

// ---------- 1. fork 子进程 ----------

const child = fork(resolve(__dirname, 'worker.ts'), [], {
  execArgv: ['--import', 'tsx'],
  stdio: ['inherit', 'inherit', 'inherit', 'ipc'],
});

console.log(`[parent] 子进程已启动, pid = ${child.pid}`);

// ---------- 2. 创建 IPC Channel ----------

const channel = new NodeProcessChannel({
  process: child,
  description: 'parent↔child',
});

// ---------- 3. 注册本地服务（供子进程调用） ----------

serviceHost.registerService('main', {
  channel,
  serviceHost,
  handlers: {
    getTimestamp: () => Date.now(),
    getEnv: (key: string) => process.env[key] ?? `<${key} not set>`,
  },
});

// ---------- 4. 创建客户端代理（调用子进程服务） ----------

interface WorkerService {
  compute(n: number): Promise<number>;
  ping(): Promise<string>;
  fibonacci(n: number): Promise<number>;
}

const workerClient = clientHost.registerClient('worker', { channel });
const worker = workerClient.createProxy<WorkerService>();

// ---------- 5. 调用远程方法 ----------

async function main() {
  // 等子进程完成初始化
  await new Promise((r) => setTimeout(r, 500));

  try {
    console.log('\n[parent] === 开始调用子进程方法 ===\n');

    const doubled = await worker.compute(21);
    console.log(`[parent] worker.compute(21) = ${doubled}`);

    const pong = await worker.ping();
    console.log(`[parent] worker.ping()      = "${pong}"`);

    const fib10 = await worker.fibonacci(10);
    console.log(`[parent] worker.fibonacci(10) = ${fib10}`);

    console.log('\n[parent] === 所有 RPC 调用完成 ===');
  } catch (err) {
    console.error('[parent] RPC 调用出错:', err);
  } finally {
    // 清理：杀掉子进程并退出
    child.kill();
    console.log('[parent] 子进程已终止，退出。');
    process.exit(0);
  }
}

main();
