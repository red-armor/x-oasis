---
id: D-001
title: Orchestrator connect 去中心化设计讨论
description: >
  探讨将 Connection Orchestrator 的 connect 能力从 main process 中心化调度
  下放到 participant 本地发起的可行性，对比两种架构的优劣与演进路径。
category: discussion
created: 2026-05-10
updated: 2026-05-15
tags: [orchestrator, connect, decentralized, architecture, pagelet]
references:
  - id: I-001
    rel: related-to
    file: ../issue/20260510-async-call-rpc-electron-heartbeat-ping-bug.md
  - id: D-002
    rel: derives
    file: ./20260511-multi-page-routing-pagelet-proxy.md
  - id: P-001
    rel: derives
    file: ../roadmap/20260515-orchestrator-sub-path-exports-plan.md
---

# Orchestrator connect 去中心化设计讨论

> 讨论将 `connect()` 调用从 main process 中心化发起改为 participant 本地发起的架构演进，
> 使 pagelet 能自主决定连接对象，orchestrator 退化为观察者角色。

## 1. 现状：中心化 connect 模型

当前 `BaseConnectionOrchestrator` 的 `connect()` 方法只能由**持有 orchestrator 实例的进程**（Electron 中即 main process）调用：

```typescript
// main process 中
const info = await orchestrator.connect('main-pagelet', 'renderer');
```

调用链路：

1. `connect(fromId, toId)` 验证两个 participant 均已注册 — `BaseConnectionOrchestrator.ts:445-454`
2. `_doConnect()` 创建 `PortPair` — `BaseConnectionOrchestrator.ts:646`
3. 并行调用 `activateParticipant()` 通过 RPC 将 port 分发给双方 — `BaseConnectionOrchestrator.ts:680-687`
4. 双方 ack 后状态转 `READY`

**关键约束**：

- `createPortPair()` 是 platform-specific 方法，只有 orchestrator 实例能创建端口对
- `activateParticipant()` 通过控制面 channel 的 `makeRequest` 推送 port — `ElectronConnectionOrchestrator.ts:108-112`
- participant 是**被动接收者**：只能通过 `registerOrchestratorHandler` 注册回调来接收 port
- 不存在 participant 发现机制：participant 无法知道还有谁在线

### 1.1 中心化模型的数据流

```
┌──────────────────────────────────────────────────────┐
│                   Main Process                       │
│                                                      │
│  orchestrator.connect('pagelet-A', 'pagelet-B')      │
│         │                                            │
│         ├─ createPortPair() → { port1, port2 }       │
│         │                                            │
│         ├─ activateParticipant(A, port1)  ──────┐    │
│         │                                       │    │
│         └─ activateParticipant(B, port2)  ──┐   │    │
│                                             │   │    │
└─────────────────────────────────────────────│───│────┘
                                              │   │
       ┌──────────────────┐    ┌──────────────▼───▼─────┐
       │  Pagelet A       │    │  Pagelet B             │
       │  (被动接收 port1) │◄──►│  (被动接收 port2)      │
       └──────────────────┘    └────────────────────────┘
```

### 1.2 中心化模型的问题

1. **耦合度高**：每个 pagelet 的连接需求都要泄露到 main process
2. **main process 成为瓶颈**：所有连接决策集中在一处，随 pagelet 数量增长复杂度膨胀
3. **本地性丧失**：pagelet 最清楚自己需要连接谁，但无法自主决策
4. **编排代码膨胀**：main process 中堆积大量连接编排逻辑

## 2. 提议：去中心化 connect 模型

### 2.1 核心思路

将 `connect` 能力下放到 participant 进程中，使 pagelet 可以：

1. 拿到 orchestrator 实例（或其代理）
2. 查询当前在线的 participant 列表
3. 在**自己的进程内**决定连接谁
4. 主动发起 `connect()`

Orchestrator 角色从「连接调度者」变为「连接观察者 + 端口分配器」。

### 2.2 去中心化模型的数据流

```
┌──────────────────────────────────────────────────────┐
│                   Main Process                       │
│                                                      │
│  Orchestrator (观察者 + 端口分配器)                    │
│    - registerParticipant()  注册参与者                │
│    - createPortPair()      创建端口对                 │
│    - 监听 connect/disconnect 事件                    │
│                                                      │
└───────────┬──────────────────────┬───────────────────┘
            │                      │
     控制面 channel        控制面 channel
            │                      │
  ┌─────────▼──────────┐  ┌───────▼──────────────────┐
  │  Pagelet A         │  │  Pagelet B               │
  │                    │  │                          │
  │  participants =    │  │  participants =           │
  │    orchestrator    │  │    orchestrator           │
  │      .listParts()  │  │      .listParts()         │
  │                    │  │                          │
  │  // A 自己决定     │  │                          │
  │  // 要连接谁       │  │                          │
  │  orchestrator      │  │                          │
  │    .connect(       │  │                          │
  │      'A', 'B'     │  │                          │
  │    )               │  │                          │
  │       │            │  │                          │
  │       └──► port1 ◄─┼──┼──► port2                │
  │                    │  │                          │
  └────────────────────┘  └──────────────────────────┘
```

### 2.3 API 变更草案

