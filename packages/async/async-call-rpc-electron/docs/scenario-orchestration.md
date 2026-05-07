---
title: Scenario Orchestration Best Practices
description: Best practices for orchestrating RPC connections across all Electron process topologies
order: 3
---

# Scenario Orchestration Best Practices

This guide distills patterns from `@x-oasis/async-call-rpc-electron`'s example suite into actionable best practices for every Electron IPC topology — from simple two-party IPC to complex multi-process orchestrations.

## Scenario Matrix

| Scenario                  | Topology    | Control Plane                           | Data Plane                       | Recommended Approach |
| ------------------------- | ----------- | --------------------------------------- | -------------------------------- | -------------------- |
| Main ↔ Renderer           | Two-party   | `IPCMainChannel` + `IPCRendererChannel` | —                                | Direct IPC           |
| Main ↔ Utility            | Two-party   | `ElectronUtilityProcessChannel`         | —                                | Direct Utility       |
| Renderer ↔ Main (Port)    | Two-party   | IPC                                     | `ElectronMessagePortMainChannel` | Orchestrator         |
| Renderer ↔ Utility (Port) | Three-party | IPC + Utility                           | `ElectronMessagePortMainChannel` | Orchestrator         |
| Utility ↔ Main (Port)     | Two-party   | Utility                                 | `ElectronMessagePortMainChannel` | Orchestrator         |
| Utility ↔ Utility (Port)  | Three-party | Utility × 2                             | `ElectronMessagePortMainChannel` | Orchestrator         |

---

## Pattern 1: Basic IPC — Main ↔ Renderer

**When to use:** Simple request/response between main and renderer. No high-frequency or large-payload data transfer.

```
Main Process                     Renderer Process
┌────────────┐    ipcMain/ipcRenderer    ┌──────────────┐
│  IPCMain   │◄──────────────────────────►│ IPCRenderer  │
│  Channel   │                            │   Channel    │
└────────────┘                            └──────────────┘
```

### Main Process

```typescript
import { BrowserWindow } from 'electron';
import { IPCMainChannel } from '@x-oasis/async-call-rpc-electron';
import { serviceHost } from '@x-oasis/async-call-rpc';

const win = new BrowserWindow({
  webPreferences: {
    preload: join(__dirname, 'preload.js'),
    contextIsolation: true,
    nodeIntegration: false,
  },
});

const channel = new IPCMainChannel({
  channelName: 'app-rpc',
  webContents: win.webContents,
  description: 'main→renderer RPC',
});

serviceHost.registerService('api', {
  channel,
  serviceHost,
  handlers: {
    getAppVersion: () => app.getVersion(),
    readConfig: (key: string) => config[key],
    updateConfig: (params: { key: string; value: unknown }) => {
      config[params.key] = params.value;
      return true;
    },
  },
});
```

### Preload / Renderer

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

const api = clientHost.registerClient('api', { channel }).createProxy<{
  getAppVersion(): Promise<string>;
  readConfig(key: string): Promise<unknown>;
  updateConfig(params: { key: string; value: unknown }): Promise<boolean>;
}>();
```

### Best Practices

- Each `BrowserWindow` requires its own `IPCMainChannel` instance bound to its `webContents`
- Always enable `contextIsolation: true` and `nodeIntegration: false`; expose IPC via `contextBridge`
- Wrap multiple handler parameters in a single object — the framework only passes the first arg

---

## Pattern 2: Utility Process — Main ↔ Utility

**When to use:** CPU-intensive workloads (image processing, compression, data analysis) in an isolated Node.js process without a Chromium renderer.

```
Main Process                     Utility Process
┌────────────┐   UtilityProcess   ┌──────────────┐
│ Electron   │◄───────────────────►│ Electron     │
│ Utility    │   (process/         │ Utility      │
│ Process    │    parentPort)      │ Process      │
│ Channel    │                     │ Channel      │
└────────────┘                     └──────────────┘
```

### Main Process

```typescript
import { utilityProcess } from 'electron';
import { ElectronUtilityProcessChannel } from '@x-oasis/async-call-rpc-electron';
import { clientHost, serviceHost } from '@x-oasis/async-call-rpc';

const child = utilityProcess.fork('./utility-worker.js');

const channel = new ElectronUtilityProcessChannel({
  process: child,
  description: 'main→utility RPC',
});

