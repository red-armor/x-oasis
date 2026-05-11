---
title: Scenario Orchestration Best Practices (Web)
description: Best practices for orchestrating RPC connections across Web Worker topologies
order: 3
---

# Scenario Orchestration Best Practices (Web)

This guide distills patterns from `@x-oasis/async-call-rpc-web`'s example suite into actionable best practices for every Web Worker RPC topology — from simple two-party worker RPC to complex multi-worker orchestrations with pagelet proxy.

## Scenario Matrix

| Scenario                           | Topology    | Control Plane       | Data Plane          | Recommended Approach            |
| ---------------------------------- | ----------- | ------------------- | ------------------- | ------------------------------- |
| Main Page ↔ Worker                 | Two-party   | `WorkerChannel`     | —                   | Direct Worker RPC               |
| Worker ↔ Worker                    | Three-party | `WorkerChannel` × 2 | `RPCMessageChannel` | Orchestrator                    |
| Main Page ↔ Worker (Port)          | Two-party   | `WorkerChannel`     | `RPCMessageChannel` | Orchestrator                    |
| Main Page ↔ Multi-Worker via Proxy | Multi-party | `WorkerChannel` × N | `RPCMessageChannel` | Orchestrator + ParticipantProxy |

---

## Pattern 1: Basic Worker RPC — Main Page ↔ Worker

**When to use:** Simple request/response between the main thread and a Web Worker. No high-frequency or large-payload data transfer.

```
Main Page                         Web Worker
┌────────────┐  postMessage       ┌──────────────┐
│  Worker     │◄──────────────────►│  Worker      │
│  Channel    │                    │  Channel     │
└────────────┘                    └──────────────┘
```

### Main Page

```typescript
import { WorkerChannel } from '@x-oasis/async-call-rpc-web';
import { serviceHost } from '@x-oasis/async-call-rpc';

const worker = new Worker(new URL('./worker.ts', import.meta.url), {
  type: 'module',
});
const channel = new WorkerChannel(worker, { name: 'my-worker' });

serviceHost.registerService('worker-api', {
  channel,
  serviceHost,
  handlers: {
    fibonacci(n: number): number {
      if (n <= 1) return n;
      return fibonacci(n - 1) + fibonacci(n - 2);
    },
  },
});
```

### Worker

```typescript
import { WorkerChannel } from '@x-oasis/async-call-rpc-web';
import { clientHost } from '@x-oasis/async-call-rpc';

const channel = new WorkerChannel(self, { name: 'worker-self' });

const api = clientHost.registerClient('worker-api', { channel }).createProxy<{
  fibonacci(n: number): Promise<number>;
}>();
```

### Best Practices

- Use `new URL('./worker.ts', import.meta.url)` for Vite-compatible Worker loading
- CPU-intensive computation should always run in a Worker to keep the UI thread responsive
- Each Worker instance requires its own `WorkerChannel`

---

## Pattern 2: Orchestrator — Worker ↔ Worker Direct Port

**When to use:** Two workers need high-frequency communication. The main page acts as broker, creating a `MessageChannel` and delivering one port to each worker.

```
Main Page (Broker)        Worker A              Worker B
┌──────────┐             ┌──────────┐          ┌──────────┐
│Orchestr- │  control    │ Worker   │  direct  │ Worker   │
│  ator    │◄───────────►│ Channel  │◄────────►│ Channel  │
│          │             │          │  port    │          │
└──────────┘             └──────────┘          └──────────┘
  creates + delivers      bindPort()           bindPort()
  MessageChannel
```

### Main Page

```typescript
import {
  WorkerChannel,
  WebConnectionOrchestrator,
} from '@x-oasis/async-call-rpc-web';

const workerA = new Worker(new URL('./worker-a.ts', import.meta.url), {
  type: 'module',
});
const workerB = new Worker(new URL('./worker-b.ts', import.meta.url), {
  type: 'module',
});

const channelA = new WorkerChannel(workerA, { name: 'worker-a-control' });
const channelB = new WorkerChannel(workerB, { name: 'worker-b-control' });

const orchestrator = new WebConnectionOrchestrator({
  logger: (level, msg) => console.log(`[orchestrator:${level}] ${msg}`),
});

orchestrator.registerParticipant('worker-a', channelA, 'worker');
orchestrator.registerParticipant('worker-b', channelB, 'worker');

await orchestrator.connect('worker-a', 'worker-b');
```

