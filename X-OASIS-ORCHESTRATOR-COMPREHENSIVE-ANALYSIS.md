# X-OASIS ORCHESTRATOR CODEBASE COMPREHENSIVE ANALYSIS

## 1. ORCHESTRATOR TYPES (`types.ts` - Lines 1-373)

### Core Service Path
- **`ORCHESTRATOR_SERVICE_PATH = '__x_oasis_orchestrator__'`** (Line 18)
  - Internal RPC service path for orchestrator control plane
  - Never exposed to user code
  - Used in `activateConnection` and `ping` handlers

### Participant Types (Line 23-28)
```typescript
export type ParticipantType = 'renderer' | 'utility' | 'worker' | 'process' | 'node'
```

### ParticipantInfo Interface (Lines 31-36)
```typescript
export interface ParticipantInfo {
  readonly id: string;
  readonly channel: AbstractChannelProtocol;
  readonly type: ParticipantType;
  readonly registeredAt: number;
}
```

### ActivationConfig Interface (Lines 363-372)
**Sent to each participant when orchestrator activates a connection:**
```typescript
export interface ActivationConfig {
  connectionId: string;
  port: any;  // MessagePort to bind for direct communication
  role: 'initiator' | 'receiver';
  peerServices?: Record<string, (...args: any[]) => any>;
  myServices?: Record<string, (...args: any[]) => any>;
}
```

### ConnectionConfig Interface (Lines 46-51)
**Long-lived connection configuration:**
```typescript
export interface ConnectionConfig {
  fromServices?: Record<string, (...args: any[]) => any>;
  toServices?: Record<string, (...args: any[]) => any>;
  heartbeat?: HeartbeatConfig;
  reconnectPolicy?: ReconnectPolicy;
}
```

### ConnectOptions Interface (Lines 65-83)
**Per-call first-attempt options:**
```typescript
export interface ConnectOptions {
  activateTimeoutMs?: number;     // Default: 30_000ms (Telegraph D-006)
  retryOnInitialFailure?: boolean; // Default: false
}
```

### ConnectionInfo Interface (Lines 127-151)
**Live connection handle returned by `connect()`:**
```typescript
export interface ConnectionInfo {
  readonly connectionId: string;
  readonly fromId: string;
  readonly toId: string;
  readonly state: ConnectionState;
  readonly lastStateChangedAt: number;
  readonly error?: Error;
  readonly isReady: boolean;
  readonly isConnecting: boolean;
  readonly isFailed: boolean;
  readonly isClosed: boolean;
  
  waitForStateChange(
    currentState: ConnectionState,
    deadlineMs?: number
  ): Promise<ConnectionState>;
}
```

### ConnectionState Enum (from ConnectionState.ts)
```typescript
export enum ConnectionState {
  IDLE = 'IDLE',              // Not connected yet
  CONNECTING = 'CONNECTING',  // Port pair created, waiting for activation
  READY = 'READY',            // Both sides activated
  TRANSIENT_FAILURE = 'TRANSIENT_FAILURE', // Connection lost, auto-reconnecting
  DISCONNECTING = 'DISCONNECTING',        // Graceful teardown in progress
  CLOSED = 'CLOSED',          // Terminal state
}
```

---

## 2. BaseConnectionOrchestrator (Lines 1-1172)

### Constructor (Lines 168-171)
```typescript
constructor(config: ConnectionOrchestratorConfig = {}) {
  super();
  this.config = config;
}
```

### Abstract Methods (Must be implemented by subclasses)

#### `createPortPair()` (Lines 175-182)
```typescript
protected abstract createPortPair(): PortPair;
```
- **Electron**: `new MessageChannelMain()`
- **Node**: `new MessageChannel()` from `worker_threads`
- **Web**: `new MessageChannel()` (browser API)

#### `activateParticipant()` (Lines 184-194)
```typescript
protected abstract activateParticipant(
  info: ParticipantInfo,
  config: ActivationConfig
): Promise<void>;
```
- Send port to participant via their existing RPC channel
- Used by orchestrator to deliver the MessagePort

### Key Public Methods

