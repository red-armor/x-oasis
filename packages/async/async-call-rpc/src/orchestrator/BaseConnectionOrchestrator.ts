import { Disposable } from '@x-oasis/disposable';
import { Event } from '@x-oasis/emitter';
import { Deferred, createDeferred } from '@x-oasis/deferred';

import { ConnectionState, isValidTransition } from './ConnectionState';
import { CircuitBreaker } from './CircuitBreaker';
import { ConnectionStatsTracker } from './ConnectionStatsTracker';
import { ExponentialBackoffPolicy } from './policies/ExponentialBackoffPolicy';
import {
  ParticipantInfo,
  ParticipantType,
  ConnectionConfig,
  ConnectOptions,
  ConnectionInfo,
  ConnectionOrchestratorConfig,
  ConnectionStats,
  PortPair,
  ActivationConfig,
  HeartbeatConfig,
  RetryContext,
  StateChangeEvent,
  ReplaceChannelOptions,
  ListParticipantEntry,
  ListConnectionEntry,
  OrchestratorEvent,
} from './types';
import AbstractChannelProtocol from '../protocol/AbstractChannelProtocol';

// ─── Internal managed-connection record ──────────────────────────────────────

interface ManagedConnection {
  readonly connectionId: string;
  readonly fromId: string;
  readonly toId: string;
  state: ConnectionState;
  lastStateChangedAt: number;
  error?: Error;

  portPair?: PortPair;

  heartbeatTimer?: ReturnType<typeof setInterval>;
  reconnectTimer?: ReturnType<typeof setTimeout>;

  circuitBreaker?: CircuitBreaker;
  statsTracker?: ConnectionStatsTracker;

  /** Pending waitForStateChange observers. */
  stateWaiters: Array<{
    currentState: ConnectionState;
    deferred: Deferred<ConnectionState>;
  }>;

  // Reconnect state
  reconnectAttempt: number;
  firstFailedAt?: number;

  /**
   * Last ConnectionConfig used to establish this connection.
   * Preserved across reconnects so that fromServices/toServices are not lost.
   */
  lastConfig?: ConnectionConfig;
}

// ─── TimeoutError ─────────────────────────────────────────────────────────────

export class TimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TimeoutError';
  }
}

// ─── BaseConnectionOrchestrator ──────────────────────────────────────────────

/**
 * Abstract base class for Connection Orchestrators.
 *
 * Subclasses must implement exactly two methods:
 * - `createPortPair()` — platform-specific port/channel creation
 * - `activateParticipant(info, config)` — send the port to the participant via RPC
 *
 * Everything else (state machine, heartbeat, reconnect scheduling, circuit
 * breaker, stats) is handled here.
 */
export abstract class BaseConnectionOrchestrator extends Disposable {
  // ── Registries ──────────────────────────────────────────────────────────────

  protected readonly participants = new Map<string, ParticipantInfo>();
  protected readonly connections = new Map<string, ManagedConnection>();

  /**
   * Per-participant cleanup hooks for the auto-wired `onDidDisconnected`
   * subscription installed by `registerParticipant()`. Calling the function
   * removes the subscription so we don't leak event listeners or trigger
   * `handleParticipantLost` on stale participant ids after re-registration.
   */
  private readonly _participantDisconnectCleanups = new Map<
    string,
    () => void
  >();

  /**
   * Default first-attempt activation timeout (ms). Telegraph D-006 §2 Gap 2.
   * 30s is generous enough for cold utility/process boot and tight enough that
   * production failures fail fast rather than hang.
   */
  protected readonly DEFAULT_ACTIVATE_TIMEOUT_MS = 30_000;

  // ── Config ──────────────────────────────────────────────────────────────────

  protected readonly config: ConnectionOrchestratorConfig;

  private readonly defaultHeartbeat: HeartbeatConfig = {
    enabled: false,
    intervalMs: 30_000,
    timeoutMs: 5_000,
  };

  // ── Events ──────────────────────────────────────────────────────────────────

  private readonly _onStateChangeEvent = new Event({
    name: 'orchestrator:stateChange',
  });
  readonly onStateChange = this._onStateChangeEvent.subscribe.bind(
    this._onStateChangeEvent
  );

  private readonly _onReadyEvent = new Event({
    name: 'orchestrator:ready',
  });
  readonly onReady = this._onReadyEvent.subscribe.bind(this._onReadyEvent);

  private readonly _onDisconnectedEvent = new Event({
    name: 'orchestrator:disconnected',
  });
  readonly onDisconnected = this._onDisconnectedEvent.subscribe.bind(
    this._onDisconnectedEvent
  );

