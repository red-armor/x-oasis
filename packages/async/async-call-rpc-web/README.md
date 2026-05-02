# @x-oasis/async-call-rpc-web

Web 平台传输层适配器，为 [`@x-oasis/async-call-rpc`](../async-call-rpc/) 提供 MessagePort、Web Worker、WebSocket 三种通道实现。

## 安装

```bash
pnpm add @x-oasis/async-call-rpc-web @x-oasis/async-call-rpc
```

## 核心概念

本包提供三个 Channel 类，均继承自 `AbstractChannelProtocol`：

| 类                 | 传输层                                  | 使用场景              |
| ------------------ | --------------------------------------- | --------------------- |
| `MessageChannel`   | `MessagePort`（`new MessageChannel()`） | iframe / 跨窗口通信   |
| `WorkerChannel`    | `Worker` / `self`                       | Web Worker 双向通信   |
| `WebSocketChannel` | `WebSocket`（浏览器和 Node.js `ws`）    | 客户端-服务端实时通信 |

## 快速开始

### 1. Web Worker

```typescript
// === 主线程 ===
import { WorkerChannel } from '@x-oasis/async-call-rpc-web';
import { serviceHost, clientHost } from '@x-oasis/async-call-rpc';

const worker = new Worker(new URL('./worker.ts', import.meta.url), {
  type: 'module',
});
const channel = new WorkerChannel(worker, { name: 'main-thread' });

const proxy = clientHost.registerClient('compute', { channel }).createProxy<{
  fibonacci(n: number): Promise<number>;
}>();

const result = await proxy.fibonacci(10); // 55
```

```typescript
// === Worker 线程 ===
import { WorkerChannel } from '@x-oasis/async-call-rpc-web';
import { serviceHost } from '@x-oasis/async-call-rpc';

const channel = new WorkerChannel(self, { name: 'worker' });

const service = serviceHost.registerService('compute', {
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
// === 客户端（浏览器）===
import { WebSocketChannel } from '@x-oasis/async-call-rpc-web';
import { clientHost } from '@x-oasis/async-call-rpc';

const ws = new WebSocket('ws://localhost:3456');
const channel = new WebSocketChannel(ws, { name: 'client' });

const api = clientHost.registerClient('api', { channel }).createProxy<{
  echo(msg: string): Promise<string>;
  now(): Promise<number>;
}>();

const result = await api.echo('hello'); // 'hello'
```

```typescript
// === 服务端（Node.js + ws 库）===
import { WebSocketServer } from 'ws';
import { WebSocketChannel } from '@x-oasis/async-call-rpc-web';
import { serviceHost } from '@x-oasis/async-call-rpc';

const wss = new WebSocketServer({ port: 3456 });

wss.on('connection', (ws) => {
  const channel = new WebSocketChannel(ws as any, {
    name: 'server',
    connected: true,
  });
  channel.activate();

  const service = serviceHost.registerService('api', {
    echo: (x: string) => x,
    now: () => Date.now(),
  });
  service.setChannel(channel);

  ws.on('close', () => channel.disconnect());
});
```

### 3. MessageChannel（iframe / 跨窗口）

```typescript
import { MessageChannel as RPCMessageChannel } from '@x-oasis/async-call-rpc-web';

const { port1, port2 } = new MessageChannel();

// 主窗口用 port1
const channel = new RPCMessageChannel({ port: port1 });

// 将 port2 传给 iframe
iframe.contentWindow.postMessage('init', '*', [port2]);
```

## API 参考

### `WorkerChannel`

```typescript
new WorkerChannel(worker: Worker | DedicatedWorkerGlobalScope, options?: {
  name?: string;
} & AbstractChannelProtocolProps)
```

- `worker` — 主线程传 `Worker` 实例，Worker 内传 `self`
- `name` — 可选的通道名称（用于调试日志）

### `WebSocketChannel`

```typescript
new WebSocketChannel(socket: WebSocket, options?: {
  name?: string;
  maxReconnectAttempts?: number;  // 默认 5
  reconnectDelay?: number;        // 默认 1000ms
  connected?: boolean;            // 默认 false
} & AbstractChannelProtocolProps)
```

- `socket` — 浏览器原生 WebSocket 或 Node.js `ws` 实例
- `connected` — 服务端场景下（已 open）设为 `true`
- WebSocket open 时自动 `activate()`，close 时自动 `disconnect()`

**实用方法：**

| 方法 / 属性    | 说明                          |
| -------------- | ----------------------------- |
| `readyState`   | 返回底层 WebSocket readyState |
| `isOpen()`     | 是否处于 OPEN 状态            |
| `disconnect()` | 关闭 WebSocket 并断开通道     |

### `RPCMessageChannel`

```typescript
new RPCMessageChannel(options?: {
  port?: MessagePort;     // 可省略，之后用 bindPort 绑定
  sender?: any;           // 默认 window
  targetOrigin?: string;  // 默认 '*'
} & AbstractChannelProtocolProps)
```

- `port` — `MessagePort` 实例。**可选**：省略时通道以"未连接"状态创建，`send()` 会暂存到 `pendingSendEntries`，`bindPort` 触发后自动 flush
- 构造时（或 `bindPort` 时）自动调用 `port.start()`
- `send()` 支持 `transfer` 参数传递 `Transferable` 对象
- 同时导出别名：`MessageChannel` 与 `RPCMessageChannel` 指向同一类（前者保持向后兼容，后者避免与 DOM 同名 `MessageChannel` 混淆）

#### 延迟端口绑定（bindPort）

> 当 port 通过后续 `MessageEvent` 的 transfer list 才到达时使用此模式：先把通道挂到服务/客户端上，等 port 到了再绑。

```typescript
import { RPCMessageChannel } from '@x-oasis/async-call-rpc-web';
import { serviceHost } from '@x-oasis/async-call-rpc';

// 1. 创建未绑定 port 的通道
const channel = new RPCMessageChannel();
channel.setServiceHost(serviceHost); // 注册路由

// 2. 等待 port 通过 message 事件到达
window.addEventListener('message', (event) => {
  if (event.data === 'rpc-port' && event.ports[0]) {
    channel.bindPort(event.ports[0]);
    // bindPort 调用后，channel 进入连接态，此前 queued 的 send 自动 flush
  }
});
```

`bindPort` 是幂等的：重复调用或对已绑定通道再调用都是 no-op。在绑定前调用 `send()` 会打 warn 并丢弃数据（业务一般不会触发，因为正常路径都是通过 `pendingSendEntries` 排队）。

## 运行测试

```bash
pnpm test
```

## License

ISC