### Worker A

```typescript
import {
  WorkerChannel,
  RPCMessageChannel,
  registerOrchestratorHandler,
} from '@x-oasis/async-call-rpc-web';
import { serviceHost } from '@x-oasis/async-call-rpc';

const controlChannel = new WorkerChannel(self, { name: 'worker-a-control' });

const directChannel = new RPCMessageChannel({
  description: 'worker-a↔worker-b direct',
});

serviceHost.registerService('worker-a-service', {
  channel: directChannel,
  serviceHost,
  handlers: {
    process(data: any): any {
      return { processed: data, by: 'worker-a' };
    },
  },
});

registerOrchestratorHandler(controlChannel, (ctx) => {
  directChannel.bindPort(ctx.port, { rebind: true });
});
```

### Worker B

```typescript
import {
  WorkerChannel,
  RPCMessageChannel,
  registerOrchestratorHandler,
} from '@x-oasis/async-call-rpc-web';
import { clientHost } from '@x-oasis/async-call-rpc';

const controlChannel = new WorkerChannel(self, { name: 'worker-b-control' });

const directChannel = new RPCMessageChannel({
  description: 'worker-b↔worker-a direct',
});

const workerAClient = clientHost
  .registerClient('worker-a-service', { channel: directChannel })
  .createProxy<{ process(data: any): Promise<any> }>();

registerOrchestratorHandler(controlChannel, async (ctx) => {
  directChannel.bindPort(ctx.port, { rebind: true });

  const result = await workerAClient.process({ hello: 'world' });
  console.log('Result:', result);
});
```

---

## Pattern 3: Pagelet Proxy — Main Page ↔ Multi-Worker via Proxy

**When to use:** The main page needs to call services on multiple workers (pagelet, daemon, shared) but doesn't want direct connections to each. A "pagelet" worker acts as proxy, forwarding main page calls to other workers.

This is the Web platform equivalent of Electron's pagelet-proxy pattern described in [D-002](../../../../codebase-wiki/discussion/20260511-multi-page-routing-pagelet-proxy.md).

```
Main Page (Orchestrator)       Worker Processes
┌──────────────┐               ┌──────────┐
│              │  control      │ pagelet   │
│  orchestrator│◄─────────────►│ (proxy)  │
│              │               └────┬─────┘
│              │                    │ direct ports
│              │               ┌────┴─────┐
│              │               │ shared / │
│              │               │ daemon   │
│              │               └──────────┘
└──────────────┘

After connect():
  pagelet ←MessagePort→ shared   (direct data plane)
  pagelet ←MessagePort→ daemon   (direct data plane)

Main page ↔ pagelet: via control plane WorkerChannel (RPC)
```

### Main Page: Orchestrator Setup

```typescript
import {
  WorkerChannel,
  WebConnectionOrchestrator,
} from '@x-oasis/async-call-rpc-web';
import { clientHost, serviceHost } from '@x-oasis/async-call-rpc';

const pageletWorker = new Worker(
  new URL('../workers/pagelet-worker.ts', import.meta.url),
  { type: 'module' }
);
const sharedWorker = new Worker(
  new URL('../workers/shared-worker.ts', import.meta.url),
  { type: 'module' }
);
const daemonWorker = new Worker(
  new URL('../workers/daemon-worker.ts', import.meta.url),
  { type: 'module' }
);

const pageletChannel = new WorkerChannel(pageletWorker, {
  name: 'pagelet-control',
});
const sharedChannel = new WorkerChannel(sharedWorker, {
  name: 'shared-control',
});
const daemonChannel = new WorkerChannel(daemonWorker, {
  name: 'daemon-control',
});

const orchestrator = new WebConnectionOrchestrator({
  logger: (level, msg) => console.log(`[orchestrator:${level}] ${msg}`),
});

orchestrator.registerParticipant('pagelet', pageletChannel, 'worker');
orchestrator.registerParticipant('shared', sharedChannel, 'worker');
orchestrator.registerParticipant('daemon', daemonChannel, 'worker');

// Register the proxy service on serviceHost so the control channel
// can route ORCHESTRATOR_PROXY_SERVICE_PATH requests
orchestrator.registerProxyService(serviceHost);

// Set serviceHost on ALL control channels — this is critical for
// multi-service routing (orchestrator signaling + app RPC) on one channel
pageletChannel.setServiceHost(serviceHost);
sharedChannel.setServiceHost(serviceHost);
daemonChannel.setServiceHost(serviceHost);

// Create client for pagelet's proxy API
const pageletClient = clientHost
  .registerClient('pagelet-api', { channel: pageletChannel })
  .createProxy();

// Trigger connections — pagelet will self-connect to shared/daemon
await orchestrator.connect('pagelet', 'shared');
await orchestrator.connect('pagelet', 'daemon');
```

