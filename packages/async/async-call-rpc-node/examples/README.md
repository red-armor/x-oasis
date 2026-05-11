# @x-oasis/async-call-rpc-node 示例

## 概述

`@x-oasis/async-call-rpc-node` 提供了 `NodeProcessChannel`，用于在 Node.js 环境中通过 `child_process.fork()` 建立父子进程之间的 IPC（进程间通信）RPC 通道。

配合 `@x-oasis/async-call-rpc` 的 `serviceHost` / `clientHost`，可以轻松实现双向远程过程调用——父进程可以调用子进程的方法，子进程也可以调用父进程的方法，就像调用本地函数一样。

## fork-example

一个完整的父子进程双向 RPC 通信示例。

### 架构

```
┌──────────────────────────────┐          IPC          ┌──────────────────────────────┐
│         父进程 (parent.ts)    │  ◄═══════════════►   │       子进程 (worker.ts)       │
│                              │   NodeProcessChannel  │                              │
│  服务端 (service: "main")     │                       │  服务端 (service: "worker")    │
│    ├─ getTimestamp()         │   ──── 请求 ────►     │    ├─ compute(n)              │
│    └─ getEnv(key)            │   ◄──── 响应 ────     │    ├─ ping()                  │
│                              │                       │    └─ fibonacci(n)            │
│  客户端 (client: "worker")    │   ◄──── 请求 ────     │                              │
│    ├─ compute(n)             │   ──── 响应 ────►     │  客户端 (client: "main")       │
│    ├─ ping()                 │                       │    ├─ getTimestamp()           │
│    └─ fibonacci(n)           │                       │    └─ getEnv(key)             │
└──────────────────────────────┘                       └──────────────────────────────┘
```

每个进程同时扮演**服务端**和**客户端**两个角色：

- **服务端**：注册本地方法，供对方进程调用
- **客户端**：创建代理对象，调用对方进程暴露的方法

### 启动方式

```bash
# 在项目根目录安装依赖
pnpm install

# 进入示例目录
cd packages/async/async-call-rpc-node/examples/fork-example

# 运行示例
pnpm start
# 或直接
npx tsx parent.ts
```

### 预期输出

```
[parent] 子进程已启动, pid = 12345
[worker] 子进程已就绪
[worker] 父进程时间戳: 1714600000000 (2025-05-02T00:00:00.000Z)
[worker] 父进程 NODE_VERSION = "<NODE_VERSION not set>"

[parent] === 开始调用子进程方法 ===

[parent] worker.compute(21) = 42
[parent] worker.ping()      = "pong"
[parent] worker.fibonacci(10) = 55

[parent] === 所有 RPC 调用完成 ===
[parent] 子进程已终止，退出。
```

> 注意：时间戳和 pid 会根据实际运行环境变化。

### 文件说明

| 文件            | 说明                                   |
| --------------- | -------------------------------------- |
| `parent.ts`     | 父进程入口，fork 子进程并建立 RPC 通道 |
| `worker.ts`     | 子进程，注册计算服务并调用父进程方法   |
| `package.json`  | 项目配置，使用 workspace 引用本地包    |
| `tsconfig.json` | TypeScript 配置                        |

## pagelet-proxy-example

一个完整的 Orchestrator + ParticipantProxy 多线程 RPC 示例，演示 Node.js 版本的 pagelet-proxy 架构。

> **注意**：本示例使用 `worker_threads`（而非 `child_process.fork`），因为 `MessagePort` transfer 仅在 `worker_threads` 中受支持。`child_process` IPC 无法传输 `MessagePort` 对象。

### 架构

```
┌───────────────────────────────────────────────────────────────────┐
│                    Host 线程 (host.ts) — Orchestrator              │
│                                                                   │
│   NodeConnectionOrchestrator                                      │
│     ├─ registerParticipant('client',   clientChannel,   'node')   │
│     ├─ registerParticipant('pagelet',  pageletChannel,  'worker') │
│     ├─ registerParticipant('shared',   sharedChannel,   'worker') │
│     └─ registerParticipant('daemon',   daemonChannel,   'worker') │
│                                                                   │
│   orchestrator.connect('pagelet','client')  ← 数据面直连          │
│   orchestrator.connect('pagelet','shared')  ← 数据面直连          │
│   orchestrator.connect('pagelet','daemon')  ← 数据面直连          │
└───────────────────────────────────────────────────────────────────┘

控制面：Host ←→ 每个 Worker 的 NodeMessagePortChannel（初始 MessagePort）
数据面直连（MessagePort transfer，经 Orchestrator 协商后建立）:

  client ──── NodeMessagePortChannel ──── pagelet
  pagelet ─── NodeMessagePortChannel ──── shared
  pagelet ─── NodeMessagePortChannel ──── daemon
```

- **Host**：中央编排线程，使用 `Worker` 创建 worker 线程，为每个 worker 创建 `MessageChannel` 作为控制面，通过 Orchestrator 创建数据面 `MessagePort` 对并 transfer 给各 participant
- **Pagelet**：通过 `createParticipantProxy` 自主连接其他 worker，充当 RPC 代理
- **Shared / Daemon**：通过 `createWorkerParticipant` 注册为被动 worker
- **Client**：消费端线程，通过 `registerOrchestratorHandler` 接收数据面 port，调用 pagelet 代理的 API

### 启动方式

```bash
cd packages/async/async-call-rpc-node/examples/pagelet-proxy-example
pnpm start
```

### 预期输出

```
[host] Starting pagelet-proxy example...

[shared-worker] Initialized
[daemon-worker] Initialized
[host] Orchestrator ready. Pagelet will self-connect...

[client] Waiting for system to initialize...
[pagelet-worker] connected: client=..., shared=..., daemon=...
[pagelet-worker] Initialized

[client] Requesting orchestrator to connect pagelet→client...
[client] Connect result: { "connectionId": "...", "state": "READY" }

[client] === RPC Calls via pagelet proxy ===

[client] pagelet.info()                    = "pagelet ready (pid=...)"
[client] pagelet.callSharedEcho(...)       = "shared echo: hello from client"
[client] pagelet.callSharedGetConfig(...)  = "config[theme] = value-v1"
[client] pagelet.callDaemonEcho(...)       = "daemon echo: ping daemon"
[client] pagelet.callDaemonSystemStatus()  = "system OK (#1), uptime=...s"
[client] pagelet.callHostPing(...)         = "pong from host (#1): hello host"

[client] === All RPC calls completed ===
```

### 文件说明

| 文件                | 说明                                                            |
| ------------------- | --------------------------------------------------------------- |
| `host.ts`           | Orchestrator 进程，fork 所有子进程并编排连接                    |
| `pagelet-worker.ts` | Pagelet 进程，通过 `createParticipantProxy` 自主连接其他 worker |
| `shared-worker.ts`  | Shared 配置服务进程，通过 `createWorkerParticipant` 注册        |
| `daemon-worker.ts`  | Daemon 监控服务进程，通过 `createWorkerParticipant` 注册        |
| `client.ts`         | 消费端进程，通过数据面 port 调用 pagelet 代理的 API             |
| `package.json`      | 项目配置                                                        |
| `tsconfig.json`     | TypeScript 配置                                                 |
