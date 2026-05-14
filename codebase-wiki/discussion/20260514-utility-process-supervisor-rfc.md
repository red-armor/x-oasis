---
id: D-004
title: UtilityProcessSupervisor RFC — Electron utility process 生命周期 + 透明换链
description: >
  为 @x-oasis/async-call-rpc-electron 引入 UtilityProcessSupervisor，
  统一封装 utilityProcess.fork → bindPort → registerParticipant 流程，
  并基于 replaceParticipantChannel + setKillOnDisconnect + ReconnectPolicy
  提供进程崩溃自愈能力。解决业务侧（telegraph 等）三处重复 spawn 实现 +
  无人调用 replaceParticipantChannel 的现状问题。
category: discussion
created: 2026-05-14
updated: 2026-05-14
tags: [orchestrator, utility-process, supervisor, lifecycle, replace-channel, electron]
status: draft
references:
  - id: D-001
    rel: related-to
    file: ./20260510-orchestrator-decentralized-connect.md
    note: connect 去中心化讨论中假设 participant 已存在，本文补齐 participant 生命周期管理
sources:
  - title: 'telegraph D-007: x-oasis 能力差距盘点 v2'
    url: '../../../modules/ai/telegraph/codebase-wiki/discussion/20260514-x-oasis-capability-gaps-v2.md'
---

# UtilityProcessSupervisor RFC — Electron utility process 生命周期 + 透明换链

> 提案为 `@x-oasis/async-call-rpc-electron` 引入 `UtilityProcessSupervisor`，
> 统一封装 utility process 从 spawn 到崩溃自愈的完整生命周期。
> 这是把 v0.5/v0.6 已交付的 `replaceParticipantChannel` + `setKillOnDisconnect` +
> `ReconnectPolicy` 三件能力**真正用起来**的执行层。

## 0. 背景

### 0.1 当前 x-oasis 已就绪能力

经过 v0.5–v0.6 演进，x-oasis 已交付以下 utility process 相关能力（详见
`packages/async/async-call-rpc/src/orchestrator/BaseConnectionOrchestrator.ts` /
`packages/async/async-call-rpc-electron/src/electron-main/`）：

| 能力 | API | 用途 |
|------|-----|------|
| 进程换链 | `orchestrator.replaceParticipantChannel(id, newChannel, opts)` | 进程崩溃后用新 channel 替换旧的，保留 participantId / 统计 / 订阅 |
| 防误杀 | `channel.setKillOnDisconnect(false)` | 换链时旧 channel disconnect 不会顺手 kill 子进程 |
| 重连策略 | `ExponentialBackoffPolicy` / `FixedDelayPolicy` / `NeverReconnectPolicy` | 配在 `ConnectionConfig.reconnectPolicy` 上，自动重连 |
| 首连超时与重试 | `ConnectOptions { activateTimeoutMs, retryOnInitialFailure }` | spawn 慢可控、首连失败自动进入重连流程 |
| Channel rebind | `channel.bindPort(port, { rebind: true })` | 换链场景下幂等绑定 |
| Channel 自动通知 | `registerParticipant` 内部 subscribe `onDidDisconnected` | 自动调用 `handleParticipantLost` |
| 默认 main setup | `setupMainOrchestrator(opts)` | 标准化 main 入口（但目前局限于单 orchestrator + 单 fromId/toId） |

### 0.2 真实使用情况：能力都有，没人用对

调研下游使用方（telegraph apps/）后发现：

```
$ rg "replaceParticipantChannel|setKillOnDisconnect|ExponentialBackoffPolicy" telegraph/apps/
0 matches
```

**典型反模式**（telegraph apps/daemon/electron-main/DaemonProcess.ts、
apps/shared/electron-main/SharedProcess.ts、packages/services/.../PageletProcess.ts
三处几乎一致）：

```typescript
// 业务侧手写 spawn
const child = utilityProcess.fork(entry, args);
const { port1, port2 } = new MessageChannelMain();
child.postMessage('init', [port2]);
const channel = new ElectronUtilityProcessChannel({ process: child });
orchestrator.registerParticipant(participantId, channel, 'utility');
// connect 时不传 reconnectPolicy → 永远不会自动重连
await orchestrator.connect('renderer', participantId, { activateTimeoutMs: 30_000 });

// child.on('exit') 完全没监听 → 崩溃直接丢
// 没人调用 replaceParticipantChannel → A-008 §5 透明换链不存在
```

