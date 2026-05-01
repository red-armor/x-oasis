# @x-oasis/async-call-rpc

基于中间件管道的 RPC 框架，支持 MessageChannel、WebSocket、Web Worker 等多种传输层，提供类型安全的远程过程调用能力。

## 安装

```bash
pnpm add @x-oasis/async-call-rpc
```

## 核心概念

```
┌──────────────────────────────────────────────────────┐
│  调用方 (Client)                                      │
│                                                       │
│  clientHost.registerClient()  →  proxy.someMethod()   │
│       ↓                              ↓                │
│  ProxyRPCClient            Channel.makeRequest()      │
└────────────────────┬─────────────────────────────────┘
                     │  send middleware pipeline
                     │  prepareData → updateSeqInfo → serialize → send
                     │
              ───── 传输层 (MessagePort / WebSocket / Worker) ─────
                     │
                     │  receive middleware pipeline
                     │  normalize → deserialize → handleRequest → handleResponse
                     ↓
┌──────────────────────────────────────────────────────┐
│  服务方 (Service)                                     │
│                                                       │
│  serviceHost.registerService('path', handlers)        │
│  service.setChannel(channel)                          │
└──────────────────────────────────────────────────────┘
```

- **Channel** — 传输层抽象（`MessageChannel`、`WebSocketChannel`、`WorkerChannel`）
- **Service** — 注册方法处理器，响应远程调用
- **Client** — 通过 `Proxy` 代理将方法调用转为 RPC 请求
- **Middleware** — 发送/接收管道，支持序列化、日志、离线排队等扩展

## 快速开始

### 1. 基本用法 — Web Worker

```typescript
// === 主线程 ===
import {
  WorkerChannel,
  serviceHost,
  clientHost,
} from '@x-oasis/async-call-rpc';

const worker = new Worker('./worker.js', { type: 'module' });
const channel = new WorkerChannel(worker);

// 注册本地服务（Worker 可以反向调用）
const service = serviceHost.registerService('main', {
  getTimestamp: () => Date.now(),
});
service.setChannel(channel);

// 创建远程代理，调用 Worker 中的方法
const workerProxy = clientHost
  .registerClient('worker-service', { channel })
  .createProxy<{
    fibonacci(n: number): Promise<number>;
    ping(): Promise<string>;
  }>();

const result = await workerProxy.fibonacci(10); // 55
const pong = await workerProxy.ping(); // 'pong'
```

```typescript
// === Worker 线程 ===
import {
  WorkerChannel,
  serviceHost,
  clientHost,
} from '@x-oasis/async-call-rpc';

const channel = new WorkerChannel(self);

const service = serviceHost.registerService('worker-service', {
  ping: () => 'pong',
  fibonacci: (n: number): number => {
    if (n <= 1) return n;
    let a = 0,
      b = 1;
    for (let i = 2; i <= n; i++) [a, b] = [b, a + b];
    return b;
  },
});
service.setChannel(channel);
```

### 2. WebSocket

```typescript
// === 服务端 (Node.js) ===
import { WebSocketServer } from 'ws';
import { WebSocketChannel, serviceHost } from '@x-oasis/async-call-rpc';

const wss = new WebSocketServer({ port: 3456 });

wss.on('connection', (ws) => {
  const channel = new WebSocketChannel(ws, {
    name: 'server',
    connected: true,
    createContext: ({ methodName }) => ({
      calledAt: Date.now(),
      method: methodName,
    }),
  });
  channel.activate();

  const service = serviceHost.registerService('api', {
    echo: (x) => x,
    now: () => Date.now(),
  });
  service.setChannel(channel);

  ws.on('close', () => channel.disconnect());
});
```

```typescript
// === 客户端 (浏览器) ===
import { WebSocketChannel, clientHost } from '@x-oasis/async-call-rpc';

const ws = new WebSocket('ws://localhost:3456');
const channel = new WebSocketChannel(ws, { name: 'client' });

const api = clientHost.registerClient('api', { channel }).createProxy<{
  echo(x: string): Promise<string>;
  now(): Promise<number>;
}>();

const result = await api.echo('hello'); // 'hello'
```

### 3. MessageChannel（iframe / 跨窗口）

```typescript
const { port1, port2 } = new MessageChannel();

// 主窗口用 port1
const channel = new MessageChannel({ port: port1 });

// 将 port2 传给 iframe
iframe.contentWindow.postMessage('init', '*', [port2]);
```

## 错误处理

远程调用失败时，客户端会收到 `RPCError` 实例：

```typescript
import { RPCError, JSONRPCErrorCode } from '@x-oasis/async-call-rpc';

try {
  await api.someMethod();
} catch (err) {
  if (err instanceof RPCError) {
    console.log(err.code); // JSONRPC 错误码，如 -32601
    console.log(err.message); // 错误描述
    console.log(err.data); // 附加数据（含远程堆栈）
  }
}
```

标准错误码（`JSONRPCErrorCode`）：

