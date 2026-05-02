# API Reference

Complete API reference for async-call-rpc.

## AbstractChannelProtocol

Base class for all RPC channel protocols.

### Constructor

```typescript
constructor(props?: AbstractChannelProtocolProps)
```

**Parameters:**
- `description?`: string - Human-readable channel description for logging
- `identifier?`: string - Unique identifier (e.g., process name, port)
- `metadata?`: Record<string, any> - Extensible channel context
- `connected?`: boolean - Initial connection state (default: true)
- `serializationFormat?`: string - Buffer format (default: 'json')
- `readBuffer?`: ReadBaseBuffer - Custom read buffer
- `writeBuffer?`: WriteBaseBuffer - Custom write buffer
- `createContext?`: CreateContextFn - Per-request context factory

### Properties

#### Public Properties

```typescript
ongoingRequests: Map<string, Deferred>;
pendingSendEntries: Set<PendingSendEntry>;
requestEvents: Map<string, any>;
subscriptions: Map<string, Unsubscribable>;
activeEventMethods: Set<string>;
```

#### Getters

```typescript
get service(): RPCService;
get senderMiddleware(): SenderMiddleware[];
get createContext(): CreateContextFn | null;
get readBuffer(): ReadBaseBuffer;
get writeBuffer(): WriteBaseBuffer;
get serializationFormat(): string;
get seqId(): string;
get description(): string;
get identifier(): string;
get metadata(): Record<string, any>;
```

### Methods

#### Public Methods

```typescript
setService(service: RPCService): void;
setServiceHost(host: RPCServiceHost): void;
ensureListenerAttached(): void;

setSerializationFormat(format: string): void;

isConnected(): boolean;
connect(): void;
activate(): void;
disconnect(): void;
cleanUpSubscriptions(): void;

makeRequest(props: SendingProps, transfer?: MessagePort[]): Deferred | void;
makeRequest(requestPath: string, fnName: string, ...args: any[]): Deferred | void;

send(data: any, transfer?: any[]): void;
sendReply(data: any, transfer?: any[]): void;
onMessage(...args: any[]): void;
```

##### `setServiceHost(host)`

Bind the channel to an `RPCServiceHost` for **multi-service-per-channel routing**. The `handleRequest` middleware will look up handlers via `host.getHandler(requestPath, methodName)` instead of the channel's single bound `RPCService`.

When the incoming `requestPath` is not registered on the host, the request is **silently ignored** (no `Method not found` reply). This is what allows one transport to be safely shared by multiple `RPCServiceHost` instances without cross-talk.

Idempotent: calling twice with the same host is a no-op.

##### `ensureListenerAttached()`

Idempotently wire `onMessage` to the underlying transport. Called by `setServiceHost`, `RPCService.setChannel`, and `ProxyRPCClient.setChannel` so that a single channel shared between a service host and one or more clients only ever has one listener — preventing every incoming message from being processed multiple times.

#### Protected Methods

```typescript
decorateSendMiddleware(middlewares: SenderMiddleware[]): SenderMiddleware[];
decorateOnMessageMiddleware(middlewares: ClientMiddleware[]): ClientMiddleware[];

applyOnMessageMiddleware(fns: Function | Function[]): void;
applySendMiddleware(fns: Function | Function[]): void;

resumePendingEntry(): void;
didConnected(): void;
addPendingSendEntry(entry: PendingSendEntry): void;
```

#### Abstract Methods

**Must be implemented by subclasses:**

```typescript
abstract send(data: unknown, transfer?: any[]): void;
abstract on(listener: (data: unknown) => void): void | (() => void);
```

### Events

```typescript
onDidConnected: Event<void>;
onDidDisconnected: Event<void>;
```

## RPCService

Service wrapper for hosting RPC handlers.

```typescript
class RPCService {
  constructor(servicePath: string, options?: RPCServiceOptions);

  readonly servicePath: string;
  readonly serviceHost?: RPCServiceHost;
  readonly handlersMap: Map<string, (...args: any[]) => any>;

  setChannel(channel: AbstractChannelProtocol): void;
  setInstance(instance: object): void;

  registerHandler(methodName: string, handler: (...args: any[]) => any): void;
  registerHandlers(handlers?: ServiceHandlers): void;

  /**
   * Resolve a method name to a handler. Lookup order:
   *   1. explicit `handlersMap` entry
   *   2. method on `instance` (bound to the instance via `.bind`)
   *   3. `undefined`
   */
  getHandler(methodName: string): ((...args: any[]) => any) | undefined;
}
```

