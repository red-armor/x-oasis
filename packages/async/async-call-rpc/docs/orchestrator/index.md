---
title: Connection Orchestrator
description: Core orchestrator for managing direct MessagePort connections between processes
order: 10
---

# Connection Orchestrator

The Connection Orchestrator provides automated management of direct `MessagePort` connections between processes/workers across different JavaScript environments.

## Overview

The orchestrator is organized in a layered architecture:

```
┌─────────────────────────────────────────────────────────────┐
│                    Platform Packages                        │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐        │
│  │   Electron   │ │     Node     │ │     Web      │        │
│  │ Orchestrator │ │ Orchestrator │ │ Orchestrator │        │
│  └──────────────┘ └──────────────┘ └──────────────┘        │
└─────────────────────────────────────────────────────────────┘
                            │
┌─────────────────────────────────────────────────────────────┐
│                 Core Orchestrator Layer                     │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │         BaseConnectionOrchestrator                  │   │
│  │  - State machine management                         │   │
│  │  - Reconnection scheduling                          │   │
│  │  - Circuit breaker integration                      │   │
│  │  - Stats tracking                                   │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌──────────────┐ ┌─────────────┐ ┌─────────────────────┐  │
│  │ CircuitBreaker│ │   Policies  │ │ ConnectionStats    │  │
│  └──────────────┘ └─────────────┘ └─────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                            │
┌─────────────────────────────────────────────────────────────┐
│                   RPC Foundation Layer                      │
│                                                             │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐        │
│  │ RPCService   │ │ ProxyRPCClient│ │ ServiceHost  │        │
│  └──────────────┘ └──────────────┘ └──────────────┘        │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │         AbstractChannelProtocol                     │   │
│  │  - makeRequest() for port delivery                  │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

## Platform-Specific Orchestrators

| Platform     | Package                            | Key Use Cases                                       |
| ------------ | ---------------------------------- | --------------------------------------------------- |
| **Electron** | `@x-oasis/async-call-rpc-electron` | Main ↔ Renderer, Main ↔ Utility, Renderer ↔ Utility |
| **Node.js**  | `@x-oasis/async-call-rpc-node`     | Main ↔ Worker threads, Process ↔ Process            |
| **Web**      | `@x-oasis/async-call-rpc-web`      | Page ↔ Worker, Worker ↔ Worker, Page ↔ Iframe       |

Each platform package extends `BaseConnectionOrchestrator` and implements:

- `createPortPair()`: Platform-specific MessagePort creation
- `activateParticipant()`: Port delivery via RPC `makeRequest()`

## Core Concepts

### Participant

A participant is any endpoint that can be connected:

```typescript
interface ParticipantInfo {
  id: string; // Unique identifier
  channel: AbstractChannelProtocol; // Control-plane RPC channel
  type: ParticipantType; // 'renderer' | 'utility' | 'worker' | 'process'
  registeredAt: number; // Registration timestamp
}
```

### Connection Lifecycle

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

### State Descriptions

| State               | Description                                          |
| ------------------- | ---------------------------------------------------- |
| `IDLE`              | Initial state, no connection attempt                 |
| `CONNECTING`        | Port pair created, waiting for activation            |
| `READY`             | Both sides activated, direct communication available |
| `TRANSIENT_FAILURE` | Connection lost, reconnection in progress            |
| `DISCONNECTING`     | Graceful shutdown in progress                        |
| `CLOSED`            | Connection terminated                                |

## Architecture Details

### BaseConnectionOrchestrator

The base class provides:

#### Connection Management

- `registerParticipant(id, channel, type)`: Register a participant
- `connect(fromId, toId, config)`: Establish a connection
- `disconnect(connectionId)`: Close a connection
- `getConnectionInfo(fromId, toId)`: Get connection status

#### Event Handling

- `onReady`: Connection established
- `onDisconnected`: Connection lost
- `onReconnecting`: Reconnection attempt started
- `onReconnected`: Reconnection successful
- `onReconnectFailed`: Max retries exceeded
- `onStateChange`: Any state transition

#### Resilience Features

- **Heartbeat**: Detect dead connections
- **Reconnect Policy**: Configurable retry strategy
- **Circuit Breaker**: Prevent cascading failures
- **Stats Tracking**: Monitor connection health

### Circuit Breaker

Three-state circuit breaker for connection health:

```
CLOSED (normal) ←───── probe success ─────┐
      │                                      │
      │ failure rate ≥ threshold              │
      ▼                                      │
   OPEN (fast fail) ──→ wait duration ──→ HALF_OPEN (probing)
