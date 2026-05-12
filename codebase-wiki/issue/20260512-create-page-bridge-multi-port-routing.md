---
id: I-002
title: createPageBridge 多 port 路由导致 monitor / connection 服务互斥
description: >
  createPageBridge 原本只支持单个 MessagePort，每次收到新 port 会 close 旧 port，
  导致 renderer 同时连接 connection 和 monitor 两个 utility process 时服务互斥。
  排查涉及 servicePath 路由、connectionId peerId 解析、bridgePort fallback 等多个维度。
category: issue
created: 2026-05-12
updated: 2026-05-12
tags:
  [
    createPageBridge,
    multi-port,
    serviceRoutes,
    MessagePort,
    orchestrator,
    routing,
  ]
references:
  - id: D-003
    rel: related-to
    file: ./20260512-direct-channel-vs-ipc-channel-comparison.md
  - id: I-001
    rel: related-to
    file: ./20260510-async-call-rpc-electron-heartbeat-ping-bug.md
status: draft
---

# createPageBridge 多 port 路由导致 monitor / connection 服务互斥

## 现象

renderer 同时连接 connection 和 monitor 两个 utility process 时：

1. 两个服务**只能活一个**——monitor page 展示 performance 时，connection page 中 shared / daemon / main 调用报 `Method Not found`；反之亦然
2. 尝试为 monitor 创建独立 OrchestratorClient 时，`ContextBridgeChannel` 报 `__rpc_bridge___monitor not found on globalThis`
3. 尝试广播请求到所有 port 时，connection page 从 pending 无响应变为 `Method Not found`

## 根因

### 直接触发因：`createPageBridge` 只支持单 port

`createPageBridge.ts:55-75`（原始版本）中，`registerOrchestratorHandler` 每次收到新 port 都会 close 旧 port：

```typescript
// 原始逻辑
if (bridgePort) {
  try {
    bridgePort.close();
  } catch {}
}
bridgePort = port;
realChannel.bindPort(port, { rebind: true });
```

`orchestrator.connect(renderer, connection)` 和 `orchestrator.connect(renderer, monitor)` 先后触发 `activateConnection`，后者覆盖前者的 port，导致先注册的服务无法收发消息。

### 放大因：`realChannel` 只能绑定一个 port

`RPCMessageChannel.bindPort()` 在已有 port 时，除非 `{ rebind: true }`，否则直接 return。即使保留两个 port，`realChannel` 也只能绑定一个，另一个 port 的响应无法到达 `ContextBridgeChannel`。

### 辅助因：`connectionId` 的 peerId 解析错误

`connectionId` 格式为 canonical（字母序）：`connection--renderer`、`monitor--renderer`。初始实现用 `role === 'initiator' ? parts[1] : parts[0]` 解析 peerId，但 renderer 作为 `initiator` 时取到的是 `parts[1]` = `renderer`（自己），而非 peer。正确做法是从 connectionId 中**排除 renderer**：

```typescript
resolvedPeerId = parts[0] === 'renderer' ? parts[1] : parts[0];
```

## 时间线

| 步骤 | 尝试方案                                                                                    | 结果                                                                                                                                      |
| ---- | ------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| 1    | monitor 服务注册到 connection 进程的 PageletWorker                                          | 违反"monitor 必须运行在独立 utility process"的约束                                                                                        |
| 2    | 为 monitor 创建第二套 `createPageBridge` + `OrchestratorClient`（namespace 区分 bridgeKey） | `ContextBridgeChannel` 报 `__rpc_bridge___monitor not found`——bridgeKey 拼接不一致（`__rpc_bridge___monitor` vs `__rpc_bridge__monitor`） |
| 3    | 修复 bridgeKey 拼接一致                                                                     | preload 端 bridge 创建成功，但 renderer 仍找不到——第二个 `createPageBridge` 在同一 `contextBridge` 环境中可能存在隔离问题                 |
| 4    | 改 `createPageBridge` 支持多 port 共存，不再 close 旧 port                                  | monitor 工作，但 connection 报 `Method Not found`——`bridgePort` fallback 到了错误的 port                                                  |
| 5    | 加 `defaultPeerId: 'connection'` 控制默认 port                                              | monitor 失效——`realChannel` 未绑定任何 port 导致接收通路断开                                                                              |
| 6    | 加 `serviceRoutes: { 'monitor-pagelet-api': 'monitor' }` 显式路由                           | monitor 工作，但 connection 仍 `Method Not found`——首次请求时 `servicePortMap` 还没建立映射，fallback port 不对                           |
| 7    | 加 `serviceRoutes: { 'pagelet-api': 'connection', 'monitor-pagelet-api': 'monitor' }`       | connection 仍 `Method Not found`——`connectionId` 中 peerId 解析错误，`serviceRoutes` 没有正确匹配                                         |

