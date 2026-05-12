---
title: Scenario Orchestration Best Practices
description: Best practices for orchestrating RPC connections across all Electron process topologies
order: 3
---

# Scenario Orchestration Best Practices

This guide distills patterns from `@x-oasis/async-call-rpc-electron`'s example suite into actionable best practices for every Electron IPC topology — from simple two-party IPC to complex multi-process orchestrations.

## Scenario Matrix

| Scenario                  | Topology    | Control Plane                           | Data Plane                       | Recommended Approach            |
| ------------------------- | ----------- | --------------------------------------- | -------------------------------- | ------------------------------- |
| Main ↔ Renderer           | Two-party   | `IPCMainChannel` + `IPCRendererChannel` | —                                | Direct IPC                      |
| Main ↔ Utility            | Two-party   | `ElectronUtilityProcessChannel`         | —                                | Direct Utility                  |
| Renderer ↔ Main (Port)    | Two-party   | IPC                                     | `ElectronMessagePortMainChannel` | Orchestrator                    |
| Renderer ↔ Utility (Port) | Three-party | IPC + Utility                           | `ElectronMessagePortMainChannel` | Orchestrator                    |
| Utility ↔ Main (Port)     | Two-party   | Utility                                 | `ElectronMessagePortMainChannel` | Orchestrator                    |
| Utility ↔ Utility (Port)  | Three-party | Utility × 2                             | `ElectronMessagePortMainChannel` | Orchestrator                    |
| Renderer ↔ Multi-Utility  | Multi-party | IPC + Utility × N                       | `ElectronMessagePortMainChannel` | Orchestrator + ParticipantProxy |

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

## Pattern 5: Pagelet Proxy — Renderer ↔ Multi-Utility via Proxy

**When to use:** A renderer needs to call services on multiple utility processes (pagelet, daemon, shared), but doesn't want direct connections to each. Instead, a "pagelet" utility process acts as a proxy, forwarding renderer calls to other utilities.

```
Renderer Process                    Main Process                    Utility Processes
┌──────────┐   IPC    ┌───────────┐  Orchestrator  ┌──────────┐
│          │◄────────►│           │◄──────────────►│ pagelet  │
│ renderer │          │   main    │                │ (proxy)  │
│          │          │ (broker)  │                └────┬─────┘
└──────────┘          └───────────┘                     │
                                              direct    │  direct
                                              ports     │  ports
                                                        ▼
                                               ┌──────────────┐
                                               │ shared/daemon│
                                               │ (workers)    │
                                               └──────────────┘
```

### Architecture: Control Plane + Data Plane

The pagelet connects to the renderer, shared, and daemon through the orchestrator, obtaining direct `MessagePort` channels to each:

- **Control plane**: All participants registered with the orchestrator via their IPC/UtilityProcess channels
- **Data plane**: Direct `MessagePort` pairs between pagelet ↔ renderer, pagelet ↔ shared, pagelet ↔ daemon

The renderer never directly connects to shared/daemon — it only talks to pagelet, which forwards the calls.

### Main Process: Orchestrator Setup

```typescript
import { app, BrowserWindow, utilityProcess } from 'electron';
import {
  IPCMainChannel,
  ElectronUtilityProcessChannel,
  ElectronConnectionOrchestrator,
} from '@x-oasis/async-call-rpc-electron';
import { serviceHost } from '@x-oasis/async-call-rpc';

app.whenReady().then(async () => {
  const mainWindow = new BrowserWindow({
    webPreferences: {
      preload: join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  const ipcChannel = new IPCMainChannel({
    channelName: 'app-rpc',
    webContents: mainWindow.webContents,
  });

  const pageletProc = utilityProcess.fork(join(__dirname, 'pagelet-worker.js'));
  const pageletChannel = new ElectronUtilityProcessChannel({
    process: pageletProc,
  });

  const sharedProc = utilityProcess.fork(join(__dirname, 'shared-worker.js'));
  const sharedChannel = new ElectronUtilityProcessChannel({
    process: sharedProc,
  });

  const daemonProc = utilityProcess.fork(join(__dirname, 'daemon-worker.js'));
  const daemonChannel = new ElectronUtilityProcessChannel({
    process: daemonProc,
  });

  const orchestrator = new ElectronConnectionOrchestrator({
    enableStats: true,
    heartbeat: { enabled: true, intervalMs: 10_000, timeoutMs: 5_000 },
  });

  orchestrator.registerParticipant('renderer', ipcChannel, 'renderer');
  orchestrator.registerParticipant('pagelet', pageletChannel, 'utility');
  orchestrator.registerParticipant('shared', sharedChannel, 'utility');
  orchestrator.registerParticipant('daemon', daemonChannel, 'utility');

  // The pagelet will self-connect via ParticipantOrchestratorProxy
  console.log('[main] orchestrator ready');
});
```