### 0.3 根因分析

为什么"能力齐全但没人用"？

1. **API 是原子的，工作流是组合的**。`replaceParticipantChannel` 只是一个动作，
   "spawn 新进程 → 等就绪 → bindPort(rebind) → setKillOnDisconnect(false) on 旧 →
    replace → kill 旧" 这条链需要业务侧自己组装，且**任何一步出错都会泄露进程**。
2. **状态机散落**。supervisor 状态（idle / starting / running / restarting / failed）
   是隐式的——业务侧用一堆布尔标志拼，容易出现 race condition（spawn 完成前
   `child.on('exit')` 已触发等）。
3. **缺少标准范式**。`setupMainOrchestrator` 只覆盖了 main 端的 orchestrator 注册，
   没有覆盖 utility 进程的生命周期。telegraph 三个独立实现都在重新发明轮子。

### 0.4 目标

提供 `UtilityProcessSupervisor`，让业务侧：

```typescript
const daemon = new UtilityProcessSupervisor({
  orchestrator,
  participantId: 'daemon',
  entry: require.resolve('./daemon-worker.js'),
  restartPolicy: new ExponentialBackoffPolicy({ maxRetries: 5 }),
});
await daemon.start();
// ↑ 这一行包揽了 fork + bindPort + register + onExit 监听 + 自动 restart 全流程
```

并在子进程崩溃时自动：spawn 新进程 → wait ready → `replaceParticipantChannel` →
保留所有挂起调用、统计、订阅。

## 1. 设计

### 1.1 状态机

```
   ┌─────┐  start()  ┌──────────┐  ready  ┌─────────┐
   │ idle├──────────►│ starting ├────────►│ running │
   └─────┘           └────┬─────┘         └────┬────┘
       ▲                  │ timeout/error      │ child exit
       │                  ▼                    │
       │             ┌────────┐                │
       │             │ failed │◄───────────────┤
       │             └────────┘                │
       │                                       ▼
       │ stop()                       ┌──────────────┐
       └──────────────────────────────┤ restarting   │
                                      └──────┬───────┘
                                             │ ready (replace ok)
                                             └──────► running
```

转换规则：
- `idle → starting`：调用 `start()`
- `starting → running`：spawn 完成 + channel 已注册 + （可选）首个 connect ready
- `starting → failed`：spawn 失败 / 首连超时（且 `restartOnInitialFailure = false`）
- `running → restarting`：监听到 child exit，且 `restartPolicy` 未耗尽
- `restarting → running`：新进程 spawn 完成 + `replaceParticipantChannel` 成功
- `restarting → failed`：`restartPolicy.nextRetryDelayMs()` 返回 null
- `* → idle/closed`：调用 `stop()`

### 1.2 API

