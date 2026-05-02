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
setSerializationFormat(format: string): void;

isConnected(): boolean;
connect(): void;
activate(): void;
disconnect(): void;
cleanUpSubscriptions(): void;

makeRequest(props: SendingProps, transfer?: MessagePort[]): Deferred | void;
makeRequest(requestPath: string, fnName: string, ...args: any[]): Deferred | void;

sendReply(...args: any[]): void;
onMessage(...args: any[]): void;
```

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
abstract send(data: unknown): void;
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
  constructor(target: any, options?: RPCServiceOptions);
  
  call(path: string, methodName: string, args: any[]): Promise<any>;
  onCall: Event<CallContext>;
  onCallEnd: Event<CallContext>;
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

## Channel Implementations

### Web Channels

#### RPCMessageChannel

```typescript
class RPCMessageChannel extends AbstractChannelProtocol {
  constructor(options: {
    port: MessagePort;
    sender?: any;
    targetOrigin?: string;
  } & AbstractChannelProtocolProps);
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
    webContents: WebContents;
  } & AbstractChannelProtocolProps);
}
```

#### IPCRendererChannel

```typescript
class IPCRendererChannel extends AbstractChannelProtocol {
  constructor(props: {
    channelName: string;
  } & AbstractChannelProtocolProps);
}
```

#### ElectronUtilityProcessChannel

```typescript
class ElectronUtilityProcessChannel extends AbstractChannelProtocol {
  constructor(props: {
    port: MessagePort;
  } & AbstractChannelProtocolProps);
}
```

#### ElectronMessagePortMainChannel

```typescript
class ElectronMessagePortMainChannel extends AbstractChannelProtocol {
  constructor(props: {
    port: MessagePortMain;
  } & AbstractChannelProtocolProps);
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
