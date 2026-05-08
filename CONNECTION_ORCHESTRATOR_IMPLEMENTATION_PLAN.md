# Connection Orchestrator 实现计划

## Context

基于 `ASYNC_CALL_RPC_CONNECTION_ORCHESTRATOR.md` 设计文档，在现有 async-call-rpc 框架中实现完整的 Connection Orchestrator 层。这是 Layer 2 编排层，建立在 Layer 1 Channel 和 Layer 0 RPC 原语之上。目标是将当前 5 步手动连接仪式简化为 `orchestrator.connect(A, B)` 一行调用，并提供状态机、故障处理、重连、熔断、降级等企业级能力。

Orchestrator 不是独立项目，遵循已有 "基类在 core、平台实现在平台包" 的模式。

---

## Milestone 1: 核心类型与枚举

**目标**: 定义所有 TypeScript 类型、枚举、接口。纯类型声明，无运行时逻辑。

**新建文件**:
- `packages/async/async-call-rpc/src/orchestrator/ConnectionState.ts` — ConnectionState 枚举 (IDLE/CONNECTING/READY/TRANSIENT_FAILURE/DISCONNECTING/CLOSED) + `isValidTransition()` 状态转换校验函数
- `packages/async/async-call-rpc/src/orchestrator/types.ts` — 所有接口：ParticipantInfo, ConnectionConfig, ConnectionInfo (含 waitForStateChange), ConnectionEvents, ConnectionStats, HeartbeatConfig, RequestTimeoutConfig, ReconnectPolicy + RetryContext, PendingRequestBehavior, DegradationConfig, CircuitBreakerConfig, ConnectionOrchestratorConfig, PortPair, ActivationConfig
- `packages/async/async-call-rpc/src/orchestrator/index.ts` — barrel export

**修改文件**:
- `packages/async/async-call-rpc/src/index.ts` — 添加 `export * from './orchestrator'`

**测试**:
- `packages/async/async-call-rpc/test/orchestrator/ConnectionState.spec.ts` — 枚举值验证 + isValidTransition 合法/非法转换测试

**验证**: `cd packages/async/async-call-rpc && pnpm test && pnpm build`

---

## Milestone 2: 重连策略

**目标**: 实现 3 个内置重连策略类。纯函数，无框架依赖，可独立测试。

**新建文件**:
- `packages/async/async-call-rpc/src/orchestrator/policies/ExponentialBackoffPolicy.ts` — 指数退避 + 抖动，配置: initialDelayMs, maxDelayMs, multiplier, jitterFactor, maxRetries, maxElapsedMs
- `packages/async/async-call-rpc/src/orchestrator/policies/FixedDelayPolicy.ts` — 固定延迟序列
- `packages/async/async-call-rpc/src/orchestrator/policies/NeverReconnectPolicy.ts` — 永不重连
- `packages/async/async-call-rpc/src/orchestrator/policies/index.ts` — barrel export

**修改文件**:
- `packages/async/async-call-rpc/src/orchestrator/index.ts` — 添加 policies 导出

**测试**:
- `packages/async/async-call-rpc/test/orchestrator/policies.spec.ts` — 指数增长验证、maxDelay 封顶、抖动范围、maxRetries 返回 null、FixedDelay 序列耗尽返回 null、NeverReconnect 始终 null

**验证**: `cd packages/async/async-call-rpc && pnpm test`

---

## Milestone 3: 熔断器 + 连接统计

**目标**: 实现独立的 CircuitBreaker 状态机和 ConnectionStatsTracker。

**新建文件**:
- `packages/async/async-call-rpc/src/orchestrator/CircuitBreaker.ts` — CLOSED/OPEN/HALF_OPEN 三状态，滑动窗口失败率计算，recordSuccess/recordFailure/allowRequest/getState/reset
- `packages/async/async-call-rpc/src/orchestrator/ConnectionStatsTracker.ts` — 调用计数、延迟指标(avg/p99)、重连历史、窗口化失败率

**修改文件**:
- `packages/async/async-call-rpc/src/orchestrator/index.ts` — 添加导出

