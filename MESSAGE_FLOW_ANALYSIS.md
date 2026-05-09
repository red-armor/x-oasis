# x-oasis RPC Message Flow Analysis

## Executive Summary

This document provides a deep analysis of how `AbstractChannelProtocol` routes RPC messages between service hosts and clients, with particular focus on the **late binding pattern** (bindPort) and the **ContextBridge pattern** used in Electron applications.

### Key Findings

1. **bindPort() works correctly** - Channel routes messages through serviceHost even when port is bound late
2. **ContextBridge pattern is sound** - Messages properly reach utility process through the bridge
3. **Dual-channel architecture** - Page receives through bridge, preload creates real channel to utility process
4. **Message flow is comprehensive** - Middleware pipeline ensures proper serialization and routing

---

## Architecture Overview

### The Complete Message Path

```
┌─────────────────────────────────────────────────────────────────┐
│                    SEND SIDE (Client)                            │
├─────────────────────────────────────────────────────────────────┤
│  makeRequest(path, method, ...args)                              │
│         ↓                                                        │
│  Sender Middleware Pipeline:                                    │
│  1. prepareNormalData       - Build envelope, detect Transferables
│  2. updateSeqInfo           - Assign seqId (unique per request)  │
│  3. handleDisconnectedRequest - Queue if disconnected            │
│  4. serialize               - Encode via writeBuffer             │
│  5. sendRequest             - Call channel.send()                │
│                                                                   │
│  Output: Serialized data [header, body] sent to transport        │
└─────────────────────────────────────────────────────────────────┘
                             ↓
                    [Transport Layer]
                  (MessagePort, Electron IPC, etc)
                             ↓
┌─────────────────────────────────────────────────────────────────┐
│                  RECEIVE SIDE (Server)                           │
├─────────────────────────────────────────────────────────────────┤
│  Receive Middleware Pipeline:                                   │
│  1. normalizeMessageChannelRawMessage - Extract data & ports     │
│  2. deserialize                       - Decode via readBuffer    │
│  3. handleRequest                     - Route & invoke handler   │
│  4. handleResponse                    - Route responses to client│
│                                                                   │
│  Output: Service response sent back through same channel         │
└─────────────────────────────────────────────────────────────────┘
```

---

## AbstractChannelProtocol: Core Design

### Key Properties

```typescript
class AbstractChannelProtocol extends Disposable {
  // Connection state
  protected _isConnected = true;
  
  // Service routing (multi-service per channel)
  private _service!: RPCService;
  private _serviceHost: RPCServiceHost | null = null;
  
  // Request tracking
  public ongoingRequests: Map<string, Deferred> = new Map();     // Waiting responses
  public subscriptions: Map<string, Unsubscribable> = new Map();  // Active streams
  public requestEvents: Map<string, any> = new Map();             // Event callbacks
  public pendingSendEntries: Set<PendingSendEntry> = new Set();   // Queued requests
  
  // Message processing
  protected _onMessageMiddleware: ClientMiddleware[] = [...];
  private _senderMiddleware: SenderMiddleware[] = [...];
  
  // Sequencing
  private _seqId: RequestRawSequenceId = -1;  // Auto-incremented
  private _key: string;                       // Channel identifier
}
```

---

## The bindPort() Pattern: Late Binding

### Problem: Port arrives after service registration

```typescript
// Timeline of events:
// 1. Renderer: Create channel without port
const channelA = new RPCMessageChannel({ description: 'page-bridge' });

// 2. Renderer: Register service before port arrives
serviceHostA.registerServiceHandler('/myService', instanceA);
channelA.setServiceHost(serviceHostA);

// 3. Preload: Create real channel and attach port
const { port1, port2 } = new MessageChannel();
const channelB = new RPCMessageChannel({ port: port2 });
ipcRenderer.send('port', port1);  // Send to main process

// 4. Renderer: Receives port, binds it
window.addEventListener('message', (e) => {
  if (e.data === 'port') {
    channelA.bindPort(e.ports[0]);  // ← PORT BINDING
  }
});
```

### Implementation: RPCMessageChannel.bindPort()