#### `registerParticipant()` (Lines 202-254)
**Signature:**
```typescript
registerParticipant(
  id: string,
  channel: AbstractChannelProtocol,
  type: ParticipantType = 'process'
): void
```

**Key implementation details (Lines 207-212):**
- Calls `channel.ensureListenerAttached()` to enable response routing
- Sets up auto-wired `onDidDisconnected` subscription (Telegraph D-006 §2 Gap 3)
- Stores cleanup function to prevent listener leaks on re-registration

#### `connect()` (Lines 439-536)
**Signature:**
```typescript
async connect(
  fromId: string,
  toId: string,
  configOrOptions: ConnectionConfig | ConnectOptions = {},
  maybeOptions?: ConnectOptions
): Promise<ConnectionInfo>
```

**Flow (Lines 519-536):**
1. Validate both participants exist (lines 445-454)
2. Disambiguate overload: ConnectionConfig vs ConnectOptions (lines 456-479)
3. Create canonical connectionId via `_canonicalConnectionId()` (line 481)
4. Return existing connection if in live state (lines 486-493)
5. Create/reuse ManagedConnection record (lines 495-514)
6. Optionally attach circuit breaker and stats (lines 507-512)
7. Preserve config for reconnects (line 517)
8. Execute `_doConnect()` (line 523)
9. Return ConnectionInfo via `_buildConnectionInfo()` (line 535)

#### `_doConnect()` (Lines 635-711)
**Signature:**
```typescript
private async _doConnect(
  mc: ManagedConnection,
  config: ConnectionConfig,
  options: ConnectOptions = {}
): Promise<void>
```

**Flow:**

| Line | Step |
|------|------|
| 642 | Transition to CONNECTING |
| 644-653 | Create PortPair via `createPortPair()` |
| 655-671 | Build fromActivation and toActivation configs |
| 676-677 | Get activateTimeoutMs (default 30_000ms) |
| 680-687 | Call `_withActivationTimeout()` with both `activateParticipant()` calls in parallel |
| 688-698 | Handle errors: transition to IDLE, throw |
| 700 | Transition to READY on success |
| 703-707 | Start heartbeat if configured |
| 709 | Fire onReady event |

**Key points:**
- Parallel activation: both participants receive ports simultaneously
- Timeout protection: Telegraph D-006 §2 Gap 2 (lines 673-675)
- Service exchange: each side's `peerServices` become the other's available methods

#### `_canonicalConnectionId()` (Lines 631-633)
```typescript
private _canonicalConnectionId(a: string, b: string): string {
  return a < b ? `${a}--${b}` : `${b}--${a}`;
}
```
**Purpose:** Ensures bidirectional connections use canonical ID (order-independent)

#### `_buildConnectionInfo()` (Lines 1088-1159)
**Returns:** Live ConnectionInfo proxy with getters for current state
- Implements `waitForStateChange()` with deadline timeout (lines 1122-1157)
- All properties are live snapshots of ManagedConnection

#### `disconnect()` (Lines 542-565)
```typescript
async disconnect(connectionId: string): Promise<void>
```
- Cancels pending reconnect timer
- Stops heartbeat
- Transitions READY/TRANSIENT_FAILURE/CONNECTING → DISCONNECTING → CLOSED
- Fires onClosed event

### State Machine

#### `_transitionState()` (Lines 1034-1084)
```typescript
protected _transitionState(
  mc: ManagedConnection,
  newState: ConnectionState,
  reason?: string
): void
```

**Validation (Lines 1039-1047):**
- Returns early if state unchanged
- Validates transition via `isValidTransition()` (line 1041)

**Side effects:**
- Updates `mc.state` and `mc.lastStateChangedAt`
- Fires `onStateChangeEvent` (line 1064)
- Resolves waiting `waitForStateChange()` observers (lines 1067-1076)

### Reconnection

#### `_handleConnectionLost()` (Lines 750-793)
- Stops heartbeat
- Records disconnect in stats
- Handles IDLE vs READY/CONNECTING cases differently
- Fires onDisconnected event (for READY losses)
- Schedules reconnect via `_scheduleReconnect()`