#### participant 侧新增 API

```typescript
// participant 进程内可用的 orchestrator 代理
interface ParticipantOrchestratorProxy {
  // 查询
  listParticipants(): Promise<Array<{ id: string; type: ParticipantType }>>;
  getConnectionInfo(
    fromId: string,
    toId: string
  ): Promise<ConnectionInfo | null>;
  listConnections(): Promise<ConnectionInfo[]>;

  // 连接（participant 自主发起）
  connect(
    toId: string,
    config?: ConnectionConfig,
    options?: ConnectOptions
  ): Promise<ConnectionInfo>;
  disconnect(connectionId: string): Promise<void>;

  // 事件
  onParticipantJoined: Event<ParticipantInfo>;
  onParticipantLeft: Event<{ id: string; reason: string }>;
  onConnectionReady: Event<ConnectionInfo>;
  onConnectionLost: Event<{ connectionId: string; error?: Error }>;
}
```

#### orchestrator 侧新增职责

```typescript
// orchestrator 新增的服务方法（通过 RPC 暴露给 participant）
interface OrchestratorControlPlane {
  // 原有
  activateConnection: (port: MessagePort) => void;
  ping: () => void;

  // 新增：participant 发现
  listParticipants: () => Array<{ id: string; type: ParticipantType }>;
  listConnections: () => ConnectionInfo[];

  // 新增：participant 发起连接请求
  requestConnect: (
    fromId: string,
    toId: string,
    config?: ConnectionConfig,
    options?: ConnectOptions
  ) => Promise<ConnectionInfo>;
  requestDisconnect: (connectionId: string) => Promise<void>;

  // 新增：事件订阅
  subscribeEvents: (
    callback: (event: OrchestratorEvent) => void
  ) => IDisposable;
}
```

## 3. 两种模型的架构意义

### 3.1 中心化模型的意义

中心化模型的本质是**控制面与数据面合一**——同一个进程既掌握全局拓扑，又执行端口分配。这带来三个核心优势：

**1. 全局视角下的最优调度**

Orchestrator 持有完整的 participant 注册表和连接拓扑，可以做出全局最优决策：

- 避免重复连接（幂等检查 `BaseConnectionOrchestrator.ts:486-493`）
- 统一管控连接上限、资源配额
- 实施全局策略（如"同一时间只允许 N 条连接"）

这类似于 Kubernetes 的中心化调度器：各节点不需要知道彼此的存在，调度器统一分配。

**2. 极简的一致性保证**

所有连接状态存储在单进程内存中，不存在跨进程状态同步问题：

- 不需要分布式锁
- 不需要处理请求竞态
- 状态机转换是原子的

**3. 安全边界天然收束**

在 Electron 中，main process 是可信边界。所有连接请求从这里发出意味着：

- 不存在未授权连接的风险
- participant 无法绕过策略私自建连
- 审计只需关注一个入口

### 3.2 去中心化模型的意义

去中心化模型的本质是**决策权下沉**——连接需求从消费侧发起，端口分配仍由 orchestrator 代理执行。这带来三方面价值：

**1. 连接逻辑的本地性（Locality）**

Pagelet 最清楚自己需要什么：

```typescript
// 去中心化：连接逻辑内聚在 pagelet 内部
class PageletA {
  async start() {
    const participants = await this.orchestrator.listParticipants();
    const target = participants.find(
      (p) => p.type === 'renderer' && p.id.includes('main')
    );
    if (target) {
      await this.orchestrator.connect(target.id);
    }
  }
}

// 对比中心化：连接逻辑散落在 main process
// main process 需要了解每个 pagelet 的连接需求
orchestrator.connect('pagelet-A', 'main-renderer');
orchestrator.connect('pagelet-A', 'utility-process');
orchestrator.connect('pagelet-B', 'pagelet-A');
// ... 随 pagelet 增多线性膨胀
```

当 pagelet 数量增长时，中心化方案的 main process 编排代码呈 **O(N²)** 膨胀（每对可能的连接都需要显式编排），而去中心化方案每个 pagelet 只关心自己的连接，代码复杂度为 **O(N)**。

**2. 动态拓扑的自适应**

去中心化后，pagelet 可以基于实时状态做出连接决策：

```typescript
// pagelet 监听拓扑变化，动态调整连接
proxy.onParticipantJoined((info) => {
  if (this.shouldConnectTo(info)) {
    this.orchestrator.connect(info.id);
  }
});

proxy.onParticipantLeft((info) => {
  this.cleanupConnectionsTo(info.id);
});
```

在中心化模型中，这类动态逻辑要么无法实现，要么需要复杂的 IPC 回传机制让 main process 了解 pagelet 的连接意图。

**3. 连接意图的表达能力**

去中心化允许 participant 表达丰富的连接语义：

- **条件连接**：只在特定条件下才连接（如负载低于阈值）
- **级联连接**：A 连上 B 后，发现 B 还关联了 C，再决定是否连接 C
- **策略性断连**：participant 自己决定何时断开（而非等待 main process 指令）

## 4. 适用场景分析

### 4.1 中心化模型适用场景

