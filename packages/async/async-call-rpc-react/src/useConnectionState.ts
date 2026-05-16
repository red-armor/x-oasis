import { useSyncExternalStore, useCallback } from 'react';
import {
  ConnectionInfo,
  ConnectionState,
  BaseConnectionOrchestrator,
} from '@x-oasis/async-call-rpc/orchestrator';

/**
 * React hook that subscribes to a connection's state changes.
 *
 * Returns the current connection state and metadata, automatically
 * re-rendering when the state changes.
 *
 * @example
 * ```tsx
 * function ConnectionStatus({ connectionId }: { connectionId: string }) {
 *   const { state, isReady, error } = useConnectionState(
 *     orchestrator,
 *     connectionId
 *   );
 *
 *   return (
 *     <div className={`status ${state.toLowerCase()}`}>
 *       {isReady ? '✅ Connected' : `⏳ ${state}`}
 *       {error && <span className="error">{error.message}</span>}
 *     </div>
 *   );
 * }
 * ```
 *
 * @param orchestrator - The connection orchestrator instance
 * @param connectionId - The connection identifier (fromId--toId)
 * @returns ConnectionInfo snapshot with reactive state
 */
export function useConnectionState(
  orchestrator: BaseConnectionOrchestrator | null | undefined,
  connectionId: string
): ConnectionInfo | null {
  const subscribe = useCallback(
    (callback: () => void) => {
      if (!orchestrator) return () => {};

      // Subscribe to state change events
      const unsubscribe = orchestrator.onStateChange(() => {
        callback();
      });

      return unsubscribe;
    },
    [orchestrator]
  );

  const getSnapshot = useCallback(() => {
    if (!orchestrator) return null;
    return orchestrator.getConnectionInfo(connectionId);
  }, [orchestrator, connectionId]);

  const getServerSnapshot = useCallback(() => {
    return null;
  }, []);

  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/**
 * React hook that tracks whether a connection is in READY state.
 *
 * @example
 * ```tsx
 * function DataViewer() {
 *   const isConnected = useIsConnectionReady(orchestrator, 'main--worker');
 *
 *   if (!isConnected) {
 *     return <div>Connecting...</div>;
 *   }
 *
 *   return <DataTable />;
 * }
 * ```
 */
export function useIsConnectionReady(
  orchestrator: BaseConnectionOrchestrator | null | undefined,
  connectionId: string
): boolean {
  const connection = useConnectionState(orchestrator, connectionId);
  return connection?.isReady ?? false;
}

/**
 * React hook that subscribes to connection stats.
 *
 * @example
 * ```tsx
 * function ConnectionStats({ connectionId }: { connectionId: string }) {
 *   const stats = useConnectionStats(orchestrator, connectionId);
 *
 *   if (!stats) return null;
 *
 *   return (
 *     <div className="stats">
 *       <div>Latency: {stats.avgLatencyMs.toFixed(2)}ms</div>
 *       <div>Failure Rate: {(stats.recentFailureRate * 100).toFixed(1)}%</div>
 *       <div>Reconnects: {stats.totalReconnects}</div>
 *     </div>
 *   );
 * }
 * ```
 */
export function useConnectionStats(
  orchestrator: BaseConnectionOrchestrator | null | undefined,
  connectionId: string
) {
  const subscribe = useCallback(
    (callback: () => void) => {
      if (!orchestrator) return () => {};

      // Stats update on state changes
      const unsubscribe = orchestrator.onStateChange(() => {
        callback();
      });

      return unsubscribe;
    },
    [orchestrator]
  );

  const getSnapshot = useCallback(() => {
    if (!orchestrator) return null;
    return orchestrator.getConnectionStats(connectionId);
  }, [orchestrator, connectionId]);

  const getServerSnapshot = useCallback(() => {
    return null;
  }, []);

  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/**
 * React hook that tracks all active connections.
 *
 * @example
 * ```tsx
 * function ConnectionList() {
 *   const connections = useAllConnections(orchestrator);
 *
 *   return (
 *     <ul>
 *       {connections.map(conn => (
 *         <li key={conn.connectionId}>
 *           {conn.fromId} → {conn.toId}: {conn.state}
 *         </li>
 *       ))}
 *     </ul>
 *   );
 * }
 * ```
 */
export function useAllConnections(
  orchestrator: BaseConnectionOrchestrator | null | undefined
): ConnectionInfo[] {
  const subscribe = useCallback(
    (callback: () => void) => {
      if (!orchestrator) return () => {};

      const unsubscribe = orchestrator.onStateChange(() => {
        callback();
      });

      return unsubscribe;
    },
    [orchestrator]
  );

  const getSnapshot = useCallback(() => {
    if (!orchestrator) return [];

    // Access internal connections map
    // Note: This is a bit of a hack, we should add a public API for this
    const connections = (orchestrator as any).connections;
    if (!connections) return [];

    return Array.from(connections.values()).map((mc: any) => ({
      connectionId: mc.connectionId,
      fromId: mc.fromId,
      toId: mc.toId,
      state: mc.state,
      lastStateChangedAt: mc.lastStateChangedAt,
      error: mc.error,
      isReady: mc.state === ConnectionState.READY,
      isConnecting: mc.state === ConnectionState.CONNECTING,
      isFailed: mc.state === ConnectionState.TRANSIENT_FAILURE,
      isClosed: mc.state === ConnectionState.CLOSED,
      waitForStateChange: async () => mc.state,
    })) as ConnectionInfo[];
  }, [orchestrator]);

  const getServerSnapshot = useCallback(() => {
    return [];
  }, []);

  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
