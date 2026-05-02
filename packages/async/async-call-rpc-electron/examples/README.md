# @x-oasis/async-call-rpc-electron 示例

本目录包含 `@x-oasis/async-call-rpc-electron` 的代码片段示例，展示如何在 Electron 各进程间建立 RPC 通信。

> **注意**：这些示例是代码片段，不是可独立运行的脚本。需要在完整的 Electron 项目中使用。

## 概述

`@x-oasis/async-call-rpc-electron` 提供 4 种 Channel，覆盖 Electron 全部进程间通信场景：

| Channel 类                       | 传输层                          | 运行环境              | 使用场景                   |
| -------------------------------- | ------------------------------- | --------------------- | -------------------------- |
| `IPCMainChannel`                 | `ipcMain` + `webContents`       | 主进程                | 与渲染进程通信（主进程侧） |
| `IPCRendererChannel`             | `ipcRenderer`                   | 渲染进程              | 与主进程通信（渲染进程侧） |
| `ElectronMessagePortMainChannel` | `MessagePortMain`               | 主进程                | 高性能直连通道（主进程侧） |
| `ElectronUtilityProcessChannel`  | `UtilityProcess` / `parentPort` | 主进程 / Utility 进程 | 与 Utility 进程通信        |

### 架构关系

```
┌─────────────────────────────────────────────────────┐
│                    主进程 (Main)                     │
│                                                     │
│  IPCMainChannel ◄──────────► IPCRendererChannel     │──► 渲染进程
│                                                     │
│  ElectronMessagePortMainChannel ◄──► MessagePort    │──► 渲染进程 (web 包)
│                                                     │
│  ElectronUtilityProcessChannel ◄──────────────────► │──► Utility 进程
│       (process)                    (parentPort)      │
└─────────────────────────────────────────────────────┘
```

## 示例目录

### 1. `ipc-example/` - ipcMain + ipcRenderer 通信

最常用的 Electron IPC 模式。主进程作为 Service 提供方法，渲染进程作为 Client 调用。

- `main-process.ts` - 主进程：创建窗口、注册 RPC 服务
- `renderer-process.ts` - 渲染进程：创建 RPC 客户端、调用远程方法

### 2. `utility-process-example/` - UtilityProcess 通信

用于将 CPU 密集型任务卸载到独立进程。

- `main-process.ts` - 主进程：fork 子进程、双向 RPC 通信
- `utility-worker.ts` - Utility 进程：注册计算服务

---

## 完整用法详解

### 一、ipcMain + ipcRenderer（基础 IPC）

这是 Electron 最标准的进程间通信方式。`IPCMainChannel` 和 `IPCRendererChannel` 必须配对使用，通过相同的 `channelName` 建立连接。

#### 主进程（Service 端）

```typescript
import { BrowserWindow } from 'electron';
import { IPCMainChannel } from '@x-oasis/async-call-rpc-electron';
import { serviceHost } from '@x-oasis/async-call-rpc';

const win = new BrowserWindow({
  /* ... */
});

// 创建通道 —— channelName 必须与渲染进程一致
const channel = new IPCMainChannel({
  channelName: 'app-rpc',
  webContents: win.webContents,
  description: 'main→renderer RPC',
});

// 注册服务，提供可被远程调用的方法
serviceHost.registerService('api', {
  channel,
  serviceHost,
  handlers: {
    getAppVersion: () => '1.0.0',
    readConfig: (key: string) => config[key],
  },
});
```

#### 渲染进程（Client 端）

```typescript
import { ipcRenderer } from 'electron';
import { IPCRendererChannel } from '@x-oasis/async-call-rpc-electron';
import { clientHost } from '@x-oasis/async-call-rpc';

const channel = new IPCRendererChannel({
  channelName: 'app-rpc',
  ipcRenderer,
  projectName: 'my-app',
  description: 'renderer→main RPC',
});

// 创建类型安全的代理客户端
const api = clientHost.registerClient('api', { channel }).createProxy<{
  getAppVersion(): Promise<string>;
  readConfig(key: string): Promise<any>;
}>();

// 像调用本地方法一样使用
const version = await api.getAppVersion(); // '1.0.0'
const theme = await api.readConfig('theme'); // 'dark'
```

#### 关键点

- 每个 `IPCMainChannel` 绑定一个 `WebContents`，多窗口需创建多个实例
- `WebContents` 被销毁时，Channel 自动断开
- 来自其他窗口的同名 channel 消息会被自动过滤

### 二、MessagePortMain（高性能直连）

`MessagePortMain` 提供比 ipcMain/ipcRenderer 更高性能的直连通道，适合高频通信场景。

#### 主进程

```typescript
import { MessageChannelMain, BrowserWindow } from 'electron';
import { ElectronMessagePortMainChannel } from '@x-oasis/async-call-rpc-electron';
import { serviceHost } from '@x-oasis/async-call-rpc';

const win = new BrowserWindow({
  /* ... */
});
const { port1, port2 } = new MessageChannelMain();

// 将 port2 通过 IPC 发送给渲染进程
win.webContents.postMessage('init-port', null, [port2]);

// 主进程使用 port1 建立 RPC 通道
const channel = new ElectronMessagePortMainChannel({
  port: port1,
  description: 'main↔renderer (MessagePort)',
});

serviceHost.registerService('compute', {
  channel,
  serviceHost,
  handlers: {
    heavyCompute: (data: number[]) => data.reduce((a, b) => a + b, 0),
  },
});
```