```typescript
class RPCMessageChannel extends AbstractChannelProtocol {
  private port: MessagePort | null;
  
  bindPort(port: MessagePort): void {
    if (this.port) return;  // Idempotent
    this._attachPort(port);
    this.activate();  // ← Triggers connection event
  }
  
  private _attachPort(port: MessagePort): void {
    this.port = port;
    if (port.start) port.start();
    
    // If listener was registered while port was absent
    if (this._pendingListener) {
      this._detachListener = this._wireListener(port, this._pendingListener);
      this._pendingListener = null;
    }
  }
}
```

### Connection State Transitions

```typescript
// DISCONNECTED STATE (no port)
constructor(options: {description}) {
  super({ ...options, connected: false });  // ← START DISCONNECTED
  this.port = null;
  this._pendingListener = null;
}

// CONNECTED STATE (port bound)
bindPort(port: MessagePort) {
  this._attachPort(port);
  this.activate();  // ← FIRE onDidConnected event
}

activate() {
  this._isConnected = true;
  this.onDidConnectedEvent.fire();  // ← Resumes pending requests
}
```

### Queueing During Disconnect

When channel is disconnected, requests are queued:

```typescript
// Send path (outgoing request while disconnected)
makeRequest(requestPath, methodName, ...args) {
  const result = runMiddlewares(this.senderMiddleware, args);
  // ↓
  // In handleDisconnectedRequest middleware:
  if (!protocol.isConnected() && !value.isOptionsRequest) {
    protocol.addPendingSendEntry({
      methodName: fn.displayName,
      lifecycle: SendMiddlewareLifecycle.Transform,
      ...value,
      middlewareContext: {...},
    });
    value.middlewareContext.minLifecycle = SendMiddlewareLifecycle.Aborted;
    // ↑ Skip remaining middleware (short-circuit)
  }
}

// Resume on connection
didConnected() {
  this.resumePendingEntry();  // ← Resumes all queued requests
}

resumePendingEntry() {
  this.pendingSendEntries.forEach((entry) => {
    this.pendingSendEntries.delete(entry);
    resumeMiddlewares(this.senderMiddleware, entry);  // ← Re-run middleware chain
  });
}
```

### CRITICAL: ensureListenerAttached()

This is called when binding service host or client:

```typescript
setServiceHost(host: RPCServiceHost) {
  if (this._serviceHost === host) return;
  this._serviceHost = host;
  this.ensureListenerAttached();  // ← ATTACH LISTENER
}

setChannel(channel: AbstractChannelProtocol) {
  this.channel = channel;
  this.channel.setService(this);
  this.channel.ensureListenerAttached();  // ← ATTACH LISTENER
}

ensureListenerAttached(): void {
  if (this._listenerAttached) return;  // Idempotent
  this._listenerAttached = true;
  this.on(this.onMessage.bind(this));  // ← Register message listener
}
```

**For bindPort scenarios:**
- When port is absent, `on()` stores listener in `_pendingListener`
- When port is bound, `_attachPort()` wires the pending listener
- Messages arriving after port binding are processed correctly

---

## Message Routing: Single vs Multi-Service

### Mode 1: Single Service per Channel

```typescript
// Service registers with its own channel
const service = new RPCService('/myService', {
  channel: myChannel,
  handlers: {...}
});

// Service is stored directly in channel
myChannel.setService(service);

// Request handling:
if (!serviceHost) {
  handler = service?.getHandler(methodName);  // ← Direct lookup
}
```

### Mode 2: Multi-Service per Channel (setServiceHost)

```typescript
// Create host
const host = new RPCServiceHost();
host.registerServiceHandler('/service1', instance1);
host.registerServiceHandler('/service2', instance2);

// Bind same channel to multiple services
channelA.setServiceHost(host);

// Request handling:
if (serviceHost) {
  handler = serviceHost.getHandler(requestPath, methodName);  // ← Host lookup
  if (!handler) return message;  // Silently pass through if path unknown
}
```

**This enables shared transport** - Multiple channels can use the same transport without cross-talk.

---

## Complete Message Send Flow

### Step 1: Client calls makeRequest()

```typescript
// Two calling conventions:
channel.makeRequest('servicePath', 'methodName', arg1, arg2);
// OR
channel.makeRequest({
  requestPath: 'servicePath',
  methodName: 'methodName',
  args: [arg1, arg2],
  transfer: [port1],  // Optional: explicit transfer list
});
```

