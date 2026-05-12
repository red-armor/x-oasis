---
title: Connection Orchestrator
description: Automated direct MessagePort connection management for Electron
order: 2
---

# Connection Orchestrator

The `ElectronConnectionOrchestrator` automates the creation and management of direct `MessagePort` connections between Electron processes (main, renderer, utility).

## Overview

Traditionally, establishing direct communication between Electron processes requires manual coordination:

1. Create a `MessageChannelMain` in the main process
2. Manually send one port to each participant via IPC
3. Handle port binding on both sides
4. Manage reconnection if the connection drops

The **Connection Orchestrator** eliminates this boilerplate with a declarative API:

```typescript
// Register participants with their control-plane channels
orchestrator.registerParticipant('renderer', ipcChannel, 'renderer');
orchestrator.registerParticipant('utility', utilityChannel, 'utility');

// Establish direct connection with automatic port delivery
await orchestrator.connect('renderer', 'utility');
```

## Installation

```bash
npm install @x-oasis/async-call-rpc-electron
```

## Quick Start

### Basic Example: Renderer ↔ Main

**Main Process (main.ts):**

```typescript
import { app, BrowserWindow } from 'electron';
import {
  IPCMainChannel,
  ElectronConnectionOrchestrator,
  ElectronMessagePortMainChannel,
} from '@x-oasis/async-call-rpc-electron';
import { serviceHost, clientHost } from '@x-oasis/async-call-rpc';

app.whenReady().then(async () => {
  const mainWindow = new BrowserWindow({
    webPreferences: {
      preload: join(__dirname, 'preload.js'),
    },
  });

  // Control-plane channel (existing IPC)
  const ipcChannel = new IPCMainChannel({
    channelName: 'app-rpc',
    webContents: mainWindow.webContents,
  });

  // Direct port channel (will be bound by orchestrator)
  const mainDirectChannel = new ElectronMessagePortMainChannel({
    description: 'main↔renderer direct port',
  });

  // Register services on the direct channel
  serviceHost.registerService('main-service', {
    channel: mainDirectChannel,
    handlers: {
      greet(msg: string): string {
        return `Hello from main: ${msg}`;
      },
    },
  });

  // Setup orchestrator
  const orchestrator = new ElectronConnectionOrchestrator();

  // For main-side local binding
  const mainParticipantChannel = {
    makeRequest(_path: string, method: string, port: any) {
      if (method === 'activateConnection') {
        mainDirectChannel.bindPort(port);
      }
      return { promise: Promise.resolve() };
    },
  } as any;

  orchestrator.registerParticipant('main', mainParticipantChannel, 'process');
  orchestrator.registerParticipant('renderer', ipcChannel, 'renderer');

  await orchestrator.connect('main', 'renderer');
  console.log('Direct connection established!');
});
```

**Renderer Process (preload.ts):**

```typescript
import { ipcRenderer } from 'electron';
import {
  IPCRendererChannel,
  registerOrchestratorHandler,
} from '@x-oasis/async-call-rpc-electron';
import { RPCMessageChannel } from '@x-oasis/async-call-rpc-web';
import { clientHost } from '@x-oasis/async-call-rpc';

// Control-plane channel
const ipcChannel = new IPCRendererChannel({
  channelName: 'app-rpc',
  ipcRenderer,
});

// Direct port channel (late-bound)
const directChannel = new RPCMessageChannel({
  description: 'renderer↔main direct port',
});

// Client for calling main's service
const mainClient = clientHost
  .registerClient('main-service', { channel: directChannel })
  .createProxy();

// Register handler to receive port from orchestrator
registerOrchestratorHandler(ipcChannel, (port: MessagePort) => {
  directChannel.bindPort(port);

  // Now you can call main's service directly
  setTimeout(async () => {
    const result = await (mainClient as any).greet('Renderer');
    console.log(result); // "Hello from main: Renderer"
  }, 500);
});
```

## Usage Patterns

### Pattern 1: Renderer ↔ Utility Process

For connecting a renderer window to a utility process:

```typescript
// Main process
const utilityProc = utilityProcess.fork(workerPath);
const utilityChannel = new ElectronUtilityProcessChannel({
  process: utilityProc,
});

const orchestrator = new ElectronConnectionOrchestrator();
orchestrator.registerParticipant('renderer', ipcChannel, 'renderer');
orchestrator.registerParticipant('utility', utilityChannel, 'utility');

await orchestrator.connect('renderer', 'utility');
```