const worker = clientHost.registerClient('worker', { channel }).createProxy<{
  processImage(path: string): Promise<Buffer>;
  compress(data: string): Promise<string>;
}>();

serviceHost.registerService('main-callbacks', {
  channel,
  serviceHost,
  handlers: {
    onProgress: (percent: number) => console.log(`Progress: ${percent}%`),
  },
});
```

### Utility Process

```typescript
import { ElectronUtilityProcessChannel } from '@x-oasis/async-call-rpc-electron';
import { serviceHost, clientHost } from '@x-oasis/async-call-rpc';

const channel = new ElectronUtilityProcessChannel({
  parentPort: process.parentPort!,
  description: 'utility→main RPC',
});

const mainClient = clientHost
  .registerClient('main-callbacks', { channel })
  .createProxy();

serviceHost.registerService('worker', {
  channel,
  serviceHost,
  handlers: {
    processImage: async (path: string) => {
      mainClient.onProgress(50);
      // ... heavy computation
      return result;
    },
  },
});
```

### Best Practices

- Main-side `disconnect()` automatically kills the child process
- Use reverse RPC (Utility → Main) for progress reporting, status updates
- Always check `process.parentPort` availability in the utility worker

---

## Pattern 3: Direct MessagePort — Manual Port Exchange

**When to use:** High-frequency or large-payload communication where IPC overhead is prohibitive. You need fine-grained control over port lifecycle.

```
Main Process                     Renderer / Utility
┌────────────┐  MessageChannelMain  ┌──────────────┐
│ Electron   │◄──── port1 ─────────►│ RPCMessage   │
│ MessagePort│                      │ Channel /    │
│ MainChannel│──── port2 ──────────►│ Electron     │
│            │                      │ MessagePort  │
└────────────┘                      └──────────────┘
     ↑ via IPC control plane to deliver ports
```

### Core Concept: Late-Bound Channel

A `ElectronMessagePortMainChannel` can be created without a port. Services and clients are queued until `bindPort()` is called:

```typescript
const directChannel = new ElectronMessagePortMainChannel({
  description: 'late-bound direct port',
});

serviceHost.registerService('my-service', {
  channel: directChannel,
  serviceHost,
  handlers: { greet: (msg: string) => `hello: ${msg}` },
});

const client = clientHost
  .registerClient('peer-service', { channel: directChannel })
  .createProxy();

directChannel.bindPort(receivedPort);
```

### Renderer Acquires Main Port (Manual)

**Main Process:**

```typescript
const client = clientHost
  .registerClient('renderer-api', { channel: ipcChannel })
  .createProxy();

serviceHost.registerService('api', {
  channel: ipcChannel,
  serviceHost,
  handlers: {
    acquirePort(): [Electron.MessagePortMain] {
      const { port1, port2 } = new MessageChannelMain();
      client.assignPort(port2);
      return [port1];
    },
  },
});
```

**Renderer (Preload):**

```typescript
const api = clientHost
  .registerClient('api', { channel: ipcChannel })
  .createProxy();

serviceHost.registerService('renderer-api', {
  channel: ipcChannel,
  serviceHost,
  handlers: {
    assignPort(port: MessagePort) {
      directChannel.bindPort(port);
    },
  },
});

const ports = await api.acquirePort();
directChannel.bindPort(ports[0]);
```

### Utility Acquires Main Port (Manual)

**Main Process:**

```typescript
serviceHost.registerService('main-api', {
  channel: utilityChannel,
  serviceHost,
  handlers: {
    acquireMainPort(): [Electron.MessagePortMain] {
      const { port1, port2 } = new MessageChannelMain();
      utilityInitiatedChannel.bindPort(port2);
      return [port1];
    },
  },
});

setTimeout(() => {
  const { port1, port2 } = new MessageChannelMain();
  mainInitiatedChannel.bindPort(port1);
  utilityClient.assignMainPort(port2);
}, 2000);
```

### Utility ↔ Utility (Manual — Most Complex)

When two utility processes need direct ports, the main process acts as a **broker**, mediating two independent port exchanges:

```typescript
serviceHost.registerService('main-for-utility-a', {
  channel: utilityAChannel,
  serviceHost,
  handlers: {
    acquireUtilityBPort(): [Electron.MessagePortMain] {
      const { port1, port2 } = new MessageChannelMain();
      utilityBClient.assignUtilityAPort(port2);
      return [port1];
    },
  },
});