| 场景                             | 原因                                                          |
| -------------------------------- | ------------------------------------------------------------- |
| **participant 数量少、拓扑固定** | 如只有 main + renderer + 1 个 utility，连接关系在启动时即确定 |
| **强安全合规要求**               | 所有连接必须经过审批，participant 不可信                      |
| **需要全局资源管控**             | 连接数有上限、带宽需配额、优先级需调度                        |
| **连接关系可预枚举**             | 启动时就能确定所有连接对，不需要动态发现                      |
| **快速原型 / MVP**               | 中心化实现简单，出错面小，适合早期验证                        |

典型例子：一个 Electron 桌面应用只有 main process + 2-3 个 renderer/utility process，连接关系在代码中写死即可。

### 4.2 去中心化模型适用场景

| 场景                               | 原因                                                  |
| ---------------------------------- | ----------------------------------------------------- |
| **participant 数量多、动态上下线** | pagelet 按需加载，运行时才能知道谁在线                |
| **连接关系由业务逻辑决定**         | 不同 pagelet 有不同的连接偏好，无法提前枚举           |
| **插件/扩展架构**                  | 第三方 pagelet 自带连接逻辑，main process 不应硬编码  |
| **跨模块自治**                     | 团队各自维护自己的 pagelet，不希望连接逻辑耦合到 main |
| **连接拓扑需要运行时演化**         | 根据用户操作、数据流变化动态建立/断开连接             |

典型例子：一个微前端架构的 Electron 应用，多个业务团队各自开发 pagelet，每个 pagelet 在运行时决定需要连接哪些其他 pagelet 的服务。

### 4.3 混合模型：过渡期的务实选择

两种模型并非互斥。推荐的混合策略：

```
┌─────────────────────────────────────────────────────────┐
│                    Main Process                          │
│                                                          │
│  Orchestrator                                            │
│    ├─ registerParticipant()                              │
│    ├─ connect()            ← 仍可直接调用（静态连接）     │
│    ├─ requestConnect()     ← participant RPC 请求（动态） │
│    └─ 连接策略/权限校验                                  │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

- **静态连接**（启动时确定）：继续用 `orchestrator.connect()` 中心化调度
- **动态连接**（运行时决定）：通过 `requestConnect` RPC 下放给 participant
- **权限层**：`requestConnect` 内部可插入策略引擎，决定是否放行

这允许在同一套架构中逐步迁移，避免大爆炸式重构。

## 5. 两种模型技术对比

| 维度                  | 中心化（现状）        | 去中心化（提议）                                  |
| --------------------- | --------------------- | ------------------------------------------------- |
| **连接发起方**        | main process          | participant 自主                                  |
| **participant 角色**  | 被动接收 port         | 主动选择连接对象                                  |
| **main process 职责** | 调度所有连接          | 端口分配 + 事件观察                               |
| **代码本地性**        | 连接逻辑集中在 main   | 连接逻辑靠近使用方                                |
| **participant 发现**  | 无                    | 需新增查询/订阅机制                               |
| **端口对创建**        | orchestrator 直接调用 | 需通过 RPC 请求 orchestrator 创建                 |
| **状态一致性**        | 单进程内存，简单      | 跨进程，需协议保证                                |
| **连接冲突**          | 不存在                | 同上，`_canonicalConnectionId` 幂等天然消解       |
| **安全边界**          | main process 天然可信 | 同上，guard 在 orchestrator 侧统一拦截（见 §6.3） |
| **编排复杂度**        | O(N²) 连接对枚举      | O(N) 每个 participant 自治                        |
| **动态适应性**        | 弱，需改 main 代码    | 强，participant 自行响应变化                      |
| **调试可观测性**      | orchestrator 单点可见 | 同上，连接状态仍在 orchestrator 统一管理          |

## 6. 关键设计挑战

### 6.1 端口对创建的归属

`createPortPair()` 在 Electron 中通过 `MessageChannelMain` 创建，**只能在 main process 调用**。去中心化后，participant 发起 `connect` 的实际流程变为：

```
participant                main (orchestrator)              peer participant
    │                           │                                │
    │ requestConnect(from,to)   │                                │
    │──────────────────────────►│                                │
    │                           │ createPortPair()               │
    │                           │ { port1, port2 }               │
    │                           │                                │
    │                           │ activateParticipant(from, p1)  │
    │◄──────────────────────────│                                │
    │                           │                                │
    │                           │ activateParticipant(to, p2)   │
    │                           │───────────────────────────────►│
    │                           │                                │
    │◄──── ConnectionInfo ──────│                                │