**Utility Worker:**

```typescript
import { parentPort } from 'electron';
import {
  ElectronUtilityProcessChannel,
  registerOrchestratorHandler,
} from '@x-oasis/async-call-rpc-electron';

const channel = new ElectronUtilityProcessChannel({ parentPort });
const directChannel = new RPCMessageChannel({});

registerOrchestratorHandler(channel, (port) => {
  directChannel.bindPort(port);
});
```

### Pattern 2: Utility ↔ Utility Process

Connecting two utility processes directly:

```typescript
const utilityA = utilityProcess.fork(workerPathA);
const utilityB = utilityProcess.fork(workerPathB);

const channelA = new ElectronUtilityProcessChannel({ process: utilityA });
const channelB = new ElectronUtilityProcessChannel({ process: utilityB });

orchestrator.registerParticipant('utility-a', channelA, 'utility');
orchestrator.registerParticipant('utility-b', channelB, 'utility');

await orchestrator.connect('utility-a', 'utility-b');
```

### Pattern 3: Utility ↔ Main Process

When a utility process needs direct connection to main:

```typescript
// Main process
const mainDirectChannel = new ElectronMessagePortMainChannel({});

// ... setup main services on mainDirectChannel ...

const mainParticipantChannel = {
  makeRequest(_path: string, method: string, port: any) {
    if (method === 'activateConnection') {
      mainDirectChannel.bindPort(port);
    }
    return { promise: Promise.resolve() };
  },
} as any;

orchestrator.registerParticipant('main', mainParticipantChannel, 'process');
orchestrator.registerParticipant('utility', utilityChannel, 'utility');

await orchestrator.connect('main', 'utility');
```

## API Reference

### `ElectronConnectionOrchestrator`

```typescript
class ElectronConnectionOrchestrator extends BaseConnectionOrchestrator {
  constructor(
    config?: ConnectionOrchestratorConfig,
    portFactory?: MessageChannelMainFactory
  );
}
```

#### Constructor Options

| Option        | Type                           | Description                                                      |
| ------------- | ------------------------------ | ---------------------------------------------------------------- |
| `config`      | `ConnectionOrchestratorConfig` | Optional configuration for heartbeat, reconnect, circuit breaker |
| `portFactory` | `MessageChannelMainFactory`    | Optional factory for creating port pairs (useful for testing)    |

#### Methods

##### `registerParticipant(id, channel, type)`

Register a participant that can participate in connections.

```typescript
registerParticipant(
  id: string,
  channel: AbstractChannelProtocol,
  type: ParticipantType
): void
```

**Parameters:**

- `id`: Unique identifier for the participant
- `channel`: RPC channel for control-plane communication
- `type`: Type of participant (`'renderer'`, `'utility'`, `'worker'`, `'process'`)

##### `connect(fromId, toId, config?, options?)`

Establish a direct connection between two registered participants.

```typescript
connect(
  fromId: string,
  toId: string,
  config?: ConnectionConfig,
  options?: ConnectOptions
): Promise<ConnectionInfo>
```

**ConnectOptions:**

| Option                  | Type      | Default | Description                                               |
| ----------------------- | --------- | ------- | --------------------------------------------------------- |
| `activateTimeoutMs`     | `number`  | `30000` | Timeout for the first activation handshake                |
| `retryOnInitialFailure` | `boolean` | `false` | Auto-schedule reconnect instead of throwing on first fail |

```typescript
const info = await orchestrator.connect('renderer', 'utility', undefined, {
  activateTimeoutMs: 10_000,
  retryOnInitialFailure: true,
});
```

##### `replaceParticipantChannel(id, channel, options?)`

Replace a participant's control-plane channel without losing connection stats, history, or event subscriptions.

```typescript
replaceParticipantChannel(
  id: string,
  channel: AbstractChannelProtocol,
  options?: ReplaceChannelOptions
): void
```

**ReplaceChannelOptions:**

| Option          | Type      | Default | Description                                                    |
| --------------- | --------- | ------- | -------------------------------------------------------------- |
| `autoReconnect` | `boolean` | `true`  | Automatically reconnect connections in READY/TRANSIENT_FAILURE |

```typescript
utilityProc.on('exit', () => {
  utilityProc = utilityProcess.fork(workerPath);
  const newChannel = new ElectronUtilityProcessChannel({
    process: utilityProc,
  });
  orchestrator.replaceParticipantChannel('utility', newChannel);
});
```

##### `disconnect(connectionId)`