### Pagelet Worker: Self-Connect + Proxy Services

The pagelet uses `createParticipantProxy` to self-connect to all peers, then exposes proxy handlers that forward renderer calls to shared/daemon:

```typescript
import {
  ElectronUtilityProcessChannel,
  createParticipantProxy,
} from '@x-oasis/async-call-rpc-electron';
import { clientHost, serviceHost } from '@x-oasis/async-call-rpc';

const mainChannel = new ElectronUtilityProcessChannel({
  parentPort: process.parentPort as any,
});

const proxy = createParticipantProxy({
  selfId: 'pagelet',
  controlChannel: mainChannel,
});

async function boot() {
  const rendererConn = await proxy.connect('renderer');
  const sharedConn = await proxy.connect('shared');
  const daemonConn = await proxy.connect('daemon');

  const rendererChannel = rendererConn.getChannel();
  const sharedChannel = sharedConn.getChannel();
  const daemonChannel = daemonConn.getChannel();

  const sharedClient = clientHost
    .registerClient('shared-rpc', { channel: sharedChannel })
    .createProxy<{
      echo(msg: string): Promise<string>;
      getConfig(key: string): Promise<string>;
    }>();

  const daemonClient = clientHost
    .registerClient('daemon-rpc', { channel: daemonChannel })
    .createProxy<{
      echo(msg: string): Promise<string>;
      systemStatus(): Promise<string>;
    }>();

  // Expose proxy API to renderer
  serviceHost.registerService('pagelet-api', {
    channel: rendererChannel,
    serviceHost,
    handlers: {
      info(): string {
        return `pagelet ready (pid=${process.pid})`;
      },
      async callSharedEcho(msg: string): Promise<string> {
        return sharedClient.echo(msg);
      },
      async callDaemonSystemStatus(): Promise<string> {
        return daemonClient.systemStatus();
      },
    },
  });
}

boot().catch(console.error);
```

### Shared/Daemon Workers: `createUtilityParticipant`

Workers that only need to expose services (not initiate connections) use the simpler `createUtilityParticipant`:

```typescript
import { createUtilityParticipant } from '@x-oasis/async-call-rpc-electron';

const participant = createUtilityParticipant({
  parentPort: process.parentPort as any,
  mainChannelDescription: 'daemon→main IPC channel',
  directChannelDescription: 'daemon↔pagelet direct port',
});

const handlers = {
  systemStatus(): string {
    return `system OK, uptime=${Math.floor(process.uptime())}s`;
  },
  echo(msg: string): string {
    return `daemon echo: ${msg}`;
  },
};

participant.registerControlService('daemon-rpc', handlers);
participant.registerService('daemon-rpc', handlers);
```

- `registerControlService` — accessible from the main process via the control-plane channel
- `registerService` — accessible from any peer via the data-plane channel

### Renderer: Call Pagelet API

The renderer only knows about `pagelet-api`. It doesn't need to know about shared/daemon:

```typescript
import { createOrchestratorClient } from '@x-oasis/async-call-rpc-electron/browser';

const client = createOrchestratorClient({
  directChannelDescription: 'page↔preload',
  ipcChannelDescription: 'page↔preload:ipc',
});

const pageletClient = client.getService<any>('pagelet-api');

// Call through the proxy chain
const status = await pageletClient.callDaemonSystemStatus();
const echo = await pageletClient.callSharedEcho('hello');
```

---

## Pattern 6: Subscription — Real-Time Data Push

**When to use:** When a utility process needs to push real-time data (status updates, logs, metrics) to the renderer through the pagelet proxy.

`async-call-rpc` supports two subscription patterns. Both work across orchestrator data-plane channels.

### Event Method (Ping-Pong Callback)

Best for status updates, config changes, and event notifications. Methods named `on*` are automatically treated as event methods by the framework.

**Daemon worker:**

```typescript
const handlers = {
  onSystemStatusChange(callback: (status: any) => void) {
    const interval = setInterval(() => {
      callback({
        timestamp: Date.now(),
        uptime: process.uptime(),
        memoryUsage: process.memoryUsage(),
      });
    }, 2000);
    return () => clearInterval(interval);
  },
};

participant.registerService('daemon-rpc', handlers);
```