## 最终修复

### 1. `createPageBridge` 支持多 port + servicePath 路由

**文件**：`packages/async/async-call-rpc-electron/src/electron-browser/createPageBridge.ts`

新增 `serviceRoutes` 和 `defaultPeerId` 选项：

```typescript
export interface CreatePageBridgeOptions {
  ipcRenderer: IpcRenderer;
  channelName: string;
  description?: string;
  serviceRoutes?: Record<string, string>; // servicePath → peerId
  defaultPeerId?: string; // 未匹配时的 fallback peerId
}
```

核心改动：

- **不再 close 旧 port**，所有 port 共存
- 每个 port 的消息都汇入 `messageHandlers`
- 收到消息时自动建立 `servicePath → port` 映射（`servicePortMap`）
- 从 `ctx.connectionId` 解析 peerId，配合 `serviceRoutes` 预填充路由
- 发送时按 `servicePath` 查 `servicePortMap`，未命中则走 `defaultPeerId` 对应的 port

### 2. peerId 解析修正

```typescript
// 错误：role 不决定 connectionId 中的位置
resolvedPeerId = ctx.role === 'initiator' ? parts[1] : parts[0];

// 正确：从 canonical connectionId 中排除 renderer
const parts = ctx.connectionId.split('--');
resolvedPeerId = parts[0] === 'renderer' ? parts[1] : parts[0];
```

### 3. preload 配置

**文件**：`examples/.../electron-browser/preload.ts`

```typescript
const bridge = createPageBridge({
  ipcRenderer,
  channelName,
  description: `${channelName} bridge`,
  serviceRoutes: {
    [PAGELET_SERVICE_PATH]: 'connection',
    [MONITOR_PAGELET_SERVICE_PATH]: 'monitor',
  },
  defaultPeerId: 'connection',
});
```

### 4. MonitorPageletWorker 改为 onConnection 模式

**文件**：`examples/.../monitor/application/node/MonitorPageletWorker.ts`

与 PageletWorker 同模式，在 `onConnection` 中通过直连 port 注册 `MONITOR_PAGELET_SERVICE_PATH`。

### 5. AppOrchestrator.connectMonitor

**文件**：`examples/.../pagelet-host/electron-main/AppOrchestrator.ts`

```typescript
async connectMonitor(): Promise<void> {
  const orchestrator = this.cpServer.getOrchestrator();
  await orchestrator.connect(RENDERER_PARTICIPANT_ID, 'monitor');
}
```

## 变更清单

| 文件                      | 改动                                                               |
| ------------------------- | ------------------------------------------------------------------ |
| `createPageBridge.ts`     | 多 port 共存 + `serviceRoutes` / `defaultPeerId` 路由              |
| `MonitorPageletWorker.ts` | `createParticipantProxy` + `onConnection` 注册服务                 |
| `MonitorApplication.ts`   | spawn monitor process + `connectMonitor()`                         |
| `AppOrchestrator.ts`      | 新增 `connectMonitor()`，删除 `registerMonitorProxyService()`      |
| `rpc-clients.ts`          | `monitorPageletClient` 改用 `client.getService()`（directChannel） |
| `preload.ts`              | 传入 `serviceRoutes` + `defaultPeerId`                             |

## 验证与回归

- [ ] connection page：shared / daemon / main 调用正常返回
- [ ] monitor page：performance 数据正常展示和刷新
- [ ] 重启后两个 page 均正常
- [ ] 模拟 connection process 退出后重连正常

**复发 runbook**：如果出现某服务 `Method Not found`，检查：

1. `serviceRoutes` 是否覆盖了该 servicePath
2. `servicePortMap` 是否正确建立映射（在 `bridge._send` 加 `console.log`）
3. `connectionId` 中 peerId 解析是否正确