```

本质上是将 **connect 的决策权**下放，但 **端口分配执行权** 仍在 main process。

### 6.2 连接冲突：不存在

去中心化后，pagelet-A 和 pagelet-B 可能同时向 orchestrator 请求连接对方。但当前 `connect()` 已通过 `_canonicalConnectionId(fromId, toId)` 生成唯一连接 ID — `BaseConnectionOrchestrator.ts:486-493`，并在进入 `_doConnect` 前检查：

```typescript
const existing = this.connections.get(connectionId);
if (
  existing &&
  existing.state !== ConnectionState.CLOSED &&
  existing.state !== ConnectionState.IDLE
) {
  return this._buildConnectionInfo(existing); // 幂等返回
}
```

因此**后到的请求直接拿到已有连接**，无需额外处理。这不是去中心化引入的新问题，中心化模型下如果两处代码同时 `connect` 同一对 participant 也会被幂等消解。

### 6.3 安全与权限：guard 放在 orchestrator 侧

去中心化后 participant 可主动发 `requestConnect`，但这**并未引入新的攻击面**——即使在中心化模型下，participant 也持有控制面 channel，理论上也能伪造 RPC 请求。差异在于：中心化时 `connect` 只被 main process 内部调用（调用方可信），去中心化后 `requestConnect` 的调用方来自外部 participant。

Guard 的最佳位置是 **orchestrator 的 `requestConnect` RPC handler 内部**，在调用 `this.connect()` 之前拦截：

```typescript
// orchestrator 控制面 RPC handler
'requestConnect': (fromId: string, toId: string, config?, options?) => {
  // Guard 1：身份校验——fromId 必须与请求来源 participant 一致
  if (fromId !== callerParticipantId) {
    throw new Error(`Identity mismatch: caller is ${callerParticipantId} but requested fromId is ${fromId}`);
  }

  // Guard 2：连接策略——可插拔的权限检查
  if (!this.connectionPolicy?.allowConnect(fromId, toId)) {
    throw new Error(`Connection policy denied: ${fromId} → ${toId}`);
  }

  return this.connect(fromId, toId, config, options);
}
```

关键设计点：

- **Guard 1（身份校验）**：participant 只能以自己的名义发起连接，不能冒充他人。RPC channel 本身绑定了 participant identity，所以在 handler 中可以拿到 `callerParticipantId` 做比对
- **Guard 2（连接策略）**：可选的 `connectionPolicy` 接口，支持白名单、类型限制等。不配置时默认放行，保持向后兼容
- **审计日志**：在 guard 之后、`connect()` 之前记录，无论放行还是拒绝都能追踪

这种设计与中心化模型的安全边界等价——orchestrator 始终是连接的执行者，所有请求都经过它。

### 6.4 控制面 channel 的生命周期

当前 participant 的 `channel` 在 `registerParticipant` 时传入 — `BaseConnectionOrchestrator.ts:223-228`。去中心化后，participant 的控制面 channel 需要持续可用以支持：

- 查询 participant 列表
- 发起连接请求
- 接收事件通知

这要求控制面 channel 的稳定性高于数据面，`replaceParticipantChannel` 机制 — `BaseConnectionOrchestrator.ts:319-393` 仍是必要保障。

## 7. 推荐演进路径

### Phase 1：添加 participant 发现（最小变更）

```typescript
// orchestrator 新增控制面 RPC 方法
'listParticipants': () => orchestrator.listParticipants();
'listConnections': () => orchestrator.listConnections();
```

通过 `ProxyRPCClient` 暴露给 participant，让 pagelet 能感知拓扑但连接仍由 main 发起。

### Phase 2：添加 `requestConnect` RPC 方法

```typescript
// orchestrator 控制面新增
'requestConnect': (fromId: string, toId: string, config?, options?) => {
  return orchestrator.connect(fromId, toId, config, options);
};
```

participant 通过 RPC 间接调用 `connect()`，决策权已下放，但执行路径不变。

### Phase 3：封装 `ParticipantOrchestratorProxy`

Phase 2 中 participant 通过裸 RPC 调用 `requestConnect`，但存在以下问题：

- 调用方需要知道 RPC service 名称和方法签名
- `fromId` 需要每次手动传入，容易出错
- 事件订阅需要各自手工对接
- 没有类型安全的返回值

`ParticipantOrchestratorProxy` 将这些细节封装为 participant 进程内的类型安全对象。

#### Proxy 内部结构

```typescript
class ParticipantOrchestratorProxy {
  private selfId: string;
  private rpcClient: ProxyRPCClient; // 指向 orchestrator 控制面 RPC service

  constructor(controlChannel: AbstractChannelProtocol, selfId: string) {
    this.selfId = selfId;
    // 连接到 orchestrator 暴露的 RPC service
    this.rpcClient = clientHost
      .registerClient('orchestrator-proxy', { channel: controlChannel })
      .createProxy();
  }

  // ─── 查询 ───────────────────────────────────────

  async listParticipants(): Promise<
    Array<{ id: string; type: ParticipantType }>
  > {
    return this.rpcClient.listParticipants();
  }

  async listConnections(): Promise<ConnectionInfo[]> {
    return this.rpcClient.listConnections();
  }

  async getConnectionInfo(toId: string): Promise<ConnectionInfo | null> {
    return this.rpcClient.getConnectionInfo(this.selfId, toId);
  }

  // ─── 连接 ───────────────────────────────────────

  async connect(
    toId: string,
    config?: ConnectionConfig,
    options?: ConnectOptions
  ): Promise<ConnectionInfo> {
    // fromId 自动填充为 selfId，participant 无法冒充他人
    return this.rpcClient.requestConnect(this.selfId, toId, config, options);
  }

  async disconnect(connectionId: string): Promise<void> {
    return this.rpcClient.requestDisconnect(connectionId);
  }

  // ─── 事件 ───────────────────────────────────────

