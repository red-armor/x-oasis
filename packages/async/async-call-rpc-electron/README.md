# @x-oasis/async-call-rpc-electron

Electron 传输层适配器，为 [`@x-oasis/async-call-rpc`](../async-call-rpc/) 提供 ipcMain/ipcRenderer、MessagePortMain、UtilityProcess 四种通道实现。

## 安装

```bash
pnpm add @x-oasis/async-call-rpc-electron @x-oasis/async-call-rpc
```

## 核心概念

本包提供四个 Channel 类，覆盖 Electron 所有进程间通信场景：

| 类                               | 传输层                          | 使用场景                 |
| -------------------------------- | ------------------------------- | ------------------------ |
| `IPCMainChannel`                 | `ipcMain` + `webContents`       | 主进程侧，与渲染进程通信 |
| `IPCRendererChannel`             | `ipcRenderer`                   | 渲染进程侧，与主进程通信 |
| `ElectronMessagePortMainChannel` | `MessagePortMain`               | 主进程侧，高性能直连通道 |
| `ElectronUtilityProcessChannel`  | `UtilityProcess` / `parentPort` | 主进程或 Utility 进程侧  |

## 快速开始

### 1. ipcMain / ipcRenderer

```typescript
// === 主进程 ===
import { BrowserWindow } from 'electron';
import { IPCMainChannel } from '@x-oasis/async-call-rpc-electron';
import { serviceHost } from '@x-oasis/async-call-rpc';

const win = new BrowserWindow({
  /* ... */
});
const channel = new IPCMainChannel({
  channelName: 'my-rpc',
  webContents: win.webContents,
  description: 'main→renderer',
});

const service = serviceHost.registerService('api', {
  getAppVersion: () => '1.0.0',
  readConfig: (key: string) => config[key],
});
service.setChannel(channel);
```

```typescript
// === 渲染进程 ===
import { ipcRenderer } from 'electron';
import { IPCRendererChannel } from '@x-oasis/async-call-rpc-electron';
import { clientHost } from '@x-oasis/async-call-rpc';

const channel = new IPCRendererChannel({
  channelName: 'my-rpc',
  ipcRenderer,
  projectName: 'my-app',
  description: 'renderer→main',
});

const api = clientHost.registerClient('api', { channel }).createProxy<{
  getAppVersion(): Promise<string>;
  readConfig(key: string): Promise<any>;
}>();

const version = await api.getAppVersion(); // '1.0.0'
```

### 2. MessagePortMain（高性能直连）

```typescript
// === 主进程 ===
import { MessageChannelMain, BrowserWindow } from 'electron';
import { ElectronMessagePortMainChannel } from '@x-oasis/async-call-rpc-electron';

const { port1, port2 } = new MessageChannelMain();

// 将 port2 发送给渲染进程
win.webContents.postMessage('port', null, [port2]);

// 主进程使用 port1
const channel = new ElectronMessagePortMainChannel({
  port: port1,
  description: 'main↔renderer (MessagePortMain)',
});
```

```typescript
// === 渲染进程 ===
// 收到 port2 后，使用 @x-oasis/async-call-rpc-web 的 MessageChannel
import { MessageChannel as RPCMessageChannel } from '@x-oasis/async-call-rpc-web';

ipcRenderer.on('port', (event) => {
  const port = event.ports[0];
  const channel = new RPCMessageChannel({ port });
});
```

### 3. UtilityProcess

```typescript
// === 主进程 ===
import { utilityProcess } from 'electron';
import { ElectronUtilityProcessChannel } from '@x-oasis/async-call-rpc-electron';

const child = utilityProcess.fork('./utility.js');
const channel = new ElectronUtilityProcessChannel({
  process: child,
  description: 'main→utility',
});
```

```typescript
// === Utility 进程 (utility.js) ===
import { ElectronUtilityProcessChannel } from '@x-oasis/async-call-rpc-electron';

const channel = new ElectronUtilityProcessChannel({
  parentPort: process.parentPort,
  description: 'utility→main',
});
```

## API 参考

### `IPCMainChannel`

```typescript
new IPCMainChannel(props: {
  channelName: string;
  webContents?: WebContents;       // acceptAllSenders 为 true 时可省略
  acceptAllSenders?: boolean;      // 默认 false
} & AbstractChannelProtocolProps)
```

两种工作模式：

**1. 绑定模式（默认）**

- 每个实例绑定一个 `WebContents`，多窗口需创建多个实例
- `channelName` 需与渲染进程侧的 `IPCRendererChannel` 一致
- 自动过滤非目标 `WebContents` 的消息
- `WebContents` 销毁时自动断开

**2. 广播模式（`acceptAllSenders: true`）**

接收 `channelName` 上**任意发送方**的消息，回复时定位到"最近一次发送方"。适合 broker 通道（多个渲染进程都向主进程申请 port 等）：

```typescript
const broker = new IPCMainChannel({
  channelName: 'rpc-broker',
  acceptAllSenders: true, // ⬅
  // 不必传 webContents
});

// 任意 renderer 发到 'rpc-broker' 的消息都会进入此通道，
// 回复自动 send 给最近发送的那个 webContents。
```

广播模式下不再绑 `destroyed`（没有"唯一发送方"可追踪）。

**传输列表（transfer）**

`send(data, transfer?)` 在 `transfer` 非空时改用 `webContents.postMessage(channelName, data, transfer)`，可传递 `MessagePortMain`：

```typescript
const { port1, port2 } = new MessageChannelMain();
channel.send({ kind: 'port' }, [port2]); // port2 transfer 给渲染进程
```

### `IPCRendererChannel`