### `RPCServiceOptions`

```typescript
type RPCServiceOptions = {
  /** Bind this service to a channel (1-channel-1-service mode). Optional. */
  channel?: AbstractChannelProtocol;
  /** Explicit handler map. Optional when `instance` is provided. */
  handlers?: ServiceHandlers;
  /** Owning service host (for back-reference). Optional. */
  serviceHost?: RPCServiceHost;
  /**
   * A class instance used as a fallback bag of methods. When set,
   * `getHandler(name)` falls back to `instance[name].bind(instance)`
   * if no entry exists in `handlers`.
   */
  instance?: object;
};
```

## RPCServiceHost

Routing table from `servicePath` → `RPCService`. Two registration modes:

```typescript
class RPCServiceHost {
  serviceMap: Map<string, RPCService>;

  /**
   * 1-channel-1-service mode. The service binds to its own channel via
   * `options.channel`. Always overrides `options.serviceHost` with `this`.
   */
  registerService(servicePath: string, options: RPCServiceOptions): RPCService;

  /**
   * Multi-service-per-channel mode. The service is *not* bound to a
   * channel; instead, channels share this host via
   * `channel.setServiceHost(host)`. Routing happens in the
   * `handleRequest` middleware.
   *
   * `instanceOrHandlers` is auto-detected:
   *   - if every own value is a function → handler map
   *   - otherwise → class instance (handlers resolved via prototype + bind)
   */
  registerServiceHandler(
    servicePath: string,
    instanceOrHandlers: object,
  ): RPCService;

  getService(servicePath: string): RPCService | undefined;

  /**
   * Resolve `(servicePath, methodName)` → handler. Returns `undefined`
   * for unknown paths or unknown methods. The handleRequest middleware
   * relies on this `undefined` (rather than throwing or replying) to
   * silently drop unrouted requests on shared transports.
   */
  getHandler(servicePath: string, handlerName: string):
    | ((...args: any[]) => any)
    | undefined;
}
```

## Message Types

### SendingProps

Request envelope properties:

```typescript
interface SendingProps {
  requestPath: string;      // Service path
  methodName: string;       // Method name
  args?: any[];             // Method arguments
  isOptionsRequest?: boolean;
  transfer?: MessagePort[];
  requestType?: string;     // Request type
}
```

### RequestType

```typescript
enum RequestType {
  PromiseRequest = 'pr',
  SignalRequest = 'sr',
  SubscriptionRequest = 'sub',
  SubscriptionStop = 'unsub',
  EventMethodStop = 'evt-stop',
}
```

### ResponseType

```typescript
enum ResponseType {
  ReturnSuccess = 'rs',
  ReturnFail = 'rf',
  PortSuccess = 'ps',
  PortFail = 'pf',
  SubscriptionStopped = 'ss',
  EventMethodStopped = 'evt-stopped',
}
```

### Port-returning handlers

When a handler's resolved value is **port-like** — any object with a `postMessage` function — the `handleRequest` middleware encodes it as a `PortSuccess` frame and queues the value into the underlying transport's transfer list, instead of serializing it. The receiving side's `handleResponse` resolves the deferred with `message.ports[0]`.

```typescript
serviceHost.registerServiceHandler('/broker', {
  acquirePort: () => {
    const { port1, port2 } = new MessageChannel();
    setupOn(port1);
    return port2;        // ⬅ auto-detected as port-like, sent via transfer list
  },
});

const broker = clientHost
  .registerClient('/broker', { channel })
  .createProxy<{ acquirePort(): Promise<MessagePort> }>();

const port = await broker.acquirePort();
const sub = new RPCMessageChannel({ port });
```

Detection is duck-typed (`typeof v.postMessage === 'function'`) so it works with Web `MessagePort`, Electron `MessagePortMain`, and any equivalent stand-in. The transport's `send`/`sendReply` must support a transfer-list second argument — all built-in channels do.

## Channel Implementations

### Web Channels

#### RPCMessageChannel