  onParticipantJoined(handler: (info: ParticipantInfo) => void): IDisposable {
    return this.rpcClient.subscribeParticipantJoined(handler);
  }

  onParticipantLeft(
    handler: (info: { id: string; reason: string }) => void
  ): IDisposable {
    return this.rpcClient.subscribeParticipantLeft(handler);
  }

  onConnectionReady(handler: (info: ConnectionInfo) => void): IDisposable {
    return this.rpcClient.subscribeConnectionReady(handler);
  }

  onConnectionLost(
    handler: (info: { connectionId: string; error?: Error }) => void
  ): IDisposable {
    return this.rpcClient.subscribeConnectionLost(handler);
  }
}
```

#### 使用示例：pagelet 自治连接

```typescript
// main-pagelet-worker.ts（utility process 内）
const controlChannel = new ElectronUtilityProcessMainChannel({
  description: 'pagelet → main 控制面',
});

// 注册接收 port 的 handler（现有机制，不变）
registerOrchestratorHandler(controlChannel, (port) => {
  directChannel.bindPort(port);
});

// 新增：创建 proxy，获得自治能力
const proxy = new ParticipantOrchestratorProxy(controlChannel, 'main-pagelet');

// 场景 1：启动时主动连接已知 participant
async function onBoot() {
  const participants = await proxy.listParticipants();
  const renderer = participants.find((p) => p.type === 'renderer');
  if (renderer) {
    const conn = await proxy.connect(renderer.id);
    console.log(`已连接 renderer，状态: ${conn.state}`);
  }
}

// 场景 2：动态响应拓扑变化
proxy.onParticipantJoined((info) => {
  if (info.type === 'utility' && info.id.startsWith('data-')) {
    proxy.connect(info.id); // 新的 data pagelet 上线，自动连接
  }
});

proxy.onParticipantLeft((info) => {
  console.warn(`${info.id} 离线: ${info.reason}`);
  // 业务侧清理该 participant 相关的缓存/重试逻辑
});

// 场景 3：条件连接
proxy.onConnectionReady((info) => {
  if (info.toId === 'heavy-compute-pagelet') {
    // 连接就绪后，再决定是否连接其依赖的其他 pagelet
    proxy.connect('result-aggregator');
  }
});
```

#### 对比：去中心化前后 pagelet 的代码

```
Before（中心化）:
  pagelet-worker.ts    → registerOrchestratorHandler + 被动等待
  main.ts              → orchestrator.registerParticipant(...)
                       → orchestrator.connect('main-pagelet', 'renderer')
                       → orchestrator.connect('main-pagelet', 'daemon')
                       → ... 每个 pagelet 的连接都在此维护

After（去中心化）:
  pagelet-worker.ts    → registerOrchestratorHandler（不变）
                       + ParticipantOrchestratorProxy（新增）
                       + 自主连接逻辑
  main.ts              → orchestrator.registerParticipant(...)（不变）
                       → 不再需要 orchestrator.connect(...)
                       → main 只负责注册，不关心谁连谁
```

### registerParticipant 能否在 participant 进程中调用？

**当前：只能在 main process 调用。** 原因不是 `registerParticipant` 本身需要 main-only API（它只需要一个 `AbstractChannelProtocol`），而是**控制面 channel 的创建依赖 main process 权限**：

```
registerParticipant(id, channel, type)
                    └── 这个 channel 从哪来？

  Electron 中：
  - IPCMainChannel       → 需要 webContents（main 持有 BrowserWindow）
  - ElectronUtilityProcessChannel → 需要 UtilityProcess 实例（main fork 出来的）
  - IPCRendererChannel   → 只能连回 main，不能连到其他 renderer
```

participant 进程无法创建指向 orchestrator 的 channel，因为 channel 的底层传输（IPC、utility process port）需要**进程句柄**，而进程句柄由 main process 持有。这就是鸡生蛋问题：

1. participant 想自己注册 → 需要一个到 orchestrator 的 channel
2. 创建 channel → 需要 main process 的进程句柄
3. 只有 main process 能创建 channel → 只能由 main process 注册

**要实现 participant 自注册，需要引入 bootstrap 机制**：

```
方案：main process 在 fork participant 后，将控制面 channel 作为启动参数传递

// main process
const proc = utilityProcess.fork(workerScript);
const channel = new ElectronUtilityProcessChannel({ process: proc });
orchestrator.registerParticipant('pagelet-A', channel, 'utility');