**测试**:
- `packages/async/async-call-rpc/test/orchestrator/CircuitBreaker.spec.ts` — CLOSED→OPEN (失败率超阈值)、volumeThreshold 保护、OPEN→HALF_OPEN (超时后)、HALF_OPEN→CLOSED (成功)、HALF_OPEN→OPEN (失败)、滑动窗口裁剪、reset
- `packages/async/async-call-rpc/test/orchestrator/ConnectionStatsTracker.spec.ts` — 计数、平均延迟、p99、窗口化失败率、reset

**验证**: `cd packages/async/async-call-rpc && pnpm test`

---

## Milestone 4: BaseConnectionOrchestrator 核心实现

**目标**: 实现抽象基类，包含状态机、参与者注册、connect/disconnect 生命周期、事件发射。这是最大的单个模块 (~400-500 行)。

**依赖**: Milestone 1, 2, 3

**新建文件**:
- `packages/async/async-call-rpc/src/orchestrator/BaseConnectionOrchestrator.ts`

**核心设计**:
```
class BaseConnectionOrchestrator extends Disposable {
  // 注册表
  participants: Map<string, ParticipantInfo>
  connections: Map<string, ManagedConnection>  // key: "${fromId}--${toId}"
  
  // 事件 (使用 @x-oasis/emitter Event)
  onStateChange, onReady, onDisconnected, onReconnecting, onReconnected, onReconnectFailed, onClosed
  
  // 抽象方法 (平台特定)
  abstract createPortPair(): PortPair
  abstract activateParticipant(id, config: ActivationConfig): Promise<void>
  
  // 公共 API
  registerParticipant(id, channel, type)
  unregisterParticipant(id)
  async connect(fromId, toId, config?): Promise<ConnectionInfo>
  async disconnect(connectionId): Promise<void>
  getConnectionInfo(fromId, toId?): ConnectionInfo | undefined
  getConnectionStats(connectionId): ConnectionStats | undefined
  
  // 内部
  transitionState(connectionId, newState, reason?)
  handleParticipantLost(participantId, reason)
  startHeartbeat / stopHeartbeat
  scheduleReconnect / cancelReconnect / attemptReconnect
  setupRelay / teardownRelay (降级)
  dispose()
}
```

**关键实现要点**:
- 每个 Connection 内部是 ManagedConnection 对象，持有 state、portPair、heartbeatTimer、reconnectTimer、circuitBreaker、statsTracker、stateChangeWaiters
- `transitionState()` 校验合法转换、更新状态、触发事件、resolve 等待的 waitForStateChange Deferred
- `connect()` 流程: 校验参与者存在 → IDLE→CONNECTING → createPortPair() → 并行 activateParticipant(from) + activateParticipant(to) → 成功则 READY，失败则 IDLE/TRANSIENT_FAILURE
- `waitForStateChange()` 基于 `@x-oasis/deferred`，支持 deadline 超时
- Orchestrator 使用自己的 RPCServiceHost/RPCClientHost 实例，不污染全局单例

**修改文件**:
- `packages/async/async-call-rpc/src/orchestrator/index.ts` — 添加导出

**测试**:
- `packages/async/async-call-rpc/test/orchestrator/BaseConnectionOrchestrator.spec.ts`
  - 使用 TestConnectionOrchestrator 子类 (用 Web MessageChannel mock)
  - 测试: registerParticipant 增删、connect 状态转换 IDLE→CONNECTING→READY、connect 失败回退、disconnect READY→DISCONNECTING→CLOSED、getConnectionInfo 返回正确状态、waitForStateChange 解析和超时、事件触发顺序、dispose 清理

**验证**: `cd packages/async/async-call-rpc && pnpm test`

---

## Milestone 5: 心跳 + 重连集成测试

**目标**: 验证心跳检测和重连循环在 BaseConnectionOrchestrator 中正确工作。使用 `vi.useFakeTimers()`。

**依赖**: Milestone 4

**新建文件**:
- `packages/async/async-call-rpc/test/orchestrator/heartbeat.spec.ts` — 心跳在 READY 后启动、DISCONNECTING 时停止、pong 超时触发 TRANSIENT_FAILURE、重连后恢复心跳、默认禁用
- `packages/async/async-call-rpc/test/orchestrator/reconnection.spec.ts` — TRANSIENT_FAILURE 触发重连调度、ExponentialBackoff 延迟递增、成功重连事件流 TRANSIENT_FAILURE→CONNECTING→READY + reconnected 事件、重试耗尽→CLOSED + reconnectFailed 事件、NeverReconnectPolicy 立即 CLOSED、手动 disconnect 取消重连
- `packages/async/async-call-rpc/test/orchestrator/circuit-breaker-integration.spec.ts` — 连续故障打开熔断器、超时后 HALF_OPEN、重连成功关闭熔断器

