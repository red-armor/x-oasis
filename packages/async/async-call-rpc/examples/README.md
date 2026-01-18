# Examples 运行指南

本目录包含了 `async-call-rpc` 的各种使用示例。在运行示例之前，请确保已经构建了项目。

## 前置准备

### 1. 安装依赖

在项目根目录运行：

```bash
pnpm install
```

### 2. 构建项目

在项目根目录运行：

```bash
pnpm run build
```

这会生成 `out/` 目录，示例文件需要引用这些构建产物。

## 示例说明

### 1. Node.js WebSocket 服务器示例

**文件**: `node.websocket.server.js`

这是一个 Node.js WebSocket 服务器示例，监听在 `localhost:3456` 端口。

**运行方式**:

```bash
# 在 examples 目录下
node node.websocket.server.js
```

**功能**:
- 提供 `now()` 方法：返回当前时间戳
- 提供 `echo(x)` 方法：回显传入的参数

**配合使用**: 可以与 `browser.websocket.client.js` 一起使用，先启动服务器，然后在浏览器中打开客户端页面。

---

### 2. Deno WebSocket 服务器示例

**文件**: `deno.websocket.server.ts`

这是一个 Deno WebSocket 服务器示例，监听在 `3456` 端口。

**运行方式**:

```bash
# 在 examples 目录下
deno run --allow-net deno.websocket.server.ts
```

**功能**:
- 提供 `now()` 方法：返回当前时间戳
- 提供 `rand()` 方法：返回随机数
- 提供 `echo(x)` 方法：回显传入的参数

**配合使用**: 可以与 `browser.websocket.client.js` 一起使用。

---

### 3. 浏览器 WebSocket 客户端示例

**文件**: `browser.websocket.client.js`

这是一个浏览器端的 WebSocket 客户端示例，连接到 `ws://localhost:3456/`。

**运行方式**:

1. 首先启动服务器（选择 Node.js 或 Deno 版本）：
   ```bash
   # Node.js 版本
   node node.websocket.server.js
   
   # 或 Deno 版本
   deno run --allow-net deno.websocket.server.ts
   ```

2. 在浏览器中运行客户端：
   - 可以使用任何支持 ES Module 的静态文件服务器
   - 或者使用项目根目录的 `index.html`（如果存在）
   - 或者创建一个简单的 HTML 文件来加载这个脚本

**创建测试 HTML 文件**:

创建一个 `test-websocket.html` 文件：

```html
<!DOCTYPE html>
<html>
<head>
    <title>WebSocket Client Test</title>
</head>
<body>
    <h1>WebSocket Client Test</h1>
    <p>打开浏览器控制台查看输出</p>
    <script type="module" src="./browser.websocket.client.js"></script>
</body>
</html>
```

然后使用静态文件服务器打开（例如使用 `npx serve` 或 `python -m http.server`）。

**功能**:
- 连接到 WebSocket 服务器
- 将服务器对象暴露到 `window.remote` 和 `window.server`
- 将 RPC 库暴露到 `window.ac`

---

### 4. 浏览器 Web Worker 示例

**文件**: 
- `browser.worker-main.js` - 主线程代码
- `browser.worker-worker.js` - Worker 线程代码

这是一个展示如何在 Web Worker 中使用 async-call-rpc 的示例。

**运行方式**:

1. 创建一个 HTML 文件 `test-worker.html`：

```html
<!DOCTYPE html>
<html>
<head>
    <title>Web Worker Test</title>
</head>
<body>
    <h1>Web Worker Test</h1>
    <p>打开浏览器控制台查看输出</p>
    <script type="module" src="./browser.worker-main.js"></script>
</body>
</html>
```

2. 使用静态文件服务器打开 HTML 文件（例如使用 `npx serve` 或 `python -m http.server`）

**功能**:
- 主线程创建 Worker 并调用 Worker 中的 `hello()` 方法
- Worker 线程也调用主线程的 `hello()` 方法
- 展示双向通信

---

## 快速测试流程

### 测试 WebSocket 示例

1. **终端 1** - 启动服务器：
   ```bash
   cd examples
   node node.websocket.server.js
   ```

2. **终端 2** - 启动静态文件服务器（在 examples 目录）：
   ```bash
   cd examples
   npx serve .
   ```

3. **浏览器** - 访问 `http://localhost:3000/test-websocket.html`（或服务器显示的端口）

4. **打开浏览器控制台** - 查看 RPC 调用的输出

### 测试 Web Worker 示例

1. **启动静态文件服务器**（在 examples 目录）：
   ```bash
   cd examples
   npx serve .
   ```

2. **浏览器** - 访问 `http://localhost:3000/test-worker.html`（或服务器显示的端口）

3. **打开浏览器控制台** - 查看 Worker 通信的输出

---

## 注意事项

1. **必须先构建项目**: 所有示例都依赖 `../out/base.mjs`，所以必须先运行 `pnpm run build`

2. **浏览器示例需要静态服务器**: 由于使用了 ES Module 和 `import.meta.url`，浏览器示例不能直接通过 `file://` 协议打开，需要使用 HTTP 服务器

3. **WebSocket 服务器端口**: 默认使用 `3456` 端口，确保该端口未被占用

4. **CORS 问题**: 如果遇到 CORS 问题，确保服务器和客户端在同一域名下，或者配置服务器允许跨域