```

### Reconnect Policies

Built-in policies for scheduling reconnection attempts:

#### Exponential Backoff (Default)

```typescript
const policy = new ExponentialBackoffPolicy({
  initialDelayMs: 1000, // Start with 1s delay
  maxDelayMs: 30000, // Cap at 30s
  multiplier: 2, // Double each time
  jitterFactor: 0.3, // ±30% randomization
  maxRetries: 10, // Give up after 10 attempts
  maxElapsedMs: 300000, // Or after 5 minutes
});
```

#### Fixed Delay

```typescript
const policy = new FixedDelayPolicy({
  delayMs: 5000, // Retry every 5 seconds
  maxRetries: 20,
});
```

#### Never Reconnect

```typescript
const policy = new NeverReconnectPolicy();
```

### Connection Stats

Track connection health metrics:

```typescript
interface ConnectionStats {
  totalRpcCalls: number;
  successfulCalls: number;
  failedCalls: number;
  timeouts: number;
  avgLatencyMs: number;
  p99LatencyMs: number;
  totalReconnects: number;
  recentFailureRate: number;
}
```

## Protocol Details

### Port Delivery Protocol

The orchestrator uses RPC to deliver ports to participants:

```typescript
// Internal service path (not exposed to users)
const ORCHESTRATOR_SERVICE_PATH = '__x_oasis_orchestrator__';

// Orchestrator sends port via RPC
channel.makeRequest(
  ORCHESTRATOR_SERVICE_PATH,
  'activateConnection',
  port // MessagePort as Transferable
);
```

### Participant Handler Registration

Participants register a handler to receive the port:

```typescript
// Platform-specific helper
registerOrchestratorHandler(channel, (port) => {
  directChannel.bindPort(port);
});

// Internally creates:
const service = new RPCService(ORCHESTRATOR_SERVICE_PATH, {
  handlers: {
    activateConnection: onPort,
  },
});
service.setChannel(channel);
```

## Configuration

### ConnectionOrchestratorConfig

```typescript
interface ConnectionOrchestratorConfig {
  heartbeat?: HeartbeatConfig;
  reconnectPolicy?: ReconnectPolicy;
  circuitBreaker?: CircuitBreakerConfig;
  pendingRequests?: PendingRequestBehavior;
  degradation?: DegradationConfig;
  enableStats?: boolean;
  logger?: Logger;
}

interface HeartbeatConfig {
  enabled: boolean;
  intervalMs: number; // Default: 30000
  timeoutMs: number; // Default: 5000
}

interface CircuitBreakerConfig {
  enabled: boolean;
  failureRateThreshold: number; // Default: 0.5
  volumeThreshold: number; // Default: 5
  rollingWindowMs: number; // Default: 10000
  openDurationMs: number; // Default: 30000
}
```

## Implementation Guide

### Creating a Custom Orchestrator

For new platforms, extend `BaseConnectionOrchestrator`:

```typescript
import {
  BaseConnectionOrchestrator,
  PortPair,
  ActivationConfig,
  ParticipantInfo,
  ORCHESTRATOR_SERVICE_PATH,
} from '@x-oasis/async-call-rpc';

export class CustomConnectionOrchestrator extends BaseConnectionOrchestrator {
  protected createPortPair(): PortPair {
    // Platform-specific port creation
    const { port1, port2 } = new PlatformMessageChannel();
    return { port1, port2 };
  }

  protected async activateParticipant(
    info: ParticipantInfo,
    config: ActivationConfig
  ): Promise<void> {
    const { port } = config;

    // Send port via RPC
    const deferred = info.channel.makeRequest(
      ORCHESTRATOR_SERVICE_PATH,
      'activateConnection',
      port
    );

    if (deferred && typeof (deferred as any).promise === 'object') {
      await (deferred as any).promise;
    }
  }
}
```

### Creating the Handler Helper

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

## Best Practices

### ✅ Do

- **Register handlers before connecting**: Ensure participants are ready
- **Handle reconnection events**: Workers/processes can restart
- **Enable stats in production**: Monitor connection health
- **Use circuit breaker**: Prevent cascade failures
- **Set reasonable timeouts**: Balance between resilience and responsiveness

### ❌ Don't

- **Don't expose ORCHESTRATOR_SERVICE_PATH**: It's an internal constant
- **Don't rely on connection state**: Always handle disconnections
- **Don't forget to disconnect**: Clean up when components unmount
- **Don't ignore reconnect failures**: May need manual intervention

## Migration from Manual Port Management

### Before (Manual)

```typescript
// Main process
const { port1, port2 } = new MessageChannelMain();

// Send to renderer via IPC (manual coordination)
ipcRenderer.postMessage('port-assignment', { role: 'initiator' }, [port1]);

// Send to utility via utilityProcess (manual coordination)
utilityProcess.postMessage({ type: 'port', role: 'receiver' }, [port2]);

// Wait for both to confirm (manual synchronization)
await Promise.all([waitForRendererAck(), waitForUtilityAck()]);
```

### After (Orchestrator)

```typescript
const orchestrator = new ElectronConnectionOrchestrator();
orchestrator.registerParticipant('renderer', rendererChannel, 'renderer');
orchestrator.registerParticipant('utility', utilityChannel, 'utility');
await orchestrator.connect('renderer', 'utility');
```

## Related Documentation

- [Electron Orchestrator](/packages/async/async-call-rpc-electron/orchestrator)
- [Node.js Orchestrator](/packages/async/async-call-rpc-node/orchestrator)
- [Web Orchestrator](/packages/async/async-call-rpc-web/orchestrator)
- [RPC Patterns Guide](/packages/async/async-call-rpc/rpc-patterns-guide)
- [Middleware Overview](/packages/async/async-call-rpc/middleware/overview)
