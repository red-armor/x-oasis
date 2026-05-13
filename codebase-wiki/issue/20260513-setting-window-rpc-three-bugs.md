---
id: I-003
title: Setting 独立窗口 RPC 三连故障：preload chunks、service 路由、reconnect port 映射
description: >
  在 multi-page-router-di 示例中为 Setting 添加独立窗口时，连续遇到三个故障：
  Electron sandbox 无法加载 preload chunks、createPageBridge peer ID heuristic 导致 servicePortMap 路由失败、
  以及 reconnect 后 servicePortMap 不更新映射指向已关闭的旧 port。
category: issue
created: 2026-05-13
updated: 2026-05-13
tags:
  [
    electron,
    sandbox,
    preload,
    createPageBridge,
    servicePortMap,
    orchestrator,
    reconnect,
    setting-window,
  ]
status: final
references:
  - id: I-002
    rel: related-to
    file: ./20260512-create-page-bridge-multi-port-routing.md
  - id: D-002
    rel: related-to
    file: ../discussion/20260511-multi-page-routing-pagelet-proxy.md
  - id: D-003
    rel: related-to
    file: ../discussion/20260512-direct-channel-vs-ipc-channel-comparison.md
  - id: I-004
    rel: extended-by
    file: ./20260513-create-page-bridge-reconnect-firstport-stale.md
---

# Setting 独立窗口 RPC 三连故障：preload chunks、service 路由、reconnect port 映射

> 在 multi-page-router-di 示例中为 Setting 添加独立窗口时，连续遇到三个故障。
> 本文记录每个故障的现象、根因和修复动作。

## 现象（Symptoms）

### Bug 1：Preload Script 加载失败

应用启动后 DevTools 控制台报错：

```
Unable to load preload script: .../out/preload/preload.js
Error: module not found: ./chunks/index-CvUb_Cfz.js
```

`preloadRequire` 在 Electron sandbox 环境中无法解析 `./chunks/` 子目录路径。

### Bug 2：Setting 窗口 Connect 后 function call 无响应

Setting 窗口打开后自动 Connect 成功（状态显示 READY），但点击 Get Config / Echo 等按钮，
返回 `shared not ready` / `daemon not ready`——RPC 请求未到达 setting-worker。

后台日志：

```
setting-worker] boot failed: [RPCError]: [Orchestrator] Unknown participant: "setting"
```

### Bug 3：Disconnect → Connect 后 function call 不再正常返回

首次 Connect 后 function call 正常工作，但执行 Disconnect 再 Connect 后，
所有 function call 都无响应，请求挂起或超时。

## 根因（Root Cause）

### Bug 1：Preload chunks 无法在 Electron sandbox 中加载

**直接触发因**：`electron.vite.config.ts` 中 preload 构建配置 `inlineDynamicImports: false`，
两个 preload 入口（`preload.ts` 和 `setting-preload.ts`）共享代码，
rollup 将公共依赖提取为 `chunks/index-CvUb_Cfz.js`。

**放大因**：Electron sandbox 环境的 `preloadRequire` 只能在 preload 脚本同级目录查找模块，
无法解析 `./chunks/` 子目录路径。

### Bug 2：createPageBridge 的 peer ID heuristic 与非标准 participant ID 不兼容

**直接触发因**：`createPageBridge.ts:86` 硬编码 heuristic：

```typescript
resolvedPeerId = parts[0] === 'renderer' ? parts[1] : parts[0];
```

Setting 窗口注册为 `'setting-renderer'`，connectionId 为 `'setting-renderer--setting'`，
解析出 `resolvedPeerId = 'setting-renderer'` 而非 `'setting'`。

**放大因**：`servicePortMap` 的 key 是 `servicePath`，映射的 port 取决于 `resolvedPeerId` 是否匹配
`serviceRoutes` 中的 `peerId`。由于 `resolvedPeerId` 为 `'setting-renderer'`，
不匹配 `SETTING_PARTICIPANT_ID`（`'setting'`），所有 service 路由映射失败。

**辅助因**：setting-worker 试图通过主 orchestrator 连接 shared/daemon，
但 setting 参与者只注册在 settingOrchestrator 上，主 orchestrator 找不到 `'setting'`。

### Bug 3：servicePortMap 首次写入后不更新

**直接触发因**：`createPageBridge.ts:96` 和 `:108` 两处条件 `!servicePortMap.has(servicePath)`，
只在首次添加时写入映射，后续 reconnect 不会更新。

**放大因**：disconnect 后旧 MessagePort 关闭，reconnect 时 orchestrator 分发新 port，
但 `servicePortMap` 仍指向已关闭的旧 port，`bridge._send` 向死端口发送数据。

## 时间线（Timeline）

| 节点    | 时间 | 事件                                                                               |
| ------- | ---- | ---------------------------------------------------------------------------------- |
| 发现    | T0   | 应用启动报 preload chunks 加载失败                                                 |
| 修复 1  | T1   | 将每个 preload 改为独立构建（`inlineDynamicImports: true` + lib 模式）             |
| 发现    | T2   | Setting 窗口 Connect 后 function call 返回 "not ready"                             |
| 排查    | T3   | 追踪 createPageBridge peer ID 解析逻辑，发现 `'setting-renderer'` 不匹配 heuristic |
| 修复 2  | T4   | 引入独立 `ElectronConnectionOrchestrator`，Setting 窗口注册为 `'renderer'`         |
| 发现    | T5   | setting-worker boot 失败：Unknown participant "setting"                            |
| 修复 2b | T6   | setting utility process 同时注册到主 orchestrator 和 settingOrchestrator           |
| 发现    | T7   | Disconnect → Connect 后 function call 不再返回                                     |
| 排查    | T8   | 检查 createPageBridge 源码，发现 `!servicePortMap.has()` 条件阻止映射更新          |
| 修复 3  | T9   | 移除 `!servicePortMap.has()` 条件，允许 reconnect 时覆盖旧映射                     |