```typescript
// @x-oasis/async-call-rpc-electron
import {
  ElectronConnectionOrchestrator,
  ElectronUtilityProcessChannel,
} from '@x-oasis/async-call-rpc-electron';
import { ParticipantType, ReconnectPolicy } from '@x-oasis/async-call-rpc';

export interface UtilityProcessSupervisorOptions {
  /** 必填：注册到哪个 orchestrator */
  orchestrator: ElectronConnectionOrchestrator;

  /** 必填：该 utility 在 orchestrator 中的 participant ID（重启后保持不变） */
  participantId: string;

  /** 必填：utilityProcess.fork 入口路径（绝对路径） */
  entry: string;

  /** participant 角色，默认 'utility' */
  role?: ParticipantType;

  /** utilityProcess.fork 参数 */
  forkOptions?: {
    args?: string[];
    env?: Record<string, string>;
    serviceName?: string; // 为 ps/Activity Monitor 显示的进程名
  };

  /**
   * spawn 后等待 utility 端 readiness 信号的超时（默认 30_000）
   * "ready" 的判断方式由 readinessProbe 决定（见下）
   */
  startupTimeoutMs?: number;

  /**
   * 如何判定 utility 进程"已就绪"。三选一：
   *  - 'spawn'      : utilityProcess `spawn` 事件触发即视为 ready（最快，但不保证 worker 已 setup）
   *  - 'firstMessage': 收到 worker 的第一条 'message' 事件（业务侧 worker 在 setup 完成后 postMessage('ready')）
   *  - 自定义函数  : (channel) => Promise<void>
   * 默认 'spawn'
   */
  readinessProbe?: 'spawn' | 'firstMessage' | ((channel: ElectronUtilityProcessChannel) => Promise<void>);

  /**
   * child exit 后的重启策略，复用 ReconnectPolicy 抽象
   * 默认: NeverReconnectPolicy （崩溃即 failed，不自动重启）
   */
  restartPolicy?: ReconnectPolicy;

  /**
   * 是否在 supervisor 启动后立即尝试 spawn（默认 true）。
   * false 时由业务侧手动 start()
   */
  autoStart?: boolean;

  /** 日志 hook，默认 console */
  logger?: (level: 'debug' | 'info' | 'warn' | 'error', msg: string, data?: any) => void;

  /** spawn 完成时回调（每次 spawn 都会调用，包括 restart） */
  onSpawn?: (info: { pid: number; restartCount: number; reason?: string }) => void;

  /** 进程退出时回调（每次 exit 都会调用） */
  onExit?: (info: { pid: number; code: number | null; willRestart: boolean }) => void;
}

export type SupervisorState =
  | 'idle'
  | 'starting'
  | 'running'
  | 'restarting'
  | 'failed'
  | 'stopped';

export interface RestartHistoryEntry {
  at: number;
  pid: number;
  reason: string;
  exitCode: number | null;
  recoveredAt?: number; // 新进程 ready 的时间，未 ready 则 undefined
}

export class UtilityProcessSupervisor {
  constructor(opts: UtilityProcessSupervisorOptions);

  /** 当前状态 */
  readonly state: SupervisorState;

  /** 当前 child PID（running 时非 null） */
  readonly currentPid: number | null;

  /** 累计重启历史（最多 100 条 ring buffer，供 Inspector 消费） */
  readonly restartHistory: ReadonlyArray<RestartHistoryEntry>;

  /** 累计重启次数（含正在进行的） */
  readonly restartCount: number;

  /**
   * spawn → readiness probe → registerParticipant → 监听 disconnect。
   * 重复调用：idle → 走完整流程；其他状态 → throw。
   * 抛错场景：spawn 失败、startupTimeoutMs 超时、readinessProbe 失败
   */
  start(): Promise<void>;

  /**
   * 主动重启（不等 child exit）。等价于：
   *  1. 标记 oldChannel.setKillOnDisconnect(false)
   *  2. spawn 新 child + new channel
   *  3. 等 readinessProbe
   *  4. orchestrator.replaceParticipantChannel(id, newChannel, { autoReconnect: true })
   *  5. oldChild.kill()
   *
   * 任一步失败 → rollback：kill 新 child，oldChannel 恢复 killOnDisconnect=true，状态回 running
   */
  restart(reason?: string): Promise<void>;

  /**
   * 优雅停止：
   *  1. 取消 child exit 监听（避免触发自动 restart）
   *  2. orchestrator.unregisterParticipant(participantId)
   *  3. 若 channel 还活着，setKillOnDisconnect(true) → channel.disconnect()
   *  4. timeout 等待 child exit；超时则强 kill
   *  state → stopped（不可再 start）
   */
  stop(opts?: { gracefulTimeoutMs?: number }): Promise<void>;

  /** 状态变更事件订阅 */
  onStateChange(cb: (event: { previous: SupervisorState; current: SupervisorState; reason?: string }) => Disposable;
}
```

### 1.3 与现有 API 的协作

`UtilityProcessSupervisor` 不引入新协议，全部基于现有 API 编排：