  private readonly _onReconnectingEvent = new Event({
    name: 'orchestrator:reconnecting',
  });
  readonly onReconnecting = this._onReconnectingEvent.subscribe.bind(
    this._onReconnectingEvent
  );

  private readonly _onReconnectedEvent = new Event({
    name: 'orchestrator:reconnected',
  });
  readonly onReconnected = this._onReconnectedEvent.subscribe.bind(
    this._onReconnectedEvent
  );

  private readonly _onReconnectFailedEvent = new Event({
    name: 'orchestrator:reconnectFailed',
  });
  readonly onReconnectFailed = this._onReconnectFailedEvent.subscribe.bind(
    this._onReconnectFailedEvent
  );

  private readonly _onClosedEvent = new Event({
    name: 'orchestrator:closed',
  });
  readonly onClosed = this._onClosedEvent.subscribe.bind(this._onClosedEvent);

  // ─────────────────────────────────────────────────────────────────────────────

  constructor(config: ConnectionOrchestratorConfig = {}) {
    super();
    this.config = config;
  }

  // ── Abstract platform interface ───────────────────────────────────────────

  /**
   * Create an entangled port pair for direct participant-to-participant
   * communication.
   *
   * - Electron: `new MessageChannelMain()`
   * - Node / Web: `new MessageChannel()`
   */
  protected abstract createPortPair(): PortPair;

  /**
   * Send a port (and associated configuration) to a registered participant
   * via an existing RPC channel.
   *
   * Implementations must call the participant's `activateConnection` handler
   * over the participant's channel.
   */
  protected abstract activateParticipant(
    info: ParticipantInfo,
    config: ActivationConfig
  ): Promise<void>;

  // ── Public API ────────────────────────────────────────────────────────────

  /**
   * Register a participant (renderer, utility, worker, process) along with
   * the channel through which the orchestrator can reach it.
   */
  registerParticipant(
    id: string,
    channel: AbstractChannelProtocol,
    type: ParticipantType = 'process'
  ): void {
    // Ensure the channel's message listener is attached so that responses
    // to orchestrator RPC calls (e.g. activateConnection) are processed.
    // Without this, makeRequest() creates a Deferred but the channel never
    // routes the incoming response to handleResponse, causing connect() to
    // hang in the CONNECTING state indefinitely.
    channel.ensureListenerAttached();

    // If a participant with the same id was previously registered, tear down
    // its disconnect subscription so we don't leak listeners or fire
    // handleParticipantLost on a stale id later.
    const previousCleanup = this._participantDisconnectCleanups.get(id);
    if (previousCleanup) {
      previousCleanup();
      this._participantDisconnectCleanups.delete(id);
    }

    this.participants.set(id, {
      id,
      channel,
      type,
      registeredAt: Date.now(),
    });

    // Telegraph D-006 §2 Gap 3 — auto-wire channel teardown to participant
    // loss. Previously every caller had to subscribe to the underlying
    // transport's close/error events and manually call handleParticipantLost,
    // which is easy to forget; without it the orchestrator considers the
    // participant alive forever and reconnect never fires.
    //
    // `AbstractChannelProtocol.disconnect()` is the single funnel that
    // every transport (IPCMainChannel webContents 'destroyed',
    // ElectronUtilityProcessChannel utility 'exit', explicit caller
    // disconnect) goes through, so subscribing to `onDidDisconnected` here
    // covers all of them.
    const subscription = channel.onDidDisconnected(() => {
      // Only fire if this participant is still the one registered under this
      // id — guards against late-firing events after re-registration.
      if (this.participants.get(id)?.channel === channel) {
        this.handleParticipantLost(id, 'channel disconnected');
      }
    });
    // x-oasis `Event.subscribe` returns an `IDisposable` (see
    // packages/event/emitter Event.ts → toDisposable). Normalize to a plain
    // cleanup callback so unregisterParticipant doesn't have to know.
    this._participantDisconnectCleanups.set(id, () => subscription.dispose());

    this._log('debug', `registerParticipant: ${id} (${type})`);
  }

  /** Remove a participant.  Does not close existing connections. */
  unregisterParticipant(id: string): void {
    const cleanup = this._participantDisconnectCleanups.get(id);
    if (cleanup) {
      cleanup();
      this._participantDisconnectCleanups.delete(id);
    }
    this.participants.delete(id);
    this._log('debug', `unregisterParticipant: ${id}`);
  }