### Pagelet Worker: Self-Connect + Proxy Services

The pagelet uses `ParticipantOrchestratorProxy` pattern to self-connect to all peers, then exposes proxy handlers that forward main page calls to shared/daemon:

```typescript
import { WorkerChannel, RPCMessageChannel } from '@x-oasis/async-call-rpc-web';
import {
  clientHost,
  serviceHost,
  ORCHESTRATOR_PROXY_SERVICE_PATH,
  ORCHESTRATOR_SERVICE_PATH,
} from '@x-oasis/async-call-rpc';

const controlChannel = new WorkerChannel(self, { name: 'pagelet-control' });

// ---- Step 1: Register orchestrator handlers via serviceHost ----
// Use registerServiceHandler + setServiceHost to avoid channel._service
// being overwritten by later registerService calls (causes "Method not found").

serviceHost.registerServiceHandler(ORCHESTRATOR_SERVICE_PATH, {
  activateConnection(port: any) {
    /* handle port */
  },
  activateConnectionContext(ctx: any) {
    /* store context */
  },
});

// MUST set serviceHost BEFORE any connect() call, otherwise
// the channel has no handler lookup and requests will fail
controlChannel.setServiceHost(serviceHost);

// ---- Step 2: Create proxy client for orchestrator ----
const orchestratorClient = clientHost
  .registerClient(ORCHESTRATOR_PROXY_SERVICE_PATH, { channel: controlChannel })
  .createProxy();

// ---- Step 3: Self-connect to peers ----
async function boot() {
  // Request orchestrator to establish direct ports
  await orchestratorClient.requestConnect('pagelet', 'shared');
  await orchestratorClient.requestConnect('pagelet', 'daemon');

  // After activateConnection handlers receive ports,
  // create RPC clients on the direct channels
  const sharedClient = clientHost
    .registerClient('shared-rpc', { channel: sharedDirectChannel })
    .createProxy();
  const daemonClient = clientHost
    .registerClient('daemon-rpc', { channel: daemonDirectChannel })
    .createProxy();

  // ---- Step 4: Register proxy API for the main page ----
  // Use registerServiceHandler (not registerService) to avoid
  // overwriting the ORCHESTRATOR_SERVICE_PATH handler on the channel
  serviceHost.registerServiceHandler('pagelet-api', {
    info(): string {
      return 'pagelet ready (web worker)';
    },
    async callSharedEcho(msg: string): Promise<string> {
      return sharedClient.echo(msg);
    },
    async callDaemonSystemStatus(): Promise<string> {
      return daemonClient.systemStatus();
    },
  });
}

boot().catch(console.error);
```

### Shared/Daemon Workers: `registerOrchestratorHandler`

Workers that only need to expose services use `registerOrchestratorHandler`:

```typescript
import {
  WorkerChannel,
  RPCMessageChannel,
  registerOrchestratorHandler,
} from '@x-oasis/async-call-rpc-web';
import { serviceHost } from '@x-oasis/async-call-rpc';

const controlChannel = new WorkerChannel(self, { name: 'shared-control' });

const handlers = {
  echo(msg: string): string {
    return `shared echo: ${msg}`;
  },
  getConfig(key: string): string {
    return `config[${key}] = value`;
  },
};

serviceHost.registerServiceHandler('shared-rpc', handlers);

const directChannels = new Map<string, RPCMessageChannel>();

registerOrchestratorHandler(controlChannel, (ctx) => {
  const { port, connectionId, role } = ctx;

  // Parse peer identity from connectionId (format: "fromId--toId")
  const idx = connectionId.indexOf('--');
  const from = connectionId.substring(0, idx);
  const to = connectionId.substring(idx + 2);
  const peerId = role === 'initiator' ? to : from;

  // Route port to the correct direct channel per peer
  let channel = directChannels.get(peerId);
  if (!channel) {
    channel = new RPCMessageChannel({ description: `shared↔${peerId} direct` });
    directChannels.set(peerId, channel);
  }
  channel.bindPort(port, { rebind: true });

  // Register service on the direct data-plane channel
  serviceHost.registerService('shared-rpc', {
    channel,
    serviceHost,
    handlers,
  });
});
```