serviceHost.registerService('main-for-utility-b', {
  channel: utilityBChannel,
  serviceHost,
  handlers: {
    acquireUtilityAPort(): [Electron.MessagePortMain] {
      const { port1, port2 } = new MessageChannelMain();
      utilityAClient.assignUtilityBPort(port2);
      return [port1];
    },
  },
});
```

### Manual Exchange Pain Points

| Problem                                 | Impact                    |
| --------------------------------------- | ------------------------- |
| 5+ manual steps per connection          | Error-prone boilerplate   |
| Bidirectional ports double the protocol | Exponential complexity    |
| No reconnection logic                   | Connections drop silently |
| No state tracking                       | Debugging is guesswork    |
| Port delivery ordering assumptions      | Race conditions           |

---

## Pattern 4: Orchestrator — Declarative Port Connections

**When to use:** Any scenario requiring direct MessagePort connections. The orchestrator replaces manual port exchange with a single `connect()` call.

### Why Orchestrator Over Manual Exchange

```
Manual (5–10 steps):              Orchestrator (3 lines):
1. new MessageChannelMain()       1. registerParticipant('a', ch1, type1)
2. bindPort(port1)                2. registerParticipant('b', ch2, type2)
3. client.assignPort(port2)       3. await orchestrator.connect('a', 'b')
4. handler assigns port
5. verify connection
... (repeat for bidirectional)
```

### Two-Party: Renderer ↔ Main

```typescript
import {
  ElectronConnectionOrchestrator,
  ElectronMessagePortMainChannel,
} from '@x-oasis/async-call-rpc-electron';

const mainDirectChannel = new ElectronMessagePortMainChannel({
  description: 'main↔renderer direct port',
});

serviceHost.registerService('main-direct', {
  channel: mainDirectChannel,
  serviceHost,
  handlers: { greet: (msg: string) => `hello from main: ${msg}` },
});

const orchestrator = new ElectronConnectionOrchestrator({
  logger: (level, msg) => console.log(`[orchestrator:${level}] ${msg}`),
});

const mainParticipantChannel = {
  makeRequest(_path: string, method: string, port: any) {
    if (method === 'activateConnection' && port) {
      mainDirectChannel.bindPort(port);
    }
    return { promise: Promise.resolve(), seqId: 0 };
  },
  send: () => {},
  on: () => () => {},
  activate: () => {},
  disconnect: () => {},
  onDidConnected: () => {},
  onDidDisconnected: () => {},
} as any;

orchestrator.registerParticipant('main', mainParticipantChannel, 'process');
orchestrator.registerParticipant('renderer', ipcChannel, 'renderer');

await orchestrator.connect('main', 'renderer');
```

**Renderer (Preload):**

```typescript
import { registerOrchestratorHandler } from '@x-oasis/async-call-rpc-electron';
import { RPCMessageChannel } from '@x-oasis/async-call-rpc-web';

const directChannel = new RPCMessageChannel({
  description: 'renderer↔main direct port',
});

registerOrchestratorHandler(ipcChannel, (port: MessagePort) => {
  directChannel.bindPort(port);
});
```

### Three-Party: Renderer ↔ Utility

The most common real-world scenario — a renderer needs to call heavy computation in a utility process directly.

```typescript
const utilityProc = utilityProcess.fork(workerPath);
const utilityChannel = new ElectronUtilityProcessChannel({
  process: utilityProc,
  description: 'main→utility IPC',
});

const orchestrator = new ElectronConnectionOrchestrator({
  logger: (level, msg) => console.log(`[${level}] ${msg}`),
  enableStats: true,
  heartbeat: { enabled: true, intervalMs: 10_000, timeoutMs: 5_000 },
});

orchestrator.registerParticipant('renderer', ipcChannel, 'renderer');
orchestrator.registerParticipant('utility', utilityChannel, 'utility');

await orchestrator.connect('renderer', 'utility');
```

**Utility Worker:**

```typescript
import {
  registerOrchestratorHandler,
  ElectronMessagePortMainChannel,
} from '@x-oasis/async-call-rpc-electron';

