---
id: D-005
title: ConnectionOrchestrator CircuitBreaker 是空壳 — 只创建未消费的 dead code
description: >
  ConnectionOrchestratorConfig.circuitBreaker.enabled = true 会在 BaseConnectionOrchestrator
  里创建 CircuitBreaker 实例，但全代码库（除自身定义文件外）只有 mc.circuitBreaker?.reset()
  一处调用，allowRequest / recordSuccess / recordFailure / applyFallback 在 src 中 0 命中。
  本文定位 dead code 边界、解释结构性错位（orchestrator 不持有 RPC 调用栈）、
  给出最小可行的接入方案与 API 兼容性影响。
category: discussion
created: 2026-05-14
updated: 2026-05-15
tags: [orchestrator, circuit-breaker, resilience, dead-code, bug, api-design]
status: draft
references:
  - id: D-004
    rel: related-to
    file: ./20260514-utility-process-supervisor-rfc.md
    note: D-004 覆盖 spawn/replace lifecycle，本文覆盖 connect/heartbeat 的失败决策；二者互补
  - id: P-001
    rel: derives
    file: ../roadmap/20260515-orchestrator-sub-path-exports-plan.md
sources:
  - title: 'telegraph D-007: x-oasis 能力差距盘点 v2 — Gap G2'
    url: '../../../modules/ai/telegraph/codebase-wiki/discussion/20260514-x-oasis-capability-gaps-v2.md'
---

# ConnectionOrchestrator CircuitBreaker 是空壳 — 只创建未消费的 dead code

> 一句话结论：`circuitBreaker.enabled = true` 当前**无任何运行时副作用**，
> 配上去等于没配。这是一个 P0 的 API 误导问题，需要在 v0.7 之前要么把它接进
> connect/heartbeat 失败路径，要么从公开类型里删掉以避免下游误信。

## 1. 现象

### 1.1 配置项暴露

`packages/async/async-call-rpc/src/orchestrator/types.ts:315-330`：

```ts
export interface CircuitBreakerConfig {
  /** Default: false. */
  enabled: boolean;
  /** Failure-rate threshold to open the breaker (0–1). Default: 0.5. */
  failureRateThreshold: number;
  /** Minimum sample count before the threshold is evaluated. Default: 5. */
  volumeThreshold: number;
  /** Sliding-window duration in ms. Default: 10_000. */
  rollingWindowMs: number;
  /** How long the breaker stays OPEN before moving to HALF_OPEN. Default: 30_000. */
  openDurationMs: number;
  /** Number of probe requests allowed in HALF_OPEN state. Default: 3. */
  halfOpenRequests: number;
  /** Optional synchronous fallback when the breaker is open. */
  fallback?: (...args: any[]) => any;
}
```

类型注释（types.ts:345）甚至明确写：

```ts
/** Circuit breaker wrapping RPC calls. */
circuitBreaker?: CircuitBreakerConfig;
```

— "wrapping RPC calls" 是设计意图，但代码中并未实现。

### 1.2 实例创建（src 中唯一的"使用"）

`packages/async/async-call-rpc/src/orchestrator/BaseConnectionOrchestrator.ts:508-511`：

```ts
// Optionally attach circuit breaker and stats.
if (this.config.circuitBreaker?.enabled && !mc.circuitBreaker) {
  mc.circuitBreaker = new CircuitBreaker(this.config.circuitBreaker);
}
```

`BaseConnectionOrchestrator.ts:969`（reconnect success 路径中）：

```ts
mc.circuitBreaker?.reset();
```

### 1.3 dead code 证据 — 全仓 grep

```bash
$ rg "allowRequest|recordSuccess|recordFailure|applyFallback" \
     packages/async/ --type ts -g '!**/test/**' -g '!**/*.d.ts'

packages/async/async-call-rpc/src/orchestrator/CircuitBreaker.ts:79:  allowRequest(now = Date.now()): boolean {
packages/async/async-call-rpc/src/orchestrator/CircuitBreaker.ts:101:  recordSuccess(now = Date.now()): void {
packages/async/async-call-rpc/src/orchestrator/CircuitBreaker.ts:114:  recordFailure(now = Date.now()): void {
packages/async/async-call-rpc/src/orchestrator/CircuitBreaker.ts:162:  applyFallback(...args: any[]): any {
```

`allowRequest` / `recordSuccess` / `recordFailure` / `applyFallback` 在 src 中
**只在 CircuitBreaker.ts 自身定义处出现**，没有任何调用方。仅 test/ 目录里
`CircuitBreaker.spec.ts` 直接 new 了一个实例做单元测试。

```bash
$ rg "mc\.circuitBreaker|managed\.circuitBreaker" packages/async/ --type ts -g '!**/test/**'

BaseConnectionOrchestrator.ts:509:    if (this.config.circuitBreaker?.enabled && !mc.circuitBreaker) {
BaseConnectionOrchestrator.ts:510:      mc.circuitBreaker = new CircuitBreaker(this.config.circuitBreaker);
BaseConnectionOrchestrator.ts:969:    mc.circuitBreaker?.reset();
```

