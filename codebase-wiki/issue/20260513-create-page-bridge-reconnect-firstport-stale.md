---
id: I-004
title: createPageBridge reconnect 后 firstPort 不更新导致 RPC 无响应
description: >
  disconnect → connect 后，createPageBridge 的 firstPort 仍指向已关闭的旧 port，
  realChannel.bindPort 不被调用，新 port 消息无法送达，pagelet proxy 页面 send 后收不到 response。
category: issue
created: 2026-05-13
updated: 2026-05-13
tags:
  [createPageBridge, reconnect, firstPort, realChannel, bindPort, pagelet-proxy]
status: final
references:
  - id: I-002
    rel: related-to
    file: ./20260512-create-page-bridge-multi-port-routing.md
  - id: I-003
    rel: extends
    file: ./20260513-setting-window-rpc-three-bugs.md
---

# createPageBridge reconnect 后 firstPort 不更新导致 RPC 无响应

> disconnect → connect 后，createPageBridge 的 `firstPort` 仍指向已关闭的旧 port，
> `realChannel.bindPort()` 不被调用，新 port 上的消息无法送达，renderer 页面 send 后收不到 response。

## 现象（Symptoms）

在 `pagelet-proxy` 示例中：

1. 首次 Connect → Send → 能正常拿到 response
2. 点击 Disconnect → 再点击 Connect → Send → **收不到 response，请求挂起**

触发路径：Dashboard 面板 → Connect → Send RPC → Disconnect → Connect → Send RPC → 无响应

## 根因（Root Cause）

### 直接触发因

`createPageBridge.ts:116` 使用 `if (!firstPort)` 判断是否绑定 `realChannel`：

```typescript
// 修复前
if (!firstPort) {
  firstPort = port;
  realChannel.bindPort(port, { rebind: true });
}
```

`firstPort` 只在第一次 connect 时被赋值，disconnect 后不被清空。reconnect 时新 port 到达，`!firstPort` 为 `false`，导致：

1. `firstPort` 不更新 — 仍指向已关闭的旧 port
2. `realChannel.bindPort()` 不被调用 — channel 仍绑定旧 port
3. `ContextBridgeChannel`（page 侧）通过 `realChannel` 发送的消息全部发往已关闭的旧 port

### 数据流断裂分析

```
首次 connect:
  orchestrator → activateConnection → preload 收到 port1
  firstPort = port1  ✓
  realChannel.bindPort(port1)  ✓
  page → ContextBridgeChannel → bridge._send → servicePortMap → port1 → main-pagelet  ✓

disconnect:
  port1.close()  → port 已关闭
  firstPort 仍 = port1 (stale!)  ✗
  realChannel 仍绑定 port1 (stale!)  ✗

reconnect:
  orchestrator → activateConnection → preload 收到 port2
  !firstPort → false  → 跳过绑定
  firstPort 仍 = port1 (stale!)  ✗
  realChannel 仍绑定 port1 (stale!)  ✗
  page → ContextBridgeChannel → bridge._send → port1 (已关闭!) → 消息丢失  ✗
```

### 放大因

`firstPort` 同时影响 `getDefaultPort()` 的返回值（当未设置 `defaultPeerId` 时），因此 fallback 发送路径同样发往已关闭的旧 port。

## 时间线（Timeline）

1. **发现**：手动测试 pagelet-proxy 示例，disconnect → connect 后 send 无响应
2. **定位**：阅读 `createPageBridge.ts`，发现 `firstPort` 只赋值一次，reconnect 不更新
3. **修复**：将 `if (!firstPort)` 改为基于 `resolvedPeerId` 与 `defaultPeerId` 匹配的判断
4. **验证**：添加单测覆盖 reconnect 场景

## 修复动作（Changes Applied）

### 文件：`src/electron-browser/createPageBridge.ts:116-119`

**修复前**：

```typescript
if (!firstPort) {
  firstPort = port;
  realChannel.bindPort(port, { rebind: true });
}
```

**修复后**：

```typescript
const resolvedAsDefault =
  !defaultPeerId || (resolvedPeerId && resolvedPeerId === defaultPeerId);

if (resolvedAsDefault) {
  firstPort = port;
  realChannel.bindPort(port, { rebind: true });
}
```

**修复逻辑**：

- 当新 port 属于 default peer（即 `realChannel` 绑定的目标 peer）时，始终更新 `firstPort` 并调用 `realChannel.bindPort(port, { rebind: true })`
- `rebind: true` 确保 `_detachPort()` 关闭旧 port，`_attachPort()` 绑定新 port，`activate()` 恢复 channel
- 无 `defaultPeerId` 时，所有 port 都视为 default peer（与原 `!firstPort` 首次行为一致）
- 有 `defaultPeerId` 时，只有匹配 defaultPeerId 的 port 才绑定 `realChannel`（解决多 peer 场景下 firstPort 被"错误"的 peer 占据的问题）

## 验证方法（How to Verify）

1. 运行 pagelet-proxy 示例
2. Connect → Send → 确认收到 response
3. Disconnect → Connect → Send → **确认能收到 response**（修复前挂起）
4. 多次 Disconnect → Connect 循环，确认每次都能正常收发

单测验证：

```bash
npx vitest run packages/async/async-call-rpc-electron/test/createPageBridge.spec.ts
```

重点关注新增的 `firstPort should be updated on reconnect` 系列用例。

## Runbook（复发排查）

若再次出现 reconnect 后 send 无响应：

1. 检查 `createPageBridge.ts` 中 `firstPort` 赋值逻辑是否被回退为 `if (!firstPort)`
2. 检查 `realChannel.bindPort(port, { rebind: true })` 是否在 reconnect 路径上被调用
3. 在 preload 中添加日志：`registerOrchestratorHandler` 回调中打印 `firstPort` 引用与 `resolvedAsDefault` 判断
4. 检查 `getDefaultPort()` 返回的 port 是否为最新活跃 port