const directChannel = new ElectronMessagePortMainChannel({
  description: 'utility↔renderer direct port',
});

registerOrchestratorHandler(mainChannel, (port: any) => {
  directChannel.bindPort(port);
});
```

### Utility ↔ Utility

```typescript
orchestrator.registerParticipant('utility-a', utilityAChannel, 'utility');
orchestrator.registerParticipant('utility-b', utilityBChannel, 'utility');

await orchestrator.connect('utility-a', 'utility-b');
```

Both workers use the same `registerOrchestratorHandler` pattern:

```typescript
registerOrchestratorHandler(mainChannel, (port: any) => {
  directChannel.bindPort(port);
});
```

---

## Control Plane vs Data Plane

Every complex RPC topology has two layers:

| Layer             | Purpose                                                     | Channel Types                                                           | Lifetime          |
| ----------------- | ----------------------------------------------------------- | ----------------------------------------------------------------------- | ----------------- |
| **Control Plane** | Service registration, port delivery, orchestrator signaling | `IPCMainChannel`, `IPCRendererChannel`, `ElectronUtilityProcessChannel` | Long-lived        |
| **Data Plane**    | High-throughput application data                            | `ElectronMessagePortMainChannel`, `RPCMessageChannel` (web)             | Created on demand |

```
┌─────────────────────────────────────────────────────┐
│                     Control Plane                    │
│  (IPC / UtilityProcess — always active)              │
│                                                      │
│  ┌────────┐  register  ┌──────────┐  register  ┌──┐ │
│  │Renderer│◄──────────►│   Main   │◄──────────►│U │ │
│  │  IPC   │            │(Broker)  │            │  │ │
│  └────────┘            └──────────┘            └──┘ │
│                                                      │
│  ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─  │
│                                                      │
│                     Data Plane                       │
│  (MessagePort — created by orchestrator or manually) │
│                                                      │
│  ┌────────┐  direct port  ┌──────────┐  direct port │
│  │Renderer│◄─────────────►│  Utility │◄─────────────┤│
│  │        │               │  Process │              ││
│  └────────┘               └──────────┘              │
└─────────────────────────────────────────────────────┘
```

### Best Practices

- Establish the control plane first, then create data plane connections
- Use the control plane for service discovery and port delivery
- Use data plane for high-frequency, latency-sensitive communication
- The main process is always the broker for control plane — it owns `MessageChannelMain` creation

---

## Channel Selection Guide

```
Need RPC between processes?
│
├─ Main ↔ Renderer?
│  ├─ Low frequency? ──► IPCMainChannel + IPCRendererChannel
│  └─ High frequency? ──► MessagePort via Orchestrator
│
├─ Main ↔ Utility?
│  ├─ Low frequency? ──► ElectronUtilityProcessChannel
│  └─ High frequency? ──► MessagePort via Orchestrator
│
├─ Renderer ↔ Utility?
│  └─ Always ──► MessagePort via Orchestrator
│                (main as broker)
│
└─ Utility ↔ Utility?
   └─ Always ──► MessagePort via Orchestrator
                 (main as broker)
```

### Channel Package Mapping

| Process         | Channel Type                     | Package                   |
| --------------- | -------------------------------- | ------------------------- |
| Main process    | `IPCMainChannel`                 | `async-call-rpc-electron` |
| Main process    | `ElectronMessagePortMainChannel` | `async-call-rpc-electron` |
| Main process    | `ElectronUtilityProcessChannel`  | `async-call-rpc-electron` |
| Renderer        | `IPCRendererChannel`             | `async-call-rpc-electron` |
| Renderer        | `RPCMessageChannel`              | `async-call-rpc-web`      |
| Utility process | `ElectronUtilityProcessChannel`  | `async-call-rpc-electron` |
| Utility process | `ElectronMessagePortMainChannel` | `async-call-rpc-electron` |

> Renderer processes receive standard Web `MessagePort`, so they use `@x-oasis/async-call-rpc-web` for the data plane — not the electron package.

---

## Main Process as Broker Pattern

In three-party scenarios (Renderer ↔ Utility, Utility ↔ Utility), the main process always acts as the **broker**:

1. It holds control-plane channels to all participants
2. It creates `MessageChannelMain` port pairs
3. It delivers ports to participants via their control-plane channels

### Manual Broker Implementation

```typescript
serviceHost.registerService('api-for-renderer', {
  channel: rendererChannel,
  serviceHost,
  handlers: {
    acquireUtilityPort(): [Electron.MessagePortMain] {
      const { port1, port2 } = new MessageChannelMain();
      utilityClient.assignRendererPort(port2);
      return [port1];
    },
  },
});
```

### Orchestrator Broker

```typescript
orchestrator.registerParticipant('renderer', rendererChannel, 'renderer');
orchestrator.registerParticipant('utility', utilityChannel, 'utility');
await orchestrator.connect('renderer', 'utility');
```

The orchestrator internally performs the same broker logic but with automatic port creation, delivery, verification, and reconnection.

---

## Bidirectional RPC Pattern

Both parties register services **and** create clients on the same channel:

```typescript
// Party A
serviceHost.registerService('a-service', {
  channel: directChannel,
  serviceHost,
  handlers: { greet: (msg: string) => `A says: ${msg}` },
});