3 处全部是写或 reset，**没有一处读判定结果或上报失败**。

### 1.4 行为对照

| 用户期望（基于配置 + 注释）                     | 实际行为                                                                              |
| ----------------------------------------------- | ------------------------------------------------------------------------------------- |
| 失败率超阈值 → 进入 OPEN，后续 connect 快速失败 | OPEN 永远不会触发（`recordFailure` 不会被调用）                                       |
| HALF_OPEN 探测后恢复 → CLOSED                   | 永远停在 CLOSED                                                                       |
| `fallback` 在 OPEN 期间被调用                   | 永远不会被调用                                                                        |
| `reconnect` 成功后重置 breaker                  | ✅ 这一条**意外正确**（969 行 reset），但因为 breaker 永远是 CLOSED，reset 也是 no-op |

**净结果：开启 `circuitBreaker.enabled = true` 与不开启完全等价**。

## 2. 根因 — 结构性错位

### 2.1 orchestrator 不持有 RPC 调用栈

注释说 "wrapping RPC calls"，但 `BaseConnectionOrchestrator` **只管理 connection
lifecycle**（spawn/activate/heartbeat/reconnect/close），不持有任何 RPC 调用入口：

```bash
$ rg "getRpc|callService|invokeRemote|callRemote" \
     packages/async/async-call-rpc/src/orchestrator/BaseConnectionOrchestrator.ts
# (no matches)
```

RPC 实际通过每个 participant 自己持有的 `serviceHost` / `serviceClient` 直接走
port 收发（`activateParticipant` 把 port 交给 participant 后，orchestrator 就
退出 RPC 数据路径）。

### 2.2 因此 "wrapping RPC calls" 在当前架构下不可能实现

要在 orchestrator 层包 RPC，必须：

- (a) 让所有 participant 把 `callRemote` 委托给 orchestrator —— 需要重构所有
  下游 service host/client，破坏直连 port 性能优势；或
- (b) 在每个 service proxy 调用前后用 wrapper 主动咨询 breaker —— 需要把
  breaker 句柄漏给 service 层，违反分层。

两条路都很重，且 orchestrator 当前的边界（lifecycle only）反而是它的核心价值。

### 2.3 真正"orchestrator 能管"的失败有 2 类

但 orchestrator **完全有能力**记录另外两类失败信号，且这两类是 utility process
场景下最重要的：

| 失败类型               | 在哪发生                                                  | 当前是否能检测                                          |
| ---------------------- | --------------------------------------------------------- | ------------------------------------------------------- |
| **connect 失败**       | `_doConnect` 内 createPortPair / activateParticipant 抛错 | ✅ BaseConnectionOrchestrator.ts:524-534 已有 try/catch |
| **heartbeat 超时**     | `_sendHeartbeat` 超时触发 `_handleConnectionLost`         | ✅ BaseConnectionOrchestrator.ts:1031                   |
| RPC service-level 错误 | participant 内部 RPC 调用抛错                             | ❌ 不在 orchestrator 视野                               |

connect + heartbeat 失败信号本质上是**进程/通道级健康度**，正好就是
CircuitBreaker 这种连接级保护器要保护的对象。这才是真正合理的接入面。

## 3. 最小修复方案

### 3.1 接入面收敛 — 重新定义 "circuitBreaker"

把语义从 "wrapping RPC calls" 修正为 **"wrapping connection-level health
signals (connect + heartbeat)"**。

### 3.2 三处插入点

#### 3.2.1 connect 之前 — `allowRequest`

`BaseConnectionOrchestrator.ts:521-535` 当前：

```ts
try {
  await this._doConnect(mc, config, options);
} catch (err) {
  if (options.retryOnInitialFailure) {
    this._handleConnectionLost(
      mc,
      err instanceof Error ? err : new Error(String(err))
    );
  } else {
    throw err;
  }
}
```

改为：

```ts
// Circuit breaker gate — short-circuit if OPEN with no probe budget.
if (mc.circuitBreaker && !mc.circuitBreaker.allowRequest()) {
  if (this.config.circuitBreaker?.fallback) {
    return mc.circuitBreaker.applyFallback({ connectionId, fromId, toId });
  }
  throw new Error(
    `[CircuitBreaker] connect blocked: ${connectionId} breaker is ${mc.circuitBreaker.state}`
  );
}

try {
  await this._doConnect(mc, config, options);
  mc.circuitBreaker?.recordSuccess();
} catch (err) {
  mc.circuitBreaker?.recordFailure();
  if (options.retryOnInitialFailure) {
    this._handleConnectionLost(
      mc,
      err instanceof Error ? err : new Error(String(err))
    );
  } else {
    throw err;
  }
}
```

#### 3.2.2 heartbeat 失败 — `recordFailure`

`BaseConnectionOrchestrator.ts:1031` 附近的 `_sendHeartbeat` 超时 / pong 失败
路径增加：

