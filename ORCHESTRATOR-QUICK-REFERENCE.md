# X-OASIS ORCHESTRATOR QUICK REFERENCE

## Core Concept
The orchestrator creates direct MessagePort connections between participants (renderers, workers, utility processes) through a control-plane RPC channel, enabling zero-copy peer-to-peer communication.

## Key Constants
```typescript
ORCHESTRATOR_SERVICE_PATH = '__x_oasis_orchestrator__'
DEFAULT_ACTIVATE_TIMEOUT_MS = 30_000  // Telegraph D-006 Gap 2
```

## Core Types

### ParticipantInfo
```typescript
interface ParticipantInfo {
  id: string;
  channel: AbstractChannelProtocol;  // Control-plane RPC channel
  type: ParticipantType;             // 'renderer' | 'utility' | 'worker' | 'process' | 'node'
  registeredAt: number;
}
```

### ActivationConfig
```typescript
// Sent to participant when orchestrator creates connection
interface ActivationConfig {
  connectionId: string;
  port: MessagePort;                 // Port to bind for direct communication
  role: 'initiator' | 'receiver';
  peerServices?: Record<string, Function>;
  myServices?: Record<string, Function>;
}
```

### ConnectionInfo
```typescript
// Live handle returned by orchestrator.connect()
interface ConnectionInfo {
  connectionId: string;
  fromId: string;
  toId: string;
  state: ConnectionState;            // IDLE | CONNECTING | READY | TRANSIENT_FAILURE | DISCONNECTING | CLOSED
  lastStateChangedAt: number;
  error?: Error;
  isReady: boolean;
  isConnecting: boolean;
  isFailed: boolean;
  isClosed: boolean;
  waitForStateChange(currentState: ConnectionState, deadlineMs?: number): Promise<ConnectionState>;
}
```

## BaseConnectionOrchestrator API

### Registration
```typescript
orchestrator.registerParticipant(
  id: string,
  channel: AbstractChannelProtocol,
  type?: ParticipantType
): void
```

### Connection
```typescript
// Basic
const info = await orchestrator.connect(fromId, toId);

// With services
const info = await orchestrator.connect(fromId, toId, {
  fromServices: { ... },
  toServices: { ... },
  heartbeat: { enabled: true, intervalMs: 30000, timeoutMs: 5000 },
  reconnectPolicy: new ExponentialBackoffPolicy(),
});

// With first-attempt timeout
const info = await orchestrator.connect(fromId, toId, {
  activateTimeoutMs: 30000,      // Default
  retryOnInitialFailure: false,  // Default
});
```

### Query
```typescript
orchestrator.getConnectionInfo(fromId, toId): ConnectionInfo | undefined
orchestrator.getConnectionStats(connectionId): ConnectionStats | undefined
orchestrator.listParticipants(): ListParticipantEntry[]
orchestrator.listConnections(): ListConnectionEntry[]
```

### Lifecycle
```typescript
await orchestrator.disconnect(connectionId): void
orchestrator.dispose(): void
orchestrator.handleParticipantLost(participantId: string, reason: string): void
orchestrator.replaceParticipantChannel(
  id: string,
  newChannel: AbstractChannelProtocol,
  options?: { autoReconnect?: boolean }
): void
```

### Events
```typescript
orchestrator.onStateChange((event) => { })
orchestrator.onReady((event) => { })
orchestrator.onDisconnected((event) => { })
orchestrator.onReconnecting((event) => { })
orchestrator.onReconnected((event) => { })
orchestrator.onReconnectFailed((event) => { })
orchestrator.onClosed((event) => { })
```

## Platform Implementations

### Electron
```typescript
import {
  ElectronConnectionOrchestrator,
  registerOrchestratorHandler,
  createPageBridge,
  setupMainOrchestrator,
} from '@x-oasis/async-call-rpc-electron';

// Main process
const orchestrator = new ElectronConnectionOrchestrator();
orchestrator.registerParticipant('renderer', ipcMainChannel, 'renderer');
orchestrator.registerParticipant('utility', utilityChannel, 'utility');
const info = await orchestrator.connect('renderer', 'utility');

// Renderer/utility process
registerOrchestratorHandler(ipcChannel, (port) => {
  directChannel.bindPort(port);
});
```