const bClient = clientHost
  .registerClient('b-service', { channel: directChannel })
  .createProxy();

// Party B
serviceHost.registerService('b-service', {
  channel: directChannel,
  serviceHost,
  handlers: { ping: (msg: string) => `B says: ${msg}` },
});

const aClient = clientHost
  .registerClient('a-service', { channel: directChannel })
  .createProxy();
```

### Best Practices

- Name services clearly to indicate ownership: `main-direct`, `utility-direct`, `renderer-direct`
- Register services **before** binding the port — queued messages will be processed once the port is bound
- For bidirectional communication on manually exchanged ports, use separate `ElectronMessagePortMainChannel` instances per direction to avoid message collision

---

## Orchestrator Lifecycle Management

### Event Handling

```typescript
const orchestrator = new ElectronConnectionOrchestrator({
  heartbeat: { enabled: true, intervalMs: 10_000, timeoutMs: 5_000 },
  enableStats: true,
});

orchestrator.onReady(({ connectionId }) => {
  console.log(`Connection ${connectionId} is ready`);
});

orchestrator.onDisconnected(({ connectionId, error }) => {
  console.warn(`Connection ${connectionId} lost:`, error);
});

orchestrator.onReconnecting(({ connectionId, attempt }) => {
  console.log(`Reconnecting ${connectionId}, attempt ${attempt}`);
});

orchestrator.onReconnected(({ connectionId }) => {
  console.log(`Connection ${connectionId} restored`);
});

orchestrator.onReconnectFailed(({ connectionId }) => {
  console.error(
    `Connection ${connectionId} failed permanently — manual restart needed`
  );
});

orchestrator.onStateChange((event) => {
  updateUI(event);
});
```

### Forwarding Events to Renderer

When the orchestrator runs in the main process and the UI needs connection state:

```typescript
orchestrator.onStateChange((event) => {
  mainWindow?.webContents.send('orchestrator:stateChange', event);
});

orchestrator.onReady((event) => {
  mainWindow?.webContents.send('orchestrator:ready', event);
});

ipcMain.handle('orchestrator:getStatus', async () => {
  const info = orchestrator.getConnectionInfo('renderer', 'utility');
  if (!info) return null;
  const stats = orchestrator.getConnectionStats(info.connectionId);
  return { ...info, stats };
});
```

### Configuration for Production

```typescript
const orchestrator = new ElectronConnectionOrchestrator({
  heartbeat: {
    enabled: true,
    intervalMs: 30_000,
    timeoutMs: 5_000,
  },
  reconnectPolicy: new ExponentialBackoffPolicy({
    initialDelayMs: 1_000,
    maxDelayMs: 30_000,
    maxRetries: 10,
  }),
  circuitBreaker: {
    enabled: true,
    failureRateThreshold: 0.5,
    volumeThreshold: 5,
    rollingWindowMs: 10_000,
    openDurationMs: 30_000,
  },
  enableStats: true,
  logger: (level, msg, data) => console.log(`[${level}] ${msg}`, data),
});
```

---

## Security Best Practices

### Always Use contextBridge

```typescript
const win = new BrowserWindow({
  webPreferences: {
    preload: join(__dirname, 'preload.js'),
    contextIsolation: true,
    nodeIntegration: false,
  },
});
```

```typescript
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

### Never Expose Full ipcRenderer

