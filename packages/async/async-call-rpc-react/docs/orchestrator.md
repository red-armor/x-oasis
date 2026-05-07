---
title: React Integration
description: React hooks and components for Connection Orchestrator
order: 3
---

# React Integration

`@x-oasis/async-call-rpc-react` provides React hooks and components for integrating the Connection Orchestrator into React applications.

## Overview

The React integration layer provides:

- **OrchestratorProvider**: Context provider for sharing the orchestrator instance
- **useOrchestrator**: Access the orchestrator from any component
- **useConnectionState**: Track connection state reactively
- **useConnectionStats**: Monitor connection health metrics

## Installation

```bash
npm install @x-oasis/async-call-rpc-react @x-oasis/async-call-rpc
```

## Quick Start

### 1. Setup OrchestratorProvider

Wrap your app with the provider:

```tsx
import { ElectronConnectionOrchestrator } from '@x-oasis/async-call-rpc-electron';
import { OrchestratorProvider } from '@x-oasis/async-call-rpc-react';

const orchestrator = new ElectronConnectionOrchestrator({
  enableStats: true,
  logger: (level, msg) => console.log(`[${level}] ${msg}`),
});

function App() {
  return (
    <OrchestratorProvider
      orchestrator={orchestrator}
      onReady={(id) => console.log('Connected:', id)}
      onDisconnected={(id, err) => console.log('Disconnected:', id, err)}
    >
      <MainLayout />
    </OrchestratorProvider>
  );
}
```

### 2. Track Connection State

Use hooks to display connection status:

```tsx
import {
  useConnectionState,
  useOrchestrator,
} from '@x-oasis/async-call-rpc-react';

function ConnectionStatus({ connectionId }: { connectionId: string }) {
  const { orchestrator } = useOrchestrator();
  const connection = useConnectionState(orchestrator, connectionId);

  if (!connection) {
    return <div>Not connected</div>;
  }

  return (
    <div className={`status ${connection.state.toLowerCase()}`}>
      {connection.isReady ? (
        <span>✅ Connected</span>
      ) : (
        <span>⏳ {connection.state}</span>
      )}
      {connection.error && (
        <span className="error">{connection.error.message}</span>
      )}
    </div>
  );
}
```

### 3. Manage Connections

Use the connection methods hook:

```tsx
import { useConnectionMethods } from '@x-oasis/async-call-rpc-react';

function ConnectionManager() {
  const { connect, disconnect, getInfo } = useConnectionMethods();
  const [isConnecting, setIsConnecting] = useState(false);

  const handleConnect = async () => {
    setIsConnecting(true);
    try {
      const info = await connect('main', 'worker');
      console.log('Connected:', info?.state);
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    await disconnect('main--worker');
  };

  return (
    <div>
      <button onClick={handleConnect} disabled={isConnecting}>
        {isConnecting ? 'Connecting...' : 'Connect'}
      </button>
      <button onClick={handleDisconnect}>Disconnect</button>
    </div>
  );
}
```

## API Reference

### OrchestratorProvider

Provider component that makes the orchestrator available to child components.

```tsx
interface OrchestratorProviderProps<T extends BaseConnectionOrchestrator> {
  orchestrator: T;
  onReady?: (connectionId: string) => void;
  onDisconnected?: (connectionId: string, error?: Error) => void;
  onReconnecting?: (connectionId: string, attempt: number) => void;
  onReconnectFailed?: (connectionId: string) => void;
  children: ReactNode;
}
```

**Example:**

```tsx
<OrchestratorProvider
  orchestrator={orchestrator}
  onReady={(id) => toast.success(`Connected: ${id}`)}
  onDisconnected={(id, err) => toast.error(`Disconnected: ${id}`)}
  onReconnecting={(id, attempt) =>
    toast.info(`Reconnecting ${id} (attempt ${attempt})`)
  }
  onReconnectFailed={(id) => toast.error(`Failed to reconnect: ${id}`)}
>
  <App />
</OrchestratorProvider>
```

### useOrchestrator

Hook to access the orchestrator instance from context.

```tsx
function useOrchestrator<T extends BaseConnectionOrchestrator>(): {
  orchestrator: T | null;
  isInitialized: boolean;
  error: Error | null;
};
```

**Example:**