#### 渲染进程

渲染进程收到的是标准 Web `MessagePort`，使用 `@x-oasis/async-call-rpc-web` 的 `MessageChannel` 即可：

```typescript
// 渲染进程 —— 使用 web 包而非 electron 包
import { MessageChannel as RPCMessageChannel } from '@x-oasis/async-call-rpc-web';
import { clientHost } from '@x-oasis/async-call-rpc';

ipcRenderer.on('init-port', (event) => {
  const port = event.ports[0];

  // Web 标准的 MessagePort，用 web 包的 Channel
  const channel = new RPCMessageChannel({
    port,
    description: 'renderer↔main (MessagePort)',
  });

  const compute = clientHost
    .registerClient('compute', { channel })
    .createProxy<{
      heavyCompute(data: number[]): Promise<number>;
    }>();

  const result = await compute.heavyCompute([1, 2, 3, 4, 5]); // 15
});
```

#### 关键点

- 主进程侧用 `ElectronMessagePortMainChannel`（Electron 的 `MessagePortMain` 使用 EventEmitter API）
- 渲染进程侧用 `@x-oasis/async-call-rpc-web` 的 `MessageChannel`（标准 Web `MessagePort` API）
- 构造时自动调用 `port.start()`
- 远端关闭时自动断开连接

### 三、UtilityProcess（独立计算进程）

Electron 的 `utilityProcess` 用于 fork 独立的 Node.js 进程，适合 CPU 密集型任务。

#### 主进程

```typescript
import { utilityProcess } from 'electron';
import { ElectronUtilityProcessChannel } from '@x-oasis/async-call-rpc-electron';
import { serviceHost, clientHost } from '@x-oasis/async-call-rpc';

const child = utilityProcess.fork('./utility-worker.js');

const channel = new ElectronUtilityProcessChannel({
  process: child,
  description: 'main→utility RPC',
});

// 作为 Client 调用 Utility 进程提供的服务
const worker = clientHost.registerClient('worker', { channel }).createProxy<{
  processImage(path: string): Promise<Buffer>;
  compress(data: string): Promise<string>;
}>();

const result = await worker.processImage('/path/to/image.png');
```

#### Utility 进程

```typescript
import { ElectronUtilityProcessChannel } from '@x-oasis/async-call-rpc-electron';
import { serviceHost } from '@x-oasis/async-call-rpc';

const channel = new ElectronUtilityProcessChannel({
  parentPort: process.parentPort,
  description: 'utility→main RPC',
});

serviceHost.registerService('worker', {
  channel,
  serviceHost,
  handlers: {
    processImage: async (path: string) => {
      /* 图像处理逻辑 */
    },
    compress: (data: string) => {
      /* 压缩逻辑 */
    },
  },
});
```

#### 关键点

- 主进程侧传入 `process`（`utilityProcess.fork()` 的返回值）
- Utility 进程侧传入 `parentPort`（`process.parentPort`）
- 主进程侧 `disconnect()` 会自动 kill 子进程
- 子进程退出时主进程侧自动断开连接

---

## 注意事项

### contextBridge 与安全性

在生产环境中，应通过 `contextBridge` 暴露 IPC 接口，而非直接在渲染进程中使用 `ipcRenderer`：

```typescript
// preload.ts
import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronRPC', {
  send: (channel: string, data: unknown) => ipcRenderer.send(channel, data),
  on: (channel: string, fn: (...args: any[]) => void) => {
    const listener = (_event: any, ...args: any[]) => fn(...args);
    ipcRenderer.on(channel, listener);
    return () => ipcRenderer.removeListener(channel, listener);
  },
  removeAllListeners: (channel: string) =>
    ipcRenderer.removeAllListeners(channel),
});
```

```typescript
// BrowserWindow 配置
const win = new BrowserWindow({
  webPreferences: {
    preload: path.join(__dirname, 'preload.js'),
    contextIsolation: true, // 推荐开启
    nodeIntegration: false, // 推荐关闭
  },
});
```

### 多窗口管理

每个窗口需要独立的 `IPCMainChannel` 实例：

```typescript
function setupWindowRPC(win: BrowserWindow) {
  const channel = new IPCMainChannel({
    channelName: 'app-rpc',
    webContents: win.webContents,
    description: `window-${win.id}`,
  });

  serviceHost.registerService(`window-${win.id}`, {
    channel,
    serviceHost,
    handlers: {
      /* ... */
    },
  });

  // WebContents 销毁时 Channel 自动断开，无需手动清理
}
```

### 与 @x-oasis/async-call-rpc-web 配合使用

渲染进程本质上是一个 Web 环境，因此：

- **MessagePort 场景**：渲染进程收到的 port 是标准 Web `MessagePort`，应使用 `@x-oasis/async-call-rpc-web` 的 `MessageChannel`
- **Worker 场景**：渲染进程中如果需要与 Web Worker 通信，直接使用 web 包即可
- **electron 包**：仅在需要 `ipcRenderer` 或处于主进程/Utility 进程时使用

```
渲染进程需要的包：
- @x-oasis/async-call-rpc           （核心 RPC）
- @x-oasis/async-call-rpc-electron  （IPCRendererChannel）
- @x-oasis/async-call-rpc-web       （MessagePort / Worker 通信）
```