### Main Page: Call Pagelet API

```typescript
// The main page only knows about pagelet-api
const status = await pageletClient.callDaemonSystemStatus();
const echo = await pageletClient.callSharedEcho('hello');
```

---

## Control Plane vs Data Plane

| Layer             | Purpose                                                     | Channel Types                       | Lifetime          |
| ----------------- | ----------------------------------------------------------- | ----------------------------------- | ----------------- |
| **Control Plane** | Service registration, port delivery, orchestrator signaling | `WorkerChannel`, `WebSocketChannel` | Long-lived        |
| **Data Plane**    | High-throughput application data                            | `RPCMessageChannel`                 | Created on demand |

```
┌───────────────────────────────────────────────────┐
│                  Control Plane                     │
│  (WorkerChannel — always active)                   │
│                                                    │
│  ┌──────────┐  register  ┌──────────┐  register   │
│  │Main Page │◄──────────►│Orchestr- │◄──────────► │
│  │          │            │  ator    │             │
│  └──────────┘            └──────────┘             │
│                                                    │
│  ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─  │
│                                                    │
│                  Data Plane                        │
│  (RPCMessageChannel — created by orchestrator)     │
│                                                    │
│  ┌──────────┐  direct port  ┌──────────┐          │
│  │ Worker A │◄─────────────►│ Worker B │          │
│  └──────────┘               └──────────┘          │
└───────────────────────────────────────────────────┘
```

### Best Practices

- Establish the control plane first, then create data plane connections
- Use the control plane for service discovery and port delivery
- Use data plane for high-frequency, latency-sensitive communication
- The main page always acts as the broker — it owns `MessageChannel` creation

---

## Multi-Service Routing on a Shared Channel

One of the most powerful features of `async-call-rpc` is that multiple service paths can share the same transport channel without cross-talk. This is critical for the orchestrator pattern because the control-plane channel carries both application RPCs and the internal orchestrator signaling (`activateConnection`) on the same wire.

### The `serviceHost.registerServiceHandler` + `setServiceHost` Pattern

When a Worker needs both orchestrator handlers and application services on the same channel, **you must use `serviceHost.registerServiceHandler` + `channel.setServiceHost(serviceHost)`** instead of `serviceHost.registerService({ channel })`.

The reason: `registerService({ channel })` calls `channel.setService(this)` internally, which **overwrites** `channel._service`. If you register `ORCHESTRATOR_SERVICE_PATH` first and then `pagelet-api` second, the second call replaces the orchestrator handler — causing "Method not found" errors on reconnect.

```typescript
// ✅ CORRECT: Use registerServiceHandler + setServiceHost
serviceHost.registerServiceHandler(ORCHESTRATOR_SERVICE_PATH, {
  activateConnection(port) {
    /* ... */
  },
  activateConnectionContext(ctx) {
    /* ... */
  },
});

serviceHost.registerServiceHandler('pagelet-api', {
  info() {
    return 'ready';
  },
});

// Set serviceHost AFTER registering all handlers, BEFORE connect()
controlChannel.setServiceHost(serviceHost);
```

```typescript
// ❌ WRONG: registerService overwrites channel._service
const orchService = new RPCService(ORCHESTRATOR_SERVICE_PATH, { handlers: { ... } });
orchService.setChannel(controlChannel); // sets controlChannel._service = orchService

serviceHost.registerService('pagelet-api', {
  channel: controlChannel, // OVERWRITES controlChannel._service = pagelet-api service
  serviceHost,
  handlers: { ... },
});
// Now ORCHESTRATOR_SERVICE_PATH requests cannot find their handler!
```

### When to Use Each Registration Method

