# async-call-rpc-web 示例项目

## 概述

`@x-oasis/async-call-rpc-web` 提供三种 Web 平台传输通道：

- **WorkerChannel** — 基于 Web Worker 的 RPC 通信
- **WebSocketChannel** — 基于 WebSocket 的 RPC 通信
- **RPCMessageChannel** — 基于 MessagePort 的 RPC 通信

下面展示 Worker 和 WebSocket 两个完整示例。

---

## 1. worker-example — Web Worker RPC

使用 `WorkerChannel` 在主线程与 Web Worker 之间进行 RPC 通信，将 CPU 密集型计算（fibonacci、素数判断）放到 Worker 中执行，保持 UI 线程响应。

### 启动方式

```bash
cd worker-example
pnpm install
pnpm dev
# 打开 http://localhost:5180
```

### 功能

- 输入数字，计算 Fibonacci 数列
- 判断是否为素数
- 加载状态和结果展示
- 主线程不阻塞

---

## 2. websocket-example — WebSocket RPC

使用 `WebSocketChannel` 进行客户端-服务器实时 RPC 通信。包含一个独立的 WebSocket 服务器和 React 前端。

### 启动方式

```bash
cd websocket-example
pnpm install

# 方式一：同时启动服务器和前端
pnpm dev:all

# 方式二：分别启动
# 终端 1：启动 WebSocket 服务器
pnpm server

# 终端 2：启动前端
pnpm dev
```

然后打开 http://localhost:5181

### 功能

- Echo 消息回显
- 获取服务器时间
- 获取服务器信息
- 消息日志展示
- 连接状态实时显示

---

## 端口分配

| 项目              | 服务             | 端口 |
| ----------------- | ---------------- | ---- |
| worker-example    | Vite Dev Server  | 5180 |
| websocket-example | Vite Dev Server  | 5181 |
| websocket-example | WebSocket Server | 3460 |

---

## 注意事项

1. 示例项目依赖 `@x-oasis/async-call-rpc-web` 和 `@x-oasis/async-call-rpc`，使用 `workspace:*` 引用，需在 monorepo 环境下运行
2. Worker 示例无需额外服务器，直接启动即可
3. WebSocket 示例需要先启动 WebSocket 服务器（端口 3460），再启动前端
4. 确保端口未被占用，如有冲突可在 `vite.config.ts` 和 `server.ts` 中修改
5. Worker 文件使用 `new URL('./worker.ts', import.meta.url)` 方式加载，这是 Vite 推荐的 Worker 导入方式
