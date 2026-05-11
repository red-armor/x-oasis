# X-OASIS ORCHESTRATOR FILES INDEX

## Documentation Files Created
- **X-OASIS-ORCHESTRATOR-COMPREHENSIVE-ANALYSIS.md** (26 KB)
  - Complete codebase analysis with line numbers
  - Detailed explanations of every major component
  - Control flow diagrams
  - Implementation patterns

- **ORCHESTRATOR-QUICK-REFERENCE.md** 
  - Quick lookup guide for common tasks
  - Code snippets ready to use
  - Configuration options
  - Testing patterns

- **ORCHESTRATOR-FILES-INDEX.md** (this file)
  - File location reference

## Core Orchestrator Files

### Base Implementation
| File | Path | Lines | Purpose |
|------|------|-------|---------|
| types.ts | `packages/async/async-call-rpc/src/orchestrator/types.ts` | 373 | All orchestrator types, constants, and interfaces |
| BaseConnectionOrchestrator.ts | `packages/async/async-call-rpc/src/orchestrator/BaseConnectionOrchestrator.ts` | 1,172 | Abstract base class, state machine, reconnection logic |
| ConnectionState.ts | `packages/async/async-call-rpc/src/orchestrator/ConnectionState.ts` | 105 | Connection state enum and transition validation |
| CircuitBreaker.ts | `packages/async/async-call-rpc/src/orchestrator/CircuitBreaker.ts` | ~120 | Circuit breaker implementation |
| ConnectionStatsTracker.ts | `packages/async/async-call-rpc/src/orchestrator/ConnectionStatsTracker.ts` | ~150 | Statistics collection |
| index.ts | `packages/async/async-call-rpc/src/orchestrator/index.ts` | 46 | Public API exports |

### Reconnection Policies
| File | Path |
|------|------|
| ExponentialBackoffPolicy.ts | `packages/async/async-call-rpc/src/orchestrator/policies/ExponentialBackoffPolicy.ts` |
| FixedDelayPolicy.ts | `packages/async/async-call-rpc/src/orchestrator/policies/FixedDelayPolicy.ts` |
| NeverReconnectPolicy.ts | `packages/async/async-call-rpc/src/orchestrator/policies/NeverReconnectPolicy.ts` |

## Platform-Specific Implementations

### Electron
| File | Path | Lines | Purpose |
|------|------|-------|---------|
| ElectronConnectionOrchestrator.ts | `packages/async/async-call-rpc-electron/src/electron-main/ElectronConnectionOrchestrator.ts` | 186 | Electron-specific orchestrator |
| registerOrchestratorHandler.ts | `packages/async/async-call-rpc-electron/src/electron-browser/registerOrchestratorHandler.ts` | 52 | Participant-side handler registration |
| createPageBridge.ts | `packages/async/async-call-rpc-electron/src/electron-browser/createPageBridge.ts` | 140 | Renderer process bridge |
| UtilityOrchestratorParticipant.ts | `packages/async/async-call-rpc-electron/src/electron-main/UtilityOrchestratorParticipant.ts` | 106 | Utility process participant |
| MainOrchestratorSetup.ts | `packages/async/async-call-rpc-electron/src/electron-main/MainOrchestratorSetup.ts` | 246 | Main process setup helper |
| IPCMainChannel.ts | `packages/async/async-call-rpc-electron/src/electron-main/IPCMainChannel.ts` | - | IPC control-plane channel |
| IPCRendererChannel.ts | `packages/async/async-call-rpc-electron/src/electron-browser/IPCRendererChannel.ts` | - | Renderer IPC channel |
| ElectronUtilityProcessChannel.ts | `packages/async/async-call-rpc-electron/src/electron-main/ElectronUtilityProcessChannel.ts` | - | Utility process channel |
| ElectronMessagePortMainChannel.ts | `packages/async/async-call-rpc-electron/src/electron-main/ElectronMessagePortMainChannel.ts` | - | Direct port channel |

### Node.js
| File | Path | Lines | Purpose |
|------|------|-------|---------|
| NodeConnectionOrchestrator.ts | `packages/async/async-call-rpc-node/src/NodeConnectionOrchestrator.ts` | 123 | Node.js orchestrator + handler |