| Method                                      | Sets `channel._service` | Sets `channel.serviceHost` | Multi-service safe |
| ------------------------------------------- | ----------------------- | -------------------------- | ------------------ |
| `registerService({ channel })`              | Yes (overwrites!)       | No                         | ❌                 |
| `registerServiceHandler` + `setServiceHost` | No                      | Yes (once)                 | ✅                 |
| `RPCService.setChannel()`                   | Yes (overwrites!)       | No                         | ❌                 |

---

## ActivationContext: Peer Identity in `registerOrchestratorHandler`

The `registerOrchestratorHandler` callback receives an `ActivationContext` object (not just a bare port), enabling multi-peer routing:

```typescript
interface ActivationContext {
  port: MessagePort;
  connectionId: string; // format: "fromId--toId"
  role: 'initiator' | 'receiver';
}
```

### Parsing Peer Identity

```typescript
registerOrchestratorHandler(controlChannel, (ctx) => {
  const { port, connectionId, role } = ctx;
  const idx = connectionId.indexOf('--');
  const from = connectionId.substring(0, idx);
  const to = connectionId.substring(idx + 2);
  const peerId = role === 'initiator' ? to : from;

  // Route port to the correct channel based on peerId
  peerChannels.get(peerId)?.bindPort(port, { rebind: true });
});
```

This is the Web implementation of the D-002 proposal — `connectionId` + `role` allows participants to identify which peer the port comes from, solving the multi-pagelet routing problem.

---

## Rebinding RPCMessageChannel

When a participant reconnects, it receives a new `MessagePort`. Use `bindPort` with `rebind: true` to replace the existing port:

```typescript
const directChannel = new RPCMessageChannel({
  description: 'direct data channel',
});

registerOrchestratorHandler(controlChannel, (ctx) => {
  directChannel.bindPort(ctx.port, { rebind: true });
});
```

Without `rebind: true`, the second `bindPort` call is a no-op if a port is already bound — the participant would keep using the stale port.

---

## WebSocket Channel: Client-Server RPC

**When to use:** Real-time communication between a browser and a backend server.

```
Browser                            Server
┌──────────────┐  WebSocket        ┌──────────────┐
│  WebSocket   │◄─────────────────►│  WebSocket   │
│  Channel     │                   │  Channel     │
└──────────────┘                   └──────────────┘
```

### Browser

```typescript
import { WebSocketChannel } from '@x-oasis/async-call-rpc-web';
import { clientHost } from '@x-oasis/async-call-rpc';

const ws = new WebSocket('ws://localhost:3460');
const channel = new WebSocketChannel(ws, { name: 'server-rpc' });

const serverClient = clientHost
  .registerClient('server-api', { channel })
  .createProxy<{
    echo(msg: string): Promise<string>;
    getTime(): Promise<string>;
  }>();
```

### Server (Node.js)

```typescript
import { WebSocketChannel } from '@x-oasis/async-call-rpc-node';
import { serviceHost } from '@x-oasis/async-call-rpc';

const wss = new WebSocket.Server({ port: 3460 });

wss.on('connection', (ws) => {
  const channel = new WebSocketChannel(ws, { name: 'client-rpc' });

  serviceHost.registerService('server-api', {
    channel,
    serviceHost,
    handlers: {
      echo(msg: string): string {
        return `echo: ${msg}`;
      },
      getTime(): string {
        return new Date().toISOString();
      },
    },
  });
});
```

---

## Channel Selection Guide

```
Need RPC between contexts?
│
├─ Main page ↔ Worker?
│  ├─ Low frequency? ──► WorkerChannel (direct)
│  └─ High frequency? ──► RPCMessageChannel via Orchestrator
│
├─ Worker ↔ Worker?
│  └─ Always ──► RPCMessageChannel via Orchestrator
│                (main page as broker)
│
├─ Main page ↔ Multi-Worker?
│  └─ Always ──► Orchestrator + ParticipantProxy
│
└─ Browser ↔ Server?
   └─ Always ──► WebSocketChannel
```

### Channel Package Mapping

| Context             | Channel Type        | Package               |
| ------------------- | ------------------- | --------------------- |
| Main page           | `WorkerChannel`     | `async-call-rpc-web`  |
| Main page           | `RPCMessageChannel` | `async-call-rpc-web`  |
| Web Worker          | `WorkerChannel`     | `async-call-rpc-web`  |
| Web Worker          | `RPCMessageChannel` | `async-call-rpc-web`  |
| Iframe              | `RPCMessageChannel` | `async-call-rpc-web`  |
| Browser (WebSocket) | `WebSocketChannel`  | `async-call-rpc-web`  |
| Node.js server      | `WebSocketChannel`  | `async-call-rpc-node` |