```tsx
function MyComponent() {
  const { orchestrator, isInitialized } = useOrchestrator();

  if (!isInitialized) {
    return <div>Initializing...</div>;
  }

  // Use orchestrator directly
  const info = orchestrator?.getConnectionInfo('main--worker');

  return <div>{info?.state}</div>;
}
```

### useConnectionState

Hook to subscribe to a connection's state changes.

```tsx
function useConnectionState(
  orchestrator: BaseConnectionOrchestrator | null | undefined,
  connectionId: string
): ConnectionInfo | null;
```

**Returns:**

- `connectionId`: string
- `state`: ConnectionState (IDLE, CONNECTING, READY, TRANSIENT_FAILURE, etc.)
- `isReady`: boolean
- `isConnecting`: boolean
- `isFailed`: boolean
- `isClosed`: boolean
- `error`: Error | undefined

**Example:**

```tsx
function StatusBadge({ connectionId }: { connectionId: string }) {
  const { orchestrator } = useOrchestrator();
  const connection = useConnectionState(orchestrator, connectionId);

  const statusColors = {
    IDLE: 'gray',
    CONNECTING: 'yellow',
    READY: 'green',
    TRANSIENT_FAILURE: 'orange',
    DISCONNECTING: 'red',
    CLOSED: 'gray',
  };

  return (
    <span style={{ color: statusColors[connection?.state || 'IDLE'] }}>
      {connection?.state || 'Unknown'}
    </span>
  );
}
```

### useIsConnectionReady

Convenience hook that returns only the ready state.

```tsx
function useIsConnectionReady(
  orchestrator: BaseConnectionOrchestrator | null | undefined,
  connectionId: string
): boolean;
```

**Example:**

```tsx
function DataViewer({ connectionId }: { connectionId: string }) {
  const { orchestrator } = useOrchestrator();
  const isReady = useIsConnectionReady(orchestrator, connectionId);

  if (!isReady) {
    return <div>Waiting for connection...</div>;
  }

  return <DataTable />;
}
```

### useConnectionStats

Hook to track connection statistics.

```tsx
function useConnectionStats(
  orchestrator: BaseConnectionOrchestrator | null | undefined,
  connectionId: string
): ConnectionStats | null;
```

**Returns:**

- `totalRpcCalls`: number
- `successfulCalls`: number
- `failedCalls`: number
- `timeouts`: number
- `avgLatencyMs`: number
- `p99LatencyMs`: number
- `recentFailureRate`: number
- `totalReconnects`: number

**Example:**

```tsx
function StatsPanel({ connectionId }: { connectionId: string }) {
  const { orchestrator } = useOrchestrator();
  const stats = useConnectionStats(orchestrator, connectionId);

  if (!stats) return null;

  return (
    <div className="stats">
      <div>Latency: {stats.avgLatencyMs.toFixed(2)}ms</div>
      <div>P99: {stats.p99LatencyMs.toFixed(2)}ms</div>
      <div>Failure Rate: {(stats.recentFailureRate * 100).toFixed(1)}%</div>
      <div>Total Calls: {stats.totalRpcCalls}</div>
      <div>Reconnects: {stats.totalReconnects}</div>
    </div>
  );
}
```

### useAllConnections

Hook to track all active connections.

```tsx
function useAllConnections(
  orchestrator: BaseConnectionOrchestrator | null | undefined
): ConnectionInfo[];
```

**Example:**

```tsx
function ConnectionList() {
  const { orchestrator } = useOrchestrator();
  const connections = useAllConnections(orchestrator);

  return (
    <ul>
      {connections.map((conn) => (
        <li key={conn.connectionId}>
          {conn.fromId} → {conn.toId}: {conn.state}
        </li>
      ))}
    </ul>
  );
}
```

### useConnectionMethods

Hook to access connection management methods.

```tsx
function useConnectionMethods(): {
  connect: (fromId, toId, config?) => Promise<ConnectionInfo | null>;
  disconnect: (connectionId) => Promise<void>;
  getInfo: (connectionId) => ConnectionInfo | null;
  registerParticipant: (id, channel, type) => void;
};
```

## Complete Example