### Web
| File | Path | Lines | Purpose |
|------|------|-------|---------|
| WebConnectionOrchestrator.ts | `packages/async/async-call-rpc-web/src/WebConnectionOrchestrator.ts` | 125 | Web/browser orchestrator + handler |

## RPC Framework Files

### Core Protocol
| File | Path | Lines | Purpose |
|------|------|-------|---------|
| AbstractChannelProtocol.ts | `packages/async/async-call-rpc/src/protocol/AbstractChannelProtocol.ts` | 531 | Base channel protocol, makeRequest() |
| ProxyRPCClient.ts | `packages/async/async-call-rpc/src/endpoint/ProxyRPCClient.ts` | 218 | Client-side proxy generator |
| RPCService.ts | `packages/async/async-call-rpc/src/endpoint/RPCService.ts` | 56 | Service handler registration |
| RPCClientHost.ts | `packages/async/async-call-rpc/src/endpoint/RPCClientHost.ts` | 28 | Global clientHost singleton |
| RPCServiceHost.ts | `packages/async/async-call-rpc/src/endpoint/RPCServiceHost.ts` | 85 | Global serviceHost singleton |
| index.ts | `packages/async/async-call-rpc/src/index.ts` | 39 | Public API exports |

## Key Code Locations by Feature

### Control Plane RPC Communication
- **File**: `AbstractChannelProtocol.ts` (lines 501-518)
- **Method**: `makeRequest()`
- **Usage in orchestrator**: `ElectronConnectionOrchestrator.activateParticipant()` (lines 108-116)

### Participant Handler Registration
- **Electron**: `registerOrchestratorHandler.ts` (lines 41-51)
- **Node**: `NodeConnectionOrchestrator.ts` (lines 113-122)
- **Web**: `WebConnectionOrchestrator.ts` (lines 115-124)
- **Handlers**: `activateConnection`, `ping`

### Connection Flow
- **Entry**: `BaseConnectionOrchestrator.connect()` (lines 439-536)
- **Implementation**: `_doConnect()` (lines 635-711)
- **Timeout**: `_withActivationTimeout()` (lines 721-746)

### State Management
- **State machine**: `_transitionState()` (lines 1034-1084)
- **Event firing**: `_onStateChangeEvent.fire()` (line 1064)
- **State definition**: `ConnectionState.ts` (enum at lines 38-63)

### Reconnection Logic
- **Handler**: `_handleConnectionLost()` (lines 750-793)
- **Scheduler**: `_scheduleReconnect()` (lines 795-882)
- **Attempt**: `_attemptReconnect()` (lines 891-984)

### Heartbeat
- **Starter**: `_startHeartbeat()` (lines 988-997)
- **Sender**: `_sendHeartbeat()` (lines 1011-1020)
  - Base: `BaseConnectionOrchestrator.ts` (lines 1011-1020)
  - Electron: `ElectronConnectionOrchestrator.ts` (lines 124-185)
- **Timeout handler**: `_handleHeartbeatTimeout()` (lines 1026-1030)

### ConnectionInfo
- **Builder**: `_buildConnectionInfo()` (lines 1088-1159)
- **Live proxy**: Returns ConnectionInfo interface with getters
- **waitForStateChange**: Lines 1122-1157

## Type Definition Locations

### All Types in types.ts (lines 1-373)
- Line 18: `ORCHESTRATOR_SERVICE_PATH` constant
- Lines 23-28: `ParticipantType`
- Lines 31-36: `ParticipantInfo`
- Lines 46-51: `ConnectionConfig`
- Lines 65-83: `ConnectOptions`
- Lines 85-92: `ReplaceChannelOptions`
- Lines 94-98: `ListParticipantEntry`
- Lines 100-106: `ListConnectionEntry`
- Lines 108-114: `BindPortOptions`
- Lines 116-119: `OrchestratorEvent`
- Lines 127-151: `ConnectionInfo`
- Lines 155-204: Event types
- Lines 208-231: `ConnectionStats`
- Lines 235-242: `HeartbeatConfig`
- Lines 246-251: `RequestTimeoutConfig`
- Lines 255-265: `RetryContext`
- Lines 273-275: `ReconnectPolicy`
- Lines 279-286: `PendingRequestBehavior`
- Lines 290-301: `DegradationConfig`
- Lines 305-320: `CircuitBreakerConfig`
- Lines 324-345: `ConnectionOrchestratorConfig`
- Lines 353-356: `PortPair`
- Lines 363-372: `ActivationConfig`