---

## Common Pitfalls

### 1. Using `registerService` Instead of `registerServiceHandler` on Shared Channels

```typescript
// ❌ Wrong: registerService overwrites channel._service
serviceHost.registerService('pagelet-api', {
  channel: controlChannel,
  serviceHost,
  handlers: { ... },
});
// ORCHESTRATOR_SERVICE_PATH handler is now lost!

// ✅ Correct: registerServiceHandler + setServiceHost
serviceHost.registerServiceHandler(ORCHESTRATOR_SERVICE_PATH, { ... });
serviceHost.registerServiceHandler('pagelet-api', { ... });
controlChannel.setServiceHost(serviceHost);
```

### 2. Not Calling `setServiceHost` Before `connect()`

```typescript
// ❌ Wrong: channel has no handler lookup
serviceHost.registerServiceHandler(ORCHESTRATOR_SERVICE_PATH, { ... });
// Forgot: controlChannel.setServiceHost(serviceHost);
await proxy.connect('shared'); // Method not found!

// ✅ Correct: set serviceHost before any connect
serviceHost.registerServiceHandler(ORCHESTRATOR_SERVICE_PATH, { ... });
controlChannel.setServiceHost(serviceHost);
await proxy.connect('shared');
```

### 3. Not Using `rebind: true` in `registerOrchestratorHandler`

```typescript
// ❌ Wrong: Reconnect delivers a new port, but bindPort is a no-op
registerOrchestratorHandler(channel, (ctx) => {
  directChannel.bindPort(ctx.port);
});

// ✅ Correct: Allow port replacement on reconnect
registerOrchestratorHandler(channel, (ctx) => {
  directChannel.bindPort(ctx.port, { rebind: true });
});
```

### 4. Not Registering Orchestrator Handler Before `connect()`

```typescript
// ❌ Wrong: connect triggers activateConnection, but no handler exists
await orchestrator.connect('worker-a', 'worker-b');
registerOrchestratorHandler(channel, onPort);

// ✅ Correct: register handler first
registerOrchestratorHandler(channel, onPort);
await orchestrator.connect('worker-a', 'worker-b');
```

### 5. Forgetting `type: 'module'` for Worker with Imports

```typescript
// ❌ Wrong: Worker can't resolve module imports
new Worker(new URL('./worker.ts', import.meta.url));

// ✅ Correct: Vite requires type: 'module' for TS workers
new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
```

### 6. Not Setting `setServiceHost` on Main Page Control Channels

On the main page, all control channels need `setServiceHost` for the `registerProxyService` routing to work:

```typescript
orchestrator.registerProxyService(serviceHost);
pageletChannel.setServiceHost(serviceHost); // Required!
sharedChannel.setServiceHost(serviceHost);
daemonChannel.setServiceHost(serviceHost);
```

Without this, `ORCHESTRATOR_PROXY_SERVICE_PATH` requests from Workers to the orchestrator cannot be routed.

---

## Example Reference

| Example                 | Pattern                            | Approach                        |
| ----------------------- | ---------------------------------- | ------------------------------- |
| `worker-example`        | Main Page ↔ Worker                 | Direct WorkerChannel            |
| `websocket-example`     | Browser ↔ Server                   | WebSocketChannel                |
| `pagelet-proxy-example` | Main Page ↔ Multi-Worker via Proxy | Orchestrator + ParticipantProxy |

---

## See Also

- [Package Overview](/packages/async/async-call-rpc-web/)
- [Connection Orchestrator API](/packages/async/async-call-rpc-web/orchestrator)
- [Base Orchestrator Documentation](/packages/async/async-call-rpc/orchestrator/)
- [Electron Scenario Best Practices](/packages/async/async-call-rpc-electron/scenario-orchestration)
- [D-002: Multi-Page to Multi-Pagelet RPC Routing](../../../../codebase-wiki/discussion/20260511-multi-page-routing-pagelet-proxy.md)
- [Examples Source](https://github.com/red-armor/x-oasis/tree/main/packages/async/async-call-rpc-web/examples)