Gracefully close a connection.

```typescript
disconnect(connectionId: string): Promise<void>
```

##### `listParticipants()`

List all registered participants.

```typescript
listParticipants(): Array<{ id: string; type: ParticipantType; registeredAt: number }>
```

##### `listConnections()`

List all managed connections with current state and optional stats.

```typescript
listConnections(): Array<{
  connectionId: string; fromId: string; toId: string;
  state: ConnectionState; stats?: ConnectionStats
}>
```

##### `createEventForwarder(sink)`

Consolidate all 7 event types into a single callback. Returns a disposable.

```typescript
const forwarder = orchestrator.createEventForwarder((event) => {
  console.log(`[${event.type}]`, event.payload);
});
forwarder.dispose(); // Clean up
```

##### Events

- `onReady`: Fired when a connection reaches READY state
- `onDisconnected`: Fired when a connection is lost
- `onReconnecting`: Fired when reconnection attempts start
- `onReconnected`: Fired when reconnection succeeds
- `onReconnectFailed`: Fired when reconnection gives up
- `onStateChange`: Fired on any state transition

### `registerOrchestratorHandler`

Helper function to register a handler for receiving the direct MessagePort from the orchestrator.

#### Legacy Signature (raw port)

```typescript
function registerOrchestratorHandler(
  channel: AbstractChannelProtocol,
  onPort: (port: MessagePortMain | MessagePort) => void
): void;
```

#### Context Signature (recommended)

```typescript
function registerOrchestratorHandler(
  channel: AbstractChannelProtocol,
  onPort: (ctx: ActivationContext) => void
): void;
```

The framework inspects the callback signature at runtime: if it declares a single parameter typed as `ActivationContext`, the context form is used; otherwise the raw port is passed for backward compatibility.

##### `ActivationContext`

```typescript
interface ActivationContext {
  port: any; // The direct MessagePort
  connectionId: string; // Format: "fromId--toId"
  role: 'initiator' | 'receiver'; // This participant's role in the connection
}
```

From `connectionId` and `role`, you can extract the peer identity:

```typescript
registerOrchestratorHandler(channel, (ctx) => {
  const { port, connectionId, role } = ctx;
  const idx = connectionId.indexOf('--');
  const from = connectionId.substring(0, idx);
  const to = connectionId.substring(idx + 2);
  const peerId = role === 'initiator' ? to : from;

  // Route port to the correct channel based on peerId
  getChannelFor(peerId).bindPort(port, { rebind: true });
});
```

This is critical for **multi-pagelet routing** scenarios where a single participant (e.g., renderer) receives ports from multiple pagelets and needs to distinguish them. See the [Pagelet Proxy pattern](/packages/async/async-call-rpc-electron/scenario-orchestration) for a complete example.

##### Backward Compatibility

```typescript
// Old code still works — receives raw port
registerOrchestratorHandler(channel, (port) => {
  directChannel.bindPort(port);
});
```

### `ElectronUtilityProcessChannel`

#### `setKillOnDisconnect(kill)`

Control whether the child utility process is killed when the channel disconnects.

```typescript
setKillOnDisconnect(kill: boolean): void
```

- Default: `true` — calling `disconnect()` kills the child process
- Set to `false` when replacing channels to detach from the old transport without killing the process

```typescript
const channel = new ElectronUtilityProcessChannel({ process: utilityProc });
channel.setKillOnDisconnect(false);
channel.disconnect(); // Process stays alive
```

### `ElectronMessagePortMainChannel`

#### `bindPort(port, options?)`

Bind a `MessagePortMain` to the channel.

```typescript
bindPort(port: MessagePortMain, options?: { rebind?: boolean }): void
```

| Option   | Type      | Default | Description                            |
| -------- | --------- | ------- | -------------------------------------- |
| `rebind` | `boolean` | `false` | Unbind old port first if already bound |

Use `rebind: true` inside `registerOrchestratorHandler` so reconnection delivers new ports:

```typescript
registerOrchestratorHandler(channel, (port) => {
  directChannel.bindPort(port, { rebind: true });
});
```

## Configuration

### `ConnectionOrchestratorConfig`