**验证**: `cd packages/async/async-call-rpc && pnpm test`

---

## Milestone 6: 平台 Orchestrator 实现

**目标**: 实现 Electron/Node/Web 三个平台子类。每个 ~30-80 行。

**依赖**: Milestone 4

### 6a: ElectronConnectionOrchestrator
- **新建**: `packages/async/async-call-rpc-electron/src/ElectronConnectionOrchestrator.ts`
  - `createPortPair()`: `new MessageChannelMain()` → `{ port1, port2 }`
  - `activateParticipant()`: 通过参与者的已有 channel 发送 port (Transferable)
- **修改**: `packages/async/async-call-rpc-electron/src/index.ts` — 添加导出
- **测试**: `packages/async/async-call-rpc-electron/test/ElectronConnectionOrchestrator.spec.ts`

### 6b: NodeConnectionOrchestrator
- **新建**: `packages/async/async-call-rpc-node/src/NodeMessagePortChannel.ts` — 包装 worker_threads MessagePort，支持 bindPort() 延迟绑定 (参照 ElectronMessagePortMainChannel 模式)
- **新建**: `packages/async/async-call-rpc-node/src/NodeConnectionOrchestrator.ts`
  - `createPortPair()`: `new (require('worker_threads').MessageChannel)()` → `{ port1, port2 }`
- **修改**: `packages/async/async-call-rpc-node/src/index.ts` — 添加导出
- **测试**: `packages/async/async-call-rpc-node/test/NodeMessagePortChannel.spec.ts` + `NodeConnectionOrchestrator.spec.ts`

### 6c: WebConnectionOrchestrator
- **新建**: `packages/async/async-call-rpc-web/src/WebConnectionOrchestrator.ts`
  - `createPortPair()`: `new MessageChannel()` → `{ port1, port2 }`
- **修改**: `packages/async/async-call-rpc-web/src/index.ts` — 添加导出
- **测试**: `packages/async/async-call-rpc-web/test/WebConnectionOrchestrator.spec.ts`

**验证**: 
```
cd packages/async/async-call-rpc-electron && pnpm test
cd packages/async/async-call-rpc-node && pnpm test
cd packages/async/async-call-rpc-web && pnpm test
```

---

## Milestone 7: 降级 + 端到端集成测试

**目标**: 实现降级 (直连端口→中继) 功能，写端到端集成测试。

**依赖**: Milestone 5, 6

**实现** (在 BaseConnectionOrchestrator.ts 中):
- `setupRelay(connectionId)`: 当 degradation 触发时，orchestrator 在自己到两个参与者的 channel 上注册转发服务，消息 A→orchestrator→B
- `teardownRelay(connectionId)`: autoRecover 时，重连成功后拆除中继

**新建文件**:
- `packages/async/async-call-rpc/test/orchestrator/degradation.spec.ts` — 降级触发条件 (on_failure / on_reconnect_failed)、中继建立验证、autoRecover 恢复直连、降级禁用时不建立中继
- `packages/async/async-call-rpc/test/orchestrator/integration.spec.ts` — 完整生命周期 register→connect→communicate→disconnect、多连接 A-B + A-C + B-C、连接恢复流程、stats 记录验证、dispose 清理无残留 timer

**验证**: `cd packages/async/async-call-rpc && pnpm test`

---

## Milestone 8: 示例 + 导出 + 构建验证

**目标**: 更新现有示例、确保所有包构建通过、导出完整。

**依赖**: 所有前置 Milestone

**任务**:
1. 更新 `packages/async/async-call-rpc-electron/examples/renderer-acquire-utility-port-example/` — 添加使用 ElectronConnectionOrchestrator 的简化版本 main.ts，对比展示
2. 确保所有包的 index.ts 导出完整
3. 全量构建验证: `pnpm turbo build`
4. 全量测试验证: `pnpm run -r test`
5. TypeScript 类型检查: `pnpm turbo check-types`

**验证**: 
```
pnpm turbo build    # 所有包构建通过
pnpm run -r test    # 所有测试通过
```

