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
  webContents: WebContents;
} & AbstractChannelProtocolProps)
```

- 每个实例绑定一个 `WebContents`，多窗口需创建多个实例
- `channelName` 需与渲染进程侧的 `IPCRendererChannel` 一致
- 自动过滤非目标 `WebContents` 的消息
- `WebContents` 销毁时自动断开

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

### `ElectronMessagePortMainChannel`

```typescript
new ElectronMessagePortMainChannel(props: {
  port: MainPort;
} & AbstractChannelProtocolProps)
```

- 构造时自动调用 `port.start()`
- 远端关闭时自动断开
- `send()` 支持 `transfer` 参数

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
