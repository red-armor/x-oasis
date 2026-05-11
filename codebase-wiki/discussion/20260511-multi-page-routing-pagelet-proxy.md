---
id: D-002
title: 多 Page 到多 Pagelet 的 RPC 路由问题
description: >
  在 Electron 多 page 共享同一 renderer 进程、各 page 分别对应不同 pagelet utility process
  的场景下，分析 renderer 如何将 page 发起的 RPC 请求正确路由到对应 pagelet，
  以及当前 registerOrchestratorHandler 缺少 peer 身份信息的设计缺陷与改进方案。
category: discussion
created: 2026-05-11
updated: 2026-05-11
tags:
  [
    orchestrator,
    routing,
    multi-page,
    pagelet,
    renderer,
    connect,
    ActivationConfig,
  ]
references:
  - id: D-001
    rel: derived-from
    file: ./20260510-orchestrator-decentralized-connect.md
---

# 多 Page 到多 Pagelet 的 RPC 路由问题

> 在 Electron pagelet-proxy 架构中，多个 page 由同一 renderer 渲染，
> 但各自对应不同的 pagelet utility process。当 pageA 发起 RPC 时，
> renderer 需将请求路由到 pageletA 而非 pageletB——当前架构缺少这一路由能力。
> 本文分析问题根因并探讨改进方案。

## 1. 问题描述：多对一对多的路由困境

### 1.1 目标拓扑

```
pageA ─┐                      ┌─ pageletA (utility process)
pageB ─┤── renderer process ──┤── pageletB (utility process)
pageC ─┘    (1 个 BrowserWindow) └─ pageletC (utility process)
```

- **多个 page**（pageA、pageB、pageC）共享同一个 renderer 进程
- 每个 page 分别对应一个**独立的 pagelet utility process**
- pageA 触发的 RPC 必须路由到 pageletA，pageB → pageletB，pageC → pageletC

### 1.2 当前示例的问题

当前 `pagelet-proxy-example` 中只有一个 page 和一个 pagelet，是 **1:1** 模型：

```
page ─── renderer ─── main-pagelet
```

`main-pagelet-worker.ts:29-48` 中的 `registerOrchestratorHandler` 回调存在路由缺陷：

```typescript
let activationRound = 0;
const directChannelOrder: Array<{
  channel: ElectronMessagePortMainChannel;
  name: string;
}> = [
  { channel: rendererDirectChannel, name: 'renderer' },
  { channel: sharedDirectChannel, name: 'shared' },
  { channel: daemonDirectChannel, name: 'daemon' },
];

registerOrchestratorHandler(mainChannel, (port: any) => {
  const target = directChannelOrder.find(
    (entry) => !entry.channel.isConnected()
  );
  if (target) {
    target.channel.bindPort(port, { rebind: true });
  } else {
    rendererDirectChannel.bindPort(port, { rebind: true });
  }
  activationRound++;
});
```

**问题**：

1. **无 peer 身份信息**：`registerOrchestratorHandler` 回调只收到 `(port: any)`，不知道这个 port 连接的是哪个 participant
2. **盲目分配**：`directChannelOrder` 按"第一个未连接的 channel"分配 port，当有多个 pagelet 时无法区分
3. **覆盖风险**：当所有 channel 已连接时，直接 `rebind` renderer channel，可能覆盖 pageA 与 pageletA 的连接为 pageletB 的 port

### 1.3 扩展到多 pagelet 时的错误场景

```
Orchestrator 依次调用：
  connect('main-pagelet-A', 'renderer')
  connect('main-pagelet-B', 'renderer')
  connect('main-pagelet-C', 'renderer')

renderer 收到 3 次 activateConnection(port) 回调：
  第 1 次 → 不知道来自 pagelet-A，盲目绑定到 rendererDirectChannel
  第 2 次 → 同上，rebind 覆盖第 1 次的连接
  第 3 次 → 同上，再次覆盖
```

结果：renderer 只保留了与最后一个 pagelet 的连接，前两个连接丢失。

## 2. 根因分析

### 2.1 `registerOrchestratorHandler` 缺少上下文

`registerOrchestratorHandler` 的回调签名 — `registerOrchestratorHandler.ts:41-52`：

```typescript
export function registerOrchestratorHandler(
  channel: AbstractChannelProtocol,
  onPort: (port: any) => void
): void;
```

回调 `onPort` 只接收 `port`，没有 `ActivationConfig` 中的元信息。

### 2.2 `ActivationConfig` 含有身份信息但未传递