  /**
   * Replace the channel for an existing participant without losing its
   * connection history, stats, or subscriptions.
   *
   * All connections involving this participant that are in READY or
   * TRANSIENT_FAILURE will be transitioned to TRANSIENT_FAILURE and
   * reconnect will be scheduled (unless `autoReconnect: false`).
   *
   * Typical use-case: a utility process was killed and respawned with a new
   * pid / MessagePortMain; you want the orchestrator to re-establish
   * connections automatically.
   */
  replaceParticipantChannel(
    id: string,
    channel: AbstractChannelProtocol,
    options: ReplaceChannelOptions = {}
  ): void {
    const existing = this.participants.get(id);
    if (!existing) {
      throw new Error(
        `[Orchestrator] Cannot replace channel for unknown participant: "${id}". ` +
          `Call registerParticipant() first.`
      );
    }

    const { autoReconnect = true } = options;

    channel.ensureListenerAttached();

    const previousCleanup = this._participantDisconnectCleanups.get(id);
    if (previousCleanup) {
      previousCleanup();
      this._participantDisconnectCleanups.delete(id);
    }

    this.participants.set(id, {
      id,
      channel,
      type: existing.type,
      registeredAt: existing.registeredAt,
    });

    const subscription = channel.onDidDisconnected(() => {
      if (this.participants.get(id)?.channel === channel) {
        this.handleParticipantLost(id, 'channel disconnected');
      }
    });
    this._participantDisconnectCleanups.set(id, () => subscription.dispose());

    this._log('info', `replaceParticipantChannel: ${id}`);

    if (autoReconnect) {
      for (const mc of this.connections.values()) {
        if (mc.fromId === id || mc.toId === id) {
          if (
            mc.state === ConnectionState.READY ||
            mc.state === ConnectionState.TRANSIENT_FAILURE
          ) {
            this._handleConnectionLost(
              mc,
              new Error(`participant "${id}" channel replaced`)
            );
          } else if (mc.state === ConnectionState.CONNECTING) {
            this._transitionState(
              mc,
              ConnectionState.TRANSIENT_FAILURE,
              `participant "${id}" channel replaced during CONNECTING`
            );
            this._scheduleReconnect(
              mc,
              new Error(`participant "${id}" channel replaced`)
            );
          }
        }
      }
    }
  }

  /**
   * List all registered participants with their metadata.
   */
  listParticipants(): ListParticipantEntry[] {
    const result: ListParticipantEntry[] = [];
    for (const info of this.participants.values()) {
      result.push({
        id: info.id,
        type: info.type,
        registeredAt: info.registeredAt,
      });
    }
    return result;
  }

  /**
   * List all managed connections with their current state and optional stats.
   */
  listConnections(): ListConnectionEntry[] {
    const result: ListConnectionEntry[] = [];
    for (const mc of this.connections.values()) {
      result.push({
        connectionId: mc.connectionId,
        fromId: mc.fromId,
        toId: mc.toId,
        state: mc.state,
        stats: mc.statsTracker?.snapshot(mc.state),
      });
    }
    return result;
  }

  /**
   * Create an event forwarder that subscribes to all orchestrator events and
   * pipes them into a single sink callback. Returns a Disposable that cleans
   * up all subscriptions when disposed.
   */
  createEventForwarder(sink: (event: OrchestratorEvent) => void): {
    dispose: () => void;
  } {
    const subscriptions: Array<{ dispose: () => void }> = [];

    const wire = <T>(
      eventSource: {
        subscribe: (cb: (e: T) => void) => { dispose: () => void };
      },
      type: string
    ) => {
      const sub = eventSource.subscribe((payload) => {
        sink({ type, payload });
      });
      subscriptions.push(sub);
    };

    wire(this._onStateChangeEvent, 'stateChange');
    wire(this._onReadyEvent, 'ready');
    wire(this._onDisconnectedEvent, 'disconnected');
    wire(this._onReconnectingEvent, 'reconnecting');
    wire(this._onReconnectedEvent, 'reconnected');
    wire(this._onReconnectFailedEvent, 'reconnectFailed');
    wire(this._onClosedEvent, 'closed');

    return {
      dispose: () => {
        for (const sub of subscriptions) {
          sub.dispose();
        }
        subscriptions.length = 0;
      },
    };
  }