## 修复动作（Changes Applied）

### Bug 1 修复：Preload 独立构建

**文件**：`multi-page-router-di/electron.vite.config.ts`

**改动**：

- 主 preload 保留单一入口，`inlineDynamicImports: true`，确保无共享 chunks
- setting-preload 改用 lib 模式独立构建（在 `closeBundle` 钩子中通过 `vite.build()` 执行）
- 插件重命名为 `build-extra-preloads-and-workers`，先构建 extra preloads 再构建 workers

```typescript
preload: {
  build: {
    rollupOptions: {
      input: {
        preload: resolve(__dirname, 'src/apps/main/application/electron-browser/preload.ts'),
      },
      output: { format: 'cjs', inlineDynamicImports: true },
    },
  },
  plugins: [{
    name: 'build-extra-preloads-and-workers',
    async closeBundle() {
      // 先构建 extra preloads（独立 lib 模式）
      for (const p of extraPreloads) { await build({ ... lib ... }); }
      // 再构建 workers
      for (const w of workers) { await build({ ... lib ... }); }
    },
  }],
}
```

### Bug 2 修复：独立 Orchestrator + 双注册

**文件**：

- `MainCpServer.ts:27-30,82-97` — 新增 `settingOrchestrator` 实例，setting 窗口注册为 `'renderer'`
- `AppOrchestrator.ts:46,156-258,260-264` — 新增 `settingPageServiceHost`，setting handler 使用 `getSettingOrchestrator()`
- `PageletProcess.ts:48-57` — setting utility process 同时注册到主 orchestrator 和 settingOrchestrator
- `SettingApplication.ts:29-33` — 移除 `registerSettingOrchestratorService()` 和 `connectSetting()` 调用（延迟到 window 创建后）
- `AppApplication.ts:35-37,87-88,169-172` — 注入 `AppOrchestrator`，`onSettingWindowCreated` 中依次调用注册流程

**架构变更**：

```
修改前（单一 orchestrator）:
  Main Orchestrator
    ├── renderer (main window IPC)
    ├── connection (utility)
    ├── monitor (utility)
    ├── setting (utility)
    └── setting-renderer (setting window IPC)  ← heuristic 不匹配

修改后（独立 orchestrator）:
  Main Orchestrator
    ├── renderer (main window IPC)
    ├── connection (utility)
    ├── monitor (utility)
    └── setting (utility)  ← 仅用于 worker→shared/daemon 连接

  Setting Orchestrator (独立实例)
    ├── renderer (setting window IPC)  ← heuristic 正确解析
    └── setting (utility)  ← 双注册
```

**时序修正**：

```
修改前: SettingApplication.start() → registerSettingOrchestratorService() → settingIpcChannel 为 null
修改后: onSettingWindowCreated → registerSettingWindow → registerSettingOrchestratorService → 顺序正确
```

### Bug 3 修复：servicePortMap 允许覆盖

**文件**：`src/electron-browser/createPageBridge.ts:88-101,105-112`

**改动 1**（:96）：移除 `!servicePortMap.has(servicePath)` 条件

```typescript
// 修改前
if (routePeerId === resolvedPeerId && !servicePortMap.has(servicePath)) {
  servicePortMap.set(servicePath, port);
}

// 修改后
if (routePeerId === resolvedPeerId) {
  servicePortMap.set(servicePath, port);
}
```

**改动 2**（:108）：移除 `!servicePortMap.has(servicePath)` 条件

```typescript
// 修改前
if (servicePath && !servicePortMap.has(servicePath)) {
  servicePortMap.set(servicePath, port);
}

// 修改后
if (servicePath) {
  servicePortMap.set(servicePath, port);
}
```

## 验证方法（How to Verify）

1. `npx electron-vite build` 构建成功，`out/preload/` 下无 `chunks/` 子目录
2. 启动应用 `npx electron-vite dev`，无 preload 加载报错
3. 打开 Setting 窗口，点击 Connect，状态变为 READY
4. 点击 Get Config / Echo 等按钮，返回实际数据（非 "not ready"）
5. 点击 Disconnect，状态变为 CLOSED
6. 再次点击 Connect，状态变为 READY
7. 再次点击 function call 按钮，正常返回数据

## Runbook

若复发类似"RPC 请求无响应"问题，按以下顺序排查：

1. **检查 DevTools 控制台**：是否有 preload 加载错误或 `module not found`
2. **检查 `servicePortMap` 映射**：在 `createPageBridge` 的 `_send` 中加日志，
   确认 `servicePath` 对应的 port 是否为有效 MessagePort
3. **检查 connectionId 解析**：确认 `createPageBridge` 的 peer ID heuristic
   能从 connectionId 中正确解析出 `resolvedPeerId`
4. **检查 orchestrator 注册**：确认 participant 在正确的 orchestrator 上注册
5. **检查 reconnect 路由更新**：确认 `servicePortMap` 在新 port 到达时覆盖旧映射