### Step 2: Sender Middleware Pipeline

```
makeRequest(args)
    ↓
1. prepareNormalData(channel)
   - Parse arguments
   - Generate seqId: `${uniqueKey}_${seqId++}`
   - Auto-detect Transferable objects in args
   - Build [header, body]: [[requestType, seqId, path, method], args]
   - Return {seqId, data, transfer, isOptionsRequest}
    ↓
2. updateSeqInfo(channel)
   - Attach middleware context with lifecycle tracking
   - Return unchanged
    ↓
3. handleDisconnectedRequest(channel)
   - If disconnected: queue in pendingSendEntries, set minLifecycle=Aborted
   - If connected: pass through
    ↓
4. serialize(channel)
   - Encode data via channel.writeBuffer.encode()
   - Handles complex types (MessagePort, etc.)
   - Return {data: encoded}
    ↓
5. sendRequest(channel)
   - Call channel.send(data, transfer)
   - If transfer list exists: send(data, [port1, port2])
   - If no transfer: send(data)
   - Return value unchanged
    ↓
Output: Serialized message + ports sent to transport
```

### Step 3: Transport sends message

```typescript
send(message: any, transfer?: Transferable[]): void;

// Example implementations:
// MessagePort: port.postMessage(message, transfer)
// Electron IPC: ipcRenderer.send(channel, message)
// WebSocket: ws.send(JSON.stringify(message))
```

---

## Complete Message Receive Flow

### Step 1: Transport receives message

```typescript
// MessageEvent listener fires:
port.addEventListener('message', (event: MessageEvent) => {
  // event.data = serialized message
  // event.ports = transferred objects (MessagePort, etc.)
  channel.onMessage(event);
});
```

### Step 2: Receive Middleware Pipeline

```
onMessage(event)
    ↓
1. normalizeMessageChannelRawMessage()
   - Extract event.data and event.ports
   - Return {event, data: serialized_string, ports: []}
    ↓
2. deserialize(channel)
   - Decode via channel.readBuffer.decode(data)
   - CRITICAL: Preserve ports field
   - Return {data: [header, body], ports}
    ↓
3. handleRequest(channel)
   - If request type:
     * Look up handler via service or serviceHost
     * Invoke handler with decoded args
     * Send response via protocol.sendReply()
   - If subscription request: set up observable
   - If event method: create remote callback
    ↓
4. handleResponse(channel)
   - If response type:
     * Find corresponding Deferred in ongoingRequests
     * Resolve/reject based on response type
     * For subscriptions: route to listener instead of resolving
    ↓
Output: Handler executed and response sent back
```

---

## The ContextBridge Pattern (Electron)

### Architecture

```
┌──────────────────────────────────────────────────────────┐
│                   MAIN PROCESS                           │
│                                                          │
│  Main Service Host                                       │
│  ├─ /orchestrator                                        │
│  └─ /utility                                             │
│         ↓                                                │
│  RPCMessageChannel (port2)                               │
│  - Real MessagePort bound                                │
│  - Messages processed immediately                        │
└──────────────────────────────────────────────────────────┘
            ↑
            │ port1 (transferred)
            │
┌──────────────────────────────────────────────────────────┐
│              PRELOAD CONTEXT (Hidden)                    │
│                                                          │
│  createPageBridge()                                      │
│  ├─ ipcChannel (IPC renderer)                            │
│  ├─ realChannel (RPCMessageChannel, initially unbound)  │
│  │  └─ Wait for port from main → bindPort()             │
│  └─ messageHandlers (forwarding set)                     │
│                                                          │
│  registerOrchestratorHandler()                           │
│  - Listen for port from /orchestrator                    │
│  - Bind port to realChannel when received                │
│         ↓                                                │
│  globalThis.__rpc_bridge__                               │
│  └─ Expose _send, _onMessage, _offMessage               │
└──────────────────────────────────────────────────────────┘
            ↑
            │ __rpc_bridge__ (IPC message)
            │
┌──────────────────────────────────────────────────────────┐
│              RENDERER PROCESS (Page)                     │
│                                                          │
│  ContextBridgeChannel                                    │
│  - Initially disconnected                                │
│  - activate() looks up globalThis.__rpc_bridge__         │
│  - Forwards _send/_onMessage calls                       │
│         ↓                                                │
│  RPC Calls: client.method(...)                           │
│  ├─ Send: _bridge._send(data)                            │
│  └─ Receive: _bridge._onMessage(cb)                      │
└──────────────────────────────────────────────────────────┘
```

