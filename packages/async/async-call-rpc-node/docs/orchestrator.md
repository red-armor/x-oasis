---
title: Connection Orchestrator
description: Automated direct MessagePort connection management for Node.js worker threads
order: 2
---

# Connection Orchestrator

The `NodeConnectionOrchestrator` automates the creation and management of direct `MessagePort` connections between Node.js worker threads.

## Overview

When communicating between worker threads in Node.js, you typically need to:

1. Create a `MessageChannel` in the main thread
2. Manually pass one port to each worker
3. Coordinate initialization on both sides

The **Connection Orchestrator** simplifies this to a declarative API:

```typescript
// Register workers with their control-plane channels
orchestrator.registerParticipant('worker-a', channelA, 'worker');
orchestrator.registerParticipant('worker-b', channelB, 'worker');

// Establish direct connection with automatic port delivery
await orchestrator.connect('worker-a', 'worker-b');
```

## Installation

```bash
npm install @x-oasis/async-call-rpc-node
```

## Quick Start

### Basic Example: Worker ↔ Worker

**Main Thread:**

```typescript
import { Worker } from 'worker_threads';
import {
  NodeConnectionOrchestrator,
  NodeMessagePortChannel,
} from '@x-oasis/async-call-rpc-node';
import { serviceHost, clientHost } from '@x-oasis/async-call-rpc';

// Create workers
const workerA = new Worker('./worker-a.js');
const workerB = new Worker('./worker-b.js');

// Control-plane channels (using the worker's initial message port)
const channelA = new NodeMessagePortChannel({
  description: 'main→worker-a',
  bindPort: workerA,
});

const channelB = new NodeMessagePortChannel({
  description: 'main→worker-b',
  bindPort: workerB,
});

// Setup orchestrator
const orchestrator = new NodeConnectionOrchestrator();
orchestrator.registerParticipant('worker-a', channelA, 'worker');
orchestrator.registerParticipant('worker-b', channelB, 'worker');

// Connect and wait for ready
orchestrator.onReady(({ connectionId }) => {
  console.log(`Connection ${connectionId} is ready!`);
});

await orchestrator.connect('worker-a', 'worker-b');
```

**Worker A (worker-a.js):**

```typescript
import { parentPort } from 'worker_threads';
import {
  NodeMessagePortChannel,
  registerOrchestratorHandler,
} from '@x-oasis/async-call-rpc-node';
import { RPCMessageChannel } from '@x-oasis/async-call-rpc-web';
import { serviceHost, clientHost } from '@x-oasis/async-call-rpc';

// Control-plane channel to main
const mainChannel = new NodeMessagePortChannel({
  description: 'worker-a→main',
  bindPort: parentPort,
});

// Direct port channel (late-bound)
const directChannel = new RPCMessageChannel({
  description: 'worker-a↔worker-b',
});

// Register service
serviceHost.registerService('worker-a-service', {
  channel: directChannel,
  handlers: {
    compute(data: number): number {
      return data * 2;
    },
  },
});

// Register handler to receive port from orchestrator
registerOrchestratorHandler(mainChannel, (port: MessagePort) => {
  directChannel.bindPort(port);
  console.log('Worker A: Direct port bound!');
});
```

**Worker B (worker-b.js):**

```typescript
import { parentPort } from 'worker_threads';
import {
  NodeMessagePortChannel,
  registerOrchestratorHandler,
} from '@x-oasis/async-call-rpc-node';
import { RPCMessageChannel } from '@x-oasis/async-call-rpc-web';
import { clientHost } from '@x-oasis/async-call-rpc';

// Control-plane channel to main
const mainChannel = new NodeMessagePortChannel({
  description: 'worker-b→main',
  bindPort: parentPort,
});

// Direct port channel (late-bound)
const directChannel = new RPCMessageChannel({
  description: 'worker-b↔worker-a',
});

// Client to call Worker A's service
const workerAClient = clientHost
  .registerClient('worker-a-service', { channel: directChannel })
  .createProxy();

// Register handler to receive port from orchestrator
registerOrchestratorHandler(mainChannel, async (port: MessagePort) => {
  directChannel.bindPort(port);
  console.log('Worker B: Direct port bound!');

  // Call Worker A's service directly
  const result = await (workerAClient as any).compute(21);
  console.log(`Result: ${result}`); // 42
});
```

