import { ElectronConnectionOrchestrator } from './ElectronConnectionOrchestrator.js';
import ElectronMessagePortMainChannel from './ElectronMessagePortMainChannel.js';
import IPCMainChannel from './IPCMainChannel.js';
import {
  serviceHost,
  AbstractChannelProtocol,
} from '@x-oasis/async-call-rpc/core';
import type {
  ConnectionInfo,
  StateChangeEvent,
  ReadyEvent,
  DisconnectedEvent,
  ReconnectingEvent,
  ReconnectedEvent,
  ReconnectFailedEvent,
  ClosedEvent,
} from '@x-oasis/async-call-rpc/orchestrator';
import { MessagePortMain } from '../types';

export interface MainOrchestratorSetupOptions {
  /** Main window's IPC channel */
  ipcChannel: IPCMainChannel;

  /** Participant IDs for the default connection handlers */
  fromId?: string;
  toId?: string;

  /**
   * Whether to register main process as a participant.
   * Set to false when main is only an orchestrator (not an endpoint),
   * e.g. utility-a ↔ utility-b via orchestrator.
   * Defaults to true.
   */
  registerMain?: boolean;

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
  handlers?: Record<string, (...args: unknown[]) => unknown>;

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
  mainDirectChannel: ElectronMessagePortMainChannel | null;
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
    registerMain = true,
    orchestratorConfig,
    handlers,
    setupParticipants,
    onReady,
  } = options;

  // Initialize orchestrator
  const orchestrator = new ElectronConnectionOrchestrator({
    logger:
      orchestratorConfig?.logger ||
      ((level, msg) => console.log(`[orchestrator:${level}] ${msg}`)),
    enableStats: orchestratorConfig?.enableStats ?? true,
    heartbeat: orchestratorConfig?.heartbeat,
  });

  // Optionally register main as a participant
  let mainDirectChannel: ElectronMessagePortMainChannel | null = null;
  if (registerMain) {
    mainDirectChannel = new ElectronMessagePortMainChannel({
      description: orchestratorConfig?.heartbeat
        ? 'main↔{target} direct port (with heartbeat)'
        : 'main↔{target} direct port',
    });
    const mainParticipantChannel =
      createMainParticipantChannel(mainDirectChannel);
    orchestrator.registerParticipant(
      'main',
      mainParticipantChannel as unknown as AbstractChannelProtocol,
      'process'
    );
  }

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
interface MainParticipantChannel {
  makeRequest(
    requestPath: string,
    methodName: string,
    port?: MessagePortMain
  ): { promise: Promise<void>; seqId: number };
  send(): void;
  on(): () => void;
  activate(): void;
  disconnect(): void;
  onDidConnected(): void;
  onDidDisconnected(): void;
  ensureListenerAttached(): void;
}

function createMainParticipantChannel(
  directChannel: ElectronMessagePortMainChannel
): MainParticipantChannel {
  return {
    makeRequest(
      _requestPath: string,
      methodName: string,
      port?: MessagePortMain
    ) {
      if (methodName === 'activateConnection' && port) {
        directChannel.bindPort(port, { rebind: true });
      }
      return { promise: Promise.resolve(), seqId: 0 };
    },
    send() {},
    on() {
      return () => {};
    },
    activate() {},
    disconnect() {},
    onDidConnected() {},
    onDidDisconnected() {},
    ensureListenerAttached() {},
  };
}

/**
 * Create default orchestrator event handlers
 * These handlers provide standard orchestrator functionality
 */
interface ConnectResult {
  connectionId?: string;
  fromId?: string;
  toId?: string;
  state?: string;
  lastStateChangedAt?: number;
  error?: string;
}

interface GetStatusResult {
  connectionId: string;
  fromId: string;
  toId: string;
  state: string;
  lastStateChangedAt: number;
  error?: string;
  isReady: boolean;
  stats: {
    totalRpcCalls: number;
    successfulCalls: number;
    failedCalls: number;
    avgLatencyMs: number;
    totalReconnects: number;
  } | null;
}

function createDefaultOrchestratorHandlers(
  orchestrator: ElectronConnectionOrchestrator,
  fromId: string,
  toId?: string
): Record<string, (...args: unknown[]) => unknown> {
  return {
    async connect(): Promise<ConnectResult> {
      try {
        const info: ConnectionInfo = await orchestrator.connect(fromId, toId!);
        return {
          connectionId: info.connectionId,
          fromId: info.fromId,
          toId: info.toId,
          state: info.state,
          lastStateChangedAt: info.lastStateChangedAt,
          error: info.error?.message,
        };
      } catch (err: unknown) {
        return { error: (err as Error).message };
      }
    },

    async disconnect(): Promise<void> {
      const info = orchestrator.getConnectionInfo(fromId, toId!);
      if (info) {
        await orchestrator.disconnect(info.connectionId);
      }
    },

    simulateLost(): void {
      orchestrator.handleParticipantLost(
        toId || 'renderer',
        'simulated participant lost'
      );
    },

    async getStatus(): Promise<GetStatusResult | null> {
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

    onStateChange(remoteCallback: (event: StateChangeEvent) => void) {
      orchestrator.onStateChange((event: StateChangeEvent) =>
        remoteCallback(event)
      );
    },

    onReady(remoteCallback: (event: ReadyEvent) => void) {
      orchestrator.onReady((event: ReadyEvent) => remoteCallback(event));
    },

    onDisconnected(remoteCallback: (event: DisconnectedEvent) => void) {
      orchestrator.onDisconnected((event: DisconnectedEvent) =>
        remoteCallback(event)
      );
    },

    onReconnecting(remoteCallback: (event: ReconnectingEvent) => void) {
      orchestrator.onReconnecting((event: ReconnectingEvent) =>
        remoteCallback(event)
      );
    },

    onReconnected(remoteCallback: (event: ReconnectedEvent) => void) {
      orchestrator.onReconnected((event: ReconnectedEvent) =>
        remoteCallback(event)
      );
    },

    onReconnectFailed(remoteCallback: (event: ReconnectFailedEvent) => void) {
      orchestrator.onReconnectFailed((event: ReconnectFailedEvent) =>
        remoteCallback(event)
      );
    },

    onClosed(remoteCallback: (event: ClosedEvent) => void) {
      orchestrator.onClosed((event: ClosedEvent) => remoteCallback(event));
    },
  };
}
