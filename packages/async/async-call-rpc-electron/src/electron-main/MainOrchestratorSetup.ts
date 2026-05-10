import { ElectronConnectionOrchestrator } from './ElectronConnectionOrchestrator.js';
import ElectronMessagePortMainChannel from './ElectronMessagePortMainChannel.js';
import IPCMainChannel from './IPCMainChannel.js';
import { serviceHost } from '@x-oasis/async-call-rpc';

export interface MainOrchestratorSetupOptions {
  /** Main window's IPC channel */
  ipcChannel: IPCMainChannel;

  /** Participant IDs for the default connection handlers */
  fromId?: string;
  toId?: string;

  /** Orchestrator configuration */
  orchestratorConfig?: {
    logger?: (level: string, msg: string) => void;
    enableStats?: boolean;
    heartbeat?: {
      enabled: boolean;
      intervalMs: number;
      timeoutMs: number;
    };
  };

  /** Service handlers for orchestrator control */
  handlers?: Record<string, (...args: any[]) => any>;

  /** Custom participant setup function */
  setupParticipants?: (
    orchestrator: ElectronConnectionOrchestrator
  ) => Promise<void> | void;

  /** Callback when orchestrator is ready */
  onReady?: (setup: MainOrchestratorSetupResult) => void;
}

export interface MainOrchestratorSetupResult {
  orchestrator: ElectronConnectionOrchestrator;
  ipcChannel: IPCMainChannel;
  mainDirectChannel: ElectronMessagePortMainChannel;
  serviceHost: typeof serviceHost;
}

/**
 * Set up orchestrator in main process with common patterns abstracted
 *
 * This handles:
 * - Orchestrator initialization with logging and stats
 * - Main process direct message port channel
 * - Registration of main as a participant
 * - Common orchestrator service handlers
 * - Event lifecycle management
 */
export async function setupMainOrchestrator(
  options: MainOrchestratorSetupOptions
): Promise<MainOrchestratorSetupResult> {
  const {
    ipcChannel,
    fromId = 'main',
    toId,
    orchestratorConfig,
    handlers,
    setupParticipants,
    onReady,
  } = options;

  // Create main process direct channel
  const mainDirectChannel = new ElectronMessagePortMainChannel({
    description: orchestratorConfig?.heartbeat
      ? 'main↔{target} direct port (with heartbeat)'
      : 'main↔{target} direct port',
  });

  // Initialize orchestrator
  const orchestrator = new ElectronConnectionOrchestrator({
    logger:
      orchestratorConfig?.logger ||
      ((level, msg) => console.log(`[orchestrator:${level}] ${msg}`)),
    enableStats: orchestratorConfig?.enableStats ?? true,
    heartbeat: orchestratorConfig?.heartbeat,
  });

  // Register main as a participant with custom channel adapter
  const mainParticipantChannel =
    createMainParticipantChannel(mainDirectChannel);
  orchestrator.registerParticipant('main', mainParticipantChannel, 'process');

  // Create default handlers merged with custom handlers
  const defaultHandlers = createDefaultOrchestratorHandlers(
    orchestrator,
    fromId,
    toId
  );
  const mergedHandlers = { ...defaultHandlers, ...handlers };

  // Register orchestrator service on IPC channel
  serviceHost.registerService('orchestrator', {
    channel: ipcChannel,
    serviceHost,
    handlers: mergedHandlers,
  });

  // Setup custom participants
  if (setupParticipants) {
    await setupParticipants(orchestrator);
  }

  const result: MainOrchestratorSetupResult = {
    orchestrator,
    ipcChannel,
    mainDirectChannel,
    serviceHost,
  };

  onReady?.(result);
  return result;
}

/**
 * Create a participant channel adapter for main process
 * This allows main process to participate in orchestrator connections
 */
function createMainParticipantChannel(
  directChannel: ElectronMessagePortMainChannel
): any {
  return {
    makeRequest(requestPath: string, methodName: string, port: any) {
      if (methodName === 'activateConnection' && port) {
        directChannel.bindPort(port);
      }
      return { promise: Promise.resolve(), seqId: 0 };
    },
    send: () => {},
    on: () => () => {},
    activate: () => {},
    disconnect: () => {},
    onDidConnected: () => {},
    onDidDisconnected: () => {},
    ensureListenerAttached: () => {},
  } as any;
}

/**
 * Create default orchestrator event handlers
 * These handlers provide standard orchestrator functionality
 */
function createDefaultOrchestratorHandlers(
  orchestrator: ElectronConnectionOrchestrator,
  fromId: string,
  toId?: string
): Record<string, (...args: any[]) => any> {
  return {
    async connect(): Promise<any> {
      try {
        const info = await orchestrator.connect(fromId, toId!);
        return {
          connectionId: info.connectionId,
          fromId: info.fromId,
          toId: info.toId,
          state: info.state,
          lastStateChangedAt: info.lastStateChangedAt,
          error: info.error?.message,
        };
      } catch (err: any) {
        return { error: err.message };
      }
    },

    async disconnect(): Promise<void> {
      const info = orchestrator.getConnectionInfo(fromId, toId!);
      if (info) {
        await orchestrator.disconnect(info.connectionId);
      }
    },

    simulateLost(participantId: string, reason?: string): void {
      orchestrator.handleParticipantLost(
        participantId,
        reason || 'simulated participant lost'
      );
    },

    async getStatus(): Promise<any> {
      const info = orchestrator.getConnectionInfo(fromId, toId!);
      if (!info) return null;

      const stats = orchestrator.getConnectionStats(info.connectionId);
      return {
        connectionId: info.connectionId,
        fromId: info.fromId,
        toId: info.toId,
        state: info.state,
        lastStateChangedAt: info.lastStateChangedAt,
        error: info.error?.message,
        isReady: info.isReady,
        stats: stats
          ? {
              totalRpcCalls: stats.totalRpcCalls,
              successfulCalls: stats.successfulCalls,
              failedCalls: stats.failedCalls,
              avgLatencyMs: stats.avgLatencyMs,
              totalReconnects: stats.totalReconnects,
            }
          : null,
      };
    },

    onStateChange(remoteCallback: (event: any) => void) {
      orchestrator.onStateChange((event) => remoteCallback(event));
    },

    onReady(remoteCallback: (event: any) => void) {
      orchestrator.onReady((event) => remoteCallback(event));
    },

    onDisconnected(remoteCallback: (event: any) => void) {
      orchestrator.onDisconnected((event) => remoteCallback(event));
    },

    onReconnecting(remoteCallback: (event: any) => void) {
      orchestrator.onReconnecting((event) => remoteCallback(event));
    },

    onReconnected(remoteCallback: (event: any) => void) {
      orchestrator.onReconnected((event) => remoteCallback(event));
    },

    onReconnectFailed(remoteCallback: (event: any) => void) {
      orchestrator.onReconnectFailed((event) => remoteCallback(event));
    },

    onClosed(remoteCallback: (event: any) => void) {
      orchestrator.onClosed((event) => remoteCallback(event));
    },
  };
}
