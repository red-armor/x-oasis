---
id: P-001
title: Orchestrator Sub-path Exports 分离实施计划
description: >
  将 @x-oasis/async-call-rpc 及其 3 个 adapter 包（-web、-node、-electron）
  中的 orchestrator 高级功能通过 sub-path exports 拆分为 /core 和 /orchestrator
  两个入口，使只用基础 RPC 的消费者无需打包 orchestrator 代码（1300+ 行 + 50+ 类型）。
category: roadmap
created: 2025-05-15
updated: 2025-05-15
tags: [orchestrator, sub-path-exports, tree-shaking, bundle-size, rollup]
status: draft
references:
  - id: D-005
    rel: related-to
    file: ../discussion/20260514-circuit-breaker-dead-code.md
  - id: D-001
    rel: related-to
    file: ../discussion/20260510-orchestrator-decentralized-connect.md
---

# Orchestrator Sub-path Exports 分离实施计划

> 将 orchestrator 高级功能从 core RPC 中通过 sub-path exports 物理分离，
> 使基础 RPC 消费者零 orchestrator 体积开销，同时保持完全向后兼容。

## 1. 背景与动机

### 1.1 当前问题

`@x-oasis/async-call-rpc` 的 barrel `src/index.ts:39` 通过 `export * from './orchestrator'` 全量导出 orchestrator 子系统：

```ts
// src/index.ts — 当前
export * from './orchestrator'; // 1300+ 行 + 50+ 类型
```

即使用户只需要基础 RPC（`RPCServiceHost`、`ProxyRPCClient`、`AbstractChannelProtocol`），
也会把 `BaseConnectionOrchestrator`、`CircuitBreaker`、`ConnectionStatsTracker`、
所有重连策略和 50+ 类型定义全部打包进来。

### 1.2 依赖图谱

```
@x-oasis/async-call-rpc (core)
├── orchestrator/         ← 重：1300行 + 50+ 类型
│   ├── BaseConnectionOrchestrator
│   ├── CircuitBreaker
│   ├── ConnectionStatsTracker
│   ├── policies/*
│   └── ORCHESTRATOR_SERVICE_PATH / ORCHESTRATOR_PROXY_SERVICE_PATH
├── endpoint/             ← 轻：核心
├── protocol/             ← 轻：核心
├── middlewares/           ← 轻：核心
└── buffer/               ← 轻：核心

@x-oasis/async-call-rpc-web
├── MessageChannel / WebSocketChannel / WorkerChannel  → core only
└── WebConnectionOrchestrator / registerOrchestratorHandler → core + orchestrator ⚠️

@x-oasis/async-call-rpc-node
├── NodeProcessChannel / NodeMessagePortChannel        → core only
└── NodeConnectionOrchestrator / NodeOrchestratorHelpers → core + orchestrator ⚠️

@x-oasis/async-call-rpc-electron
├── IPCMainChannel / ElectronMessagePortMainChannel / ... → core only
├── ElectronConnectionOrchestrator / ParticipantOrchestratorProxy → core + orchestrator ⚠️
├── MainOrchestratorSetup / UtilityProcessSupervisor              → core + orchestrator ⚠️
├── registerOrchestratorHandler (electron-browser)                → core + 常量 ⚠️
└── OrchestratorClient (browser)                                  → core + event 类型 ⚠️
```

### 1.3 核心判断

- **Orchestrator 是唯一既重又可选的子系统** — 其余要么已经可插拔（middleware / transport / serialization），要么还没到需要插件化的复杂度
- **Core 对 orchestrator 零反向依赖** — 拆分无架构障碍
- **3 个 adapter 包都同时导出 transport + orchestrator** — 必须同步拆分

### 1.4 现有可插拔能力（无需额外插件化）

| 能力          | 当前机制                                                 | 状态            |
| ------------- | -------------------------------------------------------- | --------------- |
| Middleware    | `decorateSendMiddleware` / `decorateOnMessageMiddleware` | ✅ 已完全可插拔 |
| Transport     | 独立包 (web/electron/node/react)                         | ✅ 已分离       |
| Serialization | `BufferFactory` + `SerializationFormat`                  | ✅ 已可扩展     |
| Context 注入  | `createContext` 回调                                     | ✅ 已可插拔     |

### 1.5 潜在可插件化的高级能力