```typescript
interface ConnectionOrchestratorConfig {
  // Heartbeat configuration
  heartbeat?: {
    enabled: boolean;
    intervalMs: number;
    timeoutMs: number;
  };

  // Reconnect policy
  reconnectPolicy?: ReconnectPolicy;

  // Circuit breaker
  circuitBreaker?: {
    enabled: boolean;
    failureRateThreshold: number;
    volumeThreshold: number;
    rollingWindowMs: number;
    openDurationMs: number;
  };

  // Pending request behavior during disconnect/reconnect
  pendingRequests?: {
    onDisconnect: 'reject' | 'queue' | 'timeout';
    duringReconnect: 'reject' | 'queue';
    maxQueueSize: number;
    queueTimeoutMs: number;
  };

  // Stats tracking
  enableStats?: boolean;

  // Logger
  logger?: (
    level: 'debug' | 'info' | 'warn' | 'error',
    message: string,
    data?: any
  ) => void;
}
```

### Example: With Full Configuration

```typescript
const orchestrator = new ElectronConnectionOrchestrator({
  heartbeat: {
    enabled: true,
    intervalMs: 30000, // 30s heartbeat
    timeoutMs: 5000, // 5s timeout
  },
  reconnectPolicy: new ExponentialBackoffPolicy({
    initialDelayMs: 1000,
    maxDelayMs: 30000,
    maxRetries: 10,
  }),
  circuitBreaker: {
    enabled: true,
    failureRateThreshold: 0.5,
    volumeThreshold: 5,
    rollingWindowMs: 10000,
    openDurationMs: 30000,
  },
  pendingRequests: {
    onDisconnect: 'reject',
    duringReconnect: 'reject',
    maxQueueSize: 100,
    queueTimeoutMs: 5000,
  },
  enableStats: true,
  logger: (level, msg, data) => console.log(`[${level}] ${msg}`, data),
});
```

### Heartbeat

The `ElectronConnectionOrchestrator` overrides `_sendHeartbeat` to send RPC pings through the control plane. If a pong is not received within `timeoutMs`, the connection transitions to `TRANSIENT_FAILURE` and reconnection is scheduled.

Pings travel through the **control plane** (the same channel used for port delivery), validating that the control-plane channel is alive — a prerequisite for reconnection.

### Bidirectional Connection Semantics

`connect('a', 'b')` and `connect('b', 'a')` resolve to the **same** connection. The connection ID is always normalized to lexicographic order (e.g., `'a--b'`, never `'b--a'`). Both calls return the same `ConnectionInfo`.

## Connection State Machine

```
IDLE → CONNECTING → READY ←──────┐
 ↑    │      │         │         │
 │    │      ↓         ↓         │
 │    │  (failure)  TRANSIENT_FAILURE
 │    │                  │       │
 │    │                  │(retry)│
 │    └──────────────────┘       │
 └───────────────────────────────┘
```

**States:**

- `IDLE`: Initial state, no connection attempt
- `CONNECTING`: Port pair created, waiting for activation
- `READY`: Both sides activated, direct communication available
- `TRANSIENT_FAILURE`: Connection lost, attempting reconnection
- `DISCONNECTING`: Graceful shutdown in progress
- `CLOSED`: Connection terminated