Orchestrator 在 `activateParticipant` 时构造了完整的 `ActivationConfig` — `types.ts:363-372`：

```typescript
export interface ActivationConfig {
  connectionId: string;
  port: any;
  role: 'initiator' | 'receiver';
  peerServices?: Record<string, (...args: any[]) => any>;
  myServices?: Record<string, (...args: any[]) => any>;
}
```

但在 `ElectronConnectionOrchestrator.ts:102-117` 的实际传输中，只发送了 `port`：

```typescript
protected async activateParticipant(
  info: ParticipantInfo,
  config: ActivationConfig
): Promise<void> {
  const { port } = config;
  const deferred = info.channel.makeRequest(
    ORCHESTRATOR_SERVICE_PATH,
    'activateConnection',
    port    // ← 只传了 port，丢弃了 connectionId、role 等
  );
}
```

**`connectionId` 中包含 `fromId` 和 `toId`**（格式为 `_canonicalConnectionId(fromId, toId)` — `BaseConnectionOrchestrator.ts:486-493`），但这一关键路由信息在传递到 participant 侧时丢失了。

### 2.3 问题链

```
Orchestrator 持有完整上下文
  │
  ├─ connect('pagelet-A', 'renderer') → ActivationConfig { connectionId: 'pagelet-A--renderer', role: 'initiator', port }
  ├─ connect('pagelet-B', 'renderer') → ActivationConfig { connectionId: 'pagelet-B--renderer', role: 'initiator', port }
  └─ connect('pagelet-C', 'renderer') → ActivationConfig { connectionId: 'pagelet-C--renderer', role: 'initiator', port }
        │
        ▼ activateParticipant 只传 port
        │
  Renderer registerOrchestratorHandler(port)
        │
        └─ ❌ 不知道 port 来自哪个 pagelet → 无法路由
```

## 3. 改进方案

### 3.1 方案一：扩展 `activateConnection` 传递 `ActivationConfig`（推荐）

**核心思路**：让 `registerOrchestratorHandler` 回调接收完整的 `ActivationConfig` 而非裸 `port`。

#### 3.1.1 修改 `activateParticipant` 传递完整 config

```typescript
// ElectronConnectionOrchestrator.ts
protected async activateParticipant(
  info: ParticipantInfo,
  config: ActivationConfig
): Promise<void> {
  const { port, connectionId, role } = config;

  const deferred = info.channel.makeRequest(
    ORCHESTRATOR_SERVICE_PATH,
    'activateConnection',
    { port, connectionId, role }   // 传递结构化对象，port 仍在 transferList 中
  );

  if (deferred && typeof (deferred as any).promise === 'object') {
    await (deferred as any).promise;
  }
}
```

#### 3.1.2 扩展 `registerOrchestratorHandler` 回调签名

```typescript
export interface ActivationContext {
  port: any;
  connectionId: string;
  role: 'initiator' | 'receiver';
}

export function registerOrchestratorHandler(
  channel: AbstractChannelProtocol,
  onPort: (ctx: ActivationContext) => void
): void;
```

#### 3.1.3 Participant 侧路由实现

```typescript
const pageletChannels = new Map<string, ElectronMessagePortMainChannel>();

registerOrchestratorHandler(mainChannel, (ctx) => {
  const { port, connectionId, role } = ctx;

  // connectionId 格式为 "fromId--toId"，解析出对端
  const [from, to] = connectionId.split('--');
  const peerId = role === 'initiator' ? to : from;

  // 路由到对应 pagelet 的 channel
  let channel = pageletChannels.get(peerId);
  if (!channel) {
    channel = new ElectronMessagePortMainChannel({
      description: `↔${peerId} direct port`,
    });
    pageletChannels.set(peerId, channel);
  }
  channel.bindPort(port, { rebind: true });
});
```

#### 3.1.4 优势

- **最小侵入**：只改 `activateParticipant` 的传参格式和 `registerOrchestratorHandler` 的回调签名
- **向后兼容**：可以保留旧的 `(port: any) => void` 签名作为重载，新签名 `(ctx: ActivationContext) => void` 作为推荐
- **不需要改 orchestrator 核心**：`BaseConnectionOrchestrator.connect()` 逻辑不变

### 3.2 方案二：`connect()` 返回 channel 引用

用户提出的改进意向：

```typescript
const connection = connect('shared');
const channel = connection.getChannel();
```

**核心思路**：让 `connect()` 返回的 `ConnectionInfo` 携带 channel 引用，participant 在发起连接后直接拿到数据面 channel。