| 能力             | 当前状态                    | 复杂度        | 普适性             | 是否需要插件化       |
| ---------------- | --------------------------- | ------------- | ------------------ | -------------------- |
| **Orchestrator** | 内嵌在主包                  | 高 (1300+ 行) | 低（多进程才需要） | ✅ 是，sub-path 足够 |
| Observability    | 仅 `enableStats` + `logger` | 中            | 中                 | ❌ middleware 可覆盖 |
| Auth/Security    | 无                          | 中            | 中                 | ❌ middleware 可覆盖 |
| Rate Limiting    | 无                          | 低            | 低                 | ❌ middleware 可覆盖 |

**结论**：当前生态不需要 PluginRegistry，sub-path exports 是最优解。

## 2. 方案选择

| 方案                       | 改动范围                   | 向后兼容       | tree-shaking | 用户心智                         |
| -------------------------- | -------------------------- | -------------- | ------------ | -------------------------------- |
| **A. Sub-path exports** ✅ | 4 包 package.json + barrel | `"."` 保留全量 | 需改导入路径 | 2 层（`/core`、`/orchestrator`） |
| B. 独立包拆分              | 新建 3 个包                | 需迁移         | 同 A         | 包名直接表达                     |
| C. 插件注册机制            | 核心 API 变更              | 不兼容         | 需注册       | 最复杂                           |
| D. 只拆 core adapter 不动  | 1 包                       | 完全兼容       | 部分         | 最简单                           |

**选择方案 A**：sub-path exports。`"."` 保留全量导出做向后兼容，新代码使用 `/core` 或 `/orchestrator` 路径。

## 3. 实施计划

### 3.1 `@x-oasis/async-call-rpc`（core 包）

#### 3.1.1 新建 `src/core.ts`

从 `src/index.ts` 中移除 `export * from './orchestrator'`，保留其余核心导出。
同时导出 `registerOrchestratorHandler` 所需的常量和类型（零体积）：

```ts
// src/core.ts
import clientHost from './endpoint/RPCClientHost';
import ProxyRPCClient from './endpoint/ProxyRPCClient';
import RPCService from './endpoint/RPCService';
import RPCServiceHost from './endpoint/RPCServiceHost';

export { default as AbstractChannelProtocol } from './protocol/AbstractChannelProtocol';
export type { CreateContextFn } from './protocol/AbstractChannelProtocol';
export type {
  IMessageChannel,
  AbstractChannelProtocolProps,
  SendingProps,
} from './types/protocol';
export type { ClientMiddleware, SenderMiddleware } from './types';
export type { SubscriptionObserver } from './endpoint/ProxyRPCClient';
export {
  normalizeMessageChannelRawMessage,
  normalizeWebSocketRawMessage,
  normalizeIPCChannelRawMessage,
  processClientRawMessage,
} from './middlewares/normalize';
export * from './utils';
export type { ErrorResponse, ErrorResponseDetail, ID } from './error';
export { JSONRPCErrorCode, RPCError } from './error';
export * from './buffer';

const serviceHost = new RPCServiceHost();
export { ProxyRPCClient, RPCService, RPCServiceHost, clientHost, serviceHost };

// 常量：adapter 包的 registerOrchestratorHandler 需要（仅字符串，~0 体积）
export {
  ORCHESTRATOR_SERVICE_PATH,
  ORCHESTRATOR_PROXY_SERVICE_PATH,
} from './orchestrator/types';
// 类型：adapter 包的 registerOrchestratorHandler 回调参数
export type { ActivationContext } from './orchestrator/types';
```

#### 3.1.2 `src/index.ts` 保持向后兼容

```ts
export * from './core';
export * from './orchestrator';
```

#### 3.1.3 `package.json` 添加 exports

```jsonc
{
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/async-call-rpc.esm.js",
      "require": "./dist/index.js",
    },
    "./core": {
      "types": "./dist/core.d.ts",
      "import": "./dist/core.esm.js",
      "require": "./dist/core.js",
    },
    "./orchestrator": {
      "types": "./dist/orchestrator/index.d.ts",
      "import": "./dist/orchestrator.esm.js",
      "require": "./dist/orchestrator.js",
    },
  },
}
```

#### 3.1.4 构建配置改造

当前用 tsdx 构建（单入口），需改为 rollup 多入口（与 `async-call-rpc-electron` 一致）：

```ts
// rollup.config.ts 示意
export default [
  {
    input: 'src/core.ts',
    output: [
      { file: 'dist/core.js', format: 'cjs' },
      { file: 'dist/core.esm.js', format: 'esm' },
    ],
  },
  {
    input: 'src/orchestrator/index.ts',
    output: [
      { file: 'dist/orchestrator.js', format: 'cjs' },
      { file: 'dist/orchestrator.esm.js', format: 'esm' },
    ],
  },
  {
    input: 'src/index.ts',
    output: [
      { file: 'dist/index.js', format: 'cjs' },
      { file: 'dist/async-call-rpc.esm.js', format: 'esm' },
    ],
  },
];
```