// 问题：这是 main 在注册，不是 pagelet 自己注册
```

所以**短期内 `registerParticipant` 仍须在 main process 执行**。去中心化的范围是 `connect` 的决策权，不包括 `registerParticipant` 的执行权。这两者的分界线很清晰：

| 操作                  | 权限归属             | 原因                                    |
| --------------------- | -------------------- | --------------------------------------- |
| `registerParticipant` | main process         | 需要进程句柄创建 channel                |
| `connect`             | 可下放到 participant | 只需要决策"连谁"，执行仍经 orchestrator |
| `disconnect`          | 可下放到 participant | 同上                                    |
| `listParticipants`    | 可下放到 participant | 只读查询                                |

如果未来需要 participant 自注册，可以设计一个 `selfRegister` RPC 方法，让 participant 通过初始 bootstrap channel 向 orchestrator 发送注册请求，orchestrator 在 main process 侧为其创建 channel 并注册。但这属于更远期的架构变更，当前不在讨论范围内。

## 8. 去中心化在 Node.js 平台的适配分析

`@x-oasis/async-call-rpc-node` 提供了 `NodeConnectionOrchestrator`，底层使用 `worker_threads.MessageChannel` 创建端口对 — `NodeConnectionOrchestrator.ts:62-64`。Node.js 平台有两种通信模式：**worker_threads**（线程间）和 **child_process.fork**（进程间），去中心化的适配程度不同。

### 8.1 场景一：Worker Thread ↔ Worker Thread

```
Main Thread (orchestrator)
  ├── new Worker('./worker-a.js')
  ├── new Worker('./worker-b.js')
  ├── registerParticipant('worker-a', channelA, 'worker')
  ├── registerParticipant('worker-b', channelB, 'worker')
  └── connect('worker-a', 'worker-b')
        → new MessageChannel()  (worker_threads)
        → transfer port1 → worker-a
        → transfer port2 → worker-b
        → worker-a ↔ worker-b 直连
```

**去中心化适配：与 Electron 高度相似**

- `createPortPair()` 使用 `new MessageChannel()` — `NodeConnectionOrchestrator.ts:62-64`
- `MessageChannel` **只能在主线程创建**（`worker_threads` 限制），worker 内部无法创建
- 控制面 channel：主线程侧用 `new NodeMessagePortChannel({ bindPort: worker })` — `NodeMessagePortChannel.ts:64-75`，worker 内侧用 `new NodeMessagePortChannel({ bindPort: parentPort })` — `docs/orchestrator.md:90-93`

这与 Electron 的约束完全一致：

| 对比项              | Electron                                              | Node.js worker_threads                                                             |
| ------------------- | ----------------------------------------------------- | ---------------------------------------------------------------------------------- |
| 端口对创建 API      | `MessageChannelMain`                                  | `worker_threads.MessageChannel`                                                    |
| 创建位置限制        | main process only                                     | 主线程 only                                                                        |
| 控制面 channel 创建 | main 持有 process 句柄                                | 主线程持有 Worker 实例                                                             |
| worker 内侧 channel | `WorkerChannel(self)` / `registerOrchestratorHandler` | `NodeMessagePortChannel({ bindPort: parentPort })` / `registerOrchestratorHandler` |

**结论**：`requestConnect` RPC + `ParticipantOrchestratorProxy` 方案可直接复用，无需额外适配。

### 8.2 场景二：Child Process ↔ Child Process（fork）

```
Parent Process (orchestrator?)
  ├── fork('./worker-a.js')
  ├── fork('./worker-b.js')
  └── connect('worker-a', 'worker-b')  ← 能做到吗？
```

**去中心化适配：存在根本性障碍**

`child_process.fork()` 创建的子进程通过 IPC（`process.send` / `process.on('message')`）通信，封装为 `NodeProcessChannel` — `NodeProcessChannel.ts:57-114`。核心问题：

**IPC channel 不支持 `MessagePort` transfer**

`worker_threads.MessageChannel` 产生的 `MessagePort` 对象只能在 `worker_threads` 之间通过 `postMessage(..., [transferList])` 传递。`child_process` 的 IPC 底层是管道（pipe），使用 structured clone 序列化，**不能 transfer `MessagePort`**。

这意味着：

```
// 不可行
const { port1, port2 } = new MessageChannel();
childA.send({ type: 'port' }, [port1]);  // ❌ IPC 不支持 transfer MessagePort
```

因此，fork 模式下**不存在「通过 orchestrator 分配直连端口」的机制**。子进程之间的通信只能走：

1. **父进程中继**：A → parent → B（当前 `NodeProcessChannel` 的模式）
2. **自行建立 socket**：子进程间通过 TCP/UDP socket 直连（绕过 orchestrator，独立设计）

当前 fork example（`examples/fork-example/`）也验证了这一点——它只在父-子之间跑 RPC，**没有使用 orchestrator**，没有 worker 间直连。

**结论**：fork 场景不适用于 orchestrator 的端口分配模型，也就不适用于去中心化 connect。子进程间如果要直连，需要走 TCP socket 或共享内存等独立方案。

### 8.3 场景三：Worker Thread ↔ 主线程

```
Main Thread (orchestrator)
  ├── registerParticipant('main', mainParticipantChannel, 'process')
  ├── registerParticipant('worker', workerChannel, 'worker')
  └── connect('main', 'worker')