```typescript
// supervisor 内部伪代码（restart 流程）
async restart(reason: string): Promise<void> {
  this._transition('restarting', reason);
  const oldChannel = this._currentChannel;
  const oldChild = this._currentChild;

  try {
    // 1. 防止 oldChannel disconnect 时杀掉旧进程（虽然我们等会要主动 kill，但顺序很重要）
    oldChannel.setKillOnDisconnect(false);

    // 2. spawn 新进程
    const newChild = utilityProcess.fork(this.opts.entry, this.opts.forkOptions?.args, {
      env: this.opts.forkOptions?.env,
      serviceName: this.opts.forkOptions?.serviceName,
    });

    // 3. wait readiness
    await this._probeReadiness(newChild);

    // 4. 创建新 channel
    const newChannel = new ElectronUtilityProcessChannel({
      process: newChild,
      description: `${this.opts.participantId} (restarted #${this._restartCount + 1})`,
    });

    // 5. 透明换链——这一步会自动触发所有 connection 的 TRANSIENT_FAILURE → CONNECTING → READY
    this.opts.orchestrator.replaceParticipantChannel(
      this.opts.participantId,
      newChannel,
      { autoReconnect: true }
    );

    // 6. 切换内部状态
    this._currentChild = newChild;
    this._currentChannel = newChannel;
    this._restartCount++;
    this._restartHistory.push({ at: Date.now(), pid: oldChild.pid, reason, exitCode: null });

    // 7. kill old
    oldChild.kill();

    // 8. 监听新 child 的 exit
    this._wireChildExitListener(newChild);

    this._transition('running');
  } catch (err) {
    // rollback
    oldChannel.setKillOnDisconnect(true); // 恢复
    this._transition('running'); // 旧的还活着
    throw err;
  }
}
```

### 1.4 readinessProbe 的设计权衡

| 选项 | 优点 | 缺点 | 适用场景 |
|------|------|------|----------|
| `'spawn'` | 最快，零 worker 侧改动 | 不保证 worker setup 完成，首次 RPC 可能失败 | 已经依赖 `activateTimeoutMs` + `retryOnInitialFailure` 的场景 |
| `'firstMessage'` | 简单可靠 | 需要 worker 侧 `process.parentPort.postMessage('ready')` | 推荐默认升级为此 |
| 自定义 fn | 灵活 | 业务自己写，不能保证一致 | 需要复杂握手（如等数据库初始化）的场景 |

**推荐**：默认提供 `'spawn'`（向后兼容），文档强烈推荐 `'firstMessage'`，并在 utility 端
提供配套 helper `signalReady()`（一行：`process.parentPort?.postMessage({ type: '__supervisor_ready__' })`）。

### 1.5 与 setupMainOrchestrator 的关系

`setupMainOrchestrator` 解决 main 侧 orchestrator + IPC channel 注册；
`UtilityProcessSupervisor` 解决 utility 侧的 spawn + lifecycle。两者正交，可独立使用，
也可组合：

```typescript
const { orchestrator } = await setupMainOrchestrator({ ipcChannel, ... });

const daemon = new UtilityProcessSupervisor({
  orchestrator,
  participantId: 'daemon',
  entry: ...,
  restartPolicy: new ExponentialBackoffPolicy(),
});
await daemon.start();
```

## 2. 边界与不做的事

### 2.1 不负责连接编排
Supervisor 只确保 participant 在 orchestrator 中**始终可用**——
"何时 connect" / "和谁 connect" / "断线如何 reconnect" 仍由业务侧调用 `orchestrator.connect()`
+ `ConnectionConfig.reconnectPolicy` 决定。

理由：connect 是业务语义（哪些 participant 之间该建直连是拓扑设计问题），
supervisor 不应越界。

### 2.2 不负责进程内 worker setup
`signalReady()` 之外的 worker 侧业务（DI 容器、service 注册等）依然由业务自己处理。

### 2.3 不解决"零中断升级"
重启窗口期内，**正在 in-flight 的 RPC 调用会**：
- `PendingRequestBehavior.onDisconnect = 'queue'` → 排队，restart 完成后重发
- `'reject'` → 立即 reject
- `'timeout'` → 等 `requestTimeout`

这是 orchestrator 现有契约，supervisor 不改变。

### 2.4 不强制 readiness 协议
`signalReady()` 是可选的；选 `readinessProbe: 'spawn'` 时完全无侵入。

## 3. 实现位置 & 包结构

```
packages/async/async-call-rpc-electron/src/electron-main/
  ├── UtilityProcessSupervisor.ts      ← 新增（主类 + 状态机）
  ├── supervisorReadinessProbe.ts      ← 新增（三种 probe 实现）
  └── index.ts                          ← 导出 UtilityProcessSupervisor + types