---

### 3.2 `@x-oasis/async-call-rpc-web`

#### 3.2.1 新建 `src/core.ts`

```ts
export { default as MessageChannel } from './MessageChannel';
export { default as RPCMessageChannel } from './MessageChannel';
export { default as WorkerChannel } from './WorkerChannel';
export { default as WebSocketChannel } from './WebSocketChannel';
```

#### 3.2.2 `src/index.ts` 保持向后兼容

```ts
export * from './core';
export {
  WebConnectionOrchestrator,
  registerOrchestratorHandler,
} from './WebConnectionOrchestrator';
```

#### 3.2.3 `package.json` 添加 exports

```jsonc
{
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/async-call-rpc-web.esm.js",
      "require": "./dist/index.js",
    },
    "./core": {
      "types": "./dist/core.d.ts",
      "import": "./dist/core.esm.js",
      "require": "./dist/core.js",
    },
    "./orchestrator": {
      "types": "./dist/WebConnectionOrchestrator.d.ts",
      "import": "./dist/orchestrator.esm.js",
      "require": "./dist/orchestrator.js",
    },
  },
}
```

---

### 3.3 `@x-oasis/async-call-rpc-node`

#### 3.3.1 新建 `src/core.ts`

```ts
export { default as NodeProcessChannel } from './NodeProcessChannel';
export type { NodeProcessChannelProps } from './NodeProcessChannel';
export { NodeMessagePortChannel } from './NodeMessagePortChannel';
export type { NodeMessagePortChannelProps } from './NodeMessagePortChannel';
```

#### 3.3.2 `src/index.ts` 保持向后兼容

```ts
export * from './core';
export {
  NodeConnectionOrchestrator,
  registerOrchestratorHandler,
} from './NodeConnectionOrchestrator';
export {
  NodeParticipantOrchestratorProxy,
  createParticipantProxy,
  NodeWorkerParticipant,
  createWorkerParticipant,
} from './NodeOrchestratorHelpers';
export type {
  NodeParticipantConnection,
  NodeParticipantProxyOptions,
  NodeWorkerParticipantOptions,
} from './NodeOrchestratorHelpers';
```

#### 3.3.3 `package.json` 添加 exports

```jsonc
{
  "exports": {
    ".": {
      "import": "./dist/async-call-rpc-node.esm.js",
      "require": "./dist/index.js",
      "types": "./dist/src/index.d.ts",
    },
    "./core": {
      "import": "./dist/core.esm.js",
      "require": "./dist/core.js",
      "types": "./dist/core.d.ts",
    },
    "./orchestrator": {
      "import": "./dist/orchestrator.esm.js",
      "require": "./dist/orchestrator.js",
      "types": "./dist/orchestrator.d.ts",
    },
  },
}
```

---

### 3.4 `@x-oasis/async-call-rpc-electron`

已有 sub-path 架构（`./browser`、`./electron-browser`、`./electron-main`），
需要给每个增加 `./core` 变体。

#### 3.4.1 新增 core 入口文件

| 文件                           | 导出                                                                                                               |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------ |
| `src/electron-main/core.ts`    | `IPCMainChannel` + `ElectronMessagePortMainChannel` + `ElectronUtilityProcessChannel` + `UtilityProcessSupervisor` |
| `src/electron-browser/core.ts` | `IPCRendererChannel` + `createPageBridge`                                                                          |
| `src/browser/core.ts`          | `ContextBridgeChannel` + `createPageChannel` + `createIpcPageChannel` + `IPC_BRIDGE_KEY`                           |

#### 3.4.2 现有 barrel 保持不变（全量导出，向后兼容）

#### 3.4.3 `package.json` 扩展 exports

```jsonc
{
  "exports": {
    ".": {
      /* 不变 */
    },
    "./browser": {
      /* 不变 */
    },
    "./browser/core": {
      "types": "./dist/browser/core.d.ts",
      "import": "./dist/browser/core.js",
      "require": "./dist/browser/core.js",
    },
    "./electron-browser": {
      /* 不变 */
    },
    "./electron-browser/core": {
      "types": "./dist/electron-browser/core.d.ts",
      "import": "./dist/electron-browser/core.js",
      "require": "./dist/electron-browser/core.js",
    },
    "./electron-main": {
      /* 不变 */
    },
    "./electron-main/core": {
      "types": "./dist/electron-main/core.d.ts",
      "import": "./dist/electron-main/core.js",
      "require": "./dist/electron-main/core.js",
    },
  },
}
```