### Message Flow Through Bridge

#### Scenario: Page sends RPC to utility process

```
Page (Renderer)
  └─ client.utility.fetchData()
     └─ makeRequest({requestPath: '/utility', methodName: 'fetchData'})
        └─ Sender middleware encode message
           └─ Send via ContextBridgeChannel
              └─ bridge._send(serialized_data)
                 └─ Calls preload's realChannel.send()
                    └─ Calls MessagePort.postMessage()
                       └─ ┌────────────────────────────────┐
                          │ Main Process                    │
                          │ RPCMessageChannel (receives)    │
                          │  └─ onMessage middleware        │
                          │     └─ handleRequest           │
                          │        └─ Look up '/utility'   │
                          │           └─ Invoke handler    │
                          │              └─ Send response  │
                          └────────────────────────────────┘
                              │
                              └─ sendReply (same port)
                                 └─ postMessage response
                                    └─ Preload receives
                                       └─ Calls messageHandlers.forEach()
                                          └─ Calls _bridge._onMessage callback
                                             └─ ContextBridgeChannel
                                                └─ onMessage middleware
                                                   └─ handleResponse
                                                      └─ Resolve Deferred
                                                         └─ Promise resolves
                                                            └─ client.utility.fetchData() returns
```

### ContextBridgeChannel Implementation

```typescript
class ContextBridgeChannel extends AbstractChannelProtocol {
  private _bridge: ContextBridgeAPI | null = null;
  private _listeners = new Set<(data: unknown) => void>();
  
  constructor(props?: ContextBridgeChannelProps) {
    super({ ...props, connected: false });  // ← Start disconnected
  }
  
  // Store listeners while disconnected
  on(listener: (data: unknown) => void): () => void {
    this._listeners.add(listener);
    return () => this._listeners.delete(listener);
  }
  
  // Activate connects to __rpc_bridge__
  activate(): void {
    const bridge = (globalThis as any)[BRIDGE_KEY];
    if (!bridge) {
      console.warn('[ContextBridgeChannel] __rpc_bridge__ not found');
      return;
    }
    
    this._bridge = bridge;
    
    // Register callback to receive messages from preload
    bridge._onMessage((data: unknown) => {
      this._listeners.forEach((cb) => cb(data));  // ← Broadcast to all listeners
    });
    
    super.activate();  // ← Fire onDidConnected event
  }
  
  // Forward sends to preload
  send(data: unknown, transfer?: any[]): void {
    if (!this._bridge) {
      console.warn('[ContextBridgeChannel] send called before bridge setup');
      return;
    }
    this._bridge._send(data);  // ← Call preload's _send
  }
}
```

### Preload Side (createPageBridge)

```typescript
export function createPageBridge(options: CreatePageBridgeOptions) {
  const { ipcRenderer, channelName, description } = options;
  
  // Create IPC channel for requesting port from main
  const ipcChannel = new IPCRendererChannel({
    channelName,
    ipcRenderer,
    projectName: channelName,
  });
  
  // Create real channel (initially unbound)
  const realChannel = new RPCMessageChannel({
    description: `page-bridge:${channelName}`,
  });
  
  // Wait for port from orchestrator
  registerOrchestratorHandler(ipcChannel, (port: any) => {
    realChannel.bindPort(port, { rebind: true });  // ← BIND PORT
  });
  
  // Collect message handlers from page
  const messageHandlers = new Set<(data: unknown) => void>();
  
  // Create bridge API for contextBridge.exposeInMainWorld()
  const bridge: ContextBridgeAPI = {
    _send: (data: unknown) => {
      realChannel.send(data);  // ← Forward page's send to real channel
    },
    _onMessage: (cb: (data: unknown) => void) => {
      messageHandlers.add(cb);  // ← Register page's listener
    },
    _offMessage: () => {
      messageHandlers.clear();
    },
  };
  
  // Expose to page via contextBridge
  contextBridge.exposeInMainWorld(BRIDGE_KEY, {
    _send: bridge._send,
    _onMessage: bridge._onMessage,
    _offMessage: bridge._offMessage,
  });
  
  // Listen to realChannel and broadcast to all page listeners
  realChannel.on((data: unknown) => {
    messageHandlers.forEach((cb) => cb(data));  // ← Broadcast responses to page
  });
  
  return { channel: realChannel, ipcChannel };
}
```