```typescript
contextBridge.exposeInMainWorld('ipcRenderer', ipcRenderer);
```

---

## Common Pitfalls

### 1. Handler Only Receives the First Argument

```typescript
handlers: {
  updateConfig: (key: string, value: unknown) => {
    /* value is always undefined! */
  };
}

handlers: {
  updateConfig: (params: { key: string; value: unknown }) => {
    /* correct */
  };
}
```

### 2. Not Registering Orchestrator Handler Before connect()

```typescript
await orchestrator.connect('main', 'renderer');
registerOrchestratorHandler(channel, onPort);
```

```typescript
registerOrchestratorHandler(channel, onPort);
await orchestrator.connect('main', 'renderer');
```

### 3. Forgetting to Bind the Received Port

```typescript
registerOrchestratorHandler(channel, (port) => {
  console.log('Got port:', port);
});
```

```typescript
registerOrchestratorHandler(channel, (port) => {
  directChannel.bindPort(port);
});
```

### 4. Using the Wrong Channel Type in Renderer

The renderer receives a standard Web `MessagePort`, not Electron's `MessagePortMain`:

```typescript
import { RPCMessageChannel } from '@x-oasis/async-call-rpc-web';

registerOrchestratorHandler(ipcChannel, (port: MessagePort) => {
  const directChannel = new RPCMessageChannel({
    description: 'renderer data plane',
  });
  directChannel.bindPort(port);
});
```

### 5. Not Handling Reconnection Failure

```typescript
orchestrator.onReconnectFailed(({ connectionId }) => {
  console.error(`Permanent failure on ${connectionId} — user action required`);
});
```

Without this handler, a permanently dead connection goes unnoticed.

### 6. Assuming connect() Creates a New Connection Each Call

`connect()` is idempotent for the same participant pair — calling it again returns the existing `ConnectionInfo`.

---

## Decision Flowchart: Manual vs Orchestrator

```
Need direct MessagePort?
│
├─ Is it a simple, one-time, one-direction connection?
│  └─ Yes ──► Manual exchange is acceptable
│
├─ Do you need reconnection, heartbeat, or stats?
│  └─ Yes ──► Orchestrator (mandatory)
│
├─ Is it a three-party topology (renderer ↔ utility)?
│  └─ Yes ──► Orchestrator (strongly recommended)
│
├─ Is it utility ↔ utility?
│  └─ Yes ──► Orchestrator (strongly recommended)
│
└─ Is it a long-lived production connection?
   └─ Yes ──► Orchestrator (recommended)
```

**TL;DR:** Use the orchestrator for any non-trivial scenario. The manual approach is only justified for quick prototypes or single-use, fire-and-forget ports.

---

## Example Reference

| Example                                              | Pattern                   | Approach       |
| ---------------------------------------------------- | ------------------------- | -------------- |
| `ipc-example`                                        | Main ↔ Renderer           | Direct IPC     |
| `utility-process-example`                            | Main ↔ Utility            | Direct Utility |
| `renderer-acquire-main-port-example`                 | Renderer ↔ Main (Port)    | Manual         |
| `renderer-acquire-main-port-orchestrator-example`    | Renderer ↔ Main (Port)    | Orchestrator   |
| `renderer-acquire-utility-port-example`              | Renderer ↔ Utility (Port) | Manual         |
| `renderer-acquire-utility-port-orchestrator-example` | Renderer ↔ Utility (Port) | Orchestrator   |
| `utility-acquire-main-port-example`                  | Utility ↔ Main (Port)     | Manual         |
| `utility-acquire-main-port-orchestrator-example`     | Utility ↔ Main (Port)     | Orchestrator   |
| `utility-acquire-utility-port-example`               | Utility ↔ Utility (Port)  | Manual         |
| `utility-acquire-utility-port-orchestrator-example`  | Utility ↔ Utility (Port)  | Orchestrator   |

---

## See Also

- [Package Overview](/packages/async/async-call-rpc-electron/)
- [Connection Orchestrator API](/packages/async/async-call-rpc-electron/orchestrator)
- [Base Orchestrator Documentation](/packages/async/async-call-rpc/orchestrator/)
- [Examples Source](https://github.com/red-armor/x-oasis/tree/main/packages/async/async-call-rpc-electron/examples)