### Node.js
```typescript
import {
  NodeConnectionOrchestrator,
  registerOrchestratorHandler,
} from '@x-oasis/async-call-rpc-node';

// Main thread
const orchestrator = new NodeConnectionOrchestrator();
orchestrator.registerParticipant('workerA', channelA, 'worker');
orchestrator.registerParticipant('workerB', channelB, 'worker');
const info = await orchestrator.connect('workerA', 'workerB');

// Worker thread
registerOrchestratorHandler(mainChannel, (port) => {
  directChannel.bindPort(port);
});
```

### Web
```typescript
import {
  WebConnectionOrchestrator,
  registerOrchestratorHandler,
} from '@x-oasis/async-call-rpc-web';

// Main page/service worker
const orchestrator = new WebConnectionOrchestrator();
orchestrator.registerParticipant('workerA', channelA, 'worker');
orchestrator.registerParticipant('iframeB', channelB, 'renderer');
const info = await orchestrator.connect('workerA', 'iframeB');

// Worker/iframe
registerOrchestratorHandler(mainChannel, (port) => {
  directChannel.bindPort(port);
});
```

## Implementation Pattern

### 1. Subclass BaseConnectionOrchestrator
```typescript
class MyOrchestrator extends BaseConnectionOrchestrator {
  protected createPortPair(): PortPair {
    // Platform-specific port creation
  }

  protected async activateParticipant(
    info: ParticipantInfo,
    config: ActivationConfig
  ): Promise<void> {
    const deferred = info.channel.makeRequest(
      ORCHESTRATOR_SERVICE_PATH,
      'activateConnection',
      config.port
    );
    
    if (deferred && typeof (deferred as any).promise === 'object') {
      await (deferred as any).promise;
    }
  }
}
```

### 2. Participant registers handler
```typescript
registerOrchestratorHandler(controlPlaneChannel, (port) => {
  directChannel.bindPort(port, { rebind: true });
});
```

## Control Plane RPC Call

The orchestrator communicates with participants via `channel.makeRequest()`:

```typescript
// Orchestrator calls participant's handler
const deferred = info.channel.makeRequest(
  '__x_oasis_orchestrator__',   // Service path
  'activateConnection',          // Method name
  config.port                    // Port (Transferable)
);

// Participant's registerOrchestratorHandler hook responds
// by binding the received port to its direct channel

// Orchestrator awaits the promise to confirm activation
await deferred.promise;
```

## State Machine

```
IDLE
  ├─→ connect() called
  ├──→ CONNECTING
  │    ├─→ Both participants activated
  │    └──→ READY
  │        ├─→ Port closed / process exit
  │        └──→ TRANSIENT_FAILURE
  │            ├─→ Retry timer fired
  │            └──→ CONNECTING (reconnect loop)
  │                ├─→ Success
  │                └──→ READY
  │                ├─→ Failure
  │                └──→ TRANSIENT_FAILURE
  │            ├─→ Policy gave up
  │            └──→ DISCONNECTING
  │                └──→ CLOSED
  │
  ├─→ First-attempt failed (no auto-retry)
  └──→ IDLE

CLOSED (terminal state, but user can call connect() again)
```

## Configuration Options

### HeartbeatConfig
```typescript
{
  enabled: boolean;          // Default: false
  intervalMs: number;        // Default: 30_000
  timeoutMs: number;         // Default: 5_000
}
```

### ReconnectPolicy
```typescript
interface ReconnectPolicy {
  nextRetryDelayMs(context: RetryContext): number | null;
}

// Built-in policies
new ExponentialBackoffPolicy();     // 100ms, 200ms, 400ms, 800ms, ...
new FixedDelayPolicy(1000);         // Every 1000ms
new NeverReconnectPolicy();         // Never reconnect (null)
```