#### `_scheduleReconnect()` (Lines 795-882)
**Decides next retry delay via policy.nextRetryDelayMs()**
- If delay returns `null`: give up, move to CLOSED, fire onReconnectFailed
- If delay is a number: set timer for next `_attemptReconnect()`
- Applies `PendingRequestBehavior.duringReconnect` (lines 854-870)
- Fires onReconnecting event

#### `_attemptReconnect()` (Lines 891-984)
- Creates new PortPair
- Re-calls `activateParticipant()` on both sides
- Preserves lastConfig (from/toServices survive reconnect)
- On success: resets circuitBreaker, records reconnect stats
- On failure: schedules next retry

### Events (Lines 119-164)

Six event streams exposed as `on*` methods:
1. `onStateChange(event: StateChangeEvent)`
2. `onReady(event: ReadyEvent)`
3. `onDisconnected(event: DisconnectedEvent)`
4. `onReconnecting(event: ReconnectingEvent)`
5. `onReconnected(event: ReconnectedEvent)`
6. `onReconnectFailed(event: ReconnectFailedEvent)`
7. `onClosed(event: ClosedEvent)`

### Heartbeat

#### `_startHeartbeat()` (Lines 988-997)
```typescript
protected _startHeartbeat(
  mc: ManagedConnection,
  hbConfig: HeartbeatConfig
): void
```
- Sets interval to call `_sendHeartbeat()`

#### `_sendHeartbeat()` (Lines 1011-1020)
**Base implementation (overridden by subclasses):**
- Stub that just checks connection is READY
- Subclasses override with actual RPC ping call

#### `_handleHeartbeatTimeout()` (Lines 1026-1030)
- Called when pong not received within `hbConfig.timeoutMs`
- Treats as connection loss, triggers reconnect

---

## 3. ELECTRON IMPLEMENTATION

### ElectronConnectionOrchestrator (186 lines)

#### Constructor (Lines 64-71)
```typescript
constructor(
  config: ConnectionOrchestratorConfig = {},
  portFactory?: MessageChannelMainFactory
) {
  super(config);
  this._portFactory = portFactory ?? ElectronConnectionOrchestrator._defaultFactory;
}
```

#### `createPortPair()` (Lines 86-88)
```typescript
protected createPortPair(): PortPair {
  return this._portFactory();
}
```

#### `activateParticipant()` (Lines 102-117)
**Signature:**
```typescript
protected async activateParticipant(
  info: ParticipantInfo,
  config: ActivationConfig
): Promise<void>
```

**Implementation (Lines 108-116):**
```typescript
const { port } = config;

const deferred = info.channel.makeRequest(
  ORCHESTRATOR_SERVICE_PATH,
  'activateConnection',
  port
);

if (deferred && typeof (deferred as any).promise === 'object') {
  await (deferred as any).promise;
}
```

**Key points:**
- Uses `channel.makeRequest()` to invoke RPC handler
- Service path: `ORCHESTRATOR_SERVICE_PATH` (line 109)
- Method: `'activateConnection'` (line 110)
- Port is transferred as argument (line 111)
- Awaits the Deferred's promise to ensure participant acked

#### `_sendHeartbeat()` (Lines 124-185)
**Signature:**
```typescript
protected _sendHeartbeat(mc: any, hbConfig: HeartbeatConfig): void
```

**Flow:**
1. Check connection is READY (line 125)
2. Get both participants' info (lines 130-135)
3. Send `ping` RPC to both participants in parallel (lines 148-177)
4. Set timeout timer for pong response (line 141-146)
5. On timeout: call `_handleHeartbeatTimeout()` (line 144)
6. Clean up timer when both pongs received or error occurs

---

### registerOrchestratorHandler (52 lines)

#### Function Signature (Lines 41-44)
```typescript
export function registerOrchestratorHandler(
  channel: AbstractChannelProtocol,
  onPort: (port: any) => void
): void
```

#### Implementation (Lines 45-51)
```typescript
const service = new RPCService(ORCHESTRATOR_SERVICE_PATH, {
  handlers: {
    activateConnection: onPort,
    ping: () => 'pong',
  },
});
service.setChannel(channel);
```

**Key points:**
- Creates RPCService with internal service path
- `activateConnection` handler: called when orchestrator sends port
- `ping` handler: responds to heartbeat pings
- Automatically sets channel so service receives RPC requests