  /**
   * Establish a direct connection between two registered participants.
   *
   * Flow:
   * 1. IDLE → CONNECTING
   * 2. `createPortPair()`
   * 3. `activateParticipant(from, port1)` and `activateParticipant(to, port2)` in parallel
   * 4. CONNECTING → READY (success) or IDLE (first-attempt failure)
   *
   * The third argument is overloaded for backwards compatibility:
   *   - `connect(a, b, config)` — long-lived `ConnectionConfig` (heartbeat,
   *     services, reconnect policy)
   *   - `connect(a, b, options)` — first-attempt `ConnectOptions`
   *     (`activateTimeoutMs` etc.)
   *   - `connect(a, b, config, options)` — both
   *
   * Telegraph D-006 §2 Gap 2: without an `activateTimeoutMs`, a slow
   * participant that never acks `activateConnection` would leave `connect()`
   * pending forever. Default 30s.
   *
   * Returns a live `ConnectionInfo` handle.
   */
  async connect(
    fromId: string,
    toId: string,
    configOrOptions: ConnectionConfig | ConnectOptions = {},
    maybeOptions?: ConnectOptions
  ): Promise<ConnectionInfo> {
    if (!this.participants.has(fromId)) {
      throw new Error(
        `[Orchestrator] Unknown participant: "${fromId}". Did you forget to call registerParticipant()?`
      );
    }
    if (!this.participants.has(toId)) {
      throw new Error(
        `[Orchestrator] Unknown participant: "${toId}". Did you forget to call registerParticipant()?`
      );
    }

    // Disambiguate the overload: `ConnectOptions` only has `activateTimeoutMs`
    // today; `ConnectionConfig` carries `fromServices/toServices/heartbeat/
    // reconnectPolicy`. If the caller passed `activateTimeoutMs` and none of
    // the ConnectionConfig keys, treat the third arg as ConnectOptions.
    let config: ConnectionConfig;
    let options: ConnectOptions;
    if (maybeOptions !== undefined) {
      config = configOrOptions as ConnectionConfig;
      options = maybeOptions;
    } else if (
      configOrOptions &&
      ('activateTimeoutMs' in configOrOptions ||
        'retryOnInitialFailure' in configOrOptions) &&
      !('fromServices' in configOrOptions) &&
      !('toServices' in configOrOptions) &&
      !('heartbeat' in configOrOptions) &&
      !('reconnectPolicy' in configOrOptions)
    ) {
      config = {};
      options = configOrOptions as ConnectOptions;
    } else {
      config = (configOrOptions as ConnectionConfig) ?? {};
      options = {};
    }

    const connectionId = this._canonicalConnectionId(fromId, toId);

    // If there is already a managed connection in a live state, return its
    // info (idempotent). IDLE connections are re-entrant so that retry
    // attempts (including retryOnInitialFailure) can re-execute connect().
    const existing = this.connections.get(connectionId);
    if (
      existing &&
      existing.state !== ConnectionState.CLOSED &&
      existing.state !== ConnectionState.IDLE
    ) {
      return this._buildConnectionInfo(existing);
    }

    // Create or re-use the managed connection record.
    const mc: ManagedConnection = existing ?? {
      connectionId,
      fromId,
      toId,
      state: ConnectionState.IDLE,
      lastStateChangedAt: Date.now(),
      stateWaiters: [],
      reconnectAttempt: 0,
    };

    // Optionally attach circuit breaker and stats.
    if (this.config.circuitBreaker?.enabled && !mc.circuitBreaker) {
      mc.circuitBreaker = new CircuitBreaker(this.config.circuitBreaker);
    }
    if (this.config.enableStats && !mc.statsTracker) {
      mc.statsTracker = new ConnectionStatsTracker(connectionId);
    }

    this.connections.set(connectionId, mc);

    // Preserve config for reconnects so that fromServices/toServices survive.
    mc.lastConfig = config;

    // Execute the first-attempt connect flow.
    // If retryOnInitialFailure is true, treat first-attempt failure like a
    // connection loss and schedule reconnect instead of throwing.
    try {
      await this._doConnect(mc, config, options);
    } catch (err) {
      if (options.retryOnInitialFailure) {
        this._handleConnectionLost(
          mc,
          err instanceof Error ? err : new Error(String(err))
        );
      } else {
        throw err;
      }
    }

    return this._buildConnectionInfo(mc);
  }

  /**
   * Gracefully disconnect and move to CLOSED.
   * Cancels any pending reconnect timer, stops heartbeat.
   */
  async disconnect(connectionId: string): Promise<void> {
    const mc = this.connections.get(connectionId);
    if (!mc) return;

    this._cancelReconnect(mc);
    this._stopHeartbeat(mc);

    if (
      mc.state === ConnectionState.READY ||
      mc.state === ConnectionState.TRANSIENT_FAILURE ||
      mc.state === ConnectionState.CONNECTING
    ) {
      this._transitionState(
        mc,
        ConnectionState.DISCONNECTING,
        'user requested disconnect'
      );
    }

    this._transitionState(mc, ConnectionState.CLOSED, 'disconnected by user');

    this._onClosedEvent.fire({ connectionId, reason: 'disconnected by user' });
    this._log('info', `disconnect: ${connectionId}`);
  }