### ContextBridge Timing

**CRITICAL:** The bridge works correctly because:

1. **Page registers service before bridge exists**
   ```typescript
   const channel = new ContextBridgeChannel({description: 'page-bridge'});
   serviceHost.registerServiceHandler('/myService', instance);
   channel.setServiceHost(serviceHost);
   // At this point, ContextBridgeChannel is disconnected
   // but ensureListenerAttached() was called
   // and listener is stored in this._listeners set
   ```

2. **Preload exposes bridge (preload runs before page scripts)**
   - contextBridge.exposeInMainWorld() makes bridge available
   - Page can now access globalThis.__rpc_bridge__

3. **Page calls channel.activate()**
   ```typescript
   window.addEventListener('message', (e) => {
     if (e.data === 'activate-bridge') {
       channel.activate();  // ← Looks up __rpc_bridge__ now
     }
   });
   ```

4. **activate() connects listeners to preload**
   - bridge._onMessage registers callback from step 1
   - Now messages from preload flow to listeners

5. **Messages flow correctly**
   - Page sends: listeners.forEach(cb => cb(data))
   - Preload forwards: messageHandlers.forEach(cb => cb(data))
   - Real channel receives on message port
   - Middleware pipeline processes

---

## Request Lifecycle: Complete Example

### Scenario: Fetch utility process data with port transfer

```typescript
// RENDERER
const channel = new ContextBridgeChannel({description: 'page-bridge'});
const host = new RPCClientHost();
const client = host.registerClient('/utility', {channel});

channel.activate();  // ← Connects to __rpc_bridge__

// Client makes request with port transfer
const result = await client.createProxy().processData({port: myPort});
```

### Message 1: Request

```
RENDERER SIDE
  client.processData({port: myPort})
    └─ channel.makeRequest({
         requestPath: '/utility',
         methodName: 'processData',
         args: [{port: myPort}]
       })
       └─ Sender pipeline:
          1. prepareNormalData:
             - Generate seqId: 'key_0'
             - Detect Transferable: {port: myPort} has MessagePort
             - requestType = TransferableArgsRequest
             - data = [['tar', 'key_0', '/utility', 'processData'], []]
             - transfer = [myPort]
          2. updateSeqInfo: attach context
          3. handleDisconnectedRequest: pass through (connected)
          4. serialize: encode [['tar', 'key_0', '/utility', 'processData'], []]
          5. sendRequest: send(encodedData, [myPort])
             └─ ContextBridgeChannel.send()
                └─ _bridge._send(encodedData)

PRELOAD SIDE
  realChannel.send(encodedData, [myPort])
    └─ MessagePort.postMessage(encodedData, [myPort])

MAIN PROCESS
  port.addEventListener('message', (e) => {
    channel.onMessage(e);  // e.data = encodedData, e.ports = [myPort]
      └─ Receive pipeline:
         1. normalizeMessageChannelRawMessage:
            - Extract e.data (encodedData)
            - Extract e.ports [myPort]
            - Return {data: encodedData, ports: [myPort]}
         2. deserialize:
            - Decode encodedData → [['tar', 'key_0', '/utility', 'processData'], []]
            - Return {data: decoded, ports: [myPort]}
         3. handleRequest:
            - type = RequestType.TransferableArgsRequest
            - seqId = 'key_0'
            - Look up handler: host.getHandler('/utility', 'processData')
            - args = ports[0] = myPort (single Transferable)
            - handler(myPort)
              └─ processData(myPort)
                 └─ Do something with port
                 └─ Return result (e.g., MessagePort or data)
         4. handleResponse:
            - This is a request, not response, so pass through
```