### createPageBridge (140 lines)

**Purpose:** Bridges renderer process to orchestrator via both direct MessagePort and IPC

#### Function Signature (Lines 33-39)
```typescript
export function createPageBridge(options: CreatePageBridgeOptions): {
  channel: any;
  ipcChannel: IPCRendererChannel;
}
```

#### Key Flow (Lines 55-73)
```typescript
registerOrchestratorHandler(ipcChannel, (port: any) => {
  if (bridgePortListener) {
    bridgePortListener();
    bridgePortListener = null;
  }
  if (bridgePort) {
    try {
      bridgePort.close();
    } catch {}
  }
  bridgePort = port;
  const handler = (ev: MessageEvent) => {
    messageHandlers.forEach((cb) => cb(ev.data));
  };
  port.addEventListener('message', handler);
  port.start();
  bridgePortListener = () => port.removeEventListener('message', handler);
  realChannel.bindPort(port, { rebind: true });
});
```

**Purpose:**
- Captures incoming MessagePort from orchestrator
- Binds port to RPCMessageChannel for direct communication
- Forwards all received messages to registered handlers
- Allows rebinding when orchestrator creates new connections

---

## 4. NODE IMPLEMENTATION

### NodeConnectionOrchestrator (123 lines)

#### `createPortPair()` (Lines 58-66)
```typescript
protected createPortPair(): PortPair {
  const { MessageChannel } = require('worker_threads');
  const { port1, port2 } = new MessageChannel();
  return { port1, port2 };
}
```

#### `activateParticipant()` (Lines 77-92)
```typescript
protected async activateParticipant(
  info: ParticipantInfo,
  config: ActivationConfig
): Promise<void> {
  const { port } = config;

  const deferred = info.channel.makeRequest(
    ORCHESTRATOR_SERVICE_PATH,
    'activateConnection',
    port
  );

  if (deferred && typeof (deferred as any).promise === 'object') {
    await (deferred as any).promise;
  }
}
```
**Identical to Electron's implementation**

#### `registerOrchestratorHandler()` (Lines 113-122)
```typescript
export function registerOrchestratorHandler(
  channel: AbstractChannelProtocol,
  onPort: (port: any) => void
): void {
  const service = new RPCService(ORCHESTRATOR_SERVICE_PATH, {
    handlers: {
      activateConnection: onPort,
    },
  });
  service.setChannel(channel);
}
```
**Note:** No `ping` handler in Node version (heartbeat typically not used for worker threads)

---

## 5. WEB IMPLEMENTATION

### WebConnectionOrchestrator (125 lines)

#### `createPortPair()` (Lines 65-68)
```typescript
protected createPortPair(): PortPair {
  const { port1, port2 } = new MessageChannel();
  return { port1, port2 };
}
```

#### `activateParticipant()` (Lines 79-94)
**Identical to Electron and Node**

#### `registerOrchestratorHandler()` (Lines 115-124)
**Identical to Node version (no ping handler)**

---

## 6. RPC CONTROL PLANE: `channel.makeRequest()`

### AbstractChannelProtocol.makeRequest() (Lines 501-518)

#### Overload Signatures
```typescript
// Signature 1: Object form
makeRequest(props: SendingProps, transfer?: MessagePort[]): Deferred | void;

// Signature 2: String form
makeRequest(
  requestPath: string,
  fnName: string,
  ...args: any[]
): Deferred | void;
```

#### Implementation (Lines 509-518)
```typescript
makeRequest(...args: any[]) {
  const result = runMiddlewares(this.senderMiddleware, args);
  if (result?.returnValue) return result.returnValue;
  // For event methods (on*), no Deferred is created but the caller
  // may still need the seqId.  Return a lightweight object so the
  // caller can identify the request.
  if (result?.seqId !== undefined) {
    return { seqId: result.seqId } as any;
  }
}
```

**Flow:**
1. Runs through sender middleware pipeline (prepareNormalData, updateSeqInfo, serialize, etc.)
2. Middleware runs `sendRequest` which calls `this.send(data, transfer)`
3. Returns Deferred (for regular methods) or { seqId } (for event methods)