## Usage Patterns

### Pattern 1: Main Thread ↔ Worker

When the main thread needs direct communication with a worker:

```typescript
// Main thread
const mainDirectChannel = new NodeMessagePortChannel({
  description: 'main↔worker',
});

// Register services on main's direct channel
serviceHost.registerService('main-service', {
  channel: mainDirectChannel,
  handlers: {
    process(data: any): any {
      // Process in main thread
      return processedData;
    },
  },
});

// Virtual participant for main thread
const mainParticipantChannel = {
  makeRequest(_path: string, method: string, port: any) {
    if (method === 'activateConnection') {
      mainDirectChannel.bindPort(port);
    }
    return { promise: Promise.resolve() };
  },
} as any;

orchestrator.registerParticipant('main', mainParticipantChannel, 'process');
orchestrator.registerParticipant('worker', workerChannel, 'worker');

await orchestrator.connect('main', 'worker');
```

### Pattern 2: Worker Pool

Managing multiple workers with the orchestrator:

```typescript
const workers: Worker[] = [];
const orchestrator = new NodeConnectionOrchestrator();

// Create worker pool
for (let i = 0; i < 4; i++) {
  const worker = new Worker('./worker.js');
  const channel = new NodeMessagePortChannel({ bindPort: worker });

  orchestrator.registerParticipant(`worker-${i}`, channel, 'worker');
  workers.push(worker);
}

// Connect all pairs (full mesh)
for (let i = 0; i < workers.length; i++) {
  for (let j = i + 1; j < workers.length; j++) {
    await orchestrator.connect(`worker-${i}`, `worker-${j}`);
  }
}
```

## API Reference

### `NodeConnectionOrchestrator`

```typescript
class NodeConnectionOrchestrator extends BaseConnectionOrchestrator {
  constructor(config?: ConnectionOrchestratorConfig);
}
```

#### Methods

##### `registerParticipant(id, channel, type)`

```typescript
registerParticipant(
  id: string,
  channel: AbstractChannelProtocol,
  type: ParticipantType
): void
```

Register a worker or process as a connection participant.

##### `connect(fromId, toId, config?)`

```typescript
connect(
  fromId: string,
  toId: string,
  config?: ConnectionConfig
): Promise<ConnectionInfo>
```

Establish a direct MessagePort connection between two participants.

##### `disconnect(connectionId)`

```typescript
disconnect(connectionId: string): Promise<void>
```

Gracefully close a connection.

### `registerOrchestratorHandler`

```typescript
function registerOrchestratorHandler(
  channel: AbstractChannelProtocol,
  onPort: (port: MessagePort) => void
): void;
```

Register a handler in a worker to receive the direct MessagePort from the orchestrator.

**Example:**

```typescript
registerOrchestratorHandler(mainChannel, (port) => {
  directChannel.bindPort(port);
});
```

### `NodeMessagePortChannel`

Channel implementation for Node.js `worker_threads` MessagePort.

```typescript
class NodeMessagePortChannel {
  constructor(props?: NodeMessagePortChannelProps);
  bindPort(port: MessagePort): void;
}

interface NodeMessagePortChannelProps {
  description?: string;
  bindPort?: MessagePort | Worker;
}
```

## Configuration

### Connection Orchestrator Options

```typescript
const orchestrator = new NodeConnectionOrchestrator({
  // Enable heartbeat to detect dead connections
  heartbeat: {
    enabled: true,
    intervalMs: 30000,
    timeoutMs: 5000,
  },

  // Automatic reconnection with exponential backoff
  reconnectPolicy: new ExponentialBackoffPolicy({
    initialDelayMs: 1000,
    maxDelayMs: 30000,
    maxRetries: 10,
  }),

  // Circuit breaker for failing connections
  circuitBreaker: {
    enabled: true,
    failureRateThreshold: 0.5,
    volumeThreshold: 5,
    rollingWindowMs: 10000,
    openDurationMs: 30000,
  },

  // Stats tracking
  enableStats: true,

  // Logger
  logger: (level, msg, data) => console.log(`[${level}] ${msg}`, data),
});
```