## Internal Structures

### ManagedConnection (BaseConnectionOrchestrator.ts, lines 31-62)
```
ManagedConnection {
  connectionId: string
  fromId: string
  toId: string
  state: ConnectionState
  lastStateChangedAt: number
  error?: Error
  portPair?: PortPair
  heartbeatTimer?: ReturnType<typeof setInterval>
  reconnectTimer?: ReturnType<typeof setTimeout>
  circuitBreaker?: CircuitBreaker
  statsTracker?: ConnectionStatsTracker
  stateWaiters: Array<{ currentState, deferred }>
  reconnectAttempt: number
  firstFailedAt?: number
  lastConfig?: ConnectionConfig
}
```

## Critical Code Snippets

### makeRequest() Call in activateParticipant
File: `ElectronConnectionOrchestrator.ts`, lines 108-116
```typescript
const deferred = info.channel.makeRequest(
  ORCHESTRATOR_SERVICE_PATH,
  'activateConnection',
  port
);

if (deferred && typeof (deferred as any).promise === 'object') {
  await (deferred as any).promise;
}
```

### Participant Handler Setup
File: `registerOrchestratorHandler.ts`, lines 45-51
```typescript
const service = new RPCService(ORCHESTRATOR_SERVICE_PATH, {
  handlers: {
    activateConnection: onPort,
    ping: () => 'pong',
  },
});
service.setChannel(channel);
```

### State Transition
File: `BaseConnectionOrchestrator.ts`, lines 1049-1051
```typescript
const previousState = mc.state;
mc.state = newState;
mc.lastStateChangedAt = Date.now();
```

### Canonical Connection ID
File: `BaseConnectionOrchestrator.ts`, lines 631-633
```typescript
private _canonicalConnectionId(a: string, b: string): string {
  return a < b ? `${a}--${b}` : `${b}--${a}`;
}
```

## Search Tips

### Find control plane RPC references
```bash
grep -r "ORCHESTRATOR_SERVICE_PATH" packages/async/
```

### Find makeRequest calls
```bash
grep -n "makeRequest" packages/async/async-call-rpc/src/protocol/AbstractChannelProtocol.ts
```

### Find clientHost/serviceHost usage
```bash
grep -r "clientHost\|serviceHost" packages/async/async-call-rpc/src/endpoint/
```

### Find event firing
```bash
grep -n "_on.*Event.fire" packages/async/async-call-rpc/src/orchestrator/BaseConnectionOrchestrator.ts
```

## Development Workflow

1. **Add a feature to BaseConnectionOrchestrator**
   - Modify `BaseConnectionOrchestrator.ts`
   - Update types in `types.ts` if needed
   - Test all platforms (Electron, Node, Web)

2. **Add platform support**
   - Create new subclass extending `BaseConnectionOrchestrator`
   - Implement `createPortPair()` and `activateParticipant()`
   - Optionally override `_sendHeartbeat()` for real heartbeat
   - Create `registerOrchestratorHandler()` function

3. **Update participant integration**
   - Modify handler registration (e.g., `registerOrchestratorHandler.ts`)
   - Update control-plane channel (e.g., `IPCMainChannel.ts`)
   - Test with full topology

4. **Add configuration**
   - Define types in `types.ts`
   - Add to `ConnectionOrchestratorConfig` interface
   - Pass through constructor
   - Apply in relevant methods

## Build and Test

```bash
# Build
npm run build

# Test orchestrator
npm run test -- --testPathPattern=orchestrator

# Build docs
npm run docs:build
```

## Related Skills

While the orchestrator itself is this directory, it uses:
- **Type Validation** - for parameter validation
- **Request Throttling** - in reconnection policy (delays)
- **Event Management** - internal event system (onStateChange, onReady, etc.)
- **Stream Processing** - could apply to handling multiple connections
- **Object Comparison** - state comparison in state machine
- **Functional Programming** - middleware pipeline in channels