### Usage in `ElectronConnectionOrchestrator.activateParticipant()` (Lines 108-116)

```typescript
const deferred = info.channel.makeRequest(
  ORCHESTRATOR_SERVICE_PATH,           // requestPath
  'activateConnection',                // methodName
  port                                 // arg (Transferable)
);

if (deferred && typeof (deferred as any).promise === 'object') {
  await (deferred as any).promise;
}
```

**Key points:**
- `makeRequest()` returns a Deferred
- Deferred has a `.promise` property
- Awaiting the promise ensures the RPC handler completed
- Port is transferred via the framework's TransferableArgsRequest path

---

## 7. RPC ENDPOINTS: `clientHost` and `serviceHost`

### RPCClientHost (`src/endpoint/RPCClientHost.ts`)

#### Instance (Line 28)
```typescript
export default new RPCClientHost();
```

#### Methods
```typescript
class RPCClientHost {
  registerClient(
    requestPath: string,
    options?: { channel?: AbstractChannelProtocol }
  ): ProxyRPCClient;

  getClient(requestPath: string): ProxyRPCClient | undefined;
  
  removeClient(requestPath: string): boolean;
}
```

### RPCServiceHost (`src/endpoint/RPCServiceHost.ts`)

#### Methods
```typescript
class RPCServiceHost {
  registerService(
    servicePath: ServicePath,
    serviceOptions: RPCServiceOptions
  ): RPCService;

  registerServiceHandler(
    servicePath: ServicePath,
    instanceOrHandlers: object
  ): RPCService;

  getService(servicePath: ServicePath): RPCService | undefined;
  
  getHandler(servicePath: ServicePath, handlerName: string): Function | undefined;
}
```

### Usage in UtilityOrchestratorParticipant (106 lines)

#### Getting a service (Lines 66-81)
```typescript
getService<T extends Record<string, (...args: any[]) => any>>(
  servicePath: string
): T {
  if (this._serviceProxies.has(servicePath)) {
    return this._serviceProxies.get(servicePath) as T;
  }

  const proxy = clientHost                    // Global clientHost singleton
    .registerClient(servicePath, {
      channel: this._directChannel,
    })
    .createProxy<T>();

  this._serviceProxies.set(servicePath, proxy);
  return proxy;
}
```

#### Registering a service (Lines 83-92)
```typescript
registerService(
  serviceId: string,
  handlers: Record<string, (...args: any[]) => any>
): void {
  serviceHost.registerService(serviceId, {
    channel: this._directChannel,
    serviceHost,
    handlers,
  });
}
```

---

## 8. MAIN ORCHESTRATOR SETUP (MainOrchestratorSetup.ts - 246 lines)

### setupMainOrchestrator() (Lines 62-127)

#### Function Signature
```typescript
export async function setupMainOrchestrator(
  options: MainOrchestratorSetupOptions
): Promise<MainOrchestratorSetupResult>
```

#### Key Steps (Lines 65-126)

| Lines | Step |
|-------|------|
| 77-83 | Create ElectronConnectionOrchestrator with config |
| 87-96 | Optionally register main process as participant |
| 99-104 | Create and merge default + custom handlers |
| 107-111 | Register orchestrator service on IPC channel |
| 114-116 | Call setupParticipants() callback |
| 118-126 | Return setup result |

#### Default Orchestrator Handlers (Lines 157-246)
- `async connect()` — initiate connection between registered participants
- `async disconnect()` — gracefully close connection
- `simulateLost()` — test reconnection by simulating participant loss
- `async getStatus()` — return current connection state and stats
- `onStateChange(callback)` — subscribe to state change events
- `onReady(callback)` — subscribe to ready events
- `onDisconnected(callback)` — subscribe to disconnection events
- `onReconnecting(callback)` — subscribe to reconnect attempt events
- `onReconnected(callback)` — subscribe to successful reconnect events
- `onReconnectFailed(callback)` — subscribe to reconnect failure events
- `onClosed(callback)` — subscribe to closed events

---

## 9. KEY CONTROL FLOW DIAGRAM