## Connection Lifecycle

```
┌─────────┐   connect()   ┌─────────────┐
│  IDLE   │ ────────────► │ CONNECTING  │
└─────────┘               └──────┬──────┘
     ▲                           │
     │                           │ both sides
     │                           │ activated
     │                           ▼
     │                    ┌─────────────┐
     │                    │    READY    │
     │                    └──────┬──────┘
     │                           │
     │              connection   │
     │              lost/        │ error
     │              error        ▼
     │                    ┌─────────────┐
     │                    │ TRANSIENT   │
     │                    │  FAILURE    │
     │                    └──────┬──────┘
     │                           │
     │            max retries    │ retry
     │            exceeded       │
     │                           ▼
     │                    ┌─────────────┐
     └────────────────────┤   CLOSED    │
                          └─────────────┘
```

## Best Practices

### ✅ Do

- **Register handlers early**: Call `registerOrchestratorHandler` before `connect()`
- **Handle reconnection**: Listen to `onReconnecting` and `onReconnected` events
- **Enable heartbeat**: For long-running connections, detect failures quickly
- **Use circuit breaker**: Prevent cascading failures in worker pools
- **Track stats**: Monitor connection health in production

### ❌ Don't

- **Don't block the main thread**: Use workers for CPU-intensive tasks
- **Don't create too many connections**: Each connection uses resources
- **Don't ignore errors**: Always handle `onDisconnected` and `onReconnectFailed`

## Examples

### Worker Pool with Load Balancing

```typescript
class WorkerPool {
  private orchestrator: NodeConnectionOrchestrator;
  private workers: Map<string, Worker> = new Map();

  constructor(size: number) {
    this.orchestrator = new NodeConnectionOrchestrator({
      enableStats: true,
    });

    // Create workers
    for (let i = 0; i < size; i++) {
      const worker = new Worker('./pool-worker.js');
      const channel = new NodeMessagePortChannel({ bindPort: worker });

      const id = `worker-${i}`;
      this.workers.set(id, worker);
      this.orchestrator.registerParticipant(id, channel, 'worker');
    }

    // Connect main to all workers
    for (const id of this.workers.keys()) {
      this.connectMainToWorker(id);
    }
  }

  private async connectMainToWorker(workerId: string) {
    const mainChannel = new NodeMessagePortChannel({});
    const mainParticipant = {
      makeRequest: (_path: string, method: string, port: any) => {
        if (method === 'activateConnection') {
          mainChannel.bindPort(port);
        }
        return { promise: Promise.resolve() };
      },
    } as any;

    this.orchestrator.registerParticipant('main', mainParticipant, 'process');
    await this.orchestrator.connect('main', workerId);
  }
}
```

### Error Recovery

```typescript
orchestrator.onDisconnected(({ connectionId, error }) => {
  console.error(`Connection ${connectionId} lost:`, error);
  // Connection will auto-retry based on reconnectPolicy
});

orchestrator.onReconnectFailed(({ connectionId }) => {
  console.error(`Giving up on ${connectionId}`);
  // Manual intervention needed
  alertUser(`Worker connection failed: ${connectionId}`);
});
```

## Comparison with Manual Approach

| Aspect            | Manual     | With Orchestrator |
| ----------------- | ---------- | ----------------- |
| Lines of code     | ~50+       | ~10               |
| Port creation     | Manual     | Automatic         |
| Port delivery     | Manual IPC | Automatic RPC     |
| Reconnection      | Manual     | Built-in          |
| Health monitoring | Manual     | Built-in stats    |
| Error handling    | Manual     | Circuit breaker   |

## See Also

- [Base Orchestrator Documentation](/packages/async/async-call-rpc/orchestrator/)
- [Electron Orchestrator](/packages/async/async-call-rpc-electron/orchestrator)
- [Web Orchestrator](/packages/async/async-call-rpc-web/orchestrator)
- [Node.js worker_threads](https://nodejs.org/api/worker_threads.html)