```tsx
import React, { useState } from 'react';
import { ElectronConnectionOrchestrator } from '@x-oasis/async-call-rpc-electron';
import {
  OrchestratorProvider,
  useOrchestrator,
  useConnectionState,
  useConnectionStats,
  useConnectionMethods,
  useIsConnectionReady,
} from '@x-oasis/async-call-rpc-react';
import { createRPCReact } from '@x-oasis/async-call-rpc-react';

// Setup orchestrator
const orchestrator = new ElectronConnectionOrchestrator({
  enableStats: true,
  heartbeat: {
    enabled: true,
    intervalMs: 30000,
    timeoutMs: 5000,
  },
});

// App Component
function App() {
  return (
    <OrchestratorProvider
      orchestrator={orchestrator}
      onReady={(id) => console.log('Connected:', id)}
      onDisconnected={(id, err) => console.log('Disconnected:', id, err)}
    >
      <div className="app">
        <ConnectionPanel connectionId="main--worker" />
        <WorkerStatus />
      </div>
    </OrchestratorProvider>
  );
}

// Connection Panel Component
function ConnectionPanel({ connectionId }: { connectionId: string }) {
  const { orchestrator } = useOrchestrator();
  const connection = useConnectionState(orchestrator, connectionId);
  const stats = useConnectionStats(orchestrator, connectionId);
  const { connect, disconnect } = useConnectionMethods();
  const [isConnecting, setIsConnecting] = useState(false);

  const handleConnect = async () => {
    setIsConnecting(true);
    try {
      await connect('main', 'worker');
    } finally {
      setIsConnecting(false);
    }
  };

  return (
    <div className="connection-panel">
      <h3>Connection: {connectionId}</h3>
      <div className="status">
        State: {connection?.state || 'Not Connected'}
        {connection?.isReady && ' ✅'}
      </div>

      {stats && (
        <div className="stats">
          <div>Latency: {stats.avgLatencyMs.toFixed(1)}ms</div>
          <div>Failures: {(stats.recentFailureRate * 100).toFixed(1)}%</div>
        </div>
      )}

      <div className="actions">
        <button
          onClick={handleConnect}
          disabled={isConnecting || connection?.isReady}
        >
          {isConnecting ? 'Connecting...' : 'Connect'}
        </button>
        <button
          onClick={() => disconnect(connectionId)}
          disabled={!connection?.isReady}
        >
          Disconnect
        </button>
      </div>
    </div>
  );
}

// Worker Status Component
function WorkerStatus() {
  const { orchestrator } = useOrchestrator();
  const isReady = useIsConnectionReady(orchestrator, 'main--worker');

  return (
    <div className="worker-status">
      <h3>Worker Status</h3>
      {isReady ? (
        <div className="ready">✅ Worker Ready</div>
      ) : (
        <div className="offline">⏳ Worker Offline</div>
      )}
    </div>
  );
}

export default App;
```

## Best Practices

### ✅ Do

- **Always use OrchestratorProvider**: Wrap your app to provide the orchestrator context
- **Handle loading states**: Check `isInitialized` before using the orchestrator
- **Listen to events**: Use provider callbacks to respond to connection changes
- **Display connection state**: Give users visibility into connection health
- **Clean up on unmount**: The hooks automatically unsubscribe when components unmount

### ❌ Don't

- **Don't access orchestrator directly without provider**: Always use `useOrchestrator`
- **Don't forget error handling**: Connection events can include errors
- **Don't ignore reconnecting state**: Users should know when reconnection is in progress

## TypeScript Support

Full TypeScript support with generic orchestrator types:

```tsx
import { ElectronConnectionOrchestrator } from '@x-oasis/async-call-rpc-electron';

function App() {
  const orchestrator = new ElectronConnectionOrchestrator();

  return (
    <OrchestratorProvider orchestrator={orchestrator}>
      <ChildComponent />
    </OrchestratorProvider>
  );
}

function ChildComponent() {
  // TypeScript knows this is ElectronConnectionOrchestrator
  const { orchestrator } = useOrchestrator<ElectronConnectionOrchestrator>();

  // Access Electron-specific methods
  const info = orchestrator?.getConnectionInfo('main--renderer');

  return <div>{info?.state}</div>;
}
```

## See Also

- [Connection Orchestrator](/packages/async/async-call-rpc/orchestrator/)
- [Electron Orchestrator](/packages/async/async-call-rpc-electron/orchestrator)
- [React Query Integration](/packages/async/async-call-rpc-react/)
