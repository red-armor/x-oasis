import React, {
  createContext,
  useContext,
  useCallback,
  useState,
  useEffect,
  ReactNode,
} from 'react';
import {
  BaseConnectionOrchestrator,
  ConnectionInfo,
} from '@x-oasis/async-call-rpc/orchestrator';

/**
 * Context value type for OrchestratorContext
 */
export interface OrchestratorContextValue<
  T extends BaseConnectionOrchestrator = BaseConnectionOrchestrator
> {
  /** The orchestrator instance */
  orchestrator: T | null;
  /** Whether the orchestrator is initialized */
  isInitialized: boolean;
  /** Current error if initialization failed */
  error: Error | null;
}

/**
 * React Context for sharing the orchestrator instance throughout the component tree.
 *
 * @example
 * ```tsx
 * // In your app entry
 * import { ElectronConnectionOrchestrator } from '@x-oasis/async-call-rpc-electron';
 *
 * const orchestrator = new ElectronConnectionOrchestrator({
 *   enableStats: true,
 * });
 *
 * function App() {
 *   return (
 *     <OrchestratorProvider orchestrator={orchestrator}>
 *       <YourApp />
 *     </OrchestratorProvider>
 *   );
 * }
 * ```
 */
const OrchestratorContext = createContext<OrchestratorContextValue>({
  orchestrator: null,
  isInitialized: false,
  error: null,
});

/**
 * Props for OrchestratorProvider
 */
export interface OrchestratorProviderProps<
  T extends BaseConnectionOrchestrator = BaseConnectionOrchestrator
> {
  /** The orchestrator instance to provide */
  orchestrator: T;
  /** Optional callback when connection becomes ready */
  onReady?: (connectionId: string) => void;
  /** Optional callback when connection is lost */
  onDisconnected?: (connectionId: string, error?: Error) => void;
  /** Optional callback when reconnection starts */
  onReconnecting?: (connectionId: string, attempt: number) => void;
  /** Optional callback when reconnection fails permanently */
  onReconnectFailed?: (connectionId: string) => void;
  /** React children */
  children: ReactNode;
}

/**
 * Provider component that makes the orchestrator available to child components.
 *
 * Automatically subscribes to orchestrator events and provides
 * connection state tracking.
 *
 * @example
 * ```tsx
 * function App() {
 *   const [orchestrator] = useState(() => new ElectronConnectionOrchestrator());
 *
 *   return (
 *     <OrchestratorProvider
 *       orchestrator={orchestrator}
 *       onReady={(id) => console.log('Connected:', id)}
 *       onDisconnected={(id, err) => console.log('Disconnected:', id, err)}
 *     >
 *       <MainLayout />
 *     </OrchestratorProvider>
 *   );
 * }
 * ```
 */
export function OrchestratorProvider<
  T extends BaseConnectionOrchestrator = BaseConnectionOrchestrator
>({
  orchestrator,
  onReady,
  onDisconnected,
  onReconnecting,
  onReconnectFailed,
  children,
}: OrchestratorProviderProps<T>) {
  const [isInitialized, setIsInitialized] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // Subscribe to orchestrator events
  useEffect(() => {
    if (!orchestrator) {
      return undefined;
    }

    const unsubscribers: (() => void)[] = [];

    if (onReady) {
      unsubscribers.push(
        orchestrator.onReady(({ connectionId }) => {
          onReady(connectionId);
        })
      );
    }

    if (onDisconnected) {
      unsubscribers.push(
        orchestrator.onDisconnected(({ connectionId, error }) => {
          onDisconnected(connectionId, error);
        })
      );
    }

    if (onReconnecting) {
      unsubscribers.push(
        orchestrator.onReconnecting(({ connectionId, attempt }) => {
          onReconnecting(connectionId, attempt);
        })
      );
    }

    if (onReconnectFailed) {
      unsubscribers.push(
        orchestrator.onReconnectFailed(({ connectionId }) => {
          onReconnectFailed(connectionId);
        })
      );
    }

    setIsInitialized(true);

    return () => {
      unsubscribers.forEach((unsub) => unsub());
    };
  }, [
    orchestrator,
    onReady,
    onDisconnected,
    onReconnecting,
    onReconnectFailed,
  ]);

  const value: OrchestratorContextValue<T> = {
    orchestrator,
    isInitialized,
    error,
  };

  return (
    <OrchestratorContext.Provider value={value}>
      {children}
    </OrchestratorContext.Provider>
  );
}

/**
 * Hook to access the orchestrator instance from the context.
 *
 * Must be used within an OrchestratorProvider.
 *
 * @example
 * ```tsx
 * function ConnectButton() {
 *   const { orchestrator, isInitialized } = useOrchestrator();
 *
 *   const handleConnect = async () => {
 *     if (!orchestrator) return;
 *     await orchestrator.connect('main', 'worker');
 *   };
 *
 *   return (
 *     <button onClick={handleConnect} disabled={!isInitialized}>
 *       Connect
 *     </button>
 *   );
 * }
 * ```
 *
 * @throws Error if used outside of OrchestratorProvider
 */
export function useOrchestrator<
  T extends BaseConnectionOrchestrator = BaseConnectionOrchestrator
>(): OrchestratorContextValue<T> {
  const context = useContext(OrchestratorContext);

  if (context === undefined) {
    throw new Error(
      'useOrchestrator must be used within an OrchestratorProvider'
    );
  }

  return context as OrchestratorContextValue<T>;
}

/**
 * Hook to check if orchestrator is ready.
 *
 * @example
 * ```tsx
 * function App() {
 *   const isReady = useOrchestratorReady();
 *
 *   if (!isReady) {
 *     return <LoadingSpinner />;
 *   }
 *
 *   return <MainContent />;
 * }
 * ```
 */
export function useOrchestratorReady(): boolean {
  const { isInitialized } = useOrchestrator();
  return isInitialized;
}

/**
 * Hook to access connection methods with React-friendly callbacks.
 *
 * @example
 * ```tsx
 * function ConnectionManager() {
 *   const { connect, disconnect, getInfo } = useConnectionMethods();
 *
 *   const handleConnect = async () => {
 *     const info = await connect('main', 'worker');
 *     console.log('Connected:', info.state);
 *   };
 *
 *   return <button onClick={handleConnect}>Connect</button>;
 * }
 * ```
 */
export function useConnectionMethods() {
  const { orchestrator } = useOrchestrator();

  const connect = useCallback(
    async (
      fromId: string,
      toId: string,
      config?: Parameters<BaseConnectionOrchestrator['connect']>[2]
    ): Promise<ConnectionInfo | null> => {
      if (!orchestrator) return null;
      return orchestrator.connect(fromId, toId, config);
    },
    [orchestrator]
  );

  const disconnect = useCallback(
    async (connectionId: string): Promise<void> => {
      if (!orchestrator) return;
      return orchestrator.disconnect(connectionId);
    },
    [orchestrator]
  );

  const getInfo = useCallback(
    (connectionId: string): ConnectionInfo | null => {
      if (!orchestrator) return null;
      return orchestrator.getConnectionInfo(connectionId);
    },
    [orchestrator]
  );

  const registerParticipant = useCallback(
    (
      id: string,
      channel: Parameters<BaseConnectionOrchestrator['registerParticipant']>[1],
      type: Parameters<BaseConnectionOrchestrator['registerParticipant']>[2]
    ): void => {
      if (!orchestrator) return;
      orchestrator.registerParticipant(id, channel, type);
    },
    [orchestrator]
  );

  return {
    connect,
    disconnect,
    getInfo,
    registerParticipant,
  };
}
