# @x-oasis/async-call-rpc-node

Node.js 传输层适配器，为 [`@x-oasis/async-call-rpc`](../async-call-rpc/) 提供基于 `child_process.fork()` IPC 的通道实现。

## 安装

```bash
pnpm add @x-oasis/async-call-rpc-node @x-oasis/async-call-rpc
```

## 核心概念

本包提供 `NodeProcessChannel`，基于 Node.js `child_process.fork()` 建立的 IPC 通道进行双向 RPC 通信。

| 类                   | 传输层                     | 使用场景            |
| -------------------- | -------------------------- | ------------------- |
| `NodeProcessChannel` | `child_process.fork()` IPC | 父子进程间 RPC 通信 |

## 快速开始

### 父进程

```typescript
import { fork } from 'child_process';
import { NodeProcessChannel } from '@x-oasis/async-call-rpc-node';
import { serviceHost, clientHost } from '@x-oasis/async-call-rpc';

const child = fork('./worker.js');
const channel = new NodeProcessChannel({
  process: child,
  description: 'parent→child',
});

// 注册本地服务（子进程可以反向调用）
const service = serviceHost.registerService('main', {
  getTimestamp: () => Date.now(),
});
service.setChannel(channel);

// 创建远程代理，调用子进程中的方法
const workerProxy = clientHost
  .registerClient('worker', { channel })
  .createProxy<{
    compute(n: number): Promise<number>;
    ping(): Promise<string>;
  }>();

const result = await workerProxy.compute(42);
```

### 子进程 (worker.js)

```typescript
import { NodeProcessChannel } from '@x-oasis/async-call-rpc-node';
import { serviceHost } from '@x-oasis/async-call-rpc';

const channel = new NodeProcessChannel({
  process,
  description: 'child→parent',
});

const service = serviceHost.registerService('worker', {
  ping: () => 'pong',
  compute: (n: number) => n * 2,
});
service.setChannel(channel);
```

## API 参考

### `NodeProcessChannel`

```typescript
new NodeProcessChannel(props: {
  process: ChildProcess | NodeJS.Process;
} & AbstractChannelProtocolProps)
```

- `process` — 父进程侧传 `fork()` 返回的 `ChildProcess`，子进程侧传全局 `process`
- 子进程退出时自动断开连接
- IPC 消息会被包装为 `{ data: message }` 形式以兼容 normalize 中间件
- `send()` 通过 `process.send()` 发送，如果 IPC 通道不可用会打印警告

**注意事项：**

- 进程必须通过 `child_process.fork()` 创建（而非 `spawn` 或 `exec`），因为只有 `fork()` 会自动建立 IPC 通道
- `fork()` 使用 structured clone 序列化，因此默认的 JSON 序列化格式通常足够使用

## 运行测试

```bash
pnpm test
```

## License

ISC