| 码值   | 名称           | 含义       |
| ------ | -------------- | ---------- |
| -32700 | ParseError     | 解析错误   |
| -32600 | InvalidRequest | 无效请求   |
| -32601 | MethodNotFound | 方法不存在 |
| -32602 | InvalidParams  | 参数无效   |
| -32603 | InternalError  | 内部错误   |

## createContext — 请求上下文注入

类似 tRPC 的 `createContext`，可以在每次请求时注入上下文信息。上下文会作为 handler 的第二个参数传入：

```typescript
// 服务端 — 配置 createContext
const channel = new WebSocketChannel(ws, {
  createContext: ({ event, requestPath, methodName }) => ({
    sender: event?.sender,
    requestPath,
    methodName,
    timestamp: Date.now(),
  }),
});

// handler 接收 context 作为第二个参数
const service = serviceHost.registerService('api', {
  greet: (args: [string], ctx: { timestamp: number }) => {
    return `Hello ${args[0]}, called at ${ctx.timestamp}`;
  },
});
service.setChannel(channel);
```

`createContext` 支持异步函数（返回 `Promise`），如果 context 创建失败，客户端会收到 `RPCError`。

## React Query 集成

React Query 集成已拆分为独立包 [`@x-oasis/async-call-rpc-react`](../async-call-rpc-react/)，保持本包的轻量和零 React 依赖。

```bash
pnpm add @x-oasis/async-call-rpc-react @tanstack/react-query react
```

```tsx
import { createRPCReact } from '@x-oasis/async-call-rpc-react';
```

详见 [`@x-oasis/async-call-rpc-react` README](../async-call-rpc-react/README.md)。

## 序列化

默认使用 JSON，支持通过 `serializationFormat` 切换：

```typescript
const channel = new WebSocketChannel(ws, {
  serializationFormat: 'msgpack', // 需注册对应的 BufferFactory
});
```

也可以传入自定义 buffer 实例：

```typescript
const channel = new WebSocketChannel(ws, {
  readBuffer: myCustomReadBuffer,
  writeBuffer: myCustomWriteBuffer,
});
```

## 中间件

发送和接收各有一条中间件管道，通过 `decorateSendMiddleware` / `decorateOnMessageMiddleware` 扩展：

```typescript
class MyChannel extends AbstractChannelProtocol {
  decorateSendMiddleware(middlewares) {
    // 在 serialize 之前插入日志
    return [myLoggerMiddleware, ...middlewares];
  }
}
```

中间件生命周期阶段：

| 阶段          | 值  | 说明                      |
| ------------- | --- | ------------------------- |
| Prepare       | 10  | 构造请求数据              |
| Transform     | 20  | 设置 seqId、创建 Deferred |
| DataOperation | 30  | 序列化/反序列化           |
| Send          | 40  | 发送到传输层              |

## 离线排队

Channel 断开时发送的请求自动排队，重连后批量恢复：

```typescript
channel.disconnect(); // 后续请求进入 pendingSendEntries
// ... 稍后 ...
channel.activate(); // 自动 replay 所有排队请求
```

## 订阅

支持两种订阅模式，适用于不同的场景：

### 1. 流式订阅 (SubscriptionRequest) — 推荐用于数据流

使用 `client.subscribe()` 方法启动高频数据流。服务端 handler 返回一个 observable-like 对象，支持多次数据推送、错误处理和完成信号：

**适用场景**：文件监听、数据库变更、实时推送、传感器数据等

```typescript
// === 服务端 ===
const service = serviceHost.registerService('fs', {
  watchFiles: (args: [string], ctx) => {
    const dir = args[0];
    const userId = ctx?.userId; // 可以访问 context

    // 返回一个 observable-like 对象
    return {
      subscribe: (observer) => {
        const watcher = fs.watch(dir, (eventType, filename) => {
          // 每个文件变更都推送一次
          observer.onData?.({ eventType, filename, userId });
        });

        watcher.on('error', (err) => {
          observer.onError?.(err);
        });

        // 返回取消订阅接口
        return {
          unsubscribe: () => watcher.close(),
        };
      },
    };
  },
});
service.setChannel(channel);
```

```typescript
// === 客户端 ===
const client = clientHost.registerClient('fs', { channel });

// 使用 subscribe() 方法
const subscription = client.subscribe('watchFiles', ['/src'], {
  onData: (event) => {
    console.log('File changed:', event);
  },
  onError: (err) => {
    console.error('Watch error:', err);
  },
  onComplete: () => {
    console.log('Watch ended');
  },
});

// 主动取消订阅 — 发送 SubscriptionStop 到服务端
subscription.unsubscribe();
```

**协议消息**：

- `SubscriptionRequest` (`sub`) — 客户端发起订阅
- `SubscriptionStop` (`unsub`) — 客户端取消订阅
- `SubscriptionStopped` (`ss`) — 服务端确认订阅已停止
- `ReturnSuccess` — 推送数据
- `ReturnFail` — 报告错误

**特点**：

- ✅ 完整的生命周期管理
- ✅ 支持错误处理和完成信号
- ✅ 客户端可主动取消
- ✅ 多次数据推送
- ✅ 支持 context 注入