**Pagelet proxy (forwarding):**

```typescript
serviceHost.registerService('pagelet-api', {
  channel: rendererChannel,
  serviceHost,
  handlers: {
    onDaemonStatusChange(callback: (status: any) => void) {
      return daemonClient.onSystemStatusChange(callback);
    },
  },
});
```

**Renderer:**

```typescript
const unsub = pageletClient.onDaemonStatusChange((data) => {
  console.log('Status:', data);
});
// Later: unsub.unsubscribe();
```

The `on*` naming convention enables the framework to automatically serialize the callback across process boundaries — the renderer's callback is stored client-side, and a `remoteCallback` is injected server-side.

### Observable Subscribe (Streaming)

Best for high-frequency data streams (CPU metrics, file watchers). The handler returns an object with `subscribe()`. Use `clientHost.subscribe()` on the client.

**Daemon worker:**

```typescript
const handlers = {
  watchCpuUsage() {
    return {
      subscribe(observer: {
        next?: (value: any) => void;
        error?: (err: Error) => void;
        complete?: () => void;
      }) {
        let tick = 0;
        const interval = setInterval(() => {
          observer.next?.({ tick: ++tick, cpu: Math.random() * 100 });
        }, 1000);
        return { unsubscribe: () => clearInterval(interval) };
      },
    };
  },
};

participant.registerService('daemon-rpc', handlers);
```

**Pagelet proxy — bridge observable to event method:**

> ⚠️ Observable subscriptions **cannot** be forwarded as-is across process boundaries because callbacks are not serializable. Wrap them in an `on*` event method:

```typescript
const daemonSubClient = clientHost.registerClient('daemon-rpc', {
  channel: daemonChannel,
});

serviceHost.registerService('pagelet-api', {
  channel: rendererChannel,
  serviceHost,
  handlers: {
    onDaemonCpuUsage(callback: (data: any) => void) {
      const sub = daemonSubClient.subscribe('watchCpuUsage', [], {
        onData: (value) => callback(value),
        onError: (err) => console.error(err),
        onComplete: () => console.log('Stream ended'),
      });
      return { unsubscribe: () => sub.unsubscribe() };
    },
  },
});
```

**Renderer:**

```typescript
const unsub = pageletClient.onDaemonCpuUsage((data) => {
  console.log('CPU:', data.cpu);
});
```

### Subscription Pattern Comparison

| Aspect              | Event Method (`on*`)            | Observable Subscribe                     |
| ------------------- | ------------------------------- | ---------------------------------------- |
| Auto-detection      | Yes (by `on` prefix convention) | No (explicit `subscribe()` API)          |
| Cross-process proxy | ✅ Callbacks auto-serialized    | ⚠️ Must wrap in `on*` method             |
| Completion signal   | No (infinite until unsubscribe) | Yes (`onComplete`)                       |
| Error handling      | Limited                         | Full (`onError`)                         |
| Best for            | Status, config, log events      | High-frequency streams, finite sequences |

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

## Multi-Service Path Over a Shared Channel

One of the most powerful features of `async-call-rpc` is that multiple service paths can share the same transport channel without cross-talk. This is critical for the orchestrator pattern because the control-plane channel carries both your application RPCs and the internal orchestrator signaling (`activateConnection`) on the same wire.

### How It Works

Each `RPCService` is bound to a `requestPath`. When a message arrives, the framework dispatches it only to the service whose path matches — all other services ignore it. This means you can register application services and the orchestrator handler on the same channel simultaneously:

```typescript
// Application service on the control-plane channel
serviceHost.registerService('app-api', {
  channel: ipcChannel,
  serviceHost,
  handlers: {
    getVersion: () => app.getVersion(),
  },
});

// Orchestrator handler on the SAME channel — no conflict
registerOrchestratorHandler(ipcChannel, (port) => {
  directChannel.bindPort(port);
});
```

The internal orchestrator service path (`__x_oasis_orchestrator__`) never collides with user-defined service names.

### Use Case: Forwarding Proxy

When a renderer needs to call services on a utility process without a direct port, you can expose the utility's services through the main process as a **forwarding proxy**:

```typescript
// Main process forwards calls from renderer to utility
serviceHost.registerService('utility-proxy', {
  channel: rendererChannel,
  serviceHost,
  handlers: {
    processImage: async (path: string) => {
      return utilityClient.processImage(path);
    },
  },
});
```