---

## 4. 用户侧迁移路径

```ts
// ═══ 只用基础 RPC（零 orchestrator 体积）═══

// core
import { RPCServiceHost, ProxyRPCClient } from '@x-oasis/async-call-rpc/core';

// web
import { RPCMessageChannel } from '@x-oasis/async-call-rpc-web/core';

// node
import { NodeProcessChannel } from '@x-oasis/async-call-rpc-node/core';

// electron main
import { IPCMainChannel } from '@x-oasis/async-call-rpc-electron/electron-main/core';

// ═══ 需要 orchestrator（显式引入）═══

import { BaseConnectionOrchestrator } from '@x-oasis/async-call-rpc/orchestrator';
import { WebConnectionOrchestrator } from '@x-oasis/async-call-rpc-web/orchestrator';
import { ElectronConnectionOrchestrator } from '@x-oasis/async-call-rpc-electron/electron-main';

// ═══ 向后兼容（无需改动）═══

import {
  RPCServiceHost,
  BaseConnectionOrchestrator,
} from '@x-oasis/async-call-rpc';
// 仍然可用，但会包含 orchestrator 代码
```

## 5. 常量归属决策

以下常量/类型虽来自 `orchestrator/` 目录，但需要放在 `/core` 入口导出
（因为 3 个 adapter 包的 `registerOrchestratorHandler` 依赖它们）：

| 导出                              | 体积                 | 消费者                                 | 归属    |
| --------------------------------- | -------------------- | -------------------------------------- | ------- |
| `ORCHESTRATOR_SERVICE_PATH`       | 1 个字符串常量       | `registerOrchestratorHandler` (3 包)   | `/core` |
| `ORCHESTRATOR_PROXY_SERVICE_PATH` | 1 个字符串常量       | `ParticipantOrchestratorProxy` (2 包)  | `/core` |
| `ActivationContext`               | 纯类型（编译时擦除） | `registerOrchestratorHandler` 回调参数 | `/core` |

这 3 项总计 ~0 运行时体积，放在 `/core` 不会破坏分离的目标。

## 6. 执行顺序

| 步骤 | 内容                                                                        | 验证                     |
| ---- | --------------------------------------------------------------------------- | ------------------------ |
| 1    | 改 `async-call-rpc`：创建 `src/core.ts`、调整 barrel、配置 exports + rollup | 全量入口测试通过         |
| 2    | 改 `async-call-rpc-web`：同上                                               | 全量入口测试通过         |
| 3    | 改 `async-call-rpc-node`：同上                                              | 全量入口测试通过         |
| 4    | 改 `async-call-rpc-electron`：增加 core sub-path 入口                       | 全量入口测试通过         |
| 5    | 全局验证：所有包 `npm run build` + `npm run test`                           | CI 绿                    |
| 6    | tree-shaking 验证：最小示例分别从 `/core` 和 `.` 导入，对比 bundle size     | `/core` 体积显著小于 `.` |

## 7. 风险与缓解

| 风险                                                    | 缓解                                                                                  |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| tsdx → rollup 迁移引入构建差异                          | 保留 `tsc -p tsconfig.build.json` 做类型检查，rollup 只做 bundling                    |
| 现有消费者不改动享受不到 tree-shaking                   | 文档引导新代码使用 `/core`；旧代码自然过期                                            |
| `ORCHESTRATOR_SERVICE_PATH` 放 core 是否语义不当        | 实用主义：仅 2 个字符串 + 1 个纯类型，~0 体积，但 3 个 adapter 都依赖                 |
| rollup 多入口 d.ts 生成                                 | 使用 `rollup-plugin-typescript2` 或 `@rollup/plugin-typescript` + `declaration: true` |
| electron 包已有 sub-path 嵌套（`./electron-main/core`） | 用户心智可接受：electron 包的路径一直偏长，且 IDE 自动补全                            |

## 8. 未来演进

当子系统数量增长（如 Auth、Observability 变为独立模块）时，可按同样模式添加：

- `@x-oasis/async-call-rpc/auth`
- `@x-oasis/async-call-rpc/observability`

当 sub-path 多到 4-5 个时，再考虑引入 PluginRegistry 统一注册机制。