### Message 2: Response

```
MAIN PROCESS (continued from handleRequest)
  handler(myPort) returns result (could be port or data)
  
  If result is MessagePort:
    responsetype = ResponseType.PortSuccess
    sendReply(encodedResponse, [resultPort])
  Else:
    responseType = ResponseType.ReturnSuccess
    sendReply(encodedResponse)
      └─ MessagePort.postMessage(encodedResponse, [ports?])

PRELOAD SIDE
  port.addEventListener('message', (e) => {
    messageHandlers.forEach(cb => cb(e.data));
      └─ Call ContextBridgeChannel's listener
         └─ channel.on(listener) callback
            └─ onMessage(e)

RENDERER SIDE
  Receive pipeline:
    1. normalizeMessageChannelRawMessage:
       - Extract e.data and e.ports
    2. deserialize:
       - Decode response
    3. handleRequest:
       - This is response, not request, pass through
    4. handleResponse:
       - type = ResponseType.PortSuccess or ReturnSuccess
       - seqId = 'key_0'
       - Find deferred: ongoingRequests.get('key_0')
       - If PortSuccess: deferred.resolve(ports[0])
       - If ReturnSuccess: deferred.resolve(body[0])
       └─ Promise resolves
          └─ await completes
          └─ result available to user code
```

---

## Known Issues & Edge Cases

### Issue 1: Port binding must happen before service registration

**WRONG:**
```typescript
const channel = new RPCMessageChannel({});
channel.setServiceHost(host);  // ← Service registered before port

// Later...
channel.bindPort(port);  // Messages won't be processed correctly
```

**CORRECT:**
```typescript
const channel = new RPCMessageChannel({});
channel.setServiceHost(host);  // Service registered (listener attached)
channel.bindPort(port);  // Port bound, listener wired
```

*Why:* `setServiceHost()` calls `ensureListenerAttached()` which sets up listener.
If no port exists yet, listener is stored as `_pendingListener`. When port is bound,
`_attachPort()` wires the pending listener. This works correctly.

### Issue 2: ContextBridge timing dependency

**CRITICAL REQUIREMENT:** Preload must run before page scripts

If preload runs after page scripts:
- Page tries to access `globalThis.__rpc_bridge__` before it exists
- `activate()` returns early with warning
- Messages cannot be sent/received

**Solution:** Ensure preload script is loaded via `nodeIntegration: false` with proper `preload` path.

### Issue 3: Mixing Transferable and serializable args

**INVALID:**
```typescript
await service.method({
  port: messagePort,      // Transferable
  data: {some: 'data'}    // Serializable
});
// Error: Cannot mix Transferable and serializable arguments
```

**VALID:**
```typescript
// All Transferable
await service.method(port1, port2);

// All serializable
await service.method({port: undefined, data: {some: 'data'}});
```

### Issue 4: Message loss during disconnect

**Current behavior:**
- Requests sent while disconnected are queued in `pendingSendEntries`
- On reconnect (`activate()`), `didConnected()` calls `resumePendingEntry()`
- All queued requests are re-sent through middleware pipeline

**Caveat:** If channel stays disconnected for long time, queue can grow large.
Implement request timeout and cleanup as needed.

### Issue 5: Port transfer one-way

**Important:** Once a MessagePort is transferred (sent), the sender realm loses access:

```typescript
const {port1, port2} = new MessageChannel();
await service.method(port1);  // Transfer port1
// port1 is now unusable here - it's been moved to receiver realm
port1.postMessage('test');    // Error: port detached
```

This is by design (efficient, zero-copy). Plan accordingly in application code.

---

## Key Implementation Details

### seqId Generation

```typescript
get seqId() {
  this._seqId += 1;
  return `${this._key}_${this._seqId}`;
}

// Example:
// First call: 'a1b2c3d4e5f6_1'
// Second call: 'a1b2c3d4e5f6_2'
// This ensures globally unique request IDs across the application
```

### Middleware Lifecycle & Skipping