This pattern is especially useful when:

- The utility process hasn't started yet and you need a fallback
- The direct port connection is in `TRANSIENT_FAILURE` state
- You want to add middleware (logging, auth) at the broker level

---

## Process Restart & Channel Replacement

When a utility process crashes and is respawned, its PID and underlying transport change. The orchestrator's `replaceParticipantChannel` API lets you swap the control-plane channel without losing connection history, stats, or subscriptions.

### Typical Flow

```
1. Utility process crashes
2. Main process detects via onDidDisconnected or process 'exit'
3. Main process respawns utility
4. Call orchestrator.replaceParticipantChannel('utility', newChannel)
5. All connections automatically transition to TRANSIENT_FAILURE → reconnect
6. Reconnect succeeds with new ports delivered via new channel
```

### Example

```typescript
import { ElectronUtilityProcessChannel } from '@x-oasis/async-call-rpc-electron';

// Initial setup
let utilityProc = utilityProcess.fork(workerPath);
let utilityChannel = new ElectronUtilityProcessChannel({
  process: utilityProc,
  description: 'main→utility',
});

orchestrator.registerParticipant('utility', utilityChannel, 'utility');
await orchestrator.connect('renderer', 'utility');

// Listen for process exit
utilityProc.on('exit', () => {
  // Respawn
  utilityProc = utilityProcess.fork(workerPath);
  const newChannel = new ElectronUtilityProcessChannel({
    process: utilityProc,
    description: 'main→utility (respawned)',
  });

  // Replace without losing connection state
  orchestrator.replaceParticipantChannel('utility', newChannel);
  // All connections auto-reconnect via the new channel
});
```

### Without replaceParticipantChannel (Bad)

```typescript
// ❌ Loses all stats, connection history, subscriptions
orchestrator.unregisterParticipant('utility');
orchestrator.registerParticipant('utility', newChannel, 'utility');
await orchestrator.connect('renderer', 'utility');
```

### Disabling Auto-Reconnect

If you want to control reconnection manually (e.g., wait for user confirmation):

```typescript
orchestrator.replaceParticipantChannel('utility', newChannel, {
  autoReconnect: false,
});

// Later, when ready:
// The connection is still in TRANSIENT_FAILURE and will be
// picked up by the reconnect scheduler on the next attempt.
```

---

## Disconnect vs Kill (Utility Process)

By default, `ElectronUtilityProcessChannel.disconnect()` kills the child process. In the channel-replacement scenario, you only want to detach from the old transport without killing the process.

### Using `setKillOnDisconnect`

```typescript
const channel = new ElectronUtilityProcessChannel({
  process: utilityProc,
});

// Before replacing — don't kill the process on disconnect
channel.setKillOnDisconnect(false);
channel.disconnect();
// Process is still alive, but the RPC channel is disconnected

// To re-enable kill-on-disconnect for the new channel:
const newChannel = new ElectronUtilityProcessChannel({
  process: utilityProc,
});
// newChannel defaults to killOnDisconnect: true
```

---

## Rebinding MessagePortMain Channels

When a participant reconnects, it receives a new `MessagePortMain`. The `bindPort` method on `ElectronMessagePortMainChannel` supports a `rebind` option to replace an existing port:

### Basic Rebind

```typescript
const channel = new ElectronMessagePortMainChannel({
  port: oldPort,
  description: 'direct data channel',
});

// When orchestrator delivers a new port after reconnection:
channel.bindPort(newPort, { rebind: true });
// oldPort is closed, newPort is activated
```

### Inside registerOrchestratorHandler

For reconnection to work end-to-end, the handler should use `rebind: true`:

```typescript
const directChannel = new ElectronMessagePortMainChannel({
  description: 'utility↔renderer direct',
});

registerOrchestratorHandler(mainChannel, (port: any) => {
  directChannel.bindPort(port, { rebind: true });
});
```

Without `rebind: true`, the second `bindPort` call is a no-op if a port is already bound — meaning the participant would keep using the stale port from before the crash.

---

## Event Forwarding

When building a debug dashboard or monitoring UI, you often need to observe all orchestrator events in a single stream. The `createEventForwarder` API consolidates all 7 event types into one callback:

