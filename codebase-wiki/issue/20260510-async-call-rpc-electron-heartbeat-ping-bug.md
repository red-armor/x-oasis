---
id: I-001
title: async-call-rpc-electron 心跳 ping 失败导致连接断开
description: 修复 createPageBridge 中 RPC 消息解析错误，导致心跳 ping 被错误转发到 renderer 进程
category: issue
status: fixed
created: 2026-05-10
updated: 2026-05-10
tags:
  - async-call-rpc-electron
  - heartbeat
  - IPC
  - message-routing
  - bug-fix
sources:
  - path: /packages/async/async-call-rpc-electron/src/electron-browser/createPageBridge.ts
    lines: 1-100
  - path: /packages/async/async-call-rpc/src/orchestrator/BaseConnectionOrchestrator.ts
    lines: 990-1050
references:
  - rel: related_to
    id: A-001
    title: async-call-rpc-electron 架构设计
  - rel: implements
    id: R-001
    title: RPC 消息线路格式规范
---

## 现象

在 `page-acquire-renderer-port-orchestrator-example` 示例中，orchestrator 连接建立约 10 秒后会频繁断开重连：

**表现：**

- 连接成功建立（状态：READY）
- ~10 秒后：心跳超时
- 日志：`[heartbeat] ping rejected from renderer: RPCError: Method not found`
- 状态转换：`READY → TRANSIENT_FAILURE → 重连`
- 循环周期：每 ~10 秒（心跳间隔）重复一次

**影响：** 连接不稳定，无法用于 renderer 和 utility 进程间的实时通信。

## 根因

### 直接触发因

`createPageBridge.ts` 中的 `getServicePath()` 函数有数组访问错误：

```typescript
// 错误代码
function getServicePath(data: unknown): string | undefined {
  if (typeof data === 'string') {
    try {
      data = JSON.parse(data);
    } catch {
      return undefined;
    }
  }
  if (!Array.isArray(data) || !Array.isArray(data[0])) return undefined;
  const entry = data[0];
  if (!Array.isArray(entry[0])) return undefined; // ❌ entry[0] 是 number，不是数组！
  return entry[0][2]; // ❌ 永远到不了这一行
}
```

**问题分析：**

RPC 消息线路格式：`[[type, seqId, requestPath, methodName], body]`

- `data[0]` = `[type, seqId, requestPath, methodName]` ✓ (是数组)
- `entry = data[0]` = `[type, seqId, requestPath, methodName]` ✓
- `entry[0]` = `type` ✗ (**是数字**，不是数组！)
- 条件 `!Array.isArray(entry[0])` 永远为真
- 函数始终返回 `undefined`，而不是 `requestPath`

### 放大因

消息路由失败导致的级联效应：

1. Main process 发送 ping：`makeRequest(ORCHESTRATOR_SERVICE_PATH, 'ping')`
2. Preload 通过 `ipcRenderer.on('app-rpc')` 接收 ping
3. `createPageBridge` 的 bridge callback 调用 `getServicePath(pingRequest)` → 返回 `undefined`
4. Ping 未被过滤，转发到 renderer process
5. Renderer 的 `ipcPageChannel` 接收 ping 请求
6. Renderer 没有 ping 的 handler → 返回 "Method not found"
7. Main process 收到错误响应 → `ping` Deferred 被 reject
8. 心跳超时 → 连接标记为 `TRANSIENT_FAILURE`
9. 重连周期开始，问题重复

### 辅助因

`BaseConnectionOrchestrator` 中的 `_stopHeartbeat()` 方法是 `private`，无法在子类中覆盖。为了支持在 `ElectronConnectionOrchestrator` 中正确清理心跳任务，需要改为 `protected`。

## 修复

### 位置与变更

**文件 1：`packages/async/async-call-rpc-electron/src/electron-browser/createPageBridge.ts`**

```typescript
// 修复后的代码
function getServicePath(data: unknown): string | undefined {
  if (typeof data === 'string') {
    try {
      data = JSON.parse(data);
    } catch {
      return undefined;
    }
  }
  // 线路格式：[[type, seqId, requestPath, methodName], body]
  // header = data[0] = [type, seqId, requestPath, methodName]
  // requestPath 是 header 数组的第 2 个索引
  if (!Array.isArray(data) || !Array.isArray(data[0])) return undefined;
  const header = data[0]; // [type, seqId, requestPath, methodName]
  return typeof header[2] === 'string' ? header[2] : undefined;
}
```

**关键改动：**

- 正确访问 `header[2]`（`requestPath` 元素），而不是试图访问 `entry[0][2]`
- 增加澄清注释说明线路格式
- 添加类型检查 `typeof header[2] === 'string'` 验证提取的值