> **Note:** `IDLE` and `CONNECTING` can also transition directly to `TRANSIENT_FAILURE` (e.g., when `retryOnInitialFailure` is `true` or a participant's channel is replaced mid-connect).

## Best Practices

### ✅ Do

- **Use `registerOrchestratorHandler`** instead of manual IPC listeners
- **Register event handlers** before calling `connect()`
- **Handle reconnection events** for long-lived connections
- **Enable stats** in production for monitoring
- **Set reasonable heartbeat intervals** (30s default is usually good)
- **Use circuit breaker** to prevent cascading failures

### ❌ Don't

- **Don't manually call `__orchestrator` methods** — use the provided APIs
- **Don't forget to handle `onReconnectFailed`** — the connection may need manual restart
- **Don't use orchestrator for short-lived connections** — overhead may not be worth it
- **Don't ignore `TRANSIENT_FAILURE` state** — it indicates connection issues

## Common Pitfalls

### 1. Not Registering Handler Before Connect

```typescript
// ❌ Wrong: Handler registered after connect
await orchestrator.connect('main', 'renderer');
registerOrchestratorHandler(channel, onPort); // Too late!

// ✅ Correct: Register handler first
registerOrchestratorHandler(channel, onPort);
await orchestrator.connect('main', 'renderer');
```

### 2. Forgetting to Bind Port

```typescript
// ❌ Wrong: Not binding the received port
registerOrchestratorHandler(channel, (port) => {
  console.log('Got port:', port); // Port not bound!
});

// ✅ Correct: Bind the port to your channel
registerOrchestratorHandler(channel, (port) => {
  directChannel.bindPort(port);
});
```

### 3. Multiple Connections Same Pair

```typescript
// ⚠️ Note: connect() is idempotent for same pair
await orchestrator.connect('a', 'b');
await orchestrator.connect('a', 'b'); // Returns existing connection info
```

## Participant-Side APIs

While the `ElectronConnectionOrchestrator` runs in the main process, participants (utility processes) need APIs to self-connect and manage their data-plane channels.

### `ParticipantOrchestratorProxy`

Enables a utility process to autonomously request connections to other participants through the orchestrator, and obtain the resulting data-plane channel directly.

```typescript
import { createParticipantProxy } from '@x-oasis/async-call-rpc-electron';

const proxy = createParticipantProxy({
  selfId: 'pagelet',
  controlChannel: mainChannel,
});

// Self-connect to another participant
const conn = await proxy.connect('renderer');

// Get the data-plane channel for direct RPC
const rendererChannel = conn.getChannel();
```

#### `ParticipantOrchestratorProxyOptions`

| Option           | Type                                               | Description                                       |
| ---------------- | -------------------------------------------------- | ------------------------------------------------- |
| `selfId`         | `string`                                           | This participant's unique ID                      |
| `controlChannel` | `AbstractChannelProtocol`                          | Control-plane channel already connected to main   |
| `channelFactory` | `(desc: string) => ElectronMessagePortMainChannel` | Optional factory for creating data-plane channels |

#### `ParticipantConnection`

The object returned by `connect()`:

| Property       | Type                                   | Description                                  |
| -------------- | -------------------------------------- | -------------------------------------------- |
| `connectionId` | `string`                               | Connection ID (format: `fromId--toId`)       |
| `peerId`       | `string`                               | The remote participant's ID                  |
| `role`         | `'initiator' \| 'receiver'`            | This participant's role in the connection    |
| `getChannel()` | `() => ElectronMessagePortMainChannel` | Returns the data-plane channel for this peer |

#### Methods

##### `connect(toId, config?, options?)`

Request a connection to another participant. Returns a `ParticipantConnection` whose `getChannel()` provides the data-plane channel.

```typescript
const conn = await proxy.connect('shared');
const sharedChannel = conn.getChannel();
```

If already connected, returns the existing connection immediately.

##### `disconnect(connectionId)`

Disconnect an established connection.

##### `listParticipants()` / `listConnections()`

Query the orchestrator's topology from the participant side.

##### `getChannelFor(peerId)`

Retrieve the cached data-plane channel for a previously connected peer.

### `UtilityOrchestratorParticipant`

A convenience wrapper for utility processes that need both control-plane and data-plane channel management. It auto-handles `activateConnection` by binding received ports to an internal `ElectronMessagePortMainChannel`.

```typescript
import { createUtilityParticipant } from '@x-oasis/async-call-rpc-electron';

const participant = createUtilityParticipant({
  parentPort: process.parentPort!,
  mainChannelDescription: 'worker→main IPC channel',
  directChannelDescription: 'worker↔peer direct port',
});

// Register services on the direct (data-plane) channel
participant.registerService('my-api', {
  info: () => `worker ready (pid=${process.pid})`,
  echo: (msg: string) => `echo: ${msg}`,
});

// Register services on the control-plane channel (e.g., for main process calls)
participant.registerControlService('my-control-api', {
  getStatus: () => ({ pid: process.pid, uptime: process.uptime() }),
});

// Access channels if needed
participant.mainChannel; // ElectronUtilityProcessChannel
participant.directChannel; // ElectronMessagePortMainChannel
```

#### `UtilityParticipantOptions`

| Option                     | Type         | Default      | Description                                |
| -------------------------- | ------------ | ------------ | ------------------------------------------ |
| `parentPort`               | `ParentPort` | — (required) | The utility process's `process.parentPort` |
| `mainChannelDescription`   | `string`     | `undefined`  | Description for the control-plane channel  |
| `directChannelDescription` | `string`     | `undefined`  | Description for the data-plane channel     |
| `rebind`                   | `boolean`    | `true`       | Whether to rebind on reconnection          |

#### Methods

##### `registerService(serviceId, handlers)`

Register RPC handlers on the **data-plane** channel. These are accessible by any peer that has a direct port connection.

##### `registerControlService(serviceId, handlers)`

Register RPC handlers on the **control-plane** channel (the `parentPort` channel to main). These are accessible from the main process.

##### `getService<T>(servicePath)`

Get or create a typed proxy client on the data-plane channel for calling peer services.

---

## Subscription Patterns

`async-call-rpc` supports two subscription patterns for real-time data push from server to client. Both work seamlessly across the orchestrator's data-plane channels.

### Pattern A: Event Method (Ping-Pong Callback)

Methods starting with `on` (e.g., `onStatusChange`) are automatically treated as event methods. The handler receives a `remoteCallback` that it can call to push data to the client.

**Server (utility process):**

```typescript
const handlers = {
  onStatusChange(callback: (status: any) => void) {
    const interval = setInterval(() => {
      callback({ timestamp: Date.now(), cpu: Math.random() * 100 });
    }, 1000);

    // Optional cleanup — called when client unsubscribes
    return () => clearInterval(interval);
  },
};

participant.registerService('monitor-api', handlers);
```

**Client (renderer via pagelet proxy):**

```typescript
// Client-side proxy auto-detects "on*" as event method
const unsub = monitorClient.onStatusChange((data) => {
  console.log('Status update:', data);
});

// Stop listening
unsub.unsubscribe();
```

### Pattern B: Observable Subscribe (Streaming)

For high-frequency data streams, the handler returns an object with a `subscribe()` method. The client uses `clientHost.subscribe()` to attach observers.

**Server (utility process):**

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
          tick++;
          observer.next?.({ tick, cpu: Math.random() * 100 });

          if (tick >= 100) {
            clearInterval(interval);
            observer.complete?.();
          }
        }, 500);

        return { unsubscribe: () => clearInterval(interval) };
      },
    };
  },
};