```typescript
class RPCMessageChannel extends AbstractChannelProtocol {
  constructor(options?: {
    port?: MessagePort;       // optional — bind later via bindPort()
    sender?: any;
    targetOrigin?: string;
  } & AbstractChannelProtocolProps);

  /**
   * Late port binding. When `port` was omitted at construction, the
   * channel starts disconnected and queues sends. `bindPort` attaches
   * the port, calls `port.start()`, wires any pending listener, and
   * activates — the framework's `resumePendingEntry` then flushes the
   * queue. Idempotent: no-op if a port is already bound.
   */
  bindPort(port: MessagePort): void;

  send(message: any, transfer?: Transferable[]): void;
}
```

#### WebSocketChannel

```typescript
class WebSocketChannel extends AbstractChannelProtocol {
  constructor(socket: WebSocket, options?: {
    name?: string;
    maxReconnectAttempts?: number;
    reconnectDelay?: number;
  } & AbstractChannelProtocolProps);
}
```

#### WorkerChannel

```typescript
class WorkerChannel extends AbstractChannelProtocol {
  constructor(worker: Worker, options?: AbstractChannelProtocolProps);
}
```

### Node.js Channels

#### NodeProcessChannel

```typescript
class NodeProcessChannel extends AbstractChannelProtocol {
  constructor(props: {
    process: ChildProcess | NodeJS.Process;
  } & AbstractChannelProtocolProps);
}
```

### Electron Channels

#### IPCMainChannel

```typescript
class IPCMainChannel extends AbstractChannelProtocol {
  constructor(props: {
    channelName: string;
    /** Required in bound mode; optional when acceptAllSenders is true. */
    webContents?: WebContents;
    /**
     * Broadcast mode: listen on the channel regardless of source,
     * remember the most-recent sender, and reply through it. Useful for
     * broker channels where many renderers may post to the main process.
     * When true, `webContents` may be omitted.
     */
    acceptAllSenders?: boolean;
  } & AbstractChannelProtocolProps);

  /**
   * Sends `data` via `webContents.send(channelName, data)`. When `transfer`
   * is non-empty, switches to `webContents.postMessage(channelName, data, transfer)`,
   * which can carry `MessagePortMain` instances.
   */
  send(data: unknown, transfer?: any[]): void;
}
```

#### IPCRendererChannel

```typescript
class IPCRendererChannel extends AbstractChannelProtocol {
  constructor(props: {
    channelName: string;
  } & AbstractChannelProtocolProps);

  /**
   * Like `IPCMainChannel.send`, switches to `ipcRenderer.postMessage` when
   * a transfer list is provided.
   */
  send(data: unknown, transfer?: any[]): void;
}
```

#### ElectronUtilityProcessChannel

```typescript
class ElectronUtilityProcessChannel extends AbstractChannelProtocol {
  constructor(props: {
    port: MessagePort;
  } & AbstractChannelProtocolProps);

  send(data: unknown, transfer?: any[]): void;
}
```

#### ElectronMessagePortMainChannel

```typescript
class ElectronMessagePortMainChannel extends AbstractChannelProtocol {
  constructor(props?: {
    port?: MessagePortMain;   // optional — bind later via bindPort()
  } & AbstractChannelProtocolProps);

  /**
   * Late port binding (parallel to RPCMessageChannel.bindPort). Useful for
   * the Electron broker flow where a service is registered before the
   * actual `MessagePortMain` arrives via a transferred MessageEvent.
   */
  bindPort(port: MessagePortMain): void;
}
```

## Middleware Types

### Middleware Factories

```typescript
type SenderMiddleware = (channel: AbstractChannelProtocol) =>
  (data: SendingProps) => any;

type ClientMiddleware = (channel: AbstractChannelProtocol) =>
  (data: any) => any;
```

### Middleware Lifecycle

```typescript
enum SendMiddlewareLifecycle {
  Initial = 0,
  Prepare = 10,
  Transform = 20,
  DataOperation = 30,
  Send = 40,
  Aborted = 100,
}
```

## Utilities

### Deferred

Promise-like object that can be resolved/rejected externally:

```typescript
class Deferred<T = any> {
  promise: Promise<T>;
  resolve(value: T): void;
  reject(reason?: any): void;
}
```

## See Also

- [Middleware Overview](/packages/async/async-call-rpc/middleware/overview)
- [Examples](/packages/async/async-call-rpc/examples)
- [Custom Middleware Guide](/packages/async/async-call-rpc/middleware/custom-middleware)