**文件 2：`packages/async/async-call-rpc/src/orchestrator/BaseConnectionOrchestrator.ts`**

将 `_stopHeartbeat()` 从 `private` 改为 `protected`（约第 999 行）：

```typescript
// 改前
private _stopHeartbeat(): void { ... }

// 改后
protected _stopHeartbeat(): void { ... }
```

## 验证与回归

### 修复前

```
[main] initial connection state: READY
[utility] direct RPC to renderer: greeting from page: hello from utility via direct port
[heartbeat] sending ping to renderer, channel connected=true
[heartbeat] sending ping to utility, channel connected=true
[heartbeat] ping rejected from renderer: RPCError: Method not found  ❌
[heartbeat] pong received from utility: pong  ✓
[orchestrator:warn] [Orchestrator] heartbeat timeout: renderer--utility
[orchestrator:debug] [Orchestrator] [renderer--utility] READY → TRANSIENT_FAILURE
```

### 修复后

```
[main] initial connection state: READY
[utility] direct RPC to renderer: greeting from page: hello from utility via direct port
[heartbeat] sending ping to renderer, channel connected=true
[heartbeat] sending ping to utility, channel connected=true
[heartbeat] pong received from renderer: pong  ✓
[heartbeat] pong received from utility: pong  ✓
(无断开，稳定运行)
```

**测试结果：**

- 使用 `page-acquire-renderer-port-orchestrator-example` 验证
- 连续运行 30+ 秒跨越多个心跳周期（10 秒间隔）
- 心跳始终成功，无异常断开或重连
- 符合预期：ping/pong 每 10 秒按时进行，连接保持 READY 状态

### 复现步骤（如需回归）

1. 在仓库根目录构建项目：`pnpm install && pnpm run build`
2. 进入示例目录：`cd packages/async/async-call-rpc-electron/examples/page-acquire-renderer-port-orchestrator-example`
3. 启动示例应用：`node main.ts`
4. 观察日志输出（应无 heartbeat 超时错误）
5. 运行 30+ 秒，确认连接保持 READY 状态

## 时间线

| 时间       | 事件                                                                      |
| ---------- | ------------------------------------------------------------------------- |
| 2026-05-10 | 发现问题：orchestrator 连接不稳定                                         |
| 2026-05-10 | 添加调试日志：确认 ping 被拒绝                                            |
| 2026-05-10 | 排查消息路由：发现 main 进程报 "Method not found"                         |
| 2026-05-10 | 根因定位：`getServicePath()` 数组访问错误                                 |
| 2026-05-10 | 实施修复：修正 header 访问逻辑                                            |
| 2026-05-10 | 验证通过：30+ 秒稳定运行测试                                              |
| 2026-05-10 | 代码提交：`fix: resolve heartbeat timeout bug in async-call-rpc-electron` |

## 涉及代码

### 关键文件

- **src/electron-browser/createPageBridge.ts:1-100** — Bridge 创建和消息过滤
- **src/orchestrator/BaseConnectionOrchestrator.ts:990-1050** — 心跳管理
- **examples/page-acquire-renderer-port-orchestrator-example/main.ts** — 测试示例

### 相关导入

```typescript
// 如需理解 RPC 消息格式
import type { RPC } from '@x-oasis/async-call-rpc';
import { AbstractChannelProtocol } from '@x-oasis/async-call-rpc';

// 如需调试心跳
import { BaseConnectionOrchestrator } from '@x-oasis/async-call-rpc';
```

## Runbook（如果复发）

若再次出现相似的 heartbeat 超时问题，检查清单：

1. **检查日志：** 是否出现 `ping rejected from renderer: RPCError: Method not found`
2. **追踪消息：** 在 `createPageBridge` 的 bridge callback 中添加日志，验证 `getServicePath()` 返回值
3. **验证格式：** 确认 RPC 消息仍按 `[[type, seqId, requestPath, methodName], body]` 格式
4. **检查继承：** 若有新的 Orchestrator 子类，确保 `_stopHeartbeat()` 能正确调用（需为 `protected` 或 `public`）
5. **回归测试：** 使用 `page-acquire-renderer-port-orchestrator-example` 运行 30+ 秒观察

---

## 来源

- [createPageBridge.ts](../../../packages/async/async-call-rpc-electron/src/electron-browser/createPageBridge.ts)
- [BaseConnectionOrchestrator.ts](../../../packages/async/async-call-rpc/src/orchestrator/BaseConnectionOrchestrator.ts)
- [提交详情](https://code.devops.xiaohongshu.com/ee/x-oasis/-/commit/0a89b07)