  /** Get the live connection info for a given pair. */
  getConnectionInfo(fromId: string, toId?: string): ConnectionInfo | undefined {
    const connectionId = toId
      ? this._canonicalConnectionId(fromId, toId)
      : fromId;
    const mc = this.connections.get(connectionId);
    if (!mc) return undefined;
    return this._buildConnectionInfo(mc);
  }

  /** Get stats for a connection. Returns undefined if stats are disabled. */
  getConnectionStats(connectionId: string): ConnectionStats | undefined {
    const mc = this.connections.get(connectionId);
    if (!mc?.statsTracker) return undefined;
    return mc.statsTracker.snapshot(mc.state);
  }

  /**
   * Notify the orchestrator that a participant became unavailable.
   * Transitions all of its connections (READY, CONNECTING, or TRANSIENT_FAILURE)
   * to TRANSIENT_FAILURE and schedules reconnect.
   */
  handleParticipantLost(participantId: string, reason: string): void {
    for (const mc of this.connections.values()) {
      if (mc.fromId === participantId || mc.toId === participantId) {
        if (mc.state === ConnectionState.READY) {
          this._handleConnectionLost(mc, new Error(reason));
        } else if (mc.state === ConnectionState.CONNECTING) {
          this._transitionState(mc, ConnectionState.TRANSIENT_FAILURE, reason);
          this._scheduleReconnect(mc, new Error(reason));
        } else if (mc.state === ConnectionState.TRANSIENT_FAILURE) {
          this._scheduleReconnect(mc, new Error(reason));
        }
      }
    }
  }

  /** Dispose all managed connections and clean up timers. */
  dispose(): void {
    for (const mc of this.connections.values()) {
      this._cancelReconnect(mc);
      this._stopHeartbeat(mc);
      // Reject any pending state waiters.
      for (const w of mc.stateWaiters) {
        w.deferred.reject(new Error('Orchestrator disposed'));
      }
      mc.stateWaiters = [];
    }
    this.connections.clear();
    this.participants.clear();

    this._onStateChangeEvent.dispose();
    this._onReadyEvent.dispose();
    this._onDisconnectedEvent.dispose();
    this._onReconnectingEvent.dispose();
    this._onReconnectedEvent.dispose();
    this._onReconnectFailedEvent.dispose();
    this._onClosedEvent.dispose();

    super.dispose();
  }

  // ── Internal: connection flow ─────────────────────────────────────────────

  private _canonicalConnectionId(a: string, b: string): string {
    return a < b ? `${a}--${b}` : `${b}--${a}`;
  }

  private async _doConnect(
    mc: ManagedConnection,
    config: ConnectionConfig,
    options: ConnectOptions = {}
  ): Promise<void> {
    const { connectionId, fromId, toId } = mc;

    this._transitionState(mc, ConnectionState.CONNECTING);

    let portPair: PortPair;
    try {
      portPair = this.createPortPair();
      mc.portPair = portPair;
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      this._log('error', `createPortPair failed for ${connectionId}`, error);
      this._transitionState(mc, ConnectionState.IDLE, error.message);
      throw error;
    }

    const fromInfo = this.participants.get(fromId)!;
    const toInfo = this.participants.get(toId)!;

    const fromActivation: ActivationConfig = {
      connectionId,
      port: portPair.port1,
      role: 'initiator',
      myServices: config.fromServices,
      peerServices: config.toServices,
    };
    const toActivation: ActivationConfig = {
      connectionId,
      port: portPair.port2,
      role: 'receiver',
      myServices: config.toServices,
      peerServices: config.fromServices,
    };

    // Telegraph D-006 §2 Gap 2 — bound the activation handshake. Without
    // this, a participant that never acks `activateConnection` (e.g. a
    // utility process stuck in cold start) leaves connect() pending forever.
    const activateTimeoutMs =
      options.activateTimeoutMs ?? this.DEFAULT_ACTIVATE_TIMEOUT_MS;

    try {
      await this._withActivationTimeout(
        Promise.all([
          this.activateParticipant(fromInfo, fromActivation),
          this.activateParticipant(toInfo, toActivation),
        ]),
        activateTimeoutMs,
        connectionId
      );
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      this._log(
        'error',
        `activateParticipant failed for ${connectionId}`,
        error
      );
      mc.error = error;
      this._transitionState(mc, ConnectionState.IDLE, error.message);
      throw error;
    }

    this._transitionState(mc, ConnectionState.READY);

    // Start heartbeat if configured.
    const hbConfig =
      config.heartbeat ?? this.config.heartbeat ?? this.defaultHeartbeat;
    if (hbConfig.enabled) {
      this._startHeartbeat(mc, hbConfig);
    }

    this._onReadyEvent.fire({ connectionId });
    this._log('info', `connect: ${connectionId} → READY`);
  }

