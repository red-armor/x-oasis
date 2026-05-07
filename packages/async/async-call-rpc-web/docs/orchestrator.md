---
title: Connection Orchestrator
description: Automated direct MessagePort connection management for Web Workers and iframes
order: 2
---

# Connection Orchestrator

The `WebConnectionOrchestrator` automates the creation and management of direct `MessagePort` connections between web contexts (Workers, iframes, Service Workers).

## Overview

Connecting web workers or iframes traditionally requires manual coordination:

1. Create a `MessageChannel` in the parent context
2. Manually pass one port to each participant via `postMessage`
3. Coordinate initialization on both sides
4. Handle cleanup when contexts are destroyed

The **Connection Orchestrator** simplifies this:

```typescript
// Register participants with their control-plane channels
orchestrator.registerParticipant('worker', workerChannel, 'worker');
orchestrator.registerParticipant('iframe', iframeChannel, 'renderer');

// Establish direct connection with automatic port delivery
await orchestrator.connect('worker', 'iframe');
```

## Installation

```bash
npm install @x-oasis/async-call-rpc-web
```

## Quick Start

### Basic Example: Worker ↔ Worker

**Main Page:**

```typescript
import {
  WebConnectionOrchestrator,
  WorkerChannel,
} from '@x-oasis/async-call-rpc-web';
import { serviceHost, clientHost } from '@x-oasis/async-call-rpc';

// Create workers
const workerA = new Worker('./worker-a.js');
const workerB = new Worker('./worker-b.js');

// Control-plane channels
const channelA = new WorkerChannel({ worker: workerA });
const channelB = new WorkerChannel({ worker: workerB });

// Setup orchestrator
const orchestrator = new WebConnectionOrchestrator();
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
import {
  WorkerChannel,
  registerOrchestratorHandler,
} from '@x-oasis/async-call-rpc-web';
import { RPCMessageChannel } from '@x-oasis/async-call-rpc-web';
import { serviceHost } from '@x-oasis/async-call-rpc';

// Control-plane channel to main
const mainChannel = new WorkerChannel({});

// Direct port channel (late-bound)
const directChannel = new RPCMessageChannel({
  description: 'worker-a↔worker-b',
});

// Register service
serviceHost.registerService('worker-a-service', {
  channel: directChannel,
  handlers: {
    process(data: any): any {
      return { processed: data, by: 'worker-a' };
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
import {
  WorkerChannel,
  registerOrchestratorHandler,
} from '@x-oasis/async-call-rpc-web';
import { RPCMessageChannel } from '@x-oasis/async-call-rpc-web';
import { clientHost } from '@x-oasis/async-call-rpc';

// Control-plane channel to main
const mainChannel = new WorkerChannel({});

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
  const result = await (workerAClient as any).process({ hello: 'world' });
  console.log('Result:', result);
});
```

## Usage Patterns

### Pattern 1: Main Thread ↔ Worker

When the main thread needs direct communication with a worker:

```typescript
// Main thread
const worker = new Worker('./worker.js');
const workerChannel = new WorkerChannel({ worker });

const mainDirectChannel = new RPCMessageChannel({
  description: 'main↔worker',
});

// Register services on main's direct channel
serviceHost.registerService('main-service', {
  channel: mainDirectChannel,
  handlers: {
    fetchData(url: string): Promise<any> {
      return fetch(url).then((r) => r.json());
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

const orchestrator = new WebConnectionOrchestrator();
orchestrator.registerParticipant('main', mainParticipantChannel, 'process');
orchestrator.registerParticipant('worker', workerChannel, 'worker');

await orchestrator.connect('main', 'worker');
```

### Pattern 2: Worker ↔ Iframe

Connecting a worker to an iframe:

```typescript
const iframe = document.createElement('iframe');
iframe.src = './iframe.html';
document.body.appendChild(iframe);

// Wait for iframe to load
iframe.onload = () => {
  const iframeChannel = new MessageChannel();

  // Send one port to iframe
  iframe.contentWindow!.postMessage({ type: 'init-channel' }, '*', [
    iframeChannel.port2,
  ]);

  const rpcChannel = new RPCMessageChannel({ port: iframeChannel.port1 });

  orchestrator.registerParticipant('iframe', rpcChannel, 'renderer');
  orchestrator.registerParticipant('worker', workerChannel, 'worker');

  await orchestrator.connect('worker', 'iframe');
};
```

### Pattern 3: Service Worker ↔ Page

For connecting a Service Worker to the main page:

