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

通过 `createRPCReact()` 将 RPC 调用无缝接入 `@tanstack/react-query`：

```bash
pnpm add @tanstack/react-query react
```

```tsx
import { createRPCReact } from '@x-oasis/async-call-rpc/react';

// 定义远程服务接口
type FileService = {
  readFile(path: string): Promise<string>;
  writeFile(path: string, content: string): Promise<void>;
  listFiles(dir: string): Promise<string[]>;
};

// 创建类型安全的 hooks
const fileRPC = createRPCReact<FileService>(fileClient);

function FileViewer({ path }: { path: string }) {
  // useQuery — 自动缓存、去重、刷新
  const { data, isLoading, error } = fileRPC.useQuery('readFile', [path]);

  // useMutation — 写操作
  const writeMutation = fileRPC.useMutation('writeFile', {
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: fileRPC.getQueryKey('readFile', path),
      });
    },
  });

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return (
    <div>
      <pre>{data}</pre>
      <button
        onClick={() => writeMutation.mutate([path, 'new content'])}
        disabled={writeMutation.isPending}
      >
        Save
      </button>
    </div>
  );
}
```

### API

| Hook                                      | 说明                                            |
| ----------------------------------------- | ----------------------------------------------- |
| `useQuery(method, args, options?)`        | 查询，queryKey 自动为 `[path, method, ...args]` |
| `useMutation(method, options?)`           | 写操作                                          |
| `useSubscription(method, args, options?)` | 订阅 `on*` 事件方法，数据推入 query cache       |
| `getQueryKey(method, ...args)`            | 生成 queryKey，用于手动 `invalidateQueries`     |
| `proxy`                                   | 底层的 RPC 代理对象                             |

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

支持两种订阅模式：

### 1. 正式 Subscription 协议（推荐）

使用 `ProxyRPCClient.subscribe()` 方法启动流式订阅。服务端 handler 返回一个 observable-like 对象（带 `subscribe({ next, error, complete })` 方法）：

```typescript
// === 服务端 ===
const service = serviceHost.registerService('fs', {
  watchFiles: (args: [string]) => {
    const dir = args[0];
    // 返回一个 observable-like 对象
    return {
      subscribe: ({ next, error, complete }) => {
        const watcher = fs.watch(dir, (eventType, filename) => {
          next({ eventType, filename });
        });
        // 返回 Unsubscribable
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

const subscription = client.subscribe('watchFiles', ['/src'], {
  onData: (event) => console.log('File changed:', event),
  onError: (err) => console.error('Watch error:', err),
  onComplete: () => console.log('Watch ended'),
});

// 取消订阅 — 发送 SubscriptionStop 到服务端
subscription.unsubscribe();
```

协议消息类型：

- `SubscriptionRequest` (`sub`) — 客户端发起订阅
- `SubscriptionStop` (`unsub`) — 客户端取消订阅
- `SubscriptionStopped` (`ss`) — 服务端确认订阅已停止

### 2. 事件方法约定

使用 `on*` 方法名约定的事件式订阅（向后兼容）：

```typescript
proxy.onDataChanged((data) => {
  console.log('Data changed:', data);
});
```

### 生命周期管理

断开连接时自动清理所有活跃订阅：

```typescript
channel.disconnect(); // 内部调用 cleanUpSubscriptions()
```

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

// React Query 集成（单独入口）
import { createRPCReact } from '@x-oasis/async-call-rpc/react';
```

## 运行示例

```bash
# WebSocket 示例
npx tsx examples/node.websocket.server.ts   # 终端 1
npx serve examples                          # 终端 2
# 浏览器打开 http://localhost:3000/test-websocket.html

# Worker 示例
npx serve examples
# 浏览器打开 http://localhost:3000/test-worker.html

# MessageChannel 示例
npx serve examples
# 浏览器打开 http://localhost:3000/test-messagechannel.html
```

## 运行测试

```bash
pnpm test
```

## License

ISC