participant.registerService('monitor-api', handlers);
```

**Client with ProxyRPCClient (must use `on*` naming for cross-process):**

Since callbacks cannot be serialized across process boundaries, when forwarding an observable subscription through a proxy layer, expose it as an `on*` event method:

```typescript
// Pagelet proxy layer — bridges observable to event method
serviceHost.registerService('pagelet-api', {
  channel: rendererChannel,
  serviceHost,
  handlers: {
    onCpuUsage(callback: (data: any) => void) {
      const sub = daemonSubscriptionClient.subscribe('watchCpuUsage', [], {
        onData: (value) => callback(value),
        onError: (err) => console.error('Subscription error:', err),
        onComplete: () => console.log('Stream completed'),
      });
      return { unsubscribe: () => sub.unsubscribe() };
    },
  },
});
```

**Renderer:**

```typescript
const unsub = pageletClient.onCpuUsage((data) => {
  console.log('CPU:', data.cpu);
});
```

### Choosing Between Patterns

| Aspect              | Event Method (`on*`)                 | Observable Subscribe                      |
| ------------------- | ------------------------------------ | ----------------------------------------- |
| Client API          | `client.onFoo(cb)`                   | `client.subscribe('foo', args, observer)` |
| Auto-detection      | Yes (by `on` prefix)                 | No (explicit API)                         |
| Cross-process proxy | ✅ Callbacks auto-serialized         | ⚠️ Must wrap in `on*` method              |
| Completion signal   | No (infinite until unsub)            | Yes (`onComplete`)                        |
| Error handling      | Limited                              | Full (`onError`)                          |
| Best for            | Status updates, config changes, logs | High-frequency streams, finite sequences  |

> **Key insight:** When forwarding subscriptions through a proxy (e.g., renderer → pagelet → daemon), always expose them as `on*` event methods to the outer client. The proxy layer internally uses `subscribe()` for observable sources and converts them to callback-based event methods.

---

## Examples

See the [examples directory](https://github.com/red-armor/x-oasis/tree/main/packages/async/async-call-rpc-electron/examples) for complete working samples:

- `renderer-acquire-main-port-orchestrator`: Renderer ↔ Main
- `utility-acquire-main-port-orchestrator`: Utility ↔ Main
- `renderer-acquire-utility-port-orchestrator`: Renderer ↔ Utility
- `utility-acquire-utility-port-orchestrator`: Utility ↔ Utility

## See Also

- [Base Orchestrator Documentation](/packages/async/async-call-rpc/orchestrator/)
- [Node.js Orchestrator](/packages/async/async-call-rpc-node/orchestrator)
- [Web Orchestrator](/packages/async/async-call-rpc-web/orchestrator)
- [RPC Patterns Guide](/packages/async/async-call-rpc/rpc-patterns-guide)