```
Main Process (Orchestrator)
├── ElectronConnectionOrchestrator (extends BaseConnectionOrchestrator)
│   └── registered participants:
│       ├── 'renderer' → IPCMainChannel
│       ├── 'utility'  → ElectronUtilityProcessChannel
│       └── 'main'     → ElectronMessagePortMainChannel (optional)
│
│ User calls: orchestrator.connect('renderer', 'utility')
│
├─→ BaseConnectionOrchestrator.connect()
│   ├─→ Validate both participants exist
│   ├─→ Create canonical connectionId
│   ├─→ _doConnect()
│   │   ├─→ Transition IDLE → CONNECTING
│   │   ├─→ createPortPair()  [returns MessagePortMain pair]
│   │   │
│   │   ├─→ activateParticipant(renderer, config)
│   │   │   └─→ channel.makeRequest('__x_oasis_orchestrator__', 'activateConnection', port1)
│   │   │       └─→ sends RPC to renderer's registerOrchestratorHandler
│   │   │           └─→ onPort(port1) → directChannel.bindPort(port1)
│   │   │
│   │   ├─→ activateParticipant(utility, config)  [in parallel]
│   │   │   └─→ channel.makeRequest('__x_oasis_orchestrator__', 'activateConnection', port2)
│   │   │       └─→ sends RPC to utility's registerOrchestratorHandler
│   │   │           └─→ onPort(port2) → directChannel.bindPort(port2)
│   │   │
│   │   └─→ Transition CONNECTING → READY
│   │
│   └─→ Return ConnectionInfo (live proxy)
│
└─→ Now renderer & utility can communicate directly via port1 & port2

Heartbeat (if enabled):
  - Orchestrator periodically calls:
    channel.makeRequest('__x_oasis_orchestrator__', 'ping')
  - Participant responds: 'pong'
  - If timeout: transition to TRANSIENT_FAILURE, schedule reconnect

Reconnection:
  - Connection drops: transition READY → TRANSIENT_FAILURE
  - Schedule next retry using policy.nextRetryDelayMs()
  - Retry timer fires: _attemptReconnect()
    - Create new PortPair
    - Re-activate both participants
    - If successful: TRANSIENT_FAILURE → CONNECTING → READY
```

---

## 10. CRITICAL IMPLEMENTATION DETAILS

### Telegraph D-006 Gaps Fixed

**Gap 2: Cold-start cannot timeout**
- Added `activateTimeoutMs` option to `connect()` (default 30_000ms)
- Without this, a slow participant that never acks `activateConnection` would hang forever
- Implementation: `_withActivationTimeout()` (lines 721-746)

**Gap 3: Participant loss not detected**
- Auto-wire `channel.onDidDisconnected()` in `registerParticipant()` (lines 241-251)
- Calls `handleParticipantLost()` when channel disconnects
- Prevents orchestrator from considering dead participant alive forever

### Listener Attachment (Lines 207-212)
```typescript
channel.ensureListenerAttached();
```
- Critical: without this, `makeRequest()` creates Deferred but response routing fails
- Must be called in `registerParticipant()` before any RPC calls
- Ensures channel's `onMessage` middleware is wired up

### State Canonicalization (Lines 631-633)
```typescript
private _canonicalConnectionId(a: string, b: string): string {
  return a < b ? `${a}--${b}` : `${b}--${a}`;
}
```
- Ensures `connect('A', 'B')` and `connect('B', 'A')` reuse same connection
- Enables idempotent `connect()` calls

### Service Preservation Across Reconnects (Lines 516-517, 926)
```typescript
mc.lastConfig = config;  // Store original config
// Later, in _attemptReconnect():
const savedConfig = mc.lastConfig ?? {};
```
- `fromServices` and `toServices` survive reconnection
- No need to re-register services for reconnection attempts

---

## 11. DETAILED METHOD SIGNATURES FOR MODIFICATIONS

### To add a new platform (e.g., WebSocket):

