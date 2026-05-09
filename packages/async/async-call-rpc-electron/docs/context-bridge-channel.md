---
title: ContextBridge RPC Channel
description: 让 Renderer Page 通过 contextBridge 获得完整 RPC 能力
order: 4
---

# ContextBridge RPC Channel

## 背景

在 Electron `contextIsolation: true` 下，renderer 页面无法直接访问 `ipcRenderer`，也无法持有 `MessagePort`。所有与主进程 / utility 进程的通信必须经由 preload 中转。

当前 `@x-oasis/async-call-rpc-electron` 的 RPC 体系（`clientHost.registerClient().createProxy()`）在 main / preload / utility 侧都能直接使用，唯独 renderer page 被隔绝在 `contextBridge` 之外。

## 核心洞察

**contextBridge 只是传输层，两边各持半个 channel，对 RPC 框架来说是透明的。**

与其在 `contextBridge` 上逐个转发 `invoke` / `on` / `signal`，不如把 `contextBridge` 封装成一个 `AbstractChannelProtocol` 实现。这样 page 侧就能直接用 `clientHost.registerClient().createProxy()`，框架的所有能力（request/response、signal、subscription、ping-pong）自动具备。

## 架构

```
Renderer Page                     Preload                          Main / Utility
┌──────────────────┐              ┌────────────────────┐           ┌──────────────┐
│ ContextBridge    │   _send ───► │ realChannel.send() │ ────────► │              │
│ Channel          │              │                    │           │  RPC Service │
│ (AbstractChannel │  _onMessage ◄─┤ realChannel.on()  │ ◄──────── │              │
│  Protocol)       │              │                    │           │              │
│                  │              │ clientHost /       │           │              │
│ clientHost       │              │  serviceHost       │           │              │
│  .registerClient │              │  (正常使用)        │           │              │
│  .createProxy()  │              │                    │           │              │
└──────────────────┘              └────────────────────┘           └──────────────┘
        ▲                                ▲
        │    contextBridge (transport)    │
        └────────────────────────────────┘
```

## 快速开始

### Preload

```typescript
import { createPageBridge } from '@x-oasis/async-call-rpc-electron';
import { clientHost, serviceHost } from '@x-oasis/async-call-rpc';

const bridge = createPageBridge({
  ipcRenderer,
  channelName: 'app-rpc',
});

// 作为客户端 — 调用对端服务
const utility = clientHost
  .registerClient('utility-service', { channel: bridge.channel })
  .createProxy();

// 作为服务端 — 让对端（utility/main）调用 renderer 侧的方法
serviceHost.registerService('renderer-events', {
  channel: bridge.channel,
  handlers: {
    onProgress: (percent: number) => console.log(percent),
    getState: () => ({ connected: true }),
  },
});
```

### Page

```typescript
import { createPageChannel } from '@x-oasis/async-call-rpc-electron';
import { clientHost, serviceHost } from '@x-oasis/async-call-rpc';

const channel = createPageChannel();

// 作为客户端
const utility = clientHost
  .registerClient('utility-service', { channel })
  .createProxy<{
    compute(n: number): Promise<number>;
    onProgress(cb: (p: number) => void): void;
    ping(): Promise<void>;
  }>();

// 作为服务端 — 让对端调用 page 侧的方法
serviceHost.registerService('page-api', {
  channel,
  handlers: {
    getUserInput: () => prompt('Enter value'),
  },
});

// 全部开箱即用：
await utility.compute(42); // request/response
utility.onProgress((p) => console.log(p)); // signal/subscription
await utility.ping(); // ping-pong
```

### Main（Orchestrator 无感）

```typescript
const orchestrator = new ElectronConnectionOrchestrator();
orchestrator.registerParticipant('renderer', ipcChannel, 'renderer');
orchestrator.registerParticipant('utility', utilityChannel, 'utility');
await orchestrator.connect('renderer', 'utility');
```

Main 侧正常使用 orchestrator，无需感知 renderer 内部是 preload + page 的组合。

## API 参考

### `createPageBridge(options)`

Preload 侧调用，一行完成 IPC 通道创建 + `registerOrchestratorHandler` + `contextBridge` 暴露 + 消息双向桥接。

```typescript
function createPageBridge(options: {
  ipcRenderer: typeof Electron.ipcRenderer;
  channelName: string;
  description?: string;
}): {
  channel: RPCMessageChannel; // preload 可用于 clientHost / serviceHost
  ipcChannel: IPCRendererChannel; // 底层 IPC 通道（一般不需要直接用）
};
```

### `createPageChannel(description?)`

Page 侧调用，返回一个已激活的 `ContextBridgeChannel`，可直接传给 `clientHost.registerClient`。

```typescript
function createPageChannel(description?: string): ContextBridgeChannel;
```

### `ContextBridgeChannel`