#### 3.2.1 扩展 `ConnectionInfo`

```typescript
export interface ConnectionInfo {
  readonly connectionId: string;
  readonly fromId: string;
  readonly toId: string;
  readonly state: ConnectionState;
  // ... 现有字段

  // 新增：获取数据面 channel（仅在 READY 状态可用）
  getChannel?(): AbstractChannelProtocol;
}
```

#### 3.2.2 与去中心化 connect 的结合

在 D-001 提出的 `ParticipantOrchestratorProxy` 模型中，这变得更自然：

```typescript
// pagelet 进程内
const proxy = new ParticipantOrchestratorProxy(
  controlChannel,
  'main-pagelet-A'
);

// 主动连接 renderer
const conn = await proxy.connect('renderer');

// 直接获得数据面 channel，无需手动管理 registerOrchestratorHandler
const channel = conn.getChannel();
const rendererClient = clientHost
  .registerClient('renderer-api', { channel })
  .createProxy();
```

#### 3.2.3 实现难点

1. **channel 生命周期**：`ConnectionInfo` 是只读快照，但 channel 是有状态对象。当连接断开重连时，channel 内部的 port 会被替换——`ConnectionInfo.getChannel()` 返回的是引用还是快照？
2. **跨进程边界**：`ConnectionInfo` 在 orchestrator 进程和 participant 进程间通过 RPC 序列化传递，但 channel 对象不可序列化
3. **框架层代理**：participant 侧的 `ConnectionInfo` 是 RPC 返回值，需要 proxy 机制将 `getChannel()` 映射到本地的 `ElectronMessagePortMainChannel` 实例

**结论**：方案二更适合作为远期目标，与去中心化 connect（D-001 Phase 3）一起实现。短期应先做方案一。

### 3.3 方案三：Renderer 侧的请求标记 + Pagelet 侧的分发

**核心思路**：不在 transport 层解决路由，而是在 RPC 业务层通过 service name 或方法参数标记请求来源。

```typescript
// renderer 侧：每个 page 使用不同的 service name
pageA: pageletClientA = clientHost.registerClient('pagelet-api-A', { channel: channelA })
pageB: pageletClientB = clientHost.registerClient('pagelet-api-B', { channel: channelB })

// pagelet 侧：每个 pagelet 只注册自己关心的 service
pageletA: serviceHost.registerService('pagelet-api-A', { channel: rendererChannel, handlers: { ... } })
```

**优势**：不需要改框架代码，纯应用层路由。

**劣势**：

- 每个 pagelet 都需要与 renderer 建立独立的数据面连接（N 条连接而非 1 条复用）
- Service name 爆炸：M 个 page × N 个 pagelet = M×N 个 service name
- 未解决根本问题：renderer 仍然不知道 `registerOrchestratorHandler` 收到的 port 属于哪个 pagelet

## 4. 多 Page 场景下的连接拓扑

### 4.1 每个 Page 独立 BrowserWindow

```
Main Process (Orchestrator)
  ├── BrowserWindow A → IPCMainChannel A → renderer-A
  ├── BrowserWindow B → IPCMainChannel B → renderer-B
  ├── BrowserWindow C → IPCMainChannel C → renderer-C
  ├── UtilityProcess A → pageletChannel A → pagelet-A
  ├── UtilityProcess B → pageletChannel B → pagelet-B
  └── UtilityProcess C → pageletChannel C → pagelet-C

connect('pagelet-A', 'renderer-A')
connect('pagelet-B', 'renderer-B')
connect('pagelet-C', 'renderer-C')
```

每个 renderer 是独立 participant，1:1 映射清晰。**当前架构已支持**。

### 4.2 多 Page 共享 BrowserWindow（本文讨论场景）

```
Main Process (Orchestrator)
  ├── BrowserWindow → IPCMainChannel → renderer（唯一）
  │     ├── pageA（iframe / 路由 / tab）
  │     ├── pageB
  │     └── pageC
  ├── UtilityProcess A → pageletChannel A → pagelet-A
  ├── UtilityProcess B → pageletChannel B → pagelet-B
  └── UtilityProcess C → pageletChannel C → pagelet-C

connect('pagelet-A', 'renderer')  ← 三条连接都指向同一个 renderer
connect('pagelet-B', 'renderer')
connect('pagelet-C', 'renderer')
```

renderer 作为**单一 participant** 收到三条连接的 port，但无法区分它们。**当前架构不支持**。

### 4.3 方案对比

