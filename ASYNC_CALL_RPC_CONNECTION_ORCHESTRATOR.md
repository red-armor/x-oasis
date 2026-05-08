# Async-Call-RPC Connection Orchestrator — 完整课题方案

**文档版本**：1.0  
**创建日期**：2026-05-07  
**状态**：方案设计阶段  
**优先级**：高（Next Major Direction）

---

## 📋 目录

1. [项目定位与包关系](#项目定位与包关系)
2. [问题分析](#问题分析)
3. [本质认知](#本质认知)
4. [解决方案](#解决方案)
5. [架构设计](#架构设计)
6. [成本评估](#成本评估)
7. [实施路线图](#实施路线图)
8. [意义评估](#意义评估)
9. [对标和对比](#对标和对比)

---

## 项目定位与包关系

### 核心结论：Connection Orchestrator 不是独立项目

Connection Orchestrator **不是**一个新的独立包或独立项目。它是现有 async-call-rpc 包层次结构的**自然延伸**，遵循已有的 "基类在 core、平台实现在平台包" 的分层模式。

### 现有包结构与依赖关系

```
@x-oasis/async-call-rpc          (CORE, v0.4.0)
├── AbstractChannelProtocol       ← 所有 Channel 的基类
├── RPCService / RPCServiceHost   ← 服务端点
├── ProxyRPCClient / clientHost   ← 客户端代理
├── Middleware pipeline           ← 中间件管道
└── JSON-RPC 2.0 utilities        ← 协议工具
    ▲           ▲           ▲           ▲
    │           │           │           │
    │           │           │           └── @x-oasis/async-call-rpc-react (v0.3.0)
    │           │           │               └── createRPCReact<T>() — React hooks
    │           │           │
    │           │           └── @x-oasis/async-call-rpc-web (v0.2.0)
    │           │               ├── RPCMessageChannel    (MessagePort)
    │           │               ├── WorkerChannel        (Web Worker)
    │           │               └── WebSocketChannel     (WebSocket)
    │           │
    │           └── @x-oasis/async-call-rpc-node (v0.2.0)
    │               └── NodeProcessChannel (child_process)
    │
    └── @x-oasis/async-call-rpc-electron (v0.2.0)
        ├── IPCMainChannel                (ipcMain)
        ├── IPCRendererChannel            (ipcRenderer)
        ├── ElectronUtilityProcessChannel (utilityProcess)
        └── ElectronMessagePortMainChannel(MessagePortMain)
```

### Channel 的先例：Orchestrator 遵循完全相同的模式

Channel 的组织方式：

```
基类 AbstractChannelProtocol     → 在 @x-oasis/async-call-rpc (core)
实现 IPCMainChannel              → 在 @x-oasis/async-call-rpc-electron
实现 NodeProcessChannel          → 在 @x-oasis/async-call-rpc-node
实现 RPCMessageChannel           → 在 @x-oasis/async-call-rpc-web
```

Orchestrator 完全对称：

```
基类 BaseConnectionOrchestrator  → 在 @x-oasis/async-call-rpc (core)
实现 ElectronConnectionOrchestrator → 在 @x-oasis/async-call-rpc-electron
实现 NodeConnectionOrchestrator     → 在 @x-oasis/async-call-rpc-node
实现 WebConnectionOrchestrator      → 在 @x-oasis/async-call-rpc-web
```

### 为什么不是独立项目

**依赖关系决定了归属**：

```
BaseConnectionOrchestrator 依赖：
├── AbstractChannelProtocol     ← core 中
├── serviceHost / clientHost    ← core 中
└── 无任何平台特定代码
→ 所以它属于 core

ElectronConnectionOrchestrator 依赖：
├── BaseConnectionOrchestrator  ← core 中
├── MessageChannelMain          ← Electron API
├── IPCMainChannel              ← electron 包中
└── ElectronUtilityProcessChannel ← electron 包中
→ 所以它属于 @x-oasis/async-call-rpc-electron

NodeConnectionOrchestrator 依赖：
├── BaseConnectionOrchestrator  ← core 中
├── MessageChannel              ← Node worker_threads API
└── NodeProcessChannel          ← node 包中
→ 所以它属于 @x-oasis/async-call-rpc-node

WebConnectionOrchestrator 依赖：
├── BaseConnectionOrchestrator  ← core 中
├── MessageChannel              ← Web API
└── RPCMessageChannel           ← web 包中
→ 所以它属于 @x-oasis/async-call-rpc-web
```

**如果做成独立项目会带来的问题**：

| 问题 | 说明 |
|------|------|
| **多余的依赖链** | 用户要安装 `async-call-rpc` + `async-call-rpc-electron` + `async-call-rpc-orchestrator`，3 个包 |
| **包爆炸** | 3 个平台 = 3 个新的 orchestrator 包，维护 overhead 翻倍 |
| **违反内聚原则** | Electron Orchestrator 应该和 Electron Channel 在一起——它们服务于同一类用户 |
| **发布协调困难** | 版本号需要跨包同步，增加发布复杂度 |

### 三层架构（在已有包中）

Orchestrator 在现有包中增加了新的一层，形成清晰的三层架构：

```
                        ┌──────────────────────────────────────┐
Layer 2 (NEW)           │  ConnectionOrchestrator              │
连接编排层              │  "谁连接谁"                          │
                        │                                      │
                        │  Base (core) + Platform impls        │
                        │  (electron / node / web)             │
                        └──────────────┬───────────────────────┘
                                       │ 使用
                        ┌──────────────▼───────────────────────┐
Layer 1 (existing)      │  Channel                             │
传输层                  │  "如何发送/接收消息"                  │
                        │                                      │
                        │  Abstract (core) + Platform impls    │
                        │  (IPCMainChannel, NodeProcess, etc.) │
                        └──────────────┬───────────────────────┘
                                       │ 使用
                        ┌──────────────▼───────────────────────┐
Layer 0 (existing)      │  RPC Primitives                      │
RPC 原语层              │  "Service / Client / Middleware"     │
                        │                                      │
                        │  All in core                         │
                        └──────────────────────────────────────┘
```

每一层都建立在上一层之上，但**全部住在已有的包里**，不需要新项目。

### 实际文件布局

```
packages/async/async-call-rpc/src/           ← core 包
├── protocol/
│   └── AbstractChannelProtocol.ts           (已有，Layer 1 基类)
├── endpoint/
│   ├── RPCService.ts                        (已有，Layer 0)
│   └── RPCServiceHost.ts                    (已有，Layer 0)
├── orchestrator/                            ← NEW 目录（Layer 2 基类）
│   ├── BaseConnectionOrchestrator.ts
│   └── types.ts
└── index.ts                                 ← 新增 export

packages/async/async-call-rpc-electron/src/  ← Electron 包
├── IPCMainChannel.ts                        (已有，Layer 1)
├── IPCRendererChannel.ts                    (已有，Layer 1)
├── ElectronUtilityProcessChannel.ts         (已有，Layer 1)
├── ElectronMessagePortMainChannel.ts        (已有，Layer 1)
├── ElectronConnectionOrchestrator.ts        ← NEW（Layer 2 Electron 实现）
└── index.ts                                 ← 新增 export

packages/async/async-call-rpc-node/src/      ← Node 包
├── NodeProcessChannel.ts                    (已有，Layer 1)
├── NodeConnectionOrchestrator.ts            ← NEW（Layer 2 Node 实现）
└── index.ts

packages/async/async-call-rpc-web/src/       ← Web 包
├── MessageChannel.ts                        (已有，Layer 1)
├── WorkerChannel.ts                         (已有，Layer 1)
├── WebSocketChannel.ts                      (已有，Layer 1)
├── WebConnectionOrchestrator.ts             ← NEW（Layer 2 Web 实现）
└── index.ts
```

### 用户视角：零新增依赖

```typescript
// Electron 用户 — 还是只需要安装同一个包
import {
  // Layer 1: Channel（已有）
  IPCMainChannel,
  ElectronUtilityProcessChannel,
  // Layer 2: Orchestrator（新增，同一个包）
  ElectronConnectionOrchestrator,
} from '@x-oasis/async-call-rpc-electron'

// Node 用户 — 同理
import {
  NodeProcessChannel,
  NodeConnectionOrchestrator,
} from '@x-oasis/async-call-rpc-node'

// Web 用户 — 同理
import {
  RPCMessageChannel,
  WebConnectionOrchestrator,
} from '@x-oasis/async-call-rpc-web'

// 零新增依赖，零新增安装步骤
```

### 类比

Connection Orchestrator 与 async-call-rpc 的关系，类似于：

| 类比 | 基础层 | 编排层 | 关系 |
|------|-------|--------|------|
| **React** | Component, State, Props | React Router | Router 不是独立于 React 的项目，它是 React 生态中更高层的抽象 |
| **Express** | req/res, middleware | Router | Router 内建在 Express 中，不是独立包 |
| **Kubernetes** | Container, Pod | Deployment, Service | Deployment 是 Pod 之上的编排层，同一个系统 |
| **async-call-rpc** | Channel, Service, Client | ConnectionOrchestrator | Orchestrator 是 Channel 之上的编排层，同一套包 |

---

## 问题分析

### 当前核心问题

#### 问题 1：连接建立仪式繁琐（user friction）

当前 Renderer ↔ Utility 建立 RPC 通道需要多个步骤：

```typescript
// renderer 侧（当前方式）
const api = clientHost.registerClient('api', { channel: mainChannel }).createProxy()

// 1. 主动请求 port（需要理解什么是 port 请求）
const [port] = await api.acquireUtilityPort()

// 2. 创建本地 channel
const rendererInitiatedChannel = new RPCMessageChannel()

// 3. 绑定 port
rendererInitiatedChannel.bindPort(port)

// 4. 创建对方的 client
const utilityClient = clientHost
  .registerClient('utility-direct-from-renderer', { channel: rendererInitiatedChannel })
  .createProxy()

// 5. 才能调用
await utilityClient.echo('hello')

// 用户想要的只是：const utilityClient = await getUtilityClient()
```

**问题的本质**：用户需要理解 port、channel、service 等框架概念，而不是直观地说"我要连接到 utility"。

#### 问题 2：多 Channel 管理复杂度爆炸

为了支持双向通信，需要维护多条 channel：

```typescript
// renderer 侧当前需要：
const utilityInitiatedChannel = new RPCMessageChannel()     // ← 路径 A
const rendererInitiatedChannel = new RPCMessageChannel()    // ← 路径 B

// utility 侧也需要：
const rendererInitiatedChannel = new ElectronMessagePortMainChannel()
const utilityInitiatedChannel = new ElectronMessagePortMainChannel()

// 当有 2 个 utility 时，就是 4 条 channel
// 当有 3 个 utility 时，就是 6 条 channel
// 指数级增长，难以维护
```

**实际场景**：
- 2 个 Renderer + 3 个 Utility = 6 条 Channel + 12 个 Service + 12 套 Handler
- 新增 Utility 时，需要改 3 个地方（main、preload、utility-worker）
- 修改 Service 接口时，需要同步 5 个位置

#### 问题 3：Late-Binding 设计容易出错

```typescript
// 时刻 T0：创建 channel（空的，没有 port）
const utilityInitiatedChannel = new RPCMessageChannel()

// 时刻 T1：注册服务处理函数（此时 channel 还没有 port！）
serviceHost.registerService('renderer-direct-from-utility', {
  channel: utilityInitiatedChannel,  // ← 底层传输还不存在
  handlers: { greet(msg) {...} }
})

// 时刻 T2（很久以后）：Utility 请求 port，main 分配，renderer 才绑定
utilityInitiatedChannel.bindPort(port)  // ← 这时才有底层传输

// 问题场景：
// - 如果 Utility 在 T1 时就发起调用，会超时或失败
// - Service 的就绪状态无法追踪
// - 框架无法保证服务在调用时是否可用
```

**风险**：
- 竞态条件（并发启动时）
- 超时异常难诊断
- 无法区分"尚未就绪"和"调用失败"
- 热加载、重连等场景无法优雅处理

#### 问题 4：Renderer/Utility 如何获得 Connection 的 Client

**最关键的问题**：在 Renderer 或 Utility Process 中，如何拿到一个能调用对方的 client？

当前方式：
- 需要手动理解整个 port 流转过程
- 需要手动创建 channel 并绑定 port
- 需要手动注册 client
- 每个场景都要重复这个过程

**用户想要**：
```typescript
// Renderer 中
const utilityClient = await getUtilityClient()
await utilityClient.echo('hello')

// Utility 中
const rendererClient = getRendererClient()
await rendererClient.greet('test')
```

一行代码，就能得到一个能调用对方的 client。

#### 问题 5：缺乏跨平台统一的编排能力

目前只有 Electron 的例子，但同样的模式在以下场景中也需要：

- **Node.js**：主进程和多个 child process 的通信
- **Web Worker**：主线程和多个 Worker 的通信  
- **Hybrid**：Electron main ↔ Node utility ↔ Web renderer

每个平台需要重新实现一遍 port 创建、分发、激活的逻辑。

---

### 问题映射表

| 问题 | 影响范围 | 当前解决方式 | 痛点 |
|------|---------|----------|------|
| 连接仪式繁琐 | 所有应用 | 手动5步 | 用户体验差 |
| 多 Channel 爆炸 | N:M 连接场景 | 手动管理 | 维护成本高 |
| Late-Binding 错误 | 运行时 | 无保证 | 难诊断，不稳定 |
| Client 获取困难 | 业务代码 | 手动创建 | 代码冗长 |
| 跨平台不统一 | 多平台应用 | 各自实现 | 代码重复，学习曲线陡 |

---

## 本质认知

### 你提出的关键洞察

在讨论中，你指出了几个本质：

#### 洞察 1：Connection 应该在 Main Process（或协调者）

```
当前：分散的 port 流转
├─ main.ts: 创建 port
├─ preload.ts: 接收 port，创建 channel
└─ utility-worker.ts: 接收 port，创建 channel

理想：集中的连接编排
└─ MainProcessConnection
   ├─ registerRenderer()
   ├─ registerUtility()
   └─ connect() ← 一行代码搞定
```

**意义**：把复杂性从应用层上移到框架层，框架处理所有细节，应用只需声明"谁连接谁"。

#### 洞察 2：Connection 的 Client 应该被注入到参与者

```
Main Process (编排)
    │
    ├─ 创建 port pair
    │
    ├─ RPC→ Renderer.activateConnection(port1)
    │       → Renderer 的 connectionStore.set(id, client)
    │
    └─ RPC→ Utility.activateConnection(port2)
            → Utility 的 connectionStore.set(id, client)

之后：
Renderer 可以直接：const client = getClient(id)
Utility 可以直接：const client = getClient(id)
```

**意义**：参与者不需要主动去创建 client，而是编排者在建立连接时就帮它们创建好并存储。

#### 洞察 3：这是一个跨平台的统一问题

```
问题本质：A ↔ B 如何直连？

Electron                Node                    Web
─────────               ────                    ───
Renderer ↔ Utility     Child A ↔ Child B     Worker A ↔ Worker B
  协调者：Main          协调者：Master         协调者：Main Thread
  Port：MessagePort     Port：MessagePort      Port：MessagePort
  激活方式：IPC         激活方式：process.send 激活方式：postMessage

虽然传输不同，但"编排逻辑"完全相同！
```

**意义**：可以提取通用的编排逻辑到框架层，具体平台只需实现 3-5 个方法。

---

## 解决方案

### 方案 A：应用层 MainProcessConnection（纯应用方案）

**范围**：只改应用代码，框架不改

**改动**：
```
新增 120 行代码（MainProcessConnection 类）
业务代码减少 125 行
应用层总代码：-5 行
```

**实现**：在应用的 main.ts 中创建 `MainProcessConnection` 类，负责：
- 注册 renderer/utility 的 channel
- 创建 port pair
- 调用双方的 `activateConnection()` handler
- 管理连接状态

**优点**：
- ✅ 立即可用，无框架改动风险
- ✅ 时间短（1.5 天）
- ✅ 效果显著（业务代码简化 50%）

**缺点**：
- ❌ 无法复用（每个应用要自己实现）
- ❌ 无法用于开源框架发布
- ❌ 其他平台（Node、Web）无法复用

**推荐场景**：快速解决当前 Electron 应用的问题

---

### 方案 B：框架层 BaseConnectionOrchestrator（通用方案）⭐⭐⭐⭐⭐

**范围**：抽象为框架层的通用基类，各平台各自实现

**架构**：
```
packages/async/async-call-rpc/src/orchestrator/
├── BaseConnectionOrchestrator.ts      (150 行，核心逻辑)
└── types.ts                           (50 行，通用类型)

packages/async/async-call-rpc-electron/src/
└── ElectronConnectionOrchestrator.ts  (30 行，Electron 实现)

packages/async/async-call-rpc-node/src/
└── NodeConnectionOrchestrator.ts      (30 行，Node 实现)

packages/async/async-call-rpc-web/src/
└── WebConnectionOrchestrator.ts       (30 行，Web 实现)
```

**改动总量**：
```
框架代码：260 行（一次性投入）
应用代码：各减 50%
总成本：2.5 天框架 + 1 天应用改造 = 3.5 天
```

**核心设计**：

#### BaseConnectionOrchestrator 职责

```typescript
abstract class BaseConnectionOrchestrator<T extends AbstractChannelProtocol> {
  
  /**
   * 注册一个参与者（renderer、utility、child process、worker 等）
   */
  registerParticipant(
    id: string,
    channel: T,
    type: 'renderer' | 'utility' | 'worker' | 'process'
  ): void
  
  /**
   * 核心方法：建立两个参与者之间的连接
   * 自动完成：port 创建 → 分发 → 激活 → service 注册
   */
  async connect(
    fromId: string,
    toId: string,
    config: ConnectionConfig
  ): Promise<ConnectionInfo>
  
  /**
   * 获取连接信息
   */
  getConnectionInfo(participantId: string, peerId?: string): ConnectionInfo | undefined
  
  /**
   * 平台特定方法（由子类实现）
   */
  protected abstract createPortPair(): { port1: any; port2: any }
  protected abstract activateParticipant(participant, config): Promise<void>
}
```

#### 各平台的实现（极简）

```typescript
// Electron
export class ElectronConnectionOrchestrator 
  extends BaseConnectionOrchestrator {
  protected createPortPair() {
    return new MessageChannelMain()
  }
  protected async activateParticipant(participant, config) {
    const client = clientHost.registerClient(...).createProxy()
    await client.activateConnection(config)
  }
}

// Node
export class NodeConnectionOrchestrator 
  extends BaseConnectionOrchestrator {
  protected createPortPair() {
    return new MessageChannel()
  }
  protected async activateParticipant(participant, config) {
    const client = clientHost.registerClient(...).createProxy()
    await client.activateConnection(config)
  }
}

// Web
export class WebConnectionOrchestrator 
  extends BaseConnectionOrchestrator {
  protected createPortPair() {
    return new MessageChannel()
  }
  protected async activateParticipant(participant, config) {
    const client = clientHost.registerClient(...).createProxy()
    await client.activateConnection(config)
  }
}
```

#### 应用层使用（各平台统一 API）

```typescript
// Electron
const orchestrator = new ElectronConnectionOrchestrator()
orchestrator.registerParticipant('renderer', rendererChannel, 'renderer')
orchestrator.registerParticipant('utility', utilityChannel, 'utility')
await orchestrator.connect('renderer', 'utility', config)

// Node — 完全相同的 API
const orchestrator = new NodeConnectionOrchestrator()
orchestrator.registerParticipant('child-a', channelA, 'process')
orchestrator.registerParticipant('child-b', channelB, 'process')
await orchestrator.connect('child-a', 'child-b', config)

// Web — 完全相同的 API
const orchestrator = new WebConnectionOrchestrator()
orchestrator.registerParticipant('worker-1', channel1, 'worker')
orchestrator.registerParticipant('worker-2', channel2, 'worker')
await orchestrator.connect('worker-1', 'worker-2', config)
```

**参与者侧的统一接口**：

所有平台都实现相同的 `activateConnection` 方法：

```typescript
serviceHost.registerService('activator', {
  channel: orchestratorChannel,
  handlers: {
    async activateConnection(config) {
      const { connectionId, port, myServices, peerServices } = config
      
      // 1. 创建本地 channel
      const localChannel = this.createLocalChannel()
      
      // 2. 绑定 port
      localChannel.bindPort(port)
      
      // 3. 注册服务
      if (myServices) {
        serviceHost.registerService(`service-${connectionId}`, {
          channel: localChannel,
          handlers: myServices,
        })
      }
      
      // 4. 创建 client 并存储
      if (peerServices) {
        const client = clientHost
          .registerClient(`client-${connectionId}`, { channel: localChannel })
          .createProxy()
        
        connectionStore.set(connectionId, client)
      }
    },
  },
})

// 暴露统一接口
export async function getConnectedClient(connectionId?: string) {
  if (!connectionId) {
    const [, client] = Array.from(connectionStore.entries())[0]
    return client
  }
  return connectionStore.get(connectionId)
}
```

**优点**：
- ✅ 一套框架，支持所有平台
- ✅ API 完全统一，学习曲线低
- ✅ 代码极度复用
- ✅ 为开源发布做准备
- ✅ 为 WebSocket、gRPC 等新 transport 打基础

**缺点**：
- ❌ 框架改动量较大（但内聚性高）
- ❌ 前期投入（2.5 天）
- ❌ 需要测试和文档

**推荐场景**：长期的、多平台的、作为开源库发布的项目

---

### 方案 C：框架支持 Port 生命周期（可选的框架增强）

**范围**：在 BaseConnectionOrchestrator 基础上，框架直接支持 `onReady`、`isReady` 等生命周期

**改动**：
```
AbstractChannelProtocol 增加 50 行（isReady、onReady、bindPort、unbindPort）
各 Channel 实现增加 60 行（具体的 bindPort/unbindPort）
```

**作用**：
- 让 Service 注册更安全（framework 自动处理 late-binding）
- 让应用层的 Connection 类代码更简洁

**优先级**：中等（建议在方案 B 的基础上做）

---

## 架构设计

### 完整架构图

```
┌─────────────────────────────────────────────────────────────┐
│                    Async-Call-RPC Framework                 │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │  @x-oasis/async-call-rpc                               │ │
│ │  ├─ RPC 核心                                            │ │
│ │  ├─ Channel 协议                                        │ │
│ │  └─ Orchestrator (新)                                   │ │
│ │      ├─ BaseConnectionOrchestrator                      │ │
│ │      ├─ ParticipantRegistry                            │ │
│ │      └─ ConnectionState                                │ │
│ └─────────────────────────────────────────────────────────┘ │
│                           ▲                                  │
│        ┌──────────────────┼──────────────────┐             │
│        │                  │                  │             │
│ ┌──────▼──────┐  ┌────────▼────────┐  ┌──────▼──────┐    │
│ │ @x-oasis/   │  │  @x-oasis/      │  │ @x-oasis/   │    │
│ │ async-call- │  │  async-call-    │  │ async-call- │    │
│ │ rpc-electron│  │  rpc-node       │  │ rpc-web     │    │
│ │             │  │                 │  │             │    │
│ │ Electron    │  │ Node.js         │  │ Web         │    │
│ │ Orchestrator│  │ Orchestrator    │  │ Orchestrator│    │
│ └─────────────┘  └─────────────────┘  └─────────────┘    │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                    User Applications                         │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│ ┌──────────────────┐  ┌──────────────────┐  ┌────────────┐  │
│ │  Electron App    │  │  Node.js App     │  │  Web App   │  │
│ │                  │  │                  │  │            │  │
│ │ const orch =     │  │ const orch =     │  │ const orch │  │
│ │   new Electron   │  │   new Node       │  │   = new Web│  │
│ │   Orchestrator() │  │   Orchestrator() │  │ Orchestr.. │  │
│ │                  │  │                  │  │            │  │
│ │ orch.register... │  │ orch.register... │  │ orch.reg.. │  │
│ │ orch.connect()   │  │ orch.connect()   │  │ orch.con() │  │
│ │                  │  │                  │  │            │  │
│ │ await getClient()│  │ await getClient()│  │ await get..│  │
│ │ await client.xxx │  │ await client.xxx │  │ await cl...│  │
│ └──────────────────┘  └──────────────────┘  └────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### 类图

```typescript
// BaseConnectionOrchestrator
abstract class BaseConnectionOrchestrator<T extends AbstractChannelProtocol> {
  protected participants: Map<string, ParticipantInfo<T>>
  protected connections: ConnectionState[]
  
  abstract createPortPair(): { port1: any; port2: any }
  abstract activateParticipant(participant, config): Promise<void>
  
  registerParticipant(id, channel, type): void
  async connect(fromId, toId, config): Promise<ConnectionInfo>
  getConnectionInfo(participantId, peerId?): ConnectionInfo | undefined
}

// 各平台实现
class ElectronConnectionOrchestrator extends BaseConnectionOrchestrator { ... }
class NodeConnectionOrchestrator extends BaseConnectionOrchestrator { ... }
class WebConnectionOrchestrator extends BaseConnectionOrchestrator { ... }

// 类型定义
interface ParticipantInfo<T> {
  id: string
  channel: T
  type: 'renderer' | 'utility' | 'worker' | 'process'
  createdAt: number
}

interface ConnectionConfig {
  fromServices?: Record<string, (...args: any[]) => any>
  toServices?: Record<string, (...args: any[]) => any>
}

interface ConnectionInfo {
  connectionId: string
  from: string
  to: string
  port1: any
  port2: any
  status: 'connected' | 'disconnected' | 'error'
  createdAt: number
}

interface ActivationConfig {
  connectionId: string
  port: any
  role: 'initiator' | 'receiver'
  peerServices?: Record<string, (...args: any[]) => any>
  myServices?: Record<string, (...args: any[]) => any>
}
```

### 执行流程

#### 编排器侧的执行流程

```
1. registerParticipant('renderer', rendererChannel)
   └─ participants.set('renderer', { channel, type: 'renderer' })

2. registerParticipant('utility', utilityChannel)
   └─ participants.set('utility', { channel, type: 'utility' })

3. await connect('renderer', 'utility', config)
   │
   ├─ 3.1: createPortPair()  (平台特定)
   │  └─ { port1, port2 }
   │
   ├─ 3.2: activateParticipant(renderer, {
   │       connectionId: 'renderer--utility',
   │       port: port1,
   │       myServices: config.fromServices,
   │       peerServices: config.toServices
   │     })
   │  └─ RPC 调用: rendererClient.activateConnection(config)
   │
   ├─ 3.3: activateParticipant(utility, {
   │       connectionId: 'renderer--utility',
   │       port: port2,
   │       myServices: config.toServices,
   │       peerServices: config.fromServices
   │     })
   │  └─ RPC 调用: utilityClient.activateConnection(config)
   │
   └─ 3.4: connections.push({ connectionId, from, to, port1, port2 })
       └─ return { connectionId, status: 'connected' }
```

#### 参与者侧的执行流程（Renderer 为例）

```
1. Orchestrator 调用 rendererClient.activateConnection(config)
   │
   ├─ 1.1: localChannel = new RPCMessageChannel()
   │
   ├─ 1.2: localChannel.bindPort(port1)  (绑定 port)
   │
   ├─ 1.3: serviceHost.registerService(`service-renderer--utility`, {
   │       channel: localChannel,
   │       handlers: config.myServices  (我的 service)
   │     })
   │
   ├─ 1.4: client = clientHost.registerClient(`client-renderer--utility`, {
   │       channel: localChannel
   │     }).createProxy()  (创建对方的 client)
   │
   └─ 1.5: connectionStore.set('renderer--utility', client)
       └─ 应用代码可以：const c = await getConnectedClient('renderer--utility')
```

---

## 状态跟踪与故障处理设计

> 本章节是对"状态跟踪：记录连接状态，提供查询接口"和"故障处理：为未来的重连、降级等机制打基础"两个要点的完整展开。

### 开源社区方案调研

在设计 Connection Orchestrator 的状态跟踪和故障处理之前，我们调研了 5 个主流开源项目的方案，从中提取可借鉴的设计模式。

#### 1. gRPC Connectivity State Machine

gRPC 定义了业界最成熟的连接状态模型，由 5 个状态和明确的转换规则组成：

```
                    ┌──────────────────────────────────┐
                    │           SHUTDOWN                │
                    │     (终态，不可逆)                │
                    └──────────────────────────────────┘
                          ▲            ▲          ▲
                          │            │          │
                    ┌─────┴──┐  ┌──────┴───┐  ┌───┴──────────────┐
                    │  IDLE  │  │CONNECTING│  │TRANSIENT_FAILURE │
                    │未连接  │──►正在连接  │──►暂时性故障         │
                    └────────┘  └──────────┘  └──────────────────┘
                         ▲          │  ▲              │
                         │          ▼  │              │
                         │     ┌────────────┐         │
                         └─────│   READY    │◄────────┘
                               │ 连接就绪   │
                               └────────────┘
```

**状态说明**：

| 状态 | 含义 | 转换条件 |
|------|------|---------|
| **IDLE** | Channel 刚创建，没有尝试连接 | 有 RPC 请求时 → CONNECTING |
| **CONNECTING** | 正在建立连接（DNS、TCP、TLS） | 成功 → READY；失败 → TRANSIENT_FAILURE |
| **READY** | 连接已建立，可以发送 RPC | 连接断开 → TRANSIENT_FAILURE 或 IDLE |
| **TRANSIENT_FAILURE** | 暂时性故障，正在等待重试 | 重试定时器到期 → CONNECTING |
| **SHUTDOWN** | 用户主动关闭，终态 | 不可逆 |

**关键 API**：
- `channel.getState(tryToConnect?)` — 获取当前状态，可选地触发连接尝试
- `channel.waitForStateChange(currentState, deadline)` — 等待状态变化，支持超时

**设计决策**：
- TRANSIENT_FAILURE 和 CONNECTING 之间通过 exponential backoff 控制
- IDLE 到 CONNECTING 采用 lazy connect（有请求才连接）
- SHUTDOWN 是终态，不可恢复

**对我们的启发**：
- 状态模型清晰、穷举，5 个状态覆盖了所有场景
- `waitForStateChange` 是非常优雅的 API——调用者不需要轮询
- TRANSIENT_FAILURE 和永久 SHUTDOWN 的区分非常重要

#### 2. Socket.IO 重连策略

Socket.IO 的重连机制是实时通信领域的事实标准：

```typescript
const socket = io('https://server.com', {
  reconnection: true,              // 是否自动重连（默认 true）
  reconnectionAttempts: Infinity,  // 最大重试次数（默认无限）
  reconnectionDelay: 1000,         // 初始重试延迟（默认 1000ms）
  reconnectionDelayMax: 5000,      // 最大重试延迟（默认 5000ms）
  randomizationFactor: 0.5,        // 随机抖动因子（默认 0.5）
})
```

**指数退避 + 抖动的计算公式**：
```
实际延迟 = min(
  reconnectionDelay × 2^attempt × (1 ± randomizationFactor),
  reconnectionDelayMax
)

示例（默认配置）：
  第 1 次重试：1000ms × (0.5~1.5) = 500~1500ms
  第 2 次重试：2000ms × (0.5~1.5) = 1000~3000ms
  第 3 次重试：4000ms × (0.5~1.5) = 2000~5000ms
  第 4+ 次重试：capped at 5000ms
```

**事件体系**：
```typescript
socket.on('connect',           () => {})  // 连接成功
socket.on('disconnect',        (reason) => {})  // 断开连接
socket.on('reconnect',         (attempt) => {})  // 重连成功
socket.on('reconnect_attempt', (attempt) => {})  // 每次重连尝试
socket.on('reconnect_error',   (error) => {})    // 重连失败
socket.on('reconnect_failed',  () => {})          // 达到最大重试次数，放弃
```

**对我们的启发**：
- 指数退避 + 随机抖动是工业标准，必须采用
- `reconnectionDelayMax` 设上限，避免等待时间过长
- `reconnect_failed` 事件很重要——告诉用户"我放弃了"
- `randomizationFactor` 防止所有客户端同时重试（thundering herd）

#### 3. Microsoft SignalR 自动重连

SignalR 的 `HubConnectionState` 和 `withAutomaticReconnect` 提供了最完整的重连策略接口：

**5 个状态**：
```typescript
enum HubConnectionState {
  Disconnected  = 'Disconnected',   // 未连接
  Connecting    = 'Connecting',     // 正在连接
  Connected     = 'Connected',      // 已连接
  Disconnecting = 'Disconnecting',  // 正在断开
  Reconnecting  = 'Reconnecting',   // 正在重连
}
```

**自动重连配置**：
```typescript
// 方式 1：使用默认策略（延迟 0ms, 2000ms, 10000ms, 30000ms，然后放弃）
const connection = new HubConnectionBuilder()
  .withUrl('/chatHub')
  .withAutomaticReconnect()
  .build()

// 方式 2：自定义延迟数组
const connection = new HubConnectionBuilder()
  .withAutomaticReconnect([0, 1000, 5000, 10000, 30000])
  .build()

// 方式 3：自定义重试策略接口
const connection = new HubConnectionBuilder()
  .withAutomaticReconnect({
    nextRetryDelayInMilliseconds(retryContext) {
      // retryContext.previousRetryCount — 已重试次数
      // retryContext.elapsedMilliseconds — 总耗时
      // retryContext.retryReason — 断开原因
      
      if (retryContext.elapsedMilliseconds < 60000) {
        // 1 分钟内：指数退避
        return Math.pow(2, retryContext.previousRetryCount) * 1000
      }
      // 超过 1 分钟：放弃
      return null
    }
  })
  .build()
```

**重连事件**：
```typescript
connection.onreconnecting(error => {
  console.log('连接丢失，正在重连...', error)
  // UI 可以显示"重连中"状态
})

connection.onreconnected(connectionId => {
  console.log('重连成功', connectionId)
  // UI 恢复正常状态
})

connection.onclose(error => {
  console.log('连接永久关闭', error)
  // 重连已放弃，需要手动重新启动
})
```

**关键设计决策**：
- `withAutomaticReconnect()` 不处理首次连接失败——首次连接需要手动重试
- 重连成功后，之前注册的事件处理器（如 `on('ReceiveMessage')`）会自动恢复
- 返回 `null` 表示放弃重连，转入 Disconnected 状态

**对我们的启发**：
- `IRetryPolicy` 接口（`nextRetryDelayInMilliseconds`）的设计非常灵活
- `retryContext` 提供了上下文信息（已重试次数、总耗时、断开原因），让策略可以做智能决策
- 区分"首次连接"和"重连"是重要的——首次连接失败应该快速报错
- 重连成功后自动恢复事件处理器，用户无需手动重新注册

#### 4. Penpal（iframe 通信库）

Penpal 是一个极简的 iframe 通信库，其设计代表了"轻量级"的极端：

```typescript
// 建立连接
const connection = connectToChild({ iframe, methods: { add(a, b) { return a + b } } })

// connection.promise 在连接建立时 resolve
const child = await connection.promise

// 调用对方方法
const result = await child.multiply(2, 3)

// 销毁连接
connection.destroy()
```

**状态管理**：
- 没有显式的状态机——只有 `connection.promise` 的 pending/resolved/rejected
- 不提供状态查询 API
- 不提供重连通知 API

**错误处理**：
- `ERR_CONNECTION_DESTROYED` — 连接被主动销毁
- `ERR_CONNECTION_TIMEOUT` — 连接超时
- `ERR_NOT_IN_IFRAME` — 不在 iframe 中

**已知问题**：
- 当子 iframe 导航到没有 Penpal 的页面时，调用远程方法会永远挂起——没有错误、没有断开通知
- 没有主动的连接丢失检测

**对我们的启发（反面教材）**：
- 没有状态机 → 调用者无法知道连接是否健康
- 没有重连通知 → 用户体验差
- 调用挂起没有超时 → 需要请求级超时保护
- **我们绝不能犯这些错误**

#### 5. Circuit Breaker（Opossum / Resilience4j）

Circuit Breaker 不是连接管理，而是**调用保护**。但它的状态机和阈值机制对我们非常有启发：

```
              成功率恢复
         ┌───────────────────┐
         │                   │
         ▼                   │
    ┌──────────┐    失败达到阈值    ┌──────────┐
    │  CLOSED  │──────────────────►│   OPEN   │
    │ 正常通过  │                    │ 快速失败  │
    └──────────┘                    └──────────┘
         ▲                               │
         │ 测试请求成功                    │ 等待超时
         │                               ▼
    ┌──────────────┐               ┌──────────┐
    │              │◄──────────────│HALF_OPEN │
    │              │  测试请求失败   │ 探测恢复  │
    └──────────────┘               └──────────┘
```

**Opossum（Node.js）的 API**：
```typescript
const breaker = new CircuitBreaker(asyncFunction, {
  timeout: 3000,                    // 单次调用超时
  errorThresholdPercentage: 50,     // 失败率阈值（50% 触发）
  resetTimeout: 30000,              // OPEN 状态持续时间
  volumeThreshold: 5,               // 最小样本量（5 次调用后才评估）
  rollingCountTimeout: 10000,       // 滑动窗口大小
})

// 事件
breaker.on('open',     () => console.log('熔断开启'))
breaker.on('halfOpen', () => console.log('探测恢复'))
breaker.on('close',    () => console.log('恢复正常'))
breaker.on('reject',   () => console.log('请求被拒绝'))
breaker.on('fallback', () => console.log('降级处理'))
breaker.on('timeout',  () => console.log('调用超时'))

// 状态查询
breaker.opened   // boolean
breaker.closed   // boolean
breaker.halfOpen // boolean

// 带降级的调用
breaker.fallback(() => cachedResult)
const result = await breaker.fire(args)
```

**对我们的启发**：
- 熔断器适合保护 RPC 调用——连续失败时快速失败，避免雪崩
- `volumeThreshold`（最小样本量）避免前几次偶发错误就触发熔断
- `fallback` 降级机制可以让调用不完全失败（如返回缓存数据）
- 可以和重连机制叠加使用：重连负责恢复连接，熔断器负责保护调用

---

### 开源方案对比总结

| 维度 | gRPC | Socket.IO | SignalR | Penpal | Circuit Breaker |
|------|------|-----------|---------|--------|-----------------|
| **状态数** | 5 | 隐式 | 5 | 无 | 3 |
| **重连策略** | 指数退避 | 指数退避+抖动 | 自定义策略接口 | 无 | N/A |
| **状态查询** | getState() | 隐式 | connection.state | 无 | .opened/.closed |
| **状态等待** | waitForStateChange | 无 | 无 | 无 | 无 |
| **事件通知** | 无 | 丰富 | onreconnecting/onreconnected | 无 | 非常丰富 |
| **超时保护** | deadline | 有 | 无 | 可选 | timeout per call |
| **降级方案** | 无 | 无 | 无 | 无 | fallback |
| **策略可定制** | 有限 | 参数化 | IRetryPolicy 接口 | 无 | 参数化+事件 |

---

### Connection Orchestrator 的状态跟踪设计

综合以上调研，我们为 Connection Orchestrator 设计如下的状态跟踪体系。

#### 连接状态机（借鉴 gRPC + SignalR）

我们采用 **6 个状态**的模型，综合了 gRPC 的语义清晰性和 SignalR 的实用性：

```typescript
enum ConnectionState {
  /** 参与者已注册但尚未发起连接 */
  IDLE = 'IDLE',
  
  /** 正在建立连接：port pair 已创建，等待双方激活 */
  CONNECTING = 'CONNECTING',
  
  /** 连接就绪：双方已激活，RPC 可用 */
  READY = 'READY',
  
  /** 暂时性故障：连接断开，正在尝试恢复 */
  TRANSIENT_FAILURE = 'TRANSIENT_FAILURE',
  
  /** 正在断开连接：清理资源中 */
  DISCONNECTING = 'DISCONNECTING',
  
  /** 已关闭：终态，不可自动恢复（可手动重新 connect） */
  CLOSED = 'CLOSED',
}
```

**状态转换图**：

```
                         用户调用 connect()
    ┌──────────┐ ──────────────────────────► ┌──────────────┐
    │          │                             │              │
    │   IDLE   │                             │  CONNECTING  │
    │          │ ◄────────── 连接失败 ─────── │              │
    └──────────┘   (首次连接不自动重试)       └──────┬───────┘
         ▲                                          │
         │                                    双方激活成功
         │                                          │
         │                                          ▼
    ┌────┴─────────┐                         ┌──────────────┐
    │              │                         │              │
    │   CLOSED     │                         │    READY     │
    │              │                         │              │
    └──────────────┘                         └──────┬───────┘
         ▲                                          │
         │                                   port 断开 /
         │                                   进程退出 /
    放弃重连 /                                心跳超时
    用户调用 disconnect()                          │
         │                                          ▼
    ┌────┴─────────┐     重试定时器到期      ┌──────────────────┐
    │              │ ◄────────────────────── │                  │
    │DISCONNECTING │                         │TRANSIENT_FAILURE │
    │              │     重连成功            │                  │
    └──────────────┘ ──────────── ▲ ──────── └──────────────────┘
                                 │                    │
                                 │                    │
                                 └────────────────────┘
                                    经 CONNECTING → READY
```

**与 gRPC 的区别**：
- 增加了 `DISCONNECTING` 状态（借鉴 SignalR），用于优雅关闭
- `IDLE` 不会 lazy connect——我们的场景中连接是由编排者主动发起的
- `CLOSED` 不是绝对终态——用户可以重新调用 `connect()` 重建

#### 状态查询 API（借鉴 gRPC + Opossum）

```typescript
interface ConnectionInfo {
  readonly connectionId: string
  readonly from: string
  readonly to: string
  readonly state: ConnectionState
  readonly lastStateChange: number          // timestamp
  readonly error?: Error                    // 最近的错误
  
  // gRPC 风格：等待状态变化
  waitForStateChange(
    currentState: ConnectionState,
    deadlineMs?: number
  ): Promise<ConnectionState>
  
  // Opossum 风格：便捷的布尔属性
  readonly isReady: boolean
  readonly isConnecting: boolean
  readonly isFailed: boolean
  readonly isClosed: boolean
}
```

**使用示例**：

```typescript
// 查询状态
const conn = orchestrator.getConnectionInfo('renderer', 'utility')
console.log(conn.state)      // 'READY'
console.log(conn.isReady)    // true

// 等待连接就绪（带超时）
try {
  await conn.waitForStateChange(ConnectionState.CONNECTING, 5000)
  console.log('连接已建立')
} catch (e) {
  console.log('连接超时')
}

// 等待断开（无超时）
await conn.waitForStateChange(ConnectionState.READY)
// 到达这里说明连接不再是 READY 了
```

#### 事件体系（借鉴 Socket.IO + Opossum）

```typescript
interface ConnectionEvents {
  /** 状态变化（所有状态转换都会触发） */
  stateChange: (event: {
    connectionId: string
    previousState: ConnectionState
    currentState: ConnectionState
    timestamp: number
    reason?: string
  }) => void
  
  /** 连接就绪 */
  ready: (event: { connectionId: string }) => void
  
  /** 连接断开（暂时性） */
  disconnected: (event: { connectionId: string; error?: Error }) => void
  
  /** 正在重连 */
  reconnecting: (event: {
    connectionId: string
    attempt: number           // 第几次重试
    delay: number             // 下次重试的延迟
    elapsedMs: number         // 总耗时
  }) => void
  
  /** 重连成功 */
  reconnected: (event: { connectionId: string; attempt: number }) => void
  
  /** 重连放弃 */
  reconnectFailed: (event: {
    connectionId: string
    totalAttempts: number
    elapsedMs: number
    lastError?: Error
  }) => void
  
  /** 连接永久关闭 */
  closed: (event: { connectionId: string; reason: string }) => void
}

// 使用示例
orchestrator.on('stateChange', ({ connectionId, previousState, currentState }) => {
  console.log(`[${connectionId}] ${previousState} → ${currentState}`)
})

orchestrator.on('reconnecting', ({ connectionId, attempt, delay }) => {
  showToast(`正在重连 (第 ${attempt} 次，${delay}ms 后重试)`)
})

orchestrator.on('reconnected', ({ connectionId }) => {
  showToast('连接已恢复')
})

orchestrator.on('reconnectFailed', ({ connectionId, totalAttempts }) => {
  showToast(`重连失败 (尝试了 ${totalAttempts} 次)`)
})
```

#### 连接健康指标（借鉴 Opossum Status）

```typescript
interface ConnectionStats {
  readonly connectionId: string
  readonly state: ConnectionState
  
  // 计数器
  readonly totalRpcCalls: number        // RPC 总调用次数
  readonly successfulCalls: number      // 成功次数
  readonly failedCalls: number          // 失败次数
  readonly timeouts: number             // 超时次数
  
  // 延迟
  readonly avgLatencyMs: number         // 平均延迟
  readonly p99LatencyMs: number         // P99 延迟
  
  // 连接历史
  readonly totalReconnects: number      // 总重连次数
  readonly lastConnectedAt: number      // 最后连接时间
  readonly lastDisconnectedAt?: number  // 最后断开时间
  readonly uptime: number               // 连接持续时间（ms）
  
  // 窗口统计（最近 N 秒）
  readonly recentFailureRate: number    // 最近失败率 (0~1)
  readonly recentAvgLatencyMs: number   // 最近平均延迟
}

// 使用示例
const stats = orchestrator.getConnectionStats('renderer--utility')
console.log(`成功率: ${(1 - stats.recentFailureRate) * 100}%`)
console.log(`P99 延迟: ${stats.p99LatencyMs}ms`)
console.log(`总重连次数: ${stats.totalReconnects}`)
```

---

### Connection Orchestrator 的故障处理设计

#### 故障检测机制

Connection Orchestrator 面对的故障场景和传统的 WebSocket/HTTP 场景不同——我们的通信基于 MessagePort 和 IPC，故障检测需要针对性设计。

##### 检测方式 1：进程/端口生命周期事件（被动检测）

```typescript
// Electron: utility process 退出
utilityProcess.on('exit', (code) => {
  orchestrator.handleParticipantLost('utility-1', `process exited with code ${code}`)
})

// Electron: renderer webContents 销毁
webContents.on('destroyed', () => {
  orchestrator.handleParticipantLost('renderer-1', 'webContents destroyed')
})

// Node: child process 退出
childProcess.on('exit', (code, signal) => {
  orchestrator.handleParticipantLost('child-1', `exited: ${signal || code}`)
})

// Web: Worker 错误
worker.onerror = (error) => {
  orchestrator.handleParticipantLost('worker-1', error.message)
}

// MessagePort: close 事件
port.addEventListener('close', () => {
  orchestrator.handlePortClosed(connectionId)
})
```

**优点**：零开销，利用平台原生事件
**缺点**：不能检测"活着但卡住"的进程

##### 检测方式 2：心跳探测（主动检测，借鉴 gRPC keepalive）

```typescript
interface HeartbeatConfig {
  /** 心跳间隔（默认 30000ms） */
  intervalMs: number
  
  /** 心跳超时（默认 5000ms，超时视为连接断开） */
  timeoutMs: number
  
  /** 是否启用（默认 false，生产环境建议开启） */
  enabled: boolean
}
```

**实现原理**：

```
    编排者                          参与者
      │                               │
      │ ──── ping (seqId=1) ────────► │
      │                               │
      │ ◄─── pong (seqId=1) ──────── │  ← 在 timeoutMs 内收到 → 健康
      │                               │
      │ ──── ping (seqId=2) ────────► │
      │                               │
      │     ... timeoutMs 超时 ...     │  ← 未收到 → TRANSIENT_FAILURE
      │                               │
```

**与 gRPC keepalive 的对比**：
- gRPC 的 keepalive 在 transport 层实现（HTTP/2 PING frame）
- 我们在 RPC 层实现（作为特殊的 RPC 调用），更灵活
- gRPC 有 `KEEPALIVE_TIMEOUT` 和 `KEEPALIVE_TIME` 两个参数，我们简化为 `intervalMs` 和 `timeoutMs`

##### 检测方式 3：请求级超时（调用保护，借鉴 Penpal 的反面教训）

Penpal 的一个严重问题是：当对方不可达时，RPC 调用会永远挂起。我们必须避免这个问题：

```typescript
interface RequestTimeoutConfig {
  /** 默认请求超时（默认 30000ms） */
  defaultTimeoutMs: number
  
  /** 连续超时多少次触发连接状态变更 */
  consecutiveTimeoutThreshold: number
}

// 使用：每个 RPC 调用都有超时保护
const result = await utilityClient.heavyComputation(data)
// 如果 30s 内没有响应 → reject with TimeoutError
// 如果连续 3 次超时 → 触发 TRANSIENT_FAILURE
```

#### 故障恢复机制

##### 重连策略接口（借鉴 SignalR IRetryPolicy）

SignalR 的 `IRetryPolicy` 是我们见过的最灵活的重连策略接口。我们在其基础上扩展：

```typescript
/**
 * 重连策略接口（借鉴 SignalR IRetryPolicy）
 */
interface ReconnectPolicy {
  /**
   * 返回下一次重试的延迟（ms）
   * 返回 null 表示放弃重连
   */
  nextRetryDelayMs(context: RetryContext): number | null
}

interface RetryContext {
  /** 已重试次数 */
  previousRetryCount: number
  
  /** 从首次断开到现在的总耗时 */
  elapsedMs: number
  
  /** 断开原因 */
  retryReason: Error | string
  
  /** 连接的元数据 */
  connectionId: string
  fromId: string
  toId: string
}
```

##### 内置策略 1：指数退避 + 抖动（借鉴 Socket.IO）

```typescript
class ExponentialBackoffPolicy implements ReconnectPolicy {
  constructor(private options: {
    initialDelayMs?: number     // 默认 1000
    maxDelayMs?: number         // 默认 30000
    multiplier?: number         // 默认 2
    jitterFactor?: number       // 默认 0.3
    maxRetries?: number         // 默认 Infinity
    maxElapsedMs?: number       // 默认 300000 (5 分钟)
  }) {}
  
  nextRetryDelayMs(context: RetryContext): number | null {
    // 超过最大重试次数 → 放弃
    if (context.previousRetryCount >= this.options.maxRetries!) return null
    
    // 超过最大总耗时 → 放弃
    if (context.elapsedMs >= this.options.maxElapsedMs!) return null
    
    // 计算延迟
    const baseDelay = this.options.initialDelayMs! 
      * Math.pow(this.options.multiplier!, context.previousRetryCount)
    const cappedDelay = Math.min(baseDelay, this.options.maxDelayMs!)
    
    // 添加抖动
    const jitter = cappedDelay * this.options.jitterFactor! * (Math.random() * 2 - 1)
    return Math.max(0, cappedDelay + jitter)
  }
}

// 使用
const orchestrator = new ElectronConnectionOrchestrator({
  reconnectPolicy: new ExponentialBackoffPolicy({
    initialDelayMs: 1000,
    maxDelayMs: 30000,
    maxRetries: 10,
  })
})
```

##### 内置策略 2：固定延迟数组（借鉴 SignalR 默认策略）

```typescript
class FixedDelayPolicy implements ReconnectPolicy {
  constructor(private delays: number[] = [0, 2000, 10000, 30000]) {}
  
  nextRetryDelayMs(context: RetryContext): number | null {
    if (context.previousRetryCount >= this.delays.length) return null
    return this.delays[context.previousRetryCount]
  }
}

// 使用
const orchestrator = new ElectronConnectionOrchestrator({
  reconnectPolicy: new FixedDelayPolicy([0, 1000, 5000, 15000, 30000])
})
```

##### 内置策略 3：永不重连

```typescript
class NeverReconnectPolicy implements ReconnectPolicy {
  nextRetryDelayMs(): null { return null }
}

// 对于不需要自动重连的场景（如一次性任务）
const orchestrator = new ElectronConnectionOrchestrator({
  reconnectPolicy: new NeverReconnectPolicy()
})
```

##### 重连执行流程

```
    READY 状态
        │
        │ 检测到故障（进程退出 / 心跳超时 / port 关闭）
        │
        ▼
    TRANSIENT_FAILURE
        │
        ├─ 调用 reconnectPolicy.nextRetryDelayMs(context)
        │
        ├─ 返回 number → 等待指定 ms 后尝试重连
        │   │
        │   ▼
        │   重新执行 connect 流程：
        │   1. 创建新的 port pair（createPortPair）
        │   2. 激活双方（activateParticipant × 2）
        │   3. 等待双方确认
        │   │
        │   ├─ 成功 → READY（触发 reconnected 事件）
        │   │
        │   └─ 失败 → 回到 TRANSIENT_FAILURE，继续重试
        │       context.previousRetryCount++
        │       context.elapsedMs 更新
        │       再次调用 nextRetryDelayMs
        │
        └─ 返回 null → 放弃重连
            │
            ▼
          CLOSED（触发 reconnectFailed 事件）
```

##### 重连过程中的请求处理

```typescript
interface PendingRequestBehavior {
  /** 
   * 连接断开时，正在进行的请求怎么处理？
   * 'reject' — 立即拒绝所有 pending 请求
   * 'queue'  — 排队等待重连后重发
   * 'timeout' — 按原有超时处理
   */
  onDisconnect: 'reject' | 'queue' | 'timeout'
  
  /**
   * 重连期间，新发起的请求怎么处理？
   * 'reject' — 立即拒绝
   * 'queue'  — 排队等待重连
   */
  duringReconnect: 'reject' | 'queue'
  
  /**
   * 排队请求的最大数量
   */
  maxQueueSize: number
  
  /**
   * 排队请求的最大等待时间
   */
  queueTimeoutMs: number
}
```

**使用示例**：

```typescript
const orchestrator = new ElectronConnectionOrchestrator({
  reconnectPolicy: new ExponentialBackoffPolicy(),
  pendingRequests: {
    onDisconnect: 'timeout',   // 已有请求按超时处理
    duringReconnect: 'queue',  // 新请求排队
    maxQueueSize: 100,
    queueTimeoutMs: 60000,
  }
})
```

#### 降级方案（借鉴 Circuit Breaker fallback）

当直连 port 不可用时，可以降级为通过编排者中转：

```
正常模式：
  Renderer ◄══ 直连 MessagePort ══► Utility
  延迟：~1ms

降级模式（direct port 不可用）：
  Renderer ──IPC──► Main ──process IPC──► Utility
  延迟：~5ms（但仍然可用！）
```

```typescript
interface DegradationConfig {
  /**
   * 是否启用降级（默认 true）
   * 启用后，当直连 port 断开时，自动切换为通过编排者中转
   */
  enableFallback: boolean
  
  /**
   * 降级触发条件
   * 'on_failure' — port 断开时立即降级
   * 'on_reconnect_failed' — 重连放弃后才降级
   */
  fallbackTrigger: 'on_failure' | 'on_reconnect_failed'
  
  /**
   * 降级恢复：重连成功后是否自动切回直连
   */
  autoRecover: boolean
}
```

**使用示例**：

```typescript
const orchestrator = new ElectronConnectionOrchestrator({
  degradation: {
    enableFallback: true,
    fallbackTrigger: 'on_failure',    // port 断开立即降级
    autoRecover: true,                // 重连成功后自动恢复
  }
})

// 对应用完全透明：
const result = await utilityClient.echo('hello')
// 如果直连可用 → 直连调用（~1ms）
// 如果直连断开 → 自动走 Main 中转（~5ms）
// 应用代码不需要改动！
```

#### Circuit Breaker 集成（借鉴 Opossum）

在重连策略之上，叠加 Circuit Breaker 来保护调用端：

```typescript
interface CircuitBreakerConfig {
  /** 是否启用熔断器（默认 false） */
  enabled: boolean
  
  /** 失败率阈值（默认 0.5，即 50%） */
  failureRateThreshold: number
  
  /** 最小样本量（默认 5 次调用后才评估） */
  volumeThreshold: number
  
  /** 滑动窗口大小（默认 10000ms） */
  rollingWindowMs: number
  
  /** OPEN 状态持续时间（默认 30000ms） */
  openDurationMs: number
  
  /** HALF_OPEN 状态允许的探测请求数（默认 3） */
  halfOpenRequests: number
  
  /** 降级函数（可选） */
  fallback?: (...args: any[]) => any
}
```

**Circuit Breaker 与 Connection State 的协同**：

```
Connection State:     READY          TRANSIENT_FAILURE       READY
                     ─────────       ──────────────────     ──────────
Circuit Breaker:     CLOSED → OPEN → HALF_OPEN → CLOSED
                     ─────    ────   ─────────   ──────

时间线：
  T0: 连接正常，熔断器 CLOSED
  T1: 调用开始频繁超时 → 熔断器 OPEN（快速失败）
  T2: 连接检测到 port 断开 → Connection TRANSIENT_FAILURE
  T3: 重连成功 → Connection READY
  T4: 熔断器 HALF_OPEN → 允许少量探测请求
  T5: 探测成功 → 熔断器 CLOSED，完全恢复
```

**组合使用**：

```typescript
const orchestrator = new ElectronConnectionOrchestrator({
  // 重连策略
  reconnectPolicy: new ExponentialBackoffPolicy({
    initialDelayMs: 1000,
    maxRetries: 10,
  }),
  
  // 熔断器
  circuitBreaker: {
    enabled: true,
    failureRateThreshold: 0.5,
    volumeThreshold: 5,
    openDurationMs: 30000,
  },
  
  // 降级
  degradation: {
    enableFallback: true,
    fallbackTrigger: 'on_failure',
  },
})
```

---

### 完整的 ConnectionOrchestrator 配置接口

```typescript
interface ConnectionOrchestratorConfig {
  // ── 状态跟踪 ──
  
  /** 心跳配置（默认关闭） */
  heartbeat?: HeartbeatConfig
  
  /** 请求超时配置 */
  requestTimeout?: RequestTimeoutConfig
  
  // ── 故障恢复 ──
  
  /** 重连策略（默认 ExponentialBackoffPolicy） */
  reconnectPolicy?: ReconnectPolicy
  
  /** 重连期间的请求处理行为 */
  pendingRequests?: PendingRequestBehavior
  
  // ── 降级保护 ──
  
  /** 降级配置 */
  degradation?: DegradationConfig
  
  /** 熔断器配置 */
  circuitBreaker?: CircuitBreakerConfig
  
  // ── 日志与诊断 ──
  
  /** 日志函数（默认 console.log） */
  logger?: (level: 'debug' | 'info' | 'warn' | 'error', message: string, data?: any) => void
  
  /** 是否启用统计收集（默认 false） */
  enableStats?: boolean
}
```

---

### 设计决策总结

| 决策点 | 我们的选择 | 借鉴来源 | 理由 |
|--------|----------|---------|------|
| 状态模型 | 6 状态 | gRPC (5) + SignalR (5) | 增加 DISCONNECTING 用于优雅关闭 |
| 状态查询 | getState() + waitForStateChange() | gRPC | 既支持轮询也支持等待 |
| 事件体系 | 丰富的事件 | Socket.IO + Opossum | 覆盖所有生命周期 |
| 重连策略 | IRetryPolicy 接口 | SignalR | 最灵活，支持自定义 |
| 退避算法 | 指数退避 + 抖动 | Socket.IO | 工业标准，防雷群效应 |
| 首次连接 | 不自动重试 | SignalR | 首次失败应快速报错 |
| 请求保护 | 超时 + 排队 | Penpal（反面） | 绝不让请求永远挂起 |
| 降级方案 | 直连 → 中转自动切换 | Circuit Breaker fallback | 对应用透明 |
| 熔断器 | 可选叠加 | Opossum | 保护调用端，防雪崩 |
| 健康指标 | Stats 对象 | Opossum Status | 监控和诊断 |

---

## 成本评估

### 方案 A：应用层 MainProcessConnection

| 项目 | 工作量 | 时间 |
|------|--------|------|
| 新增 MainProcessConnection 类 | 120 行 | 0.5d |
| 改造 main.ts | -92 行 | 0.3d |
| 改造 preload.ts | -53 行 | 0.3d |
| 改造 utility-worker.ts | -54 行 | 0.3d |
| 测试 | - | 0.2d |
| **总计** | **净 -79 行** | **1.5 天** |

**成果**：
- 业务代码减少 199 行
- 代码简化度：60-70%
- 用户体验提升：⭐⭐⭐⭐⭐

---

### 方案 B：框架层 BaseConnectionOrchestrator（推荐）

#### 第 1 阶段：提取框架层（2.5 天）

| 项目 | 代码量 | 时间 | 难度 |
|------|--------|------|------|
| BaseConnectionOrchestrator | 150 行 | 1d | ⭐⭐⭐ |
| 通用类型定义 | 50 行 | 0.3d | ⭐⭐ |
| ElectronConnectionOrchestrator | 30 行 | 0.3d | ⭐ |
| 测试 + 文档 | - | 0.9d | ⭐⭐ |
| **小计** | **230 行** | **2.5 天** | - |

#### 第 2 阶段：扩展到其他平台（1.5 天）

| 项目 | 代码量 | 时间 |
|------|--------|------|
| NodeConnectionOrchestrator | 30 行 | 0.5d |
| WebConnectionOrchestrator | 30 行 | 0.5d |
| 示例 + 测试 | - | 0.5d |
| **小计** | **60 行** | **1.5 天** |

#### 第 3 阶段：应用层改造（可选，1 天）

| 项目 | 改动 | 时间 |
|------|------|------|
| Electron 示例重写 | -120 行 | 0.5d |
| Node 示例创建 | 新增 | 0.3d |
| Web 示例创建 | 新增 | 0.2d |
| **小计** | - | **1 天** |

#### 总投入

```
框架层：2.5 天（一次性，为所有应用所用）
平台扩展：1.5 天（可选）
应用改造：1 天（每个应用 1-2 小时）
─────────
总计：5 天框架 + 1 天示例 = 6 天（一次性）
```

#### 长期收益

```
初始投入：6 人天

后续效益：
├─ 每个新应用节省：2-3 人天（无需手动处理 port/channel）
├─ Electron 生态：节省 2-3 人天 × N 个应用 = 2N-3N 人天
├─ Node.js 应用：节省 2 人天 × M 个应用 = 2M 人天
└─ Web 应用：节省 1 人天 × K 个应用 = K 人天

总节省：2(N+M+K)+3N = 5N + 2M + K 人天

假设 N=3（3 个 Electron 应用），M=2（2 个 Node 应用），K=2（2 个 Web 应用）：
总节省 = 15 + 4 + 2 = 21 人天

ROI = 21 / 6 = 3.5 倍
```

---

### 方案对比

| 维度 | 方案 A | 方案 B | 方案 C |
|------|--------|--------|--------|
| **框架改动** | 0 行 | 260 行 | 300 行 |
| **应用层改动** | 每个 120 行 | 各减 50% | 各减 60% |
| **前期投入** | 1.5d | 6d | 7d |
| **平台支持** | Electron 仅 | 全平台 | 全平台 |
| **代码复用** | 无 | 极高 | 极高 |
| **开源友好** | 否 | 是 | 是 |
| **用户体验** | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| **维护成本** | 中 | 低 | 低 |
| **推荐度** | ✅ 短期 | ✅⭐ 推荐 | 🤔 后续 |

---

## 实施路线图

### 推荐的三阶段方案

#### Phase 1（1.5 天）：应用层快速赢（Week 1）

**目标**：立即解决 Electron 应用的痛点

**任务**：
1. 创建 `MainProcessConnection` 类（apply）
2. 改造 `main.ts`、`preload.ts`、`utility-worker.ts`
3. 写简单的文档和示例
4. 验证 2 个现有 Electron 应用可以直接使用

**交付物**：
- 更新的 renderer-acquire-utility-port-example
- 更新的 utility-acquire-utility-port-example
- README 和最佳实践指南

**成果**：
- 业务代码减少 30-40%
- 用户体验显著提升
- 为 Phase 2 奠定基础

---

#### Phase 2（4-5 天）：框架化和多平台支持（Week 2-3）

**目标**：将经验总结成框架层的通用抽象

**任务**：
1. 在 `@x-oasis/async-call-rpc` 中创建 `BaseConnectionOrchestrator`
2. 实现 `ElectronConnectionOrchestrator`
3. 实现 `NodeConnectionOrchestrator`
4. 实现 `WebConnectionOrchestrator`
5. 编写全面的文档
6. 创建 3 个平台各 1 个完整示例

**交付物**：
```
packages/async/async-call-rpc/src/orchestrator/
├── BaseConnectionOrchestrator.ts
└── types.ts

packages/async/async-call-rpc-electron/src/
└── ElectronConnectionOrchestrator.ts

packages/async/async-call-rpc-node/src/
└── NodeConnectionOrchestrator.ts

packages/async/async-call-rpc-web/src/
└── WebConnectionOrchestrator.ts

examples/
├── electron-connection-orchestrator-example/
├── node-connection-orchestrator-example/
└── web-connection-orchestrator-example/
```

**成果**：
- 框架级的抽象
- 统一的 API
- 可以发布到开源
- 为生态用户服务

---

#### Phase 3（可选，1-2 天）：增强和优化（Week 4+）

**目标**：基于反馈的优化和扩展

**可选任务**：
1. 框架层支持 Port 生命周期（`onReady`、`isReady`）
2. 自动请求队列（channel 未就绪时自动排队）
3. 错误恢复和重连机制
4. 性能指标和诊断工具
5. React/Vue hooks 集成

**成果**：
- 生产级的可靠性
- 更好的开发体验
- 企业级功能

---

### 时间表

```
Week 1
├─ Day 1-2: MainProcessConnection 开发
├─ Day 3-4: 应用改造和测试
├─ Day 5: 文档和发布
└─ ✅ Phase 1 完成

Week 2-3
├─ Day 1-2: BaseConnectionOrchestrator
├─ Day 3-4: 各平台 Orchestrator 实现
├─ Day 5: 示例和测试
├─ Day 6: 文档
└─ ✅ Phase 2 完成

Week 4+（可选）
├─ Phase 3 逐步优化
└─ 收集生态反馈
```

---

## 意义评估

### Connection Orchestrator 的核心价值

#### 1. **抽象层次提升** ⭐⭐⭐⭐⭐

**当前**：用户需要理解 port、channel、service、late-binding 等概念
```typescript
// 需要理解 5 个概念
const port = await api.acquireUtilityPort()
const channel = new RPCMessageChannel()
channel.bindPort(port)
const client = clientHost.registerClient(...).createProxy()
await client.echo('test')
```

**改进后**：用户只需理解"连接"这一个概念
```typescript
// 只需理解 1 个概念
const client = await getConnectedClient()
await client.echo('test')
```

**意义**：大幅降低学习曲线，让更多开发者能使用 async-call-rpc

#### 2. **复杂性管理** ⭐⭐⭐⭐⭐

**当前**：端到端的复杂性
```
Main Process + Renderer + Utility = 300 行繁琐代码
N 个 Utility = 300 + 100N 行代码
```

**改进后**：把复杂性上移到框架层
```
Main Process 只需 20 行（调用 orchestrator）
Renderer/Utility 只需 10 行（接收激活）
N 个 Utility = 20 + 30N 行代码（减少 70%）
```

**意义**：应用开发者只需关注业务逻辑，不用处理框架细节

#### 3. **跨平台统一** ⭐⭐⭐⭐⭐

**当前**：Electron、Node、Web 各自实现
```
Electron → ElectronConnectionOrchestrator（自己写）
Node → NodeOrchestrator（自己写）
Web → WebOrchestrator（自己写）
```

**改进后**：框架提供，应用统一使用
```
Electron → import { ElectronConnectionOrchestrator }
Node → import { NodeConnectionOrchestrator }
Web → import { WebConnectionOrchestrator }

// API 完全相同
orchestrator.registerParticipant()
await orchestrator.connect()
```

**意义**：
- 团队成员在 Electron 和 Node 项目间切换时，学习曲线最小
- 代码模式一致，维护成本低
- 为混合应用（Electron main + Node 后端）提供统一的进程通信体验

#### 4. **生态扩展能力** ⭐⭐⭐⭐

**现有支持**：
- ✅ MessagePort（Electron、Node、Web）
- ✅ IPC（Electron）
- ✅ Process 通信（Node）

**未来可以支持**（一旦框架有了 Orchestrator）：
- 📌 WebSocket（Server ↔ Multiple Clients）
- 📌 HTTP/2 Server Push（Server ↔ Browser）
- 📌 gRPC（Microservices 编排）
- 📌 Message Queue（Async 消息通信）

**意义**：一套框架概念，可以适配多种通信协议

#### 5. **作为开源库的竞争力** ⭐⭐⭐⭐⭐

**当前问题**：
- ❌ 用户看到 RPC，但需要手动处理进程编排
- ❌ 学习成本高，示例复杂
- ❌ 不清楚如何在实际多进程应用中使用
- ❌ 与竞品（如 Tauri、Worker 框架）相比体验差

**改进后**：
- ✅ 用户看到进程编排框架，自带 RPC 能力
- ✅ 学习成本低，"连接两个进程"就完成了
- ✅ 可以直接用于生产环境（Electron、Node、Web）
- ✅ 竞争力显著提升

**意义**：从"RPC 库"升级为"进程编排框架"，市场定位更清晰，吸引力更强

#### 6. **代码质量和可维护性** ⭐⭐⭐⭐

**当前**：
- ❌ 大量重复代码（每个应用都要手写 Connection 逻辑）
- ❌ 易出错（late-binding、port 管理）
- ❌ 难诊断（日志分散）
- ❌ 难测试（集成点多）

**改进后**：
- ✅ 集中的编排逻辑（框架层实现）
- ✅ 标准化的激活流程（所有参与者相同）
- ✅ 统一的错误处理和日志
- ✅ 框架层可以提供完整的测试覆盖

**意义**：应用代码更简洁，更容易 review 和维护

---

### 对标分析

#### 对标 1：Tauri

Tauri 的进程编排：
```rust
// Tauri 中很容易在 Rust/JS 间通信
#[tauri::command]
fn my_custom_command(input: String) -> String {
  format!("JS said: {}", input)
}

// 前端直接调用
invoke('my_custom_command', { input: 'hello' })
```

**Tauri 的优势**：
- 开箱即用，无需手动处理通道
- API 简洁直观

**Async-Call-RPC 的改进**：
- 不仅支持主-从，还支持多对多（N:N）
- 类型安全的 TypeScript 支持
- 支持双向流、Transferable 等高级特性
- 框架无关（可用于任何多进程场景）

---

#### 对标 2：RustPython / CPython 的多进程通信

对比在进程间传输 Python 对象的复杂性，async-call-rpc 的改进让 JS 多进程通信简单很多。

---

### 战略意义

#### 短期（3-6 个月）

- 提升现有 Electron 应用的开发体验
- 建立最佳实践文档
- 在团队内部验证方案

#### 中期（6-12 个月）

- 支持 Node.js 和 Web Worker 场景
- 发布到 npm，获得社区反馈
- 建立完整的文档和示例生态

#### 长期（1-2 年）

- 成为 JS 多进程编排的**事实标准**
- 支持更多协议（WebSocket、gRPC）
- 集成到工程框架（Nextjs、Nuxt、Electron Forge）

---

## 对标和对比

### 与其他方案的对比

#### 对比 1：当前的手动方案 vs Connection Orchestrator

| 维度 | 手动方案 | Orchestrator |
|------|---------|-------------|
| **代码行数** | 300+ | 60+ |
| **概念数** | 10+ | 2 |
| **支持的场景** | 1-1 only | N:M |
| **跨平台复用** | 0% | 100% |
| **错误风险** | 高（late-binding） | 低 |
| **学习曲线** | 陡峭 | 平缓 |
| **维护成本** | 高 | 低 |

#### 对比 2：IPC invoke/handle vs Connection Orchestrator

**Electron 内置的 IPC**：
```typescript
// ipcMain.handle + ipcRenderer.invoke
ipcMain.handle('do-something', async (event, arg) => {
  return `result: ${arg}`
})

const result = await ipcRenderer.invoke('do-something', 'input')
```

**优点**：简单、开箱即用  
**缺点**：
- 只支持 Renderer ↔ Main
- 不支持 Utility ↔ Renderer 直连（需要 Main 中转）
- 不支持类型安全
- 不支持多个 Renderer 之间的通信

**Async-Call-RPC Connection Orchestrator**：
```typescript
// Connection Orchestrator
await orchestrator.connect('renderer', 'utility')
const utilityClient = await getConnectedClient()
const result = await utilityClient.doSomething('input')
```

**优点**：
- 支持任意两个进程直连
- 类型安全（可选）
- 支持 MessagePort 直接通信（无 Main 中转）
- 跨平台（Electron、Node、Web）

---

### 行业趋势

#### 1. **云原生的进程编排思想进入桌面应用**

Kubernetes 的 Service Discovery 和 Pod 编排思想，正在影响桌面应用的架构。Connection Orchestrator 是这一趋势在 JS 多进程领域的体现。

#### 2. **TypeScript 类型安全的重视**

随着 TypeScript 的普及，类型安全变成重要诉求。Async-Call-RPC 可以提供完整的泛型支持，让跨进程的调用也有类型检查。

#### 3. **WebWorker 的回归**

现代浏览器对 WebWorker 的支持越来越好，多进程 Web 应用变成可能。Connection Orchestrator 对 Web 的支持，正好抓住这一趋势。

---

## 总结和建议

### 最终推荐方案

**采用渐进式的三阶段方案**：

#### ✅ Phase 1（必做，1.5 天）
创建应用层的 `MainProcessConnection` 类，快速解决 Electron 应用的痛点。

**预期效果**：
- 业务代码简化 50%
- 立即可用
- 为 Phase 2 奠基

#### ✅ Phase 2（强烈推荐，4-5 天）
将 MainProcessConnection 框架化为 BaseConnectionOrchestrator，支持 Electron、Node、Web 三个平台。

**预期效果**：
- 统一的跨平台 API
- 代码复用最大化
- 可以作为开源库发布
- ROI 最高

#### 🤔 Phase 3（可选，后续迭代）
基于实际使用反馈，增加生产级的功能（重连、诊断、hooks 等）。

---

### 为什么 Connection Orchestrator 的抽象意义大

#### 1. **定义了一个新的编程模型**

从"我要使用 MessagePort"转变为"我要连接两个进程"——这是思维方式的升级。

#### 2. **解决了分布式系统的经典问题**

- **服务发现**：orchestrator 负责维护参与者的注册表
- **连接管理**：自动处理 port 创建、分发、激活
- **状态跟踪**：记录连接状态，提供查询接口
- **故障处理**：为未来的重连、降级等机制打基础

#### 3. **建立了多进程开发的最佳实践**

一套统一的模式，让开发者在不同平台、不同场景下都能遵循相同的原则。

#### 4. **为 JavaScript 多进程生态奠定基础**

就像 Docker 之于容器、Kubernetes 之于编排一样，Connection Orchestrator 可以成为 JS 多进程应用的标准抽象。

---

### 最终决定

**建议立即启动 Phase 1 和 Phase 2**，理由如下：

1. **前期投入合理**：6 天框架 + 1 天示例 = 1 周的工作量
2. **后期收益巨大**：每个应用节省 2-3 人天，3 个应用以上就能收回成本
3. **技术风险低**：改动内聚，不影响现有 RPC 框架功能
4. **战略意义大**：从"RPC 库"升级为"进程编排框架"，竞争力显著提升
5. **社区价值高**：可以成为开源项目的核心竞争力

---

## 附录

### 快速参考

#### Connection Orchestrator 核心 API

```typescript
// 创建编排器（平台特定）
const orchestrator = new ElectronConnectionOrchestrator()

// 注册参与者
orchestrator.registerParticipant(id, channel, type)

// 建立连接（核心方法）
await orchestrator.connect(fromId, toId, {
  fromServices: { /* 我提供的服务 */ },
  toServices: { /* 对方提供的服务 */ }
})

// 获取连接信息
const info = orchestrator.getConnectionInfo(participantId)

// 在参与者中获取 client
const client = await getConnectedClient(connectionId)
await client.methodName(args)
```

#### 支持的平台

| 平台 | Orchestrator | 状态 |
|------|-------------|------|
| Electron | ElectronConnectionOrchestrator | Phase 2 |
| Node.js | NodeConnectionOrchestrator | Phase 2 |
| Web Worker | WebConnectionOrchestrator | Phase 2 |
| WebSocket | (Future) | Phase 3+ |
| gRPC | (Future) | Phase 3+ |

---

**文档完成日期**：2026-05-07  
**下一步**：提交 RFC 或设计评审