### 2. 事件方法 (Ping-Pong) — 用于简单事件监听

使用 `on*` 方法名约定进行低频事件监听。这是一种更简单的"监听与触发"模式，适合定期事件。客户端可以通过返回的 unsubscriber 主动停止监听：

**适用场景**：心跳/ping-pong、定期状态更新、简单事件通知等

```typescript
// === 服务端 ===
class PingService {
  // 方法名以 "on" 开头，被识别为事件方法
  onPing(callback) {
    // 定期触发回调
    setInterval(() => {
      callback(`pong-${Date.now()}`);
    }, 10000);
  }

  onProcessStatusChanged(callback) {
    // 监听进程状态变更
    process.on('status', (status) => {
      callback(status);
    });
  }
}

const service = serviceHost.registerService('ping', new PingService());
service.setChannel(channel);
```

```typescript
// === 客户端 ===
// 使用 createProxy() 并通过方法调用传入监听函数
const client = clientHost.registerClient('ping', { channel }).createProxy<{
  onPing(callback: (data: string) => void): Unsubscribable;
  onProcessStatusChanged(callback: (status: any) => void): Unsubscribable;
}>();

// 返回 unsubscriber 对象，可以调用 unsubscribe() 停止监听
const pingUnsub = client.onPing((pong) => {
  console.log('Received:', pong);
});

const statusUnsub = client.onProcessStatusChanged((status) => {
  console.log('Status changed:', status);
});

// 稍后可以取消监听
pingUnsub.unsubscribe();
statusUnsub.unsubscribe();
```

**特点**：

- ✅ 实现简单
- ✅ 对低频事件友好
- ✅ 支持多次回调
- ✅ 支持主动取消（EventMethodStop）
- ✅ 向后兼容
- ❌ 无错误处理
- ❌ 无完成信号

### 对比表

| 特性             | 流式订阅 (subscribe)                         | 事件方法 (onXxx)                          |
| ---------------- | -------------------------------------------- | ----------------------------------------- |
| **方法调用**     | `client.subscribe('method', args, observer)` | `const unsub = client.onMethod(callback)` |
| **推送频率**     | 高频（连续流）                               | 低频（定期事件）                          |
| **多次推送**     | ✅ 原生支持                                  | ✅ 支持                                   |
| **错误处理**     | ✅ onError                                   | ❌ 无                                     |
| **完成信号**     | ✅ onComplete                                | ❌ 无                                     |
| **主动取消**     | ✅ unsub.unsubscribe()                       | ✅ unsub.unsubscribe()                    |
| **Context 支持** | ✅ 支持                                      | ❌ 不支持                                 |
| **生命周期**     | ✅ 完整                                      | ✅ 基础                                   |
| **实现复杂度**   | 中等                                         | 简单                                      |

### 生命周期管理

断开连接时自动清理所有活跃订阅和事件监听：

```typescript
channel.disconnect(); // 内部调用 cleanUpSubscriptions()
```

### 何时选用哪种方式

**使用流式订阅 (subscribe)**：

- 数据变更频繁（文件监听、数据库变更）
- 需要错误处理和完成信号
- 需要支持context注入（如权限检查、审计）
- 需要可观察的生命周期

**使用事件方法 (on\*)**：

- 简单的定期事件（心跳/ping-pong、状态检查）
- 代码已存在（向后兼容）
- 实现快速简洁
- 不需要复杂的错误处理

**两种方式都支持**：

- ✅ 多次数据推送
- ✅ 主动取消 (unsubscribe)

## API 参考

### Channel 类

| 类                 | 传输层                                           |
| ------------------ | ------------------------------------------------ |
| `MessageChannel`   | `MessagePort`（iframe / `new MessageChannel()`） |
| `WorkerChannel`    | `Worker` / `self`（Web Worker）                  |
| `WebSocketChannel` | `WebSocket`（浏览器和 Node.js）                  |

### 核心导出

```typescript
import {
  // Channel
  MessageChannel,
  WorkerChannel,
  WebSocketChannel,

  // Endpoint
  ProxyRPCClient,
  RPCService,
  clientHost, // 单例，管理所有客户端
  serviceHost, // 单例，管理所有服务

  // Error
  RPCError,
  JSONRPCErrorCode,

  // Subscription
  type SubscriptionObserver,
} from '@x-oasis/async-call-rpc';
```

## 运行示例

示例项目在 `examples/` 目录下，包含三个 React 应用：

```bash
# Worker 示例（最简单，推荐先看）
cd examples/react-worker-example
pnpm install && pnpm dev

# WebSocket 示例
cd examples/react-websocket-example
pnpm install
pnpm run dev:all   # 同时启动 WebSocket server 和 Vite dev server

# 综合示例（Worker + WebSocket）
cd examples/react-full-app
pnpm install
pnpm run dev:all
```

详细说明见 `examples/README.md` 和 `examples/QUICKSTART.md`。

## 运行测试

```bash
pnpm test
```

## License

ISC