| 方案                           | 改动范围     | 路由能力       | 与去中心化 connect 兼容 | 实现复杂度 |
| ------------------------------ | ------------ | -------------- | ----------------------- | ---------- |
| 方案一：扩展 ActivationConfig  | 框架层       | 完整           | 兼容                    | 低         |
| 方案二：connect().getChannel() | 框架层 + API | 完整           | 天然结合                | 高         |
| 方案三：业务层 service name    | 应用层       | 部分解决       | 无关                    | 低         |
| 多 BrowserWindow               | 架构层       | 不存在路由问题 | 兼容                    | 中         |

## 5. 方案一的详细设计

### 5.1 `ActivationConfig` 传递变更

**Step 1**：修改 `activateParticipant` 在各平台的实现

Electron（`ElectronConnectionOrchestrator.ts:102-117`）：

```typescript
protected async activateParticipant(
  info: ParticipantInfo,
  config: ActivationConfig
): Promise<void> {
  const { port, connectionId, role } = config;

  const deferred = info.channel.makeRequest(
    ORCHESTRATOR_SERVICE_PATH,
    'activateConnection',
    { port, connectionId, role }
  );

  if (deferred && typeof (deferred as any).promise === 'object') {
    await (deferred as any).promise;
  }
}
```

Node.js 和 Web 平台的实现做同样修改。

**Step 2**：修改 `registerOrchestratorHandler` 回调

```typescript
export interface ActivationContext {
  port: any;
  connectionId: string;
  role: 'initiator' | 'receiver';
}

// 向后兼容的重载
export function registerOrchestratorHandler(
  channel: AbstractChannelProtocol,
  onPort: ((port: any) => void) | ((ctx: ActivationContext) => void)
): void;
```

实现中通过检测回调参数数量或类型决定调用方式。

**Step 3**：在 `registerOrchestratorHandler.ts` 的 handler 中解析传入对象

```typescript
'activateConnection': (arg: any) => {
  if (arg && typeof arg === 'object' && 'port' in arg) {
    onPort({ port: arg.port, connectionId: arg.connectionId, role: arg.role });
  } else {
    // 旧格式：裸 port
    onPort(arg);
  }
}
```

### 5.2 从 `connectionId` 提取 peer 身份

`connectionId` 由 `_canonicalConnectionId(fromId, toId)` 生成（`BaseConnectionOrchestrator.ts:486-493`），格式为 `${fromId}--${toId}`。

```typescript
function parseConnectionId(connectionId: string): { from: string; to: string } {
  const idx = connectionId.indexOf('--');
  return {
    from: connectionId.substring(0, idx),
    to: connectionId.substring(idx + 2),
  };
}
```

结合 `role`，participant 可推断出 peer：

```typescript
const { from, to } = parseConnectionId(ctx.connectionId);
const peerId = ctx.role === 'initiator' ? to : from;
```

### 5.3 改进后的 pagelet-worker 完整示例

```typescript
import {
  ElectronUtilityProcessChannel,
  ElectronMessagePortMainChannel,
  registerOrchestratorHandler,
} from '@x-oasis/async-call-rpc-electron';
import { clientHost, serviceHost } from '@x-oasis/async-call-rpc';

const mainChannel = new ElectronUtilityProcessChannel({
  parentPort: process.parentPort as any,
  description: 'main-pagelet→main IPC channel',
});

const peerChannels = new Map<string, ElectronMessagePortMainChannel>();

registerOrchestratorHandler(mainChannel, (ctx) => {
  const { port, connectionId, role } = ctx;
  const idx = connectionId.indexOf('--');
  const from = connectionId.substring(0, idx);
  const to = connectionId.substring(idx + 2);
  const peerId = role === 'initiator' ? to : from;

  let channel = peerChannels.get(peerId);
  if (!channel) {
    channel = new ElectronMessagePortMainChannel({
      description: `↔${peerId} direct port`,
    });
    peerChannels.set(peerId, channel);
  }
  channel.bindPort(port, { rebind: true });
});

// 向特定 peer 注册 RPC service
function getServiceChannel(peerId: string): ElectronMessagePortMainChannel {
  return peerChannels.get(peerId)!;
}

// 例：向 renderer 注册 pagelet API
serviceHost.registerService('pagelet-api', {
  channel: getServiceChannel('renderer'),
  serviceHost,
  handlers: {
    info(): string {
      return `pagelet ready (pid=${process.pid})`;
    },
  },
});
```

## 6. 与去中心化 connect 的关系