  /**
   * Race a promise against a timeout. The timeout reject path produces a
   * `TimeoutError` so callers can catch with `instanceof TimeoutError` and
   * distinguish from real activation failures.
   *
   * The timer is unref'd via clearTimeout on settle to avoid keeping the
   * Node event loop alive past test/process shutdown.
   */
  private _withActivationTimeout<T>(
    promise: Promise<T>,
    timeoutMs: number,
    connectionId: string
  ): Promise<T> {
    if (timeoutMs <= 0) return promise;
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(
          new TimeoutError(
            `connect(${connectionId}) timed out: activateParticipant did not resolve within ${timeoutMs}ms`
          )
        );
      }, timeoutMs);
      promise.then(
        (value) => {
          clearTimeout(timer);
          resolve(value);
        },
        (err) => {
          clearTimeout(timer);
          reject(err);
        }
      );
    });
  }

  // ── Internal: reconnection ────────────────────────────────────────────────

  private _handleConnectionLost(mc: ManagedConnection, error?: Error): void {
    this._stopHeartbeat(mc);
    mc.error = error;

    if (mc.state === ConnectionState.CLOSED) return;
    if (mc.state === ConnectionState.DISCONNECTING) return;

    // If we were in IDLE (first-attempt failed with retryOnInitialFailure),
    // transition to TRANSIENT_FAILURE directly so reconnect can be scheduled.
    if (mc.state === ConnectionState.IDLE) {
      this._transitionState(
        mc,
        ConnectionState.TRANSIENT_FAILURE,
        error?.message
      );
      mc.statsTracker?.recordDisconnect();
      this._scheduleReconnect(mc, error);
      return;
    }

    if (
      mc.state !== ConnectionState.READY &&
      mc.state !== ConnectionState.CONNECTING
    )
      return;

    const prevState = mc.state;

    this._transitionState(
      mc,
      ConnectionState.TRANSIENT_FAILURE,
      error?.message
    );
    mc.statsTracker?.recordDisconnect();

    if (prevState === ConnectionState.READY) {
      this._onDisconnectedEvent.fire({
        connectionId: mc.connectionId,
        error,
      });
    }

    this._scheduleReconnect(mc, error);
  }

  private _scheduleReconnect(
    mc: ManagedConnection,
    reason?: Error | string
  ): void {
    const policy =
      this.config.reconnectPolicy ?? new ExponentialBackoffPolicy();

    if (!mc.firstFailedAt) mc.firstFailedAt = Date.now();

    const context: RetryContext = {
      previousRetryCount: mc.reconnectAttempt,
      elapsedMs: Date.now() - mc.firstFailedAt,
      retryReason: reason ?? 'connection lost',
      connectionId: mc.connectionId,
      fromId: mc.fromId,
      toId: mc.toId,
    };

    const delay = policy.nextRetryDelayMs(context);

    if (delay === null) {
      this._log(
        'warn',
        `reconnect policy gave up for ${mc.connectionId} after ${mc.reconnectAttempt} attempts`
      );
      this._transitionState(
        mc,
        ConnectionState.DISCONNECTING,
        'reconnect policy gave up'
      );
      this._transitionState(
        mc,
        ConnectionState.CLOSED,
        'reconnect policy gave up'
      );
      this._onReconnectFailedEvent.fire({
        connectionId: mc.connectionId,
        totalAttempts: mc.reconnectAttempt,
        elapsedMs: Date.now() - (mc.firstFailedAt ?? Date.now()),
        lastError: mc.error,
      });
      this._onClosedEvent.fire({
        connectionId: mc.connectionId,
        reason: 'reconnect failed',
      });
      return;
    }

    this._log(
      'debug',
      `scheduleReconnect: ${mc.connectionId} attempt ${
        mc.reconnectAttempt + 1
      } in ${Math.round(delay)}ms`
    );

    // Apply PendingRequestBehavior.duringReconnect: if 'reject', reject any
    // in-flight requests on both participant channels. We don't call
    // channel.disconnect() here because that would trigger onDidDisconnected
    // → handleParticipantLost → infinite loop.
    const pendingBehavior = this.config.pendingRequests;
    if (pendingBehavior?.duringReconnect === 'reject') {
      const fromInfo = this.participants.get(mc.fromId);
      const toInfo = this.participants.get(mc.toId);
      for (const info of [fromInfo, toInfo]) {
        if (info) {
          for (const [, deferred] of info.channel.ongoingRequests) {
            try {
              deferred.reject(new Error('connection lost, during reconnect'));
            } catch {
              // Deferred may already be settled
            }
          }
          info.channel.ongoingRequests.clear();
        }
      }
    }

    this._onReconnectingEvent.fire({
      connectionId: mc.connectionId,
      attempt: mc.reconnectAttempt + 1,
      delay,
      elapsedMs: Date.now() - (mc.firstFailedAt ?? Date.now()),
    });

    mc.reconnectTimer = setTimeout(async () => {
      await this._attemptReconnect(mc);
    }, delay);
  }

  private _cancelReconnect(mc: ManagedConnection): void {
    if (mc.reconnectTimer != null) {
      clearTimeout(mc.reconnectTimer);
      mc.reconnectTimer = undefined;
    }
  }

  private async _attemptReconnect(mc: ManagedConnection): Promise<void> {
    if (mc.state !== ConnectionState.TRANSIENT_FAILURE) return;

    mc.reconnectAttempt++;
    this._transitionState(mc, ConnectionState.CONNECTING, 're-connecting');

    let portPair: PortPair;
    try {
      portPair = this.createPortPair();
      mc.portPair = portPair;
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      mc.error = error;
      this._transitionState(
        mc,
        ConnectionState.TRANSIENT_FAILURE,
        error.message
      );
      this._scheduleReconnect(mc, error);
      return;
    }

    const fromInfo = this.participants.get(mc.fromId);
    const toInfo = this.participants.get(mc.toId);

    if (!fromInfo || !toInfo) {
      this._transitionState(
        mc,
        ConnectionState.DISCONNECTING,
        'participant gone'
      );
      this._transitionState(mc, ConnectionState.CLOSED, 'participant gone');
      return;
    }

    const savedConfig = mc.lastConfig ?? {};

    const fromActivation: ActivationConfig = {
      connectionId: mc.connectionId,
      port: portPair.port1,
      role: 'initiator',
      myServices: savedConfig.fromServices,
      peerServices: savedConfig.toServices,
    };
    const toActivation: ActivationConfig = {
      connectionId: mc.connectionId,
      port: portPair.port2,
      role: 'receiver',
      myServices: savedConfig.toServices,
      peerServices: savedConfig.fromServices,
    };

    const activateTimeoutMs = this.DEFAULT_ACTIVATE_TIMEOUT_MS;

    try {
      await this._withActivationTimeout(
        Promise.all([
          this.activateParticipant(fromInfo, fromActivation),
          this.activateParticipant(toInfo, toActivation),
        ]),
        activateTimeoutMs,
        mc.connectionId
      );
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      mc.error = error;
      this._transitionState(
        mc,
        ConnectionState.TRANSIENT_FAILURE,
        error.message
      );
      this._scheduleReconnect(mc, error);
      return;
    }

    mc.error = undefined;
    mc.circuitBreaker?.reset();
    mc.statsTracker?.recordReconnect();
    const attempt = mc.reconnectAttempt;
    mc.reconnectAttempt = 0;
    mc.firstFailedAt = undefined;

    this._transitionState(mc, ConnectionState.READY, 'reconnected');

    const hbConfig =
      savedConfig.heartbeat ?? this.config.heartbeat ?? this.defaultHeartbeat;
    if (hbConfig.enabled) {
      this._startHeartbeat(mc, hbConfig);
    }

    this._onReconnectedEvent.fire({ connectionId: mc.connectionId, attempt });
    this._onReadyEvent.fire({ connectionId: mc.connectionId });
    this._log('info', `reconnected: ${mc.connectionId} (attempt ${attempt})`);
  }

  // ── Internal: heartbeat ───────────────────────────────────────────────────

  protected _startHeartbeat(
    mc: ManagedConnection,
    hbConfig: HeartbeatConfig
  ): void {
    this._stopHeartbeat(mc);

    mc.heartbeatTimer = setInterval(() => {
      this._sendHeartbeat(mc, hbConfig);
    }, hbConfig.intervalMs);
  }

  protected _stopHeartbeat(mc: ManagedConnection): void {
    if (mc.heartbeatTimer != null) {
      clearInterval(mc.heartbeatTimer);
      mc.heartbeatTimer = undefined;
    }
  }

  /**
   * Override in subclasses for a real ping/pong implementation.
   * Default implementation triggers TRANSIENT_FAILURE after timeout
   * (serves as a stub for testing; real implementations should use RPC ping).
   */
  protected _sendHeartbeat(
    mc: ManagedConnection,
    _hbConfig: HeartbeatConfig
  ): void {
    // Subclasses replace this with an actual RPC ping call.
    // Here we just check that the connection is still READY.
    if (mc.state !== ConnectionState.READY) {
      this._stopHeartbeat(mc);
    }
  }

  /**
   * Called by subclasses when a pong response is not received within
   * `heartbeatTimeoutMs`.
   */
  protected _handleHeartbeatTimeout(mc: ManagedConnection): void {
    if (mc.state !== ConnectionState.READY) return;
    this._log('warn', `heartbeat timeout: ${mc.connectionId}`);
    this._handleConnectionLost(mc, new Error('heartbeat timeout'));
  }

  // ── Internal: state machine ───────────────────────────────────────────────

  protected _transitionState(
    mc: ManagedConnection,
    newState: ConnectionState,
    reason?: string
  ): void {
    if (mc.state === newState) return;

    if (!isValidTransition(mc.state, newState)) {
      this._log(
        'warn',
        `Invalid state transition ${mc.state} → ${newState} for ${mc.connectionId}`
      );
      return;
    }

    const previousState = mc.state;
    mc.state = newState;
    mc.lastStateChangedAt = Date.now();
    if (newState !== ConnectionState.READY) {
      // only clear error on READY to avoid clobbering diagnostics
    }

    // Notify state-change event.
    const event: StateChangeEvent = {
      connectionId: mc.connectionId,
      previousState,
      currentState: newState,
      timestamp: mc.lastStateChangedAt,
      reason,
    };
    this._onStateChangeEvent.fire(event);

    // Resolve waiting observers.
    const remainingWaiters: typeof mc.stateWaiters = [];
    for (const w of mc.stateWaiters) {
      if (w.currentState !== newState) {
        // The state has changed away from what they were waiting on.
        w.deferred.resolve(newState);
      } else {
        remainingWaiters.push(w);
      }
    }
    mc.stateWaiters = remainingWaiters;

    this._log(
      'debug',
      `[${mc.connectionId}] ${previousState} → ${newState}${
        reason ? ` (${reason})` : ''
      }`
    );
  }

  // ── Internal: ConnectionInfo builder ─────────────────────────────────────

  private _buildConnectionInfo(mc: ManagedConnection): ConnectionInfo {
    const self = this;
    return {
      get connectionId() {
        return mc.connectionId;
      },
      get fromId() {
        return mc.fromId;
      },
      get toId() {
        return mc.toId;
      },
      get state() {
        return mc.state;
      },
      get lastStateChangedAt() {
        return mc.lastStateChangedAt;
      },
      get error() {
        return mc.error;
      },
      get isReady() {
        return mc.state === ConnectionState.READY;
      },
      get isConnecting() {
        return mc.state === ConnectionState.CONNECTING;
      },
      get isFailed() {
        return mc.state === ConnectionState.TRANSIENT_FAILURE;
      },
      get isClosed() {
        return mc.state === ConnectionState.CLOSED;
      },

      waitForStateChange(
        currentState: ConnectionState,
        deadlineMs?: number
      ): Promise<ConnectionState> {
        // If already changed, resolve immediately.
        if (mc.state !== currentState) {
          return Promise.resolve(mc.state);
        }

        const deferred = createDeferred<ConnectionState>();

        mc.stateWaiters.push({ currentState, deferred });

        const nativePromise = Promise.resolve(deferred.promise);

        if (deadlineMs != null) {
          const timer = setTimeout(() => {
            const idx = mc.stateWaiters.findIndex(
              (w) => w.deferred === deferred
            );
            if (idx !== -1) mc.stateWaiters.splice(idx, 1);
            deferred.reject(
              new TimeoutError(
                `waitForStateChange timed out after ${deadlineMs}ms (connection ${mc.connectionId})`
              )
            );
          }, deadlineMs);

          // Cancel timer if resolved early.
          nativePromise
            .then(() => clearTimeout(timer))
            .catch(() => clearTimeout(timer));
        }

        return nativePromise;
      },
    };
  }

  // ── Internal: logger ─────────────────────────────────────────────────────

  private _log(
    level: 'debug' | 'info' | 'warn' | 'error',
    message: string,
    data?: any
  ): void {
    if (this.config.logger) {
      this.config.logger(level, `[Orchestrator] ${message}`, data);
    }
  }
}