Page 侧的 `AbstractChannelProtocol` 实现，通过 `contextBridge` 管道与 preload 侧的真实 channel 通信。

```typescript
class ContextBridgeChannel extends AbstractChannelProtocol {
  on(listener: (data: unknown) => void): () => void;
  send(data: unknown): void;
  activate(): void;
  disconnect(): void;
}
```

## 内部实现

### createPageBridge

```typescript
export function createPageBridge(options: {
  ipcRenderer: typeof Electron.ipcRenderer;
  channelName: string;
  description?: string;
}) {
  const { ipcRenderer, channelName, description } = options;

  const ipcChannel = new IPCRendererChannel({ channelName, ipcRenderer });
  const realChannel = new RPCMessageChannel({
    description: description ?? `page-bridge:${channelName}`,
  });

  registerOrchestratorHandler(ipcChannel, (port) => {
    realChannel.bindPort(port, { rebind: true });
  });

  // contextBridge 桥接
  const messageHandlers = new Set<(data: unknown) => void>();

  contextBridge.exposeInMainWorld('__rpc_bridge__', {
    _send: (data: unknown) => realChannel.send(data),
    _onMessage: (cb: (data: unknown) => void) => messageHandlers.add(cb),
    _offMessage: () => messageHandlers.clear(),
  });

  realChannel.on((data: unknown) => {
    messageHandlers.forEach((cb) => cb(data));
  });

  return { channel: realChannel, ipcChannel };
}
```

### createPageChannel

```typescript
export function createPageChannel(description?: string): ContextBridgeChannel {
  const channel = new ContextBridgeChannel({
    description: description ?? 'page-rpc',
  });
  channel.activate();
  return channel;
}
```

### ContextBridgeChannel

```typescript
import AbstractChannelProtocol from '@x-oasis/async-call-rpc';

export class ContextBridgeChannel extends AbstractChannelProtocol {
  private bridge = (window as any).__rpc_bridge__;
  private listeners = new Set<(data: unknown) => void>();

  on(listener: (data: unknown) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  send(data: unknown): void {
    this.bridge._send(data);
  }

  activate(): void {
    this.bridge._onMessage((data: unknown) => {
      this.listeners.forEach((cb) => cb(data));
    });
  }

  disconnect(): void {
    this.listeners.clear();
    this.bridge._offMessage();
  }
}
```

## 多 Service 场景

Preload 和 Page 可以在同一个 bridge channel 上注册多个 service / client，互不干扰：

```typescript
// preload.ts
const bridge = createPageBridge({ ipcRenderer, channelName: 'app-rpc' });

const utilityClient = clientHost
  .registerClient('utility-service', { channel: bridge.channel })
  .createProxy();
const mainClient = clientHost
  .registerClient('main-service', { channel: bridge.channel })
  .createProxy();

serviceHost.registerService('renderer-events', {
  channel: bridge.channel,
  handlers: {
    onProgress: (percent: number) => console.log(percent),
    getState: () => ({ connected: true }),
  },
});
```

```typescript
// page.ts
const channel = createPageChannel();

const utility = clientHost
  .registerClient('utility-service', { channel })
  .createProxy();
const main = clientHost
  .registerClient('main-service', { channel })
  .createProxy();

serviceHost.registerService('page-api', {
  channel,
  handlers: {
    getUserInput: () => prompt('Enter value'),
  },
});
```

> `contextBridge._send` 和 `_onMessage` 是双向管道，`serviceHost` 和 `clientHost` 各用各的，框架自动按 `requestPath` 分发。

## 对比

```
之前 preload:  20+ 行 (IPCRendererChannel + RPCMessageChannel + registerOrchestratorHandler
                         + contextBridge + messageHandlers + realChannel.on)
现在 preload:  3 行     createPageBridge + clientHost.registerClient

之前 page:     5 行     new ContextBridgeChannel + activate + clientHost
现在 page:     3 行     createPageChannel + clientHost
```

## 设计优势

1. **零转发成本** — `contextBridge` 只是传输层，不需要为每个 RPC 方法写转发
2. **全能力继承** — request/response、signal、subscription、ping-pong 全部自动可用
3. **Preload 可选参与** — preload 自己也可以 `registerClient` / `registerService`，与 page 共享同一个 channel
4. **Orchestrator 无感** — main 侧的 orchestrator 不知道也不需要知道 renderer 内部是 preload + page 的组合
5. **类型安全** — page 侧 `createProxy<T>()` 和其他端完全一致

## 待验证

- [ ] `contextBridge` 的 structured clone 对 RPC 序列化消息是否有损（如 `ArrayBuffer` / `Transferable`）
- [ ] 大量消息时的性能（contextBridge 走的是同步 postMessage 内部机制）
- [ ] `onDidConnected` / `onDidDisconnected` 事件是否也需要透传给 page
