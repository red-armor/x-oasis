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