```typescript
// Main page
const registration = await navigator.serviceWorker.register('./sw.js');
const sw = registration.active;

if (sw) {
  const channel = new MessageChannel();
  sw.postMessage({ type: 'init-orchestrator' }, [channel.port2]);

  const rpcChannel = new RPCMessageChannel({ port: channel.port1 });

  orchestrator.registerParticipant('page', pageChannel, 'renderer');
  orchestrator.registerParticipant('sw', rpcChannel, 'worker');

  await orchestrator.connect('page', 'sw');
}
```

## API Reference

### `WebConnectionOrchestrator`

```typescript
class WebConnectionOrchestrator extends BaseConnectionOrchestrator {
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

Register a worker, iframe, or other context as a participant.

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

Register a handler to receive the direct MessagePort from the orchestrator.

**Example:**

```typescript
registerOrchestratorHandler(mainChannel, (port) => {
  directChannel.bindPort(port);
});
```

### Channels

#### `RPCMessageChannel`

Channel implementation for `MessagePort` (main thread, iframe, etc.).

```typescript
const channel = new RPCMessageChannel({
  port?: MessagePort;        // Existing port to bind
  description?: string;      // Human-readable description
});
```

#### `WorkerChannel`

Channel implementation for Web Workers.

```typescript
const channel = new WorkerChannel({
  worker?: Worker;           // Worker instance (main side)
  description?: string;
});
```

## Configuration

### Connection Orchestrator Options

```typescript
const orchestrator = new WebConnectionOrchestrator({
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

## Browser Compatibility

The Web Connection Orchestrator requires:

- `MessageChannel` API
- `MessagePort` API
- `Worker` API (for worker connections)

**Supported browsers:**

- Chrome 60+
- Firefox 55+
- Safari 15.2+
- Edge 79+

## Best Practices

### ✅ Do

- **Register handlers early**: Call `registerOrchestratorHandler` before `connect()`
- **Handle reconnection**: Workers may restart unexpectedly
- **Enable heartbeat**: Detect dead connections in long-running apps
- **Clean up on unload**: Disconnect when the page is closed

```typescript
window.addEventListener('beforeunload', () => {
  orchestrator.disconnect('main--worker');
});
```

### ❌ Don't

- **Don't rely on cross-origin iframes**: Use `postMessage` with proper origin checks
- **Don't forget to handle errors**: Workers can fail silently
- **Don't create too many connections**: Each connection uses resources

## Examples

### Multi-Worker Data Processing

```typescript
class WorkerPool {
  private orchestrator: WebConnectionOrchestrator;
  private workers: Worker[] = [];

  constructor(size: number) {
    this.orchestrator = new WebConnectionOrchestrator({
      enableStats: true,
    });

    // Create worker pool
    for (let i = 0; i < size; i++) {
      const worker = new Worker('./processor.js');
      const channel = new WorkerChannel({ worker });

      const id = `processor-${i}`;
      this.workers.push(worker);
      this.orchestrator.registerParticipant(id, channel, 'worker');
    }

    // Connect main to all workers
    for (const id of this.workers.map((_, i) => `processor-${i}`)) {
      this.connectMainToWorker(id);
    }
  }

  private async connectMainToWorker(workerId: string) {
    const mainChannel = new RPCMessageChannel({});
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

  async distributeTask(data: any) {
    // Round-robin to available workers
    const workerId = this.getNextWorker();
    const client = this.getClient(workerId);
    return client.process(data);
  }
}
```

### Worker Recovery

```typescript
orchestrator.onDisconnected(({ connectionId, error }) => {
  console.warn(`Worker ${connectionId} disconnected:`, error);
  // Orchestrator will automatically retry based on reconnectPolicy
});

orchestrator.onReconnectFailed(({ connectionId }) => {
  console.error(`Worker ${connectionId} failed to reconnect`);
  // Create a new worker
  const newWorker = new Worker('./worker.js');
  // ... re-register and reconnect
});
```

## Security Considerations

### Cross-Origin Iframes

When communicating with cross-origin iframes:

```typescript
// Always validate origin
window.addEventListener('message', (event) => {
  if (event.origin !== 'https://trusted-domain.com') {
    return;
  }
  // Process message
});
```

### Worker Script Origin

Ensure worker scripts are loaded from trusted sources:

```typescript
// ❌ Don't load from untrusted URLs
const worker = new Worker(userProvidedUrl);

// ✅ Load from same origin or trusted CDN
const worker = new Worker('/workers/trusted-worker.js');
```

## See Also

- [Base Orchestrator Documentation](/packages/async/async-call-rpc/orchestrator/)
- [Electron Orchestrator](/packages/async/async-call-rpc-electron/orchestrator)
- [Node.js Orchestrator](/packages/async/async-call-rpc-node/orchestrator)
- [Web Workers API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API)
- [MessageChannel API](https://developer.mozilla.org/en-US/docs/Web/API/MessageChannel)