```ts
mc.circuitBreaker?.recordFailure();
this._handleConnectionLost(mc, new Error('heartbeat timeout'));
```

heartbeat 成功的 ack 路径增加 `mc.circuitBreaker?.recordSuccess()`。

#### 3.2.3 reconnect 之前 — 复用 3.2.1 的 gate

`_scheduleReconnect` 内部最终也会调到 `_doConnect`（line 911-980 区间），3.2.1
的 gate 自然覆盖。reconnect 成功后的 `mc.circuitBreaker?.reset()`（已在 line
969）保留 —— 它现在终于会有可重置的状态。

### 3.3 行为变化

| 场景                     | 修复前                       | 修复后                                   |
| ------------------------ | ---------------------------- | ---------------------------------------- |
| utility process 反复崩溃 | 无穷无尽地 reconnect，吃 CPU | 失败率超阈值 → OPEN，30s 内不再尝试      |
| 探测期连续 N 次失败      | 仍然继续 reconnect           | HALF_OPEN 探测失败 → 回 OPEN             |
| 探测期连续 N 次成功      | 无                           | HALF_OPEN → CLOSED，恢复正常重连         |
| 用户配 `fallback`        | 永远不调用                   | OPEN 期间 connect 调用返回 fallback 结果 |

### 3.4 API 兼容性

- `CircuitBreakerConfig` 字段不变 —— 类型层零破坏
- `circuitBreaker.enabled` 默认 `false` —— 不改默认行为
- 原本错误地配 `enabled: true` 的下游会**真正生效** —— 行为变更，但既然原本是
  noop，"开始生效" 等价于回归到用户期望
- 新增可观测事件（可选）：`onCircuitBreakerOpened` / `onCircuitBreakerClosed`
  上报状态切换 —— 这部分作为后续 PR

## 4. 替代方案 — 如果不修

### 4.1 选项 A：删除公开 API

- 把 `CircuitBreakerConfig` 从 `ConnectionOrchestratorConfig` 移除
- 把 `CircuitBreaker` 类降为 internal（不 export）
- 释放出 "circuitBreaker" 这个名字给将来真正实现的版本

**代价**：semver major（公开类型变化）；下游可能已经基于 dead code 配过（虽然
反正不生效）。

### 4.2 选项 B：明确文档化 "not implemented"

types.ts 中加 `@deprecated [v0.6] Not consumed yet, see D-005`，但这等于在 API
里挂"小心地滑"标牌。**不推荐**。

### 4.3 选项 C（推荐）：实现 §3 的最小接入

工作量 ~50 LOC + 2 个新单测，无 API 破坏，dead code 转活码。

## 5. 测试矩阵

| 用例                                                           | 期望                                                                      |
| -------------------------------------------------------------- | ------------------------------------------------------------------------- |
| `enabled: false`（默认）                                       | 与当前完全一致，零行为差异                                                |
| `enabled: true` + `volumeThreshold=3` + 连续 3 次 connect 失败 | breaker → OPEN，第 4 次 connect 立即抛 `[CircuitBreaker] connect blocked` |
| OPEN 状态等待 `openDurationMs` 后 connect                      | breaker → HALF_OPEN，allow `halfOpenRequests` 次探测                      |
| HALF_OPEN 探测全部成功                                         | breaker → CLOSED，行为恢复                                                |
| HALF_OPEN 探测失败                                             | breaker → OPEN，重置计时                                                  |
| `fallback` 配置 + OPEN 状态 connect                            | 返回 fallback 结果，不抛错                                                |
| heartbeat timeout × N                                          | 累计到 breaker，与 connect 失败共用窗口                                   |

## 6. 与 D-004 的关系

| 议题       | D-004 (Supervisor)                       | D-005 (CircuitBreaker，本文)     |
| ---------- | ---------------------------------------- | -------------------------------- |
| 关心层面   | participant 进程 spawn / lifecycle       | connection 健康度判定            |
| 触发动作   | spawn / kill / replaceParticipantChannel | OPEN / HALF_OPEN / CLOSED        |
| 失败信号源 | utilityProcess `disconnect` / `exit`     | connect 异常 + heartbeat timeout |
| 是否互斥   | 否                                       | 否                               |

实际生产中应**同时启用**：Supervisor 负责"进程崩了重新拉起"，CircuitBreaker
负责"反复拉起反复崩 → 暂停一会儿别死循环"。两者形成 spawn-rate 限流闭环。

## 7. 结论 / 推动方向

- **立即**：把 D-005 标记为 P0，因为有下游（telegraph D-007 G2）已经报问题
- **v0.6.x 补丁**：实现 §3.2 的三处插入 + §5 的测试矩阵
- **v0.7**：补 onCircuitBreakerStateChanged 事件 + Inspector 中显示当前 breaker
  state（参考 D-001/D-002 中的 inspector 数据流）
- **拒绝**选项 B（文档化 "not implemented"）—— 它把问题留给下游