```typescript
export class WebSocketConnectionOrchestrator extends BaseConnectionOrchestrator {
  // Must implement:
  protected createPortPair(): PortPair {
    // Your platform's port pair creation
  }

  protected async activateParticipant(
    info: ParticipantInfo,
    config: ActivationConfig
  ): Promise<void> {
    const { port } = config;
    
    // Your platform's RPC call pattern
    const deferred = info.channel.makeRequest(
      ORCHESTRATOR_SERVICE_PATH,
      'activateConnection',
      port
    );
    
    if (deferred && typeof (deferred as any).promise === 'object') {
      await (deferred as any).promise;
    }
  }

  // Optional: override heartbeat
  protected _sendHeartbeat(
    mc: ManagedConnection,
    hbConfig: HeartbeatConfig
  ): void {
    // Your platform's heartbeat implementation
  }
}
```

### To hook into connection lifecycle:

```typescript
orchestrator.onStateChange((event: StateChangeEvent) => {
  console.log(`${event.connectionId}: ${event.previousState} → ${event.currentState}`);
});

orchestrator.onReady((event: ReadyEvent) => {
  console.log(`${event.connectionId} is ready for RPC`);
});

orchestrator.onDisconnected((event: DisconnectedEvent) => {
  console.log(`${event.connectionId} disconnected:`, event.error);
});

orchestrator.onReconnecting((event: ReconnectingEvent) => {
  console.log(`${event.connectionId} reconnect attempt ${event.attempt} in ${event.delay}ms`);
});

orchestrator.onReconnected((event: ReconnectedEvent) => {
  console.log(`${event.connectionId} reconnected after ${event.attempt} attempts`);
});

orchestrator.onReconnectFailed((event: ReconnectFailedEvent) => {
  console.log(`${event.connectionId} failed after ${event.totalAttempts} reconnect attempts`);
});

orchestrator.onClosed((event: ClosedEvent) => {
  console.log(`${event.connectionId} closed: ${event.reason}`);
});
```

---

## 12. ABSOLUTE FILE PATHS

- `/Users/ryu/Documents/code/red/x-oasis/packages/async/async-call-rpc/src/orchestrator/types.ts`
- `/Users/ryu/Documents/code/red/x-oasis/packages/async/async-call-rpc/src/orchestrator/BaseConnectionOrchestrator.ts`
- `/Users/ryu/Documents/code/red/x-oasis/packages/async/async-call-rpc/src/orchestrator/ConnectionState.ts`
- `/Users/ryu/Documents/code/red/x-oasis/packages/async/async-call-rpc/src/orchestrator/index.ts`
- `/Users/ryu/Documents/code/red/x-oasis/packages/async/async-call-rpc-electron/src/electron-main/ElectronConnectionOrchestrator.ts`
- `/Users/ryu/Documents/code/red/x-oasis/packages/async/async-call-rpc-electron/src/electron-browser/registerOrchestratorHandler.ts`
- `/Users/ryu/Documents/code/red/x-oasis/packages/async/async-call-rpc-electron/src/electron-browser/createPageBridge.ts`
- `/Users/ryu/Documents/code/red/x-oasis/packages/async/async-call-rpc-electron/src/electron-main/UtilityOrchestratorParticipant.ts`
- `/Users/ryu/Documents/code/red/x-oasis/packages/async/async-call-rpc-electron/src/electron-main/MainOrchestratorSetup.ts`
- `/Users/ryu/Documents/code/red/x-oasis/packages/async/async-call-rpc-node/src/NodeConnectionOrchestrator.ts`
- `/Users/ryu/Documents/code/red/x-oasis/packages/async/async-call-rpc-web/src/WebConnectionOrchestrator.ts`
- `/Users/ryu/Documents/code/red/x-oasis/packages/async/async-call-rpc/src/protocol/AbstractChannelProtocol.ts`
- `/Users/ryu/Documents/code/red/x-oasis/packages/async/async-call-rpc/src/endpoint/ProxyRPCClient.ts`
- `/Users/ryu/Documents/code/red/x-oasis/packages/async/async-call-rpc/src/endpoint/RPCClientHost.ts`
- `/Users/ryu/Documents/code/red/x-oasis/packages/async/async-call-rpc/src/endpoint/RPCServiceHost.ts`
- `/Users/ryu/Documents/code/red/x-oasis/packages/async/async-call-rpc/src/endpoint/RPCService.ts`
- `/Users/ryu/Documents/code/red/x-oasis/packages/async/async-call-rpc/src/index.ts`