```

**去中心化适配：部分适用**

主线程作为 participant 注册时，使用一个虚拟 channel adapter — `docs/orchestrator.md:179-186`：

```typescript
const mainParticipantChannel = {
  makeRequest(_path: string, method: string, port: any) {
    if (method === 'activateConnection') {
      mainDirectChannel.bindPort(port);
    }
    return { promise: Promise.resolve() };
  },
} as any;
```

主线程既是 orchestrator 又是 participant。去中心化时，主线程不需要通过 RPC 调 `requestConnect`——它直接持有 orchestrator 实例。所以这个场景的去中心化意义不大，主线程本来就是中心。

但如果 worker 想主动连接主线程（而非等主线程 `connect` 过来），去中心化就有价值——worker 通过 proxy 调 `connect('main')`，由主线程侧的 `activateParticipant` 把 port bind 到 `mainDirectChannel`。

**结论**：worker → main 的方向适配去中心化；main → worker 的方向无额外收益。

### 8.4 Node.js 三种场景对比总结

| 维度                       | Worker ↔ Worker        | Fork 子进程 ↔ 子进程          | Worker ↔ 主线程        |
| -------------------------- | ---------------------- | ----------------------------- | ---------------------- |
| `createPortPair` 可用性    | 主线程 only            | 不适用（IPC 不支持 transfer） | 主线程 only            |
| `MessagePort` transfer     | 支持（worker_threads） | 不支持（IPC 是 pipe）         | 支持                   |
| `registerParticipant` 位置 | 主线程                 | 父进程                        | 主线程                 |
| participant 自主 `connect` | 适配                   | 不适配                        | worker → main 方向适配 |
| 去中心化方案               | `requestConnect` RPC   | 需要 TCP socket 直连          | `requestConnect` RPC   |

### 8.5 Node.js vs Web vs Electron 全平台对比

| 维度                   | Electron             | Web                                  | Node.js                          |
| ---------------------- | -------------------- | ------------------------------------ | -------------------------------- |
| `createPortPair` API   | `MessageChannelMain` | `new MessageChannel()`               | `worker_threads.MessageChannel`  |
| 创建位置限制           | main process only    | 任意上下文                           | 主线程 only                      |
| 不支持 transfer 的场景 | 无                   | WebSocket                            | `child_process` IPC              |
| 去中心化适配           | 完全适配             | Worker/Iframe 适配，WebSocket 不适配 | worker_threads 适配，fork 不适配 |
| 不适配时的替代方案     | N/A                  | 信令/路由层                          | TCP socket / 共享内存            |

**核心洞察**：去中心化 connect 的适配条件是**平台必须支持 `MessagePort` transfer**。三个平台中不支持的（Electron 无、Web 的 WebSocket、Node.js 的 fork）恰好都是没有内存共享的跨进程/跨网络场景——这并非巧合，`MessagePort` transfer 本质上是内核级的句柄传递，只存在于共享内存的通信模型中。

## 9. 去中心化在 Web 平台的适配分析

`@x-oasis/async-call-rpc-web` 提供了 `WebConnectionOrchestrator`，底层使用浏览器原生 `MessageChannel` API 创建端口对 — `WebConnectionOrchestrator.ts:65-68`。Web 平台有三种典型场景，去中心化的适配程度各不相同。

### 9.1 场景一：Main Page ↔ Worker

```
Main Page (orchestrator)
  ├── registerParticipant('worker-a', workerChannelA)
  ├── registerParticipant('worker-b', workerChannelB)
  └── connect('worker-a', 'worker-b')
```

**去中心化适配：与 Electron 等价**

- `createPortPair()` 使用 `new MessageChannel()` — **不依赖 main-process-only API**，任何 JS 上下文都能调用
- `WorkerChannel` 在 worker 内侧构造为 `new WorkerChannel(self)` — `WorkerChannel.ts:33-44`
- 控制面 channel 的创建权与 Electron 类似：主页面 `new Worker(...)` 持有句柄，worker 内侧通过 `self` 回连

但有一个关键差异：**Web Worker 内部也能创建 `MessageChannel`**。这意味着理论上 worker 可以自己 `new MessageChannel()` 并通过控制面传递 port，而不需要 orchestrator 代为创建。不过当前 `connect` 流程把 `createPortPair` 封装在 orchestrator 内，改动较大，暂不建议走这条路。

**结论**：`requestConnect` RPC + `ParticipantOrchestratorProxy` 的方案与 Electron 完全一致，可直接复用。

### 9.2 场景二：Worker ↔ Iframe

```
Main Page (orchestrator)
  ├── registerParticipant('worker', workerChannel)
  ├── registerParticipant('iframe', iframeChannel)  ← 需要 iframe.contentWindow.postMessage 传 port
  └── connect('worker', 'iframe')
```

**去中心化适配：可用，但 iframe channel 创建有特殊约束**

当前 iframe 的控制面 channel 创建流程（`docs/orchestrator.md:186-207`）：

```typescript
const iframe = document.createElement('iframe');
iframe.onload = () => {
  const iframeChannel = new MessageChannel();
  iframe.contentWindow!.postMessage({ type: 'init-channel' }, '*', [
    iframeChannel.port2,
  ]);
  const rpcChannel = new RPCMessageChannel({ port: iframeChannel.port1 });
  orchestrator.registerParticipant('iframe', rpcChannel, 'renderer');
};
```

这里有一个 Web 特有的约束：**只有持有 `iframe.contentWindow` 引用的上下文才能向 iframe 传递 `MessagePort`**。iframe 自己无法主动向外部创建 channel（`window.parent.postMessage` 可以发消息，但不能 transfer port 出来）。

因此：

| 操作                       | iframe 内部能否做？ | 原因                                                  |
| -------------------------- | ------------------- | ----------------------------------------------------- |
| `registerParticipant`      | 否                  | 需要 `contentWindow` 引用创建 channel，只有父页面持有 |
| `connect`（发起）          | 可                  | 通过已有控制面 channel 调 RPC                         |
| `connect`（被动接收 port） | 可                  | `registerOrchestratorHandler` 已支持                  |
| `listParticipants`         | 可                  | 通过已有控制面 channel 调 RPC                         |

**结论**：去中心化对 iframe 场景适配，但 `registerParticipant` 仍须在父页面执行。iframe 获得代理后可以自主决定连接谁。

### 9.3 场景三：WebSocket（跨终端）

```
Server (Node.js)
  ├── 每个客户端连入时创建 WebSocketChannel
  ├── registerParticipant('client-A', wsChannelA)
  └── ...?