packages/async/async-call-rpc-electron/src/electron-browser/
  └── (无变化)

packages/async/async-call-rpc-electron/src/utility/   ← 新增子目录
  ├── signalReady.ts                    ← worker 侧 helper
  └── index.ts
```

新增导出（`@x-oasis/async-call-rpc-electron`）：

```typescript
// 主进程侧
export { UtilityProcessSupervisor } from './electron-main/UtilityProcessSupervisor';
export type {
  UtilityProcessSupervisorOptions,
  SupervisorState,
  RestartHistoryEntry,
} from './electron-main/UtilityProcessSupervisor';

// utility 进程侧
export { signalReady } from './utility/signalReady';
```

## 4. 测试矩阵

| 场景 | 期望 |
|------|------|
| `start()` 成功路径 | spawn → ready → registered → state=running |
| `start()` spawn 失败 | state=failed，throws |
| `start()` readinessProbe 超时 | child killed，state=failed，throws |
| `restart()` 成功路径 | new channel replaces old，挂起调用全部迁移成功，旧 child killed |
| `restart()` 新 spawn 失败 | rollback：state=running，旧 channel + child 不变 |
| `restart()` 新 ready 但 replaceParticipantChannel 抛错 | rollback：新 child killed，state=running |
| 自动 restart：child exit + restartPolicy 允许 | state=restarting → running，restartHistory +1 |
| 自动 restart：child exit + restartPolicy 拒绝 | state=failed，停止重试 |
| `stop()` running 状态 | unregister + 优雅 kill，state=stopped |
| `stop()` restarting 状态 | 取消 restart 计划，kill 新旧两个 child |
| 并发 `restart()` | 后续调用 reject 或排队（默认排队） |
| `restart()` 期间发起 `stop()` | stop 优先：取消 restart，state=stopped |
| Per-connection 统计在 restart 后保留 | ConnectionStats.totalReconnects 递增，但 totalRpcCalls 不重置 |

## 5. 迁移路径（telegraph 视角）

下游案例：`telegraph/apps/daemon/electron-main/DaemonProcess.ts`、
`telegraph/apps/shared/electron-main/SharedProcess.ts`、
`telegraph/packages/services/.../PageletProcess.ts` 三处可统一替换为 supervisor 调用。
预计每处删除 ~80 行手写 spawn / register / cleanup 代码。

详见 telegraph 仓库 D-007（x-oasis 能力差距盘点 v2）"第二波改造"章节。

## 6. 开放问题

1. **多 utility 进程共享 supervisor？**
   场景：telegraph PageletProcess 一个类管理多个 pagelet utility（design / monitor / connection）。
   需要 `UtilityProcessSupervisorPool`（管理一组 supervisor）还是让业务自己 `Map<id, supervisor>`？
   倾向后者——pool 不增加抽象价值，只增加 surface。

2. **跨进程 supervisor 状态查询？**
   Inspector 需要从 main 之外的进程（比如 daemon）查询 supervisor 状态。
   当前设计 supervisor 只活在 main，要查只能通过 RPC service 暴露。
   是否在 supervisor 上提供 `attachToService(host, path)` 一行注册的便利？

3. **readinessProbe='firstMessage' 的协议命名空间**
   建议固定使用 `{ type: '__supervisor_ready__' }`，与未来可能的其他控制消息（如
   graceful shutdown ack）共享命名空间 `__supervisor_*`。需先约定，避免业务 worker 误用。

4. **是否引入 supervisor-level event API？**
   当前只 `onStateChange`。是否需要 `onRestart` / `onCrash` 单独事件？
   倾向不加——`onStateChange` 足够，复杂场景看 restartHistory。

## 7. 接收意见

请 review 后在 PR / wiki 评论中针对以下点反馈：
1. API 命名（Supervisor vs Manager vs Lifecycle）
2. readinessProbe 默认值（'spawn' vs 'firstMessage'）
3. restart rollback 策略是否需要可配置
4. 第 6 节开放问题