### ConnectionOrchestratorConfig
```typescript
{
  heartbeat?: HeartbeatConfig;
  requestTimeout?: RequestTimeoutConfig;
  reconnectPolicy?: ReconnectPolicy;
  pendingRequests?: PendingRequestBehavior;
  degradation?: DegradationConfig;
  circuitBreaker?: CircuitBreakerConfig;
  logger?: (level, message, data?) => void;
  enableStats?: boolean;
}
```

## Client/Service Hosts

### clientHost (Global singleton)
```typescript
import { clientHost } from '@x-oasis/async-call-rpc';

// Register a client proxy
const client = clientHost.registerClient('my-service', {
  channel: myChannel,
});

// Create a type-safe proxy
const proxy = client.createProxy<MyServiceType>();

// Use it
const result = await proxy.myMethod(arg1, arg2);
```

### serviceHost (Global singleton)
```typescript
import { serviceHost } from '@x-oasis/async-call-rpc';

// Register service handlers
serviceHost.registerService('my-service', {
  channel: myChannel,
  handlers: {
    myMethod: (arg1, arg2) => { /* ... */ },
  },
});

// Or register from instance
serviceHost.registerServiceHandler('my-service', myInstance);
```

## Telegraph D-006 Fixes

### Gap 2: Cold-start timeout
```typescript
// Without activateTimeoutMs, a slow participant hangs forever
const info = await orchestrator.connect('from', 'to', {
  activateTimeoutMs: 30000,  // Now it times out after 30s
});
```

### Gap 3: Participant loss not detected
```typescript
// Auto-wired in registerParticipant()
orchestrator.registerParticipant(id, channel, type);
// → channel.onDidDisconnected() → handleParticipantLost()
// → All connections with that participant move to TRANSIENT_FAILURE
```

## Error Handling

### TimeoutError
```typescript
try {
  const info = await orchestrator.connect('from', 'to', {
    activateTimeoutMs: 1000,
  });
} catch (err) {
  if (err instanceof TimeoutError) {
    // First attempt timed out
  }
}
```

### Connection errors from events
```typescript
orchestrator.onDisconnected((event) => {
  console.error('Disconnected:', event.error);
});

orchestrator.onReconnectFailed((event) => {
  console.error('Reconnect failed after', event.totalAttempts, 'attempts');
});
```

## Performance Tips

1. **Enable stats only when needed** (overhead per request)
   ```typescript
   new ElectronConnectionOrchestrator({ enableStats: true })
   ```

2. **Tune heartbeat interval** for your latency characteristics
   ```typescript
   { heartbeat: { enabled: true, intervalMs: 60000, timeoutMs: 10000 } }
   ```

3. **Choose reconnect policy wisely**
   - ExponentialBackoffPolicy: good for temporary failures
   - FixedDelayPolicy: good for predictable failures
   - NeverReconnectPolicy: good for testing

4. **Use port pool for frequent connects/disconnects**
   - Reuse same connection if possible
   - Or implement port caching at application level

## Testing

```typescript
// Simulate participant loss
orchestrator.handleParticipantLost('participant-id', 'test disconnect');

// Monitor state changes
orchestrator.onStateChange((event) => {
  console.log(`${event.connectionId}: ${event.previousState} → ${event.currentState}`);
});

// Wait for specific state
const newState = await connectionInfo.waitForStateChange(
  ConnectionState.READY,
  5000  // timeout after 5s
);
```

## Common Patterns

### Registry pattern
```typescript
class OrchestratorManager {
  private orchestrator = new ElectronConnectionOrchestrator();
  private connections = new Map<string, ConnectionInfo>();

  async connect(fromId: string, toId: string): Promise<ConnectionInfo> {
    const key = `${fromId}--${toId}`;
    const existing = this.connections.get(key);
    if (existing?.isReady) return existing;
    
    const info = await this.orchestrator.connect(fromId, toId);
    this.connections.set(key, info);
    return info;
  }
}
```

### Event aggregation
```typescript
const forwarder = orchestrator.createEventForwarder((event) => {
  console.log(`[Orchestrator] ${event.type}:`, event.payload);
});

// Later
forwarder.dispose();
```