Client (Browser)
  └── const wsChannel = new WebSocketChannel(ws)
```

**去中心化适配：不适用，需要完全不同的架构**

这是三种场景中最特殊的一个。WebSocket 的核心差异：

1. **没有 `MessageChannel`**：WebSocket 是 TCP 流，不是内存内的端口对。`createPortPair()` 返回的两个 `MessagePort` 无法直接在 WebSocket 上 transfer——它们只能通过 `postMessage(..., [transfer])` 在同源的 Worker/Iframe 间传递
2. **不存在中央 orchestrator**：服务端和客户端是对等的两个进程，没有一个「持有多方句柄」的第三方
3. **连接本身就是 channel**：WebSocket 连接既是控制面也是数据面，不存在「通过控制面分配数据面端口」的概念

当前 `WebSocketChannel` 的用法（`examples/websocket-example/server.ts:20-57`）是直接在单个 WebSocket 连接上跑 RPC，没有使用 orchestrator：

```typescript
wss.on('connection', (ws) => {
  const channel = new WebSocketChannel(ws as any, { connected: true });
  serviceHost.registerService('api', { channel, handlers: { ... } });
});
```

如果要在 WebSocket 场景实现「A 通过服务器中转与 B 直接通信」，需要的不是 `requestConnect`，而是：

- **服务端中继**：服务端转发 A 和 B 之间的消息（当前 WebSocket 的默认模式）
- **WebRTC DataChannel**：真正的 P2P 直连，但需要 SDP offer/answer 信令（这才是 Web 的「去中心化 connect」对应物）

**结论**：WebSocket 场景不适用于当前的去中心化设计。如果需要 participant 自主决定通信对象，应设计独立的服务端路由/信令层，而不是套用 orchestrator 的 `requestConnect` 模式。

### 9.4 三种场景对比总结

| 维度                       | Worker 场景          | Iframe 场景                   | WebSocket 场景                    |
| -------------------------- | -------------------- | ----------------------------- | --------------------------------- |
| `createPortPair` 可用性    | 任意上下文           | 任意上下文                    | 不适用（无 MessageChannel）       |
| `registerParticipant` 位置 | 主页面               | 父页面                        | 服务端                            |
| participant 自主 `connect` | 适配                 | 适配                          | 不适配                            |
| 去中心化方案               | `requestConnect` RPC | `requestConnect` RPC          | 需要独立信令/路由设计             |
| 核心障碍                   | 无                   | iframe 无法自建控制面 channel | 无 `MessageChannel` transfer 机制 |

### 9.5 Web 平台的独特机会

Web 平台有一个 Electron 不具备的优势：**`MessageChannel` 可以在任意上下文创建**（`new MessageChannel()` 无平台限制）。这打开了 Electron 中不可能的路径——**participant 间直接交换 port，不经过 orchestrator**：

```
Worker A                          Worker B
   │                                │
   │──── new MessageChannel() ──────│
   │     { port1, port2 }          │
   │                                │
   │  port1.bindPort(port1)         │  port2 通过控制面发给 B
   │                                │◄── 控制面 postMessage(port2)
   │◄─────────── 直接通信 ─────────►│
```

但这需要 participant 之间已有控制面 channel，而当前只有 orchestrator ↔ participant 的控制面。要实现 participant 间直接通信，需要它们先通过 orchestrator 建立一条控制面 channel——这就形成了递归依赖。

**务实的结论**：Web 平台的去中心化仍应走 `requestConnect` RPC 路线，`MessageChannel` 的灵活性暂不利用。这与 Electron 的方案保持一致，降低跨平台的心智负担。

## 10. 结论

去中心化的 `connect` 在逻辑上更顺——谁需要连接谁决定连接。核心改动并非重新实现端口分配，而是**在控制面上新增 RPC 方法**，让 participant 通过代理间接驱动 orchestrator 的 `connect`。

**推荐的实现顺序**：Phase 1 → Phase 2 → Phase 3，每一步向后兼容，可独立交付。

## 参考

- `BaseConnectionOrchestrator.ts:439-536` — `connect()` 实现
- `BaseConnectionOrchestrator.ts:202-254` — `registerParticipant()` 实现
- `BaseConnectionOrchestrator.ts:635-711` — `_doConnect()` 核心流程
- `ElectronConnectionOrchestrator.ts:102-117` — `activateParticipant()` Electron 实现
- [Connection Orchestrator 文档](../../packages/async/async-call-rpc/docs/orchestrator/index.md)