```typescript
new IPCRendererChannel(props: {
  channelName: string;
  ipcRenderer: IpcRenderer;
  projectName: string;
} & AbstractChannelProtocolProps)
```

- `projectName` 用于命名空间隔离
- `disconnect()` 会移除该 channelName 上的所有监听器
- `send(data, transfer?)`：`transfer` 非空时改用 `ipcRenderer.postMessage` 转发 `MessagePort`

### `ElectronMessagePortMainChannel`

```typescript
new ElectronMessagePortMainChannel(props?: {
  port?: MainPort;        // 可省略，之后 bindPort 绑定
} & AbstractChannelProtocolProps)
```

- 构造时（或 `bindPort` 时）自动调用 `port.start()`
- 远端关闭时自动断开
- `send()` 支持 `transfer` 参数

#### 延迟端口绑定（bindPort）

主进程的 broker 流程经常出现"先注册服务、后拿到 port"的情况。`bindPort` 让通道可以先与 service host / client 关联，等 port 真正到达再绑：

```typescript
import { ElectronMessagePortMainChannel } from '@x-oasis/async-call-rpc-electron';
import { serviceHost } from '@x-oasis/async-call-rpc';

// 先建未绑 port 的通道，挂上 service host
const channel = new ElectronMessagePortMainChannel({
  description: 'pending-broker-port',
});
channel.setServiceHost(serviceHost);

// 等 port 通过其他通道转发过来：
brokerChannel.on((event) => {
  if (event.data?.kind === 'port' && event.ports?.[0]) {
    channel.bindPort(event.ports[0]);
    // 此前 send 进 pendingSendEntries 的请求会自动 flush
  }
});
```

`bindPort` 是幂等的：通道已绑定 port 时再次调用是 no-op。绑定前 `send()` 会打 warn 并丢弃数据（业务一般通过 `pendingSendEntries` 排队，不会触发）。

### `ElectronUtilityProcessChannel`

```typescript
// 主进程侧
new ElectronUtilityProcessChannel({
  process: UtilityProcess;
} & AbstractChannelProtocolProps)

// Utility 进程侧
new ElectronUtilityProcessChannel({
  parentPort: ParentPort;
} & AbstractChannelProtocolProps)
```

- 主进程侧：进程退出时自动断开，`disconnect()` 会 kill 子进程
- Utility 进程侧：通过 `process.parentPort` 通信

## 目录结构与子路径导出

本包按 Electron 进程环境划分源码目录，并通过 **子路径导出**（sub-path exports）确保各环境的 bundle 不会引入不必要的依赖。

```
src/
├── browser/            → 渲染进程（浏览器环境，无 Electron API 依赖）
├── electron-browser/   → Preload 脚本（有 ipcRenderer、contextBridge 访问权限）
├── electron-main/      → 主进程 / Utility 进程（有 ipcMain、utilityProcess 等运行时 API）
├── types.ts            → 跨环境共享类型（编译后擦除）
└── index.ts            → 根入口，re-export 所有子路径
```

### 导入路径选择

| 导入路径                                            | 运行环境         | 依赖                                       | 典型用途                                                                            |
| --------------------------------------------------- | ---------------- | ------------------------------------------ | ----------------------------------------------------------------------------------- |
| `@x-oasis/async-call-rpc-electron/browser`          | 渲染进程         | 无 Electron API                            | `createPageChannel`、`ContextBridgeChannel`                                         |
| `@x-oasis/async-call-rpc-electron/electron-browser` | Preload          | `ipcRenderer`、`contextBridge`（类型级别） | `createPageBridge`、`IPCRendererChannel`、`registerOrchestratorHandler`             |
| `@x-oasis/async-call-rpc-electron/electron-main`    | 主进程 / Utility | `ipcMain`、`utilityProcess` 等运行时 API   | `IPCMainChannel`、`ElectronConnectionOrchestrator`、`ElectronUtilityProcessChannel` |
| `@x-oasis/async-call-rpc-electron`                  | 任意（兼容）     | 全部                                       | 向后兼容，会引入所有依赖                                                            |

### 为什么这样划分？

1. **`browser/`** — 渲染进程的代码不依赖任何 Electron 运行时 API，只通过 `globalThis.__rpc_bridge__`（由 preload 注入）通信。独立导出确保渲染进程 bundle 不会误引 `electron` 模块。

2. **`electron-browser/`** — Preload 脚本需要 `ipcRenderer` 和 `contextBridge`，但不引用主进程 API（如 `ipcMain`）。类型通过 `electron` 模块声明引入，编译后擦除，避免 bundle 问题。

3. **`electron-main/`** — 主进程和 Utility 进程使用完整 Electron 运行时 API，不能在渲染进程加载。

### 使用示例

```typescript
// 渲染进程（App.tsx）— 无 Electron 依赖
import { createPageChannel } from '@x-oasis/async-call-rpc-electron/browser';
const channel = createPageChannel('page↔preload');

// Preload 脚本 — 需要 ipcRenderer、contextBridge
import { createPageBridge } from '@x-oasis/async-call-rpc-electron/electron-browser';
const { channel, ipcChannel } = createPageBridge({
  ipcRenderer,
  channelName: 'app-rpc',
});

// 主进程 — 需要 ipcMain、utilityProcess 等
import {
  IPCMainChannel,
  ElectronConnectionOrchestrator,
} from '@x-oasis/async-call-rpc-electron/electron-main';
```

## Peer Dependencies

| 包         | 版本    | 说明     |
| ---------- | ------- | -------- |
| `electron` | >= 20.0 | 可选依赖 |

## 运行测试

```bash
pnpm test
```

## License

ISC