---

## 依赖图

```
M1 (类型/枚举)
 ├── M2 (重连策略) ──┐
 └── M3 (熔断器/统计) ┤
                      ├── M4 (BaseConnectionOrchestrator)
                      │    ├── M5 (心跳/重连测试)
                      │    └── M6 (平台 Orchestrator)
                      │         │
                      │         ├── M7 (降级 + 集成测试)
                      │         │
                      │         └── M8 (示例 + 构建)
```

M2 和 M3 可并行。M5 和 M6 可并行。关键路径: M1 → M3 → M4 → M7 → M8。

---

## 风险与缓解

| 风险 | 影响 | 缓解策略 |
|------|------|---------|
| activateParticipant 中 port 作为 Transferable 传输 | 高 | 现有框架已支持 TransferableArgsRequest，port 作为顶层参数传递而非嵌套在对象中 |
| 心跳需要双向 RPC | 中 | 定义 well-known 服务路径 `__orchestrator__`，参与者在 activateConnection 时自动注册 heartbeat handler |
| 降级中继复杂度 | 中 | 如果实现过于复杂，可将降级标记为 experimental，核心价值 (状态机+重连+心跳) 不依赖降级 |
| Timer 泄漏 | 低 | ManagedConnection 追踪所有 timer ID，dispose 统一清理，测试用 vi.getTimerCount() 验证 |

---

## 文件总览

### 新建 (~27 个文件)

**Core** (`packages/async/async-call-rpc/`):

| 文件 | Milestone |
|------|-----------|
| `src/orchestrator/ConnectionState.ts` | M1 |
| `src/orchestrator/types.ts` | M1 |
| `src/orchestrator/index.ts` | M1 |
| `src/orchestrator/policies/ExponentialBackoffPolicy.ts` | M2 |
| `src/orchestrator/policies/FixedDelayPolicy.ts` | M2 |
| `src/orchestrator/policies/NeverReconnectPolicy.ts` | M2 |
| `src/orchestrator/policies/index.ts` | M2 |
| `src/orchestrator/CircuitBreaker.ts` | M3 |
| `src/orchestrator/ConnectionStatsTracker.ts` | M3 |
| `src/orchestrator/BaseConnectionOrchestrator.ts` | M4 |
| `test/orchestrator/ConnectionState.spec.ts` | M1 |
| `test/orchestrator/policies.spec.ts` | M2 |
| `test/orchestrator/CircuitBreaker.spec.ts` | M3 |
| `test/orchestrator/ConnectionStatsTracker.spec.ts` | M3 |
| `test/orchestrator/BaseConnectionOrchestrator.spec.ts` | M4 |
| `test/orchestrator/heartbeat.spec.ts` | M5 |
| `test/orchestrator/reconnection.spec.ts` | M5 |
| `test/orchestrator/circuit-breaker-integration.spec.ts` | M5 |
| `test/orchestrator/integration.spec.ts` | M7 |
| `test/orchestrator/degradation.spec.ts` | M7 |

**Electron** (`packages/async/async-call-rpc-electron/`):

| 文件 | Milestone |
|------|-----------|
| `src/ElectronConnectionOrchestrator.ts` | M6 |
| `test/ElectronConnectionOrchestrator.spec.ts` | M6 |

**Node** (`packages/async/async-call-rpc-node/`):

| 文件 | Milestone |
|------|-----------|
| `src/NodeMessagePortChannel.ts` | M6 |
| `src/NodeConnectionOrchestrator.ts` | M6 |
| `test/NodeMessagePortChannel.spec.ts` | M6 |
| `test/NodeConnectionOrchestrator.spec.ts` | M6 |

**Web** (`packages/async/async-call-rpc-web/`):

| 文件 | Milestone |
|------|-----------|
| `src/WebConnectionOrchestrator.ts` | M6 |
| `test/WebConnectionOrchestrator.spec.ts` | M6 |

### 修改 (~4 个文件)

| 文件 | Milestone |
|------|-----------|
| `packages/async/async-call-rpc/src/index.ts` | M1 |
| `packages/async/async-call-rpc-electron/src/index.ts` | M6 |
| `packages/async/async-call-rpc-node/src/index.ts` | M6 |
| `packages/async/async-call-rpc-web/src/index.ts` | M6 |
