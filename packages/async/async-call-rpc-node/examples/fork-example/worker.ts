/**
 * worker.ts — 子进程
 *
 * 由父进程通过 child_process.fork() 启动，通过 NodeProcessChannel
 * 与父进程建立双向 RPC 通信。子进程同时扮演两个角色：
 *   - 服务端：暴露 compute / ping / fibonacci 方法供父进程调用
 *   - 客户端：调用父进程的 getTimestamp 方法
 */

import { NodeProcessChannel } from '../../src/index';
import { clientHost, serviceHost } from '@x-oasis/async-call-rpc/core';

// ---------- 1. 创建 IPC Channel ----------

const channel = new NodeProcessChannel({
  process,
  description: 'child↔parent',
});

// ---------- 2. 注册本地服务（供父进程调用） ----------

function fibonacci(n: number): number {
  if (n <= 1) return n;
  let a = 0,
    b = 1;
  for (let i = 2; i <= n; i++) {
    [a, b] = [b, a + b];
  }
  return b;
}

serviceHost.registerService('worker', {
  channel,
  serviceHost,
  handlers: {
    compute: (n: number) => n * 2,
    ping: () => 'pong',
    fibonacci: (n: number) => fibonacci(n),
  },
});

// ---------- 3. 调用父进程的方法 ----------

interface MainService {
  getTimestamp(): Promise<number>;
  getEnv(key: string): Promise<string>;
}

const mainClient = clientHost.registerClient('main', { channel });
const main = mainClient.createProxy<MainService>();

async function init() {
  try {
    const ts = await main.getTimestamp();
    console.log(`[worker] 父进程时间戳: ${ts} (${new Date(ts).toISOString()})`);

    const nodeVersion = await main.getEnv('NODE_VERSION');
    console.log(`[worker] 父进程 NODE_VERSION = "${nodeVersion}"`);
  } catch (err) {
    console.error('[worker] 调用父进程方法出错:', err);
  }
}

console.log('[worker] 子进程已就绪');
init();