```typescript
const forwarder = orchestrator.createEventForwarder((event) => {
  console.log(`[${event.type}]`, event.payload);
  // event.type: 'stateChange' | 'ready' | 'disconnected' |
  //             'reconnecting' | 'reconnected' | 'reconnectFailed' | 'closed'

  // Forward to renderer for UI
  mainWindow?.webContents.send('orchestrator:event', event);
});

// Clean up when no longer needed
forwarder.dispose();
```

This eliminates the need to subscribe to each of the 7 event types individually.

---

## Topology Query APIs

For monitoring and debugging, the orchestrator provides list APIs to inspect all registered participants and managed connections:

### List Participants

```typescript
const participants = orchestrator.listParticipants();
// Returns: Array<{ id: string; type: ParticipantType; registeredAt: number }>
```

### List Connections

```typescript
const connections = orchestrator.listConnections();
// Returns: Array<{ connectionId: string; fromId: string; toId: string;
//                   state: ConnectionState; stats?: ConnectionStats }>
```

### Use Case: Connection Dashboard

```typescript
ipcMain.handle('orchestrator:getStatus', async () => {
  return {
    participants: orchestrator.listParticipants(),
    connections: orchestrator.listConnections(),
  };
});
```

---

## Bidirectional Connection Semantics

`connect('a', 'b')` and `connect('b', 'a')` resolve to the **same** connection — the connection ID is always the lexicographically smaller ID first (e.g., `'a--b'`, never `'b--a'`). This means:

- Both `connect('renderer', 'utility')` and `connect('utility', 'renderer')` return the same `ConnectionInfo`
- `getConnectionInfo('renderer', 'utility')` and `getConnectionInfo('utility', 'renderer')` return the same result

If you need directional semantics (e.g., different service sets per direction), use `fromServices` and `toServices` in the `ConnectionConfig`:

```typescript
await orchestrator.connect('renderer', 'utility', {
  fromServices: { rendererApi: { ping: () => 'pong' } },
  toServices: { utilityApi: { compute: (n: number) => n * 2 } },
});
```

---

## Heartbeat Configuration

The `ElectronConnectionOrchestrator` provides a concrete heartbeat implementation that sends RPC pings through the control plane (`__x_oasis_orchestrator__`) and detects dead connections when pong responses time out.

### How It Works

```
Every intervalMs:
  orchestrator → ping → participant A's channel
  orchestrator → ping → participant B's channel
  └─ If no pong within timeoutMs → _handleHeartbeatTimeout()
     └─ Connection transitions to TRANSIENT_FAILURE
        └─ Reconnect scheduled
```

### Production Configuration

```typescript
const orchestrator = new ElectronConnectionOrchestrator({
  heartbeat: {
    enabled: true,
    intervalMs: 30_000, // Ping every 30s
    timeoutMs: 5_000, // 5s to respond
  },
});
```

### Important Notes

- Heartbeat pings travel through the **control plane** (the same channel used for port delivery), not the data plane
- This validates that the control-plane channel is alive, which is a prerequisite for reconnection
- If you need to validate the data plane separately, implement your own application-level ping on the direct port

---

## First-Connection Timeout & Retry

By default, `connect()` hangs forever if a participant never acknowledges `activateConnection` (e.g., a utility stuck in cold start). Two options address this:

### `activateTimeoutMs`

```typescript
const info = await orchestrator.connect('renderer', 'utility', {
  activateTimeoutMs: 10_000, // Fail after 10s if no ack
});
```

On timeout, `connect()` rejects with a `TimeoutError` and the connection is left in `IDLE`.

### `retryOnInitialFailure`

When `true`, a first-attempt failure transitions the connection to `TRANSIENT_FAILURE` and schedules automatic reconnection instead of throwing:

```typescript
const info = await orchestrator.connect('renderer', 'utility', {
  activateTimeoutMs: 10_000,
  retryOnInitialFailure: true,
});
// info.state === TRANSIENT_FAILURE — reconnect will be attempted
```

This is useful when utility process startup time is unpredictable and you want the orchestrator to keep trying automatically.

---

## Pending Request Behavior

When a connection drops, in-flight RPC requests need to be handled. The `pendingRequests` configuration controls this:

```typescript
const orchestrator = new ElectronConnectionOrchestrator({
  pendingRequests: {
    onDisconnect: 'reject', // Immediately reject in-flight requests
    duringReconnect: 'reject', // Reject new requests while reconnecting
    maxQueueSize: 100,
    queueTimeoutMs: 5_000,
  },
});
```