```typescript
enum SendMiddlewareLifecycle {
  Initial = 0,
  Prepare = 10,      // prepareNormalData
  Transform = 20,    // updateSeqInfo, handleDisconnectedRequest
  DataOperation = 30, // serialize
  Send = 40,         // sendRequest
  Aborted = 100,
}

// If handleDisconnectedRequest sets minLifecycle = Aborted,
// serialize and sendRequest are skipped
if (shouldSkip(accum, middleware)) {
  // Skip this middleware
  return accum;
}
```

### Deferred Tracking

```typescript
// When request sent:
makeRequest() {
  const deferred = new Deferred();
  const seqId = channel.seqId;
  channel.ongoingRequests.set(seqId, deferred);
  // ... send request ...
  return deferred;
}

// When response received:
handleResponse(message) {
  const seqId = message.header[1];
  const deferred = protocol.ongoingRequests.get(seqId);
  if (deferred) {
    deferred.resolve(result);  // Or reject(error)
    protocol.ongoingRequests.delete(seqId);  // Clean up
  }
}
```

---

## Middleware Order & Importance

### Send Middleware (Outgoing)

| Order | Middleware | Lifecycle | Purpose |
|-------|-----------|-----------|---------|
| 1 | prepareNormalData | Prepare | Structure message with header/body |
| 2 | updateSeqInfo | Transform | Attach context & lifecycle tracking |
| 3 | handleDisconnectedRequest | Transform | Queue if offline, skip rest |
| 4 | serialize | DataOperation | Encode via writeBuffer |
| 5 | sendRequest | Send | Call channel.send() with transfer |

### Receive Middleware (Incoming)

| Order | Middleware | Purpose |
|-------|-----------|---------|
| 1 | normalizeMessageChannelRawMessage | Extract data & ports from MessageEvent |
| 2 | deserialize | Decode via readBuffer, preserve ports |
| 3 | handleRequest | Dispatch to handler, send response |
| 4 | handleResponse | Route response to pending request Deferred |

**CRITICAL:** Deserialize must preserve `ports` field for PortSuccess handling.

---

## Troubleshooting Guide

### Symptom: "Cannot read property '0' of undefined" in handleResponse

**Cause:** `message.ports` is undefined
**Reason:** normalize or deserialize middleware dropped the ports field
**Fix:** Ensure deserialize returns `{...value, data: decoded}` (preserves ports via spread)

### Symptom: "send() called before port was bound"

**Cause:** Message sent while channel disconnected
**Diagnosis:** Check if `channel.isConnected()` is true
**Fix:** 
1. Wait for channel connection before sending
2. Or implement offline queueing (which the framework does automatically)

### Symptom: "Method not found" error when using serviceHost

**Cause:** Request path doesn't match any registered service
**Diagnosis:** Check `serviceHost.getHandler(requestPath, methodName)`
**Fix:** Ensure service is registered with exact path matching

### Symptom: ContextBridgeChannel doesn't receive messages

**Cause:** Bridge not activated or not found
**Diagnosis:** Check console for "globalThis.__rpc_bridge__ not found"
**Fix:**
1. Ensure preload script runs before page scripts
2. Call `channel.activate()` after DOM ready
3. Verify `createPageBridge()` was called in preload

---

## Summary: How It All Works Together

1. **Channel Creation** - `new RPCMessageChannel({description})` or `new ContextBridgeChannel()`
2. **Service Registration** - `serviceHost.registerServiceHandler(path, instance)` or `channel.setService()`
3. **Service Host Binding** - `channel.setServiceHost(host)` - triggers `ensureListenerAttached()`
4. **Port Binding** (delayed) - `channel.bindPort(port)` - wires pending listener, activates channel
5. **Request Sent** - Client calls `makeRequest()` → sender middleware → `send()` → transport
6. **Message Received** - Transport delivers → receiver middleware → `onMessage()`
7. **Handler Invoked** - `handleRequest` looks up handler via service or serviceHost → calls it
8. **Response Sent** - Handler returns → `sendReply()` → transport
9. **Response Routed** - `handleResponse` finds deferred via seqId → resolves promise

**The beauty of the design:**
- Single middleware pipeline handles all transports
- Late binding pattern works because of deferred listener attachment
- ContextBridge pattern works because preload's real channel owns the port
- Multi-service routing prevents cross-talk with shared transports
- Offline queueing automatically resumes on reconnection

