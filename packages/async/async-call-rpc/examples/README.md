# Examples

本目录包含 `async-call-rpc` 的使用示例。

## 前置准备

```bash
# 1. 安装依赖
pnpm install

# 2. 构建项目
pnpm run build
```

## 示例列表

### WebSocket (Node.js Server + Browser Client)

演示通过 WebSocket 实现跨进程 RPC 通信。

```bash
# 终端 1 — 启动服务器
npx tsx examples/node.websocket.server.ts

# 终端 2 — 启动静态文件服务器
npx serve examples

# 浏览器 — 打开 http://localhost:3000/test-websocket.html
```

服务器提供以下方法：

- `server.echo(x)` — 回显参数
- `server.now()` — 返回时间戳
- `server.add(a, b)` — 加法
- `server.greet(name)` — 问候

### Web Worker (Main Thread + Worker)

演示主线程和 Web Worker 之间的双向 RPC 通信。

```bash
npx serve examples
# 打开 http://localhost:3000/test-worker.html
```

- 主线程提供 `getTimestamp()`, `getTitle()`
- Worker 提供 `ping()`, `fibonacci(n)`

### MessageChannel (Main Window + Iframe)

演示通过 `MessageChannel` API 实现窗口与 iframe 之间的 RPC 通信。

```bash
npx serve examples
# 打开 http://localhost:3000/test-messagechannel.html
```

## 文件说明

| 文件                               | 说明                         |
| ---------------------------------- | ---------------------------- |
| `node.websocket.server.ts`         | Node.js WebSocket RPC 服务器 |
| `browser.websocket.client.ts`      | 浏览器 WebSocket 客户端      |
| `browser.worker-main.ts`           | Web Worker 主线程            |
| `browser.worker-worker.ts`         | Web Worker 工作线程          |
| `browser.messagechannel-main.js`   | MessageChannel 主窗口        |
| `browser.messagechannel-iframe.js` | MessageChannel iframe        |
| `test-*.html`                      | 浏览器测试页面               |

> React Query 集成示例已迁移至 [`@x-oasis/async-call-rpc-react`](../../async-call-rpc-react/examples/)。

## 注意事项

1. 浏览器示例需要 HTTP 服务器（不能通过 `file://` 打开）
2. WebSocket 服务器默认使用端口 `3456`