本文讨论的路由问题与 D-001 的去中心化 connect 是**互补关系**：

| 维度     | D-001（去中心化 connect）                      | D-002（多 page 路由）       |
| -------- | ---------------------------------------------- | --------------------------- |
| 核心问题 | 谁来决定连谁                                   | 收到 port 后怎么分发        |
| 改动层面 | connect 决策权下放                             | activateConnection 信息补全 |
| 依赖关系 | 不依赖 D-002                                   | 不依赖 D-001                |
| 合并效果 | participant 自主 connect + 自主路由 = 完全自治 |                             |

两者可独立实现、独立交付。合并后效果：

```
// 去中心化 + 路由感知的 pagelet
const proxy = new ParticipantOrchestratorProxy(controlChannel, 'pagelet-A');

// 1. 自主决定连接 renderer
const conn = await proxy.connect('renderer');

// 2. 通过 ActivationContext 自动知道连接来自谁
//    （方案一）registerOrchestratorHandler 回调中已有 peerId
//    （方案二）conn.getChannel() 直接拿到 channel

// 3. 在 channel 上注册/使用 RPC service
```

## 7. 多 Page 在 Renderer 内的隔离方案

即使 `registerOrchestratorHandler` 传递了 `ActivationContext`，renderer 进程内仍需将不同 page 的 RPC 请求路由到正确的 channel。这有几种应用层方案：

### 7.1 每个 Page 使用独立 iframe + 独立 MessagePort

```typescript
// main process
for (const [pageName, pageletId] of [
  ['pageA', 'pagelet-A'],
  ['pageB', 'pagelet-B'],
]) {
  const win = new BrowserWindow({ ... });
  const ipcChannel = new IPCMainChannel({ webContents: win.webContents, ... });
  orchestrator.registerParticipant(pageName, ipcChannel, 'renderer');
  orchestrator.connect(pageletId, pageName);
}
```

每个 page 是独立 participant，路由自然解决。**代价是多 BrowserWindow**。

### 7.2 单 BrowserWindow 内用路由标记

```typescript
// renderer 侧：根据 page 标识选择 channel
const pageChannels = new Map<string, AbstractChannelProtocol>();

// pageA 的代码
const pageletClientA = clientHost
  .registerClient('pagelet-api', { channel: pageChannels.get('pagelet-A')! })
  .createProxy();

// pageB 的代码
const pageletClientB = clientHost
  .registerClient('pagelet-api', { channel: pageChannels.get('pagelet-B')! })
  .createProxy();
```

这要求 renderer 知道 page→pagelet 的映射关系，且页面代码需要感知路由逻辑。

### 7.3 Router Proxy 模式

在 renderer 进程内引入一个 RPC router，所有 page 统一调用 router，router 根据请求来源分发：

```typescript
// renderer 侧 RPC router
serviceHost.registerService('pagelet-router', {
  channel: rendererControlChannel,
  handlers: {
    async callPagelet(pageId: string, method: string, ...args: any[]) {
      const channel = pageChannels.get(pageId);
      if (!channel) throw new Error(`Unknown page: ${pageId}`);
      // 通过 channel 转发 RPC 到对应 pagelet
      return clientHost
        .registerClient('forward', { channel })
        .createProxy()
        [method](...args);
    },
  },
});
```

## 8. 结论

**短期推荐**：方案一（扩展 `ActivationConfig`），改动小、向后兼容、解决根本问题。

**远期目标**：方案二（`connect().getChannel()`）与去中心化 connect 结合，提供更优雅的 API。

**关键改动清单**：

1. `activateParticipant` 传递 `{ port, connectionId, role }` 而非裸 `port`
2. `registerOrchestratorHandler` 回调签名扩展为 `(ctx: ActivationContext) => void`
3. Participant 侧根据 `connectionId` + `role` 推断 `peerId`，路由 port 到对应 channel

## 参考

- `registerOrchestratorHandler.ts:41-52` — 当前回调签名，只传 `port`
- `ElectronConnectionOrchestrator.ts:102-117` — `activateParticipant` 实现，丢弃了 `ActivationConfig` 中的元信息
- `BaseConnectionOrchestrator.ts:486-493` — `_canonicalConnectionId` 生成 `fromId--toId` 格式的 connectionId
- `types.ts:363-372` — `ActivationConfig` 定义，已包含 `connectionId` 和 `role`
- [D-001 Orchestrator connect 去中心化设计讨论](./20260510-orchestrator-decentralized-connect.md)
