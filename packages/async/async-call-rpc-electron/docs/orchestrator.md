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

##### `connect(fromId, toId, config?)`

Establish a direct connection between two registered participants.

```typescript
connect(
  fromId: string,
  toId: string,
  config?: ConnectionConfig
): Promise<ConnectionInfo>
```

**Returns:** `ConnectionInfo` object with state and event tracking.

##### `disconnect(connectionId)`

Gracefully close a connection.

```typescript
disconnect(connectionId: string): Promise<void>
```

##### Events

- `onReady`: Fired when a connection reaches READY state
- `onDisconnected`: Fired when a connection is lost
- `onReconnecting`: Fired when reconnection attempts start
- `onReconnected`: Fired when reconnection succeeds
- `onReconnectFailed`: Fired when reconnection gives up
- `onStateChange`: Fired on any state transition

### `registerOrchestratorHandler`

Helper function to register a handler for receiving the direct MessagePort.

```typescript
function registerOrchestratorHandler(
  channel: AbstractChannelProtocol,
  onPort: (port: MessagePortMain | MessagePort) => void
): void;
```

**Usage:**

```typescript
registerOrchestratorHandler(ipcChannel, (port) => {
  directChannel.bindPort(port);
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
  enableStats: true,
  logger: (level, msg, data) => console.log(`[${level}] ${msg}`, data),
});
```

## Connection State Machine

```
IDLE → CONNECTING → READY ←──────┐
 ↑         │            │        │
 │         ↓            ↓        │
 │    (failure)    TRANSIENT_FAILURE
 │                            │
 │                            │ (retry)
 │                            ↓
 └────────────────────────────┘
```

**States:**

- `IDLE`: Initial state, no connection attempt
- `CONNECTING`: Port pair created, waiting for activation
- `READY`: Both sides activated, direct communication available
- `TRANSIENT_FAILURE`: Connection lost, attempting reconnection
- `DISCONNECTING`: Graceful shutdown in progress
- `CLOSED`: Connection terminated

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

## Examples

See the [examples directory](https://github.com/red-armor/x-oasis/tree/main/packages/async/async-call-rpc-electron/examples) for complete working samples:

- `renderer-acquire-main-port-orchestrator-example`: Renderer ↔ Main
- `utility-acquire-main-port-orchestrator-example`: Utility ↔ Main
- `renderer-acquire-utility-port-orchestrator-example`: Renderer ↔ Utility
- `utility-acquire-utility-port-orchestrator-example`: Utility ↔ Utility

## See Also

- [Base Orchestrator Documentation](/packages/async/async-call-rpc/orchestrator/)
- [Node.js Orchestrator](/packages/async/async-call-rpc-node/orchestrator)
- [Web Orchestrator](/packages/async/async-call-rpc-web/orchestrator)
- [RPC Patterns Guide](/packages/async/async-call-rpc/rpc-patterns-guide)