| Option            | Value       | Behavior                                            |
| ----------------- | ----------- | --------------------------------------------------- |
| `onDisconnect`    | `'reject'`  | Reject all in-flight requests when connection drops |
| `onDisconnect`    | `'queue'`   | Queue requests, replay when reconnected             |
| `onDisconnect`    | `'timeout'` | Let requests time out naturally                     |
| `duringReconnect` | `'reject'`  | Reject new requests while in TRANSIENT_FAILURE      |
| `duringReconnect` | `'queue'`   | Queue new requests for replay on reconnect          |

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

### 7. Using Non-`on*` Names for Cross-Process Event Methods

When a renderer calls a subscription method through a proxy (renderer → pagelet → daemon), the method name **must** start with `on` (e.g., `onDaemonStatusChange`, not `watchDaemonStatus`). The framework uses the `on*` prefix to detect event methods and automatically serialize the callback across process boundaries.

```typescript
// ❌ Wrong: 'watchDaemonCpu' is treated as a regular method — callback cannot be serialized
handlers: {
  watchDaemonCpu(callback) { ... }
}

// TypeError: l is not a function
// (callback arrives as a non-function value after serialization)
```

```typescript
// ✅ Correct: 'onDaemonCpuUsage' triggers event method handling
handlers: {
  onDaemonCpuUsage(callback) { ... }
}
```

### 8. Not Wrapping Observable Subscriptions in `on*` Methods

Observable subscriptions (`clientHost.subscribe()`) work within a single process boundary. To expose them across the proxy chain, you **must** wrap the subscription in an `on*` event method at the proxy layer:

```typescript
// ❌ Wrong: Directly exposing subscribe — callback cannot cross process boundary
handlers: {
  watchDaemonCpu(callback) {
    return daemonSubClient.subscribe('watchCpuUsage', [], {
      onData: (value) => callback(value),
    });
  }
}

// ✅ Correct: Rename to on* and the framework handles callback serialization
handlers: {
  onDaemonCpuUsage(callback) {
    const sub = daemonSubClient.subscribe('watchCpuUsage', [], {
      onData: (value) => callback(value),
    });
    return { unsubscribe: () => sub.unsubscribe() };
  }
}
```

### 9. Not Returning Cleanup from Event Method Handlers

Event method handlers that set up intervals or listeners should return a cleanup function. Without it, the interval continues running even after the client unsubscribes:

```typescript
// ❌ Wrong: Memory leak — interval keeps running after unsubscribe
onStatusChange(callback) {
  setInterval(() => callback(getStatus()), 1000);
}

// ✅ Correct: Return cleanup function
onStatusChange(callback) {
  const id = setInterval(() => callback(getStatus()), 1000);
  return () => clearInterval(id);
}
```

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

| Example                                      | Pattern                   | Approach                        | Subscription              |
| -------------------------------------------- | ------------------------- | ------------------------------- | ------------------------- |
| `ipc-example`                                | Main ↔ Renderer           | Direct IPC                      | —                         |
| `utility-process`                            | Main ↔ Utility            | Direct Utility                  | —                         |
| `renderer-acquire-main-port`                 | Renderer ↔ Main (Port)    | Manual                          | —                         |
| `renderer-acquire-main-port-orchestrator`    | Renderer ↔ Main (Port)    | Orchestrator                    | —                         |
| `renderer-acquire-utility-port`              | Renderer ↔ Utility (Port) | Manual                          | —                         |
| `renderer-acquire-utility-port-orchestrator` | Renderer ↔ Utility (Port) | Orchestrator                    | —                         |
| `utility-acquire-main-port`                  | Utility ↔ Main (Port)     | Manual                          | —                         |
| `utility-acquire-main-port-orchestrator`     | Utility ↔ Main (Port)     | Orchestrator                    | —                         |
| `utility-acquire-utility-port`               | Utility ↔ Utility (Port)  | Manual                          | —                         |
| `utility-acquire-utility-port-orchestrator`  | Utility ↔ Utility (Port)  | Orchestrator                    | —                         |
| `pagelet-proxy`                              | Renderer ↔ Multi-Utility  | Orchestrator + ParticipantProxy | Event method + Observable |

---

## See Also

- [Package Overview](/packages/async/async-call-rpc-electron/)
- [Connection Orchestrator API](/packages/async/async-call-rpc-electron/orchestrator)
- [Base Orchestrator Documentation](/packages/async/async-call-rpc/orchestrator/)
- [Examples Source](https://github.com/red-armor/x-oasis/tree/main/packages/async/async-call-rpc-electron/examples)
