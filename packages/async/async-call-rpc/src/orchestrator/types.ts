import { ConnectionState } from './ConnectionState';
import AbstractChannelProtocol from '../protocol/AbstractChannelProtocol';

// ─── Internal constants ───────────────────────────────────────────────────────

/**
 * The RPC service path used internally by all Connection Orchestrators to
 * deliver ports to participants.
 *
 * This constant is an implementation detail of the orchestrator protocol and
 * should never appear in user code.  Participants receive ports via the
 * platform-specific `registerOrchestratorHandler` helper (e.g.
 * `registerOrchestratorHandler` from `@x-oasis/async-call-rpc-electron`),
 * which encapsulates this path internally.
 *
 * @internal
 */
export const ORCHESTRATOR_SERVICE_PATH = '__x_oasis_orchestrator__' as const;

/**
 * The RPC service path used by `ParticipantOrchestratorProxy` to expose
 * orchestrator operations (requestConnect, listParticipants, etc.) over
 * the participant's control-plane channel.
 *
 * @internal
 */
export const ORCHESTRATOR_PROXY_SERVICE_PATH =
  '__x_oasis_orchestrator_proxy__' as const;

// ─── Participant ──────────────────────────────────────────────────────────────

/** The role a participant plays in the application topology. */
export type ParticipantType =
  | 'renderer'
  | 'utility'
  | 'worker'
  | 'process'
  | 'node';

/** Metadata about a registered participant. */
export interface ParticipantInfo {
  readonly id: string;
  readonly channel: AbstractChannelProtocol;
  readonly type: ParticipantType;
  readonly registeredAt: number;
}

// ─── Connection config passed to connect() ────────────────────────────────────

/**
 * Optional service handlers that can be registered as part of the connection.
 *
 * `fromServices` — methods the **from** participant exposes to the **to** side.
 * `toServices`   — methods the **to** participant exposes to the **from** side.
 */
export interface ConnectionConfig {
  fromServices?: Record<string, (...args: any[]) => any>;
  toServices?: Record<string, (...args: any[]) => any>;
  heartbeat?: HeartbeatConfig;
  reconnectPolicy?: ReconnectPolicy;
}

/**
 * Per-call options for `BaseConnectionOrchestrator.connect()`.
 *
 * Distinct from `ConnectionConfig` (which configures the long-lived
 * connection's heartbeat / reconnect / services) — `ConnectOptions` only
 * shapes the **first-attempt** activation handshake.
 *
 * Added in v0.5.x to fix the "cold-start cannot time out" gap (telegraph
 * D-006 §2 Gap 2): without `activateTimeoutMs`, a slow utility process that
 * never acks `activateConnection` would hang `connect()` forever instead of
 * surfacing a clear error.
 */
export interface ConnectOptions {
  /**
   * First-attempt activation timeout in ms. If both `activateParticipant`
   * promises haven't resolved by then, `connect()` rejects with a
   * `TimeoutError` and the connection is left in IDLE so the caller can
   * decide whether to retry.
   *
   * Default: 30_000 (30s) — generous enough for cold utility/process boot
   * but tight enough that production failures fail fast rather than hang.
   */
  activateTimeoutMs?: number;

  /**
   * Whether to apply reconnect policy on first-attempt failure.
   * Default: false — first attempt failure leaves the connection in IDLE
   * without auto-retry, preserving backward compatibility.
   */
  retryOnInitialFailure?: boolean;
}

export interface ReplaceChannelOptions {
  /**
   * Whether to immediately attempt reconnection for connections that were
   * in READY or TRANSIENT_FAILURE state after the channel is replaced.
   * Default: true.
   */
  autoReconnect?: boolean;
}

export interface ListParticipantEntry {
  id: string;
  type: ParticipantType;
  registeredAt: number;
}

export interface ListConnectionEntry {
  connectionId: string;
  fromId: string;
  toId: string;
  state: ConnectionState;
  stats?: ConnectionStats;
}

export interface BindPortOptions {
  /**
   * When true and a port is already bound, unbind the old port first then
   * bind the new one. Default: false — throws if already bound.
   */
  rebind?: boolean;
}

export interface OrchestratorEvent {
  type: string;
  payload: unknown;
}

// ─── ConnectionInfo — returned by connect() / getConnectionInfo() ─────────────

/**
 * Live view of a connection.  All properties are readonly snapshots;
 * call `waitForStateChange` to be notified when the state changes.
 */
export interface ConnectionInfo {
  readonly connectionId: string;
  readonly fromId: string;
  readonly toId: string;
  readonly state: ConnectionState;
  readonly lastStateChangedAt: number;
  readonly error?: Error;

  // convenience booleans
  readonly isReady: boolean;
  readonly isConnecting: boolean;
  readonly isFailed: boolean;
  readonly isClosed: boolean;

  /**
   * Resolves when the connection leaves `currentState`.
   * Rejects with `TimeoutError` if `deadlineMs` is exceeded.
   *
   * Modelled after `grpc.Channel.watchConnectivityState`.
   */
  waitForStateChange(
    currentState: ConnectionState,
    deadlineMs?: number
  ): Promise<ConnectionState>;
}

// ─── Events ──────────────────────────────────────────────────────────────────

export interface StateChangeEvent {
  connectionId: string;
  previousState: ConnectionState;
  currentState: ConnectionState;
  timestamp: number;
  reason?: string;
}

export interface ReadyEvent {
  connectionId: string;
}

export interface DisconnectedEvent {
  connectionId: string;
  error?: Error;
}

export interface ReconnectingEvent {
  connectionId: string;
  attempt: number;
  delay: number;
  elapsedMs: number;
}

export interface ReconnectedEvent {
  connectionId: string;
  attempt: number;
}

export interface ReconnectFailedEvent {
  connectionId: string;
  totalAttempts: number;
  elapsedMs: number;
  lastError?: Error;
}

export interface ClosedEvent {
  connectionId: string;
  reason: string;
}

export interface ConnectionEvents {
  stateChange: StateChangeEvent;
  ready: ReadyEvent;
  disconnected: DisconnectedEvent;
  reconnecting: ReconnectingEvent;
  reconnected: ReconnectedEvent;
  reconnectFailed: ReconnectFailedEvent;
  closed: ClosedEvent;
}

// ─── Stats ────────────────────────────────────────────────────────────────────

export interface ConnectionStats {
  readonly connectionId: string;
  readonly state: ConnectionState;

  // counters
  readonly totalRpcCalls: number;
  readonly successfulCalls: number;
  readonly failedCalls: number;
  readonly timeouts: number;

  // latency
  readonly avgLatencyMs: number;
  readonly p99LatencyMs: number;

  // connection history
  readonly totalReconnects: number;
  readonly lastConnectedAt: number;
  readonly lastDisconnectedAt: number | undefined;
  readonly uptime: number;

  // windowed (recent N seconds)
  readonly recentFailureRate: number;
  readonly recentAvgLatencyMs: number;

  /**
   * Recent state transitions for this connection (oldest → newest, ring
   * buffer capped at the tracker's configured size, default 50). Useful
   * for Inspector / health-debug surfaces that want a "what just
   * happened" view without subscribing to the live `onStateChange`
   * stream.
   */
  readonly stateTransitions: ReadonlyArray<StateTransitionRecord>;
}

/**
 * One entry in {@link ConnectionStats.stateTransitions}. Plain JSON
 * shape so it can travel over RPC without further serialization.
 */
export interface StateTransitionRecord {
  /** epoch ms */
  readonly at: number;
  readonly prev: ConnectionState;
  readonly curr: ConnectionState;
  /** Optional reason string passed to `_transitionState`. */
  readonly reason?: string;
}

// ─── Heartbeat ────────────────────────────────────────────────────────────────

export interface HeartbeatConfig {
  /** Whether heartbeating is active. Default: false. */
  enabled: boolean;
  /** Milliseconds between pings. Default: 30_000. */
  intervalMs: number;
  /** Milliseconds before a missing pong is considered a timeout. Default: 5_000. */
  timeoutMs: number;
}

// ─── Request timeout ─────────────────────────────────────────────────────────

export interface RequestTimeoutConfig {
  /** Default per-request timeout in ms. Default: 30_000. */
  defaultTimeoutMs: number;
  /** How many consecutive timeouts trigger a TRANSIENT_FAILURE transition. */
  consecutiveTimeoutThreshold: number;
}

// ─── Reconnect policy ────────────────────────────────────────────────────────

export interface RetryContext {
  /** Number of retries that have already been attempted. */
  previousRetryCount: number;
  /** Milliseconds since the first failure. */
  elapsedMs: number;
  /** The error or description that caused the disconnect. */
  retryReason: Error | string;
  connectionId: string;
  fromId: string;
  toId: string;
}

/**
 * Decides how long to wait before the next reconnect attempt.
 * Return `null` to give up and move to CLOSED.
 *
 * Modelled after SignalR's `IRetryPolicy`.
 */
export interface ReconnectPolicy {
  nextRetryDelayMs(context: RetryContext): number | null;
}

// ─── ReconnectPolicy declarative descriptor (cross-process safe) ─────────────

/**
 * JSON-serialisable description of a {@link ReconnectPolicy} implementation.
 *
 * `ConnectionConfig.reconnectPolicy` accepts either a live class instance
 * (same-process callers) or a `ReconnectPolicySpec` (cross-process callers,
 * e.g. a utility worker shipping the config to the main-process orchestrator
 * via `ParticipantOrchestratorProxy.connect`). The orchestrator unmarshals
 * specs back into class instances on receipt — see
 * `instantiateReconnectPolicy()`.
 *
 * Adding a new policy requires:
 *   1. exporting its `*Options` interface from the policy file
 *   2. adding a discriminant to the union below
 *   3. extending `instantiateReconnectPolicy()` with the matching case
 */
export type ReconnectPolicySpec =
  | { kind: 'exponential-backoff'; options?: ExponentialBackoffOptionsLike }
  | { kind: 'fixed-delay'; delays?: number[] }
  | { kind: 'never' };

/**
 * Mirror of `ExponentialBackoffOptions` declared as a plain interface here so
 * `types.ts` can describe specs without circularly importing the policy file.
 * The fields are kept identical and verified by a structural-assignability
 * test in `policies-spec.spec.ts`.
 */
export interface ExponentialBackoffOptionsLike {
  initialDelayMs?: number;
  maxDelayMs?: number;
  multiplier?: number;
  jitterFactor?: number;
  maxRetries?: number;
  maxElapsedMs?: number;
}

/**
 * Cross-process-safe subset of {@link ConnectionConfig}.
 *
 * Workers in a separate process (utility / renderer / node) cannot ship
 * `fromServices` / `toServices` to the main-process orchestrator — RPC
 * handlers are functions and have no meaningful serialised form. They also
 * cannot ship a live {@link ReconnectPolicy} class instance, because class
 * methods don't survive `structuredClone` or JSON serialisation.
 *
 * `ConnectionConfigSpec` is the safe shape: only fields whose values can
 * cross a process boundary intact (heartbeat is plain numbers; reconnect
 * policy uses the declarative {@link ReconnectPolicySpec} descriptor).
 *
 * `ParticipantOrchestratorProxy.connect()` accepts this shape; the
 * orchestrator's `requestConnect` proxy handler unmarshals it into a real
 * {@link ConnectionConfig} via `instantiateReconnectPolicy()`.
 */
export interface ConnectionConfigSpec {
  heartbeat?: HeartbeatConfig;
  reconnectPolicy?: ReconnectPolicySpec;
}

// ─── Pending request behaviour during reconnect ───────────────────────────────

export interface PendingRequestBehavior {
  /** What to do with in-flight requests when the connection drops. */
  onDisconnect: 'reject' | 'queue' | 'timeout';
  /** What to do with new requests while reconnecting. */
  duringReconnect: 'reject' | 'queue';
  maxQueueSize: number;
  queueTimeoutMs: number;
}

// ─── Degradation (relay fallback) ─────────────────────────────────────────────

export interface DegradationConfig {
  /** Whether relay fallback is enabled. Default: true. */
  enableFallback: boolean;
  /**
   * When to switch to relay mode.
   * `'on_failure'`          — immediately when the direct port drops.
   * `'on_reconnect_failed'` — only after the reconnect policy gives up.
   */
  fallbackTrigger: 'on_failure' | 'on_reconnect_failed';
  /** Automatically switch back to direct port once reconnected. */
  autoRecover: boolean;
}

// ─── Circuit breaker ─────────────────────────────────────────────────────────

export interface CircuitBreakerConfig {
  /** Default: false. */
  enabled: boolean;
  /** Failure-rate threshold to open the breaker (0–1). Default: 0.5. */
  failureRateThreshold: number;
  /** Minimum sample count before the threshold is evaluated. Default: 5. */
  volumeThreshold: number;
  /** Sliding-window duration in ms. Default: 10_000. */
  rollingWindowMs: number;
  /** How long the breaker stays OPEN before moving to HALF_OPEN. Default: 30_000. */
  openDurationMs: number;
  /** Number of probe requests allowed in HALF_OPEN state. Default: 3. */
  halfOpenRequests: number;
  /** Optional synchronous fallback when the breaker is open. */
  fallback?: (...args: any[]) => any;
}

// ─── Top-level Orchestrator config ───────────────────────────────────────────

export interface ConnectionOrchestratorConfig {
  /** Heartbeat / keepalive settings. Disabled by default. */
  heartbeat?: HeartbeatConfig;
  /** Per-request timeout defaults. */
  requestTimeout?: RequestTimeoutConfig;
  /** Strategy for scheduling reconnect attempts. */
  reconnectPolicy?: ReconnectPolicy;
  /** How to handle pending requests while reconnecting. */
  pendingRequests?: PendingRequestBehavior;
  /** Relay (degradation) fallback. */
  degradation?: DegradationConfig;
  /** Circuit breaker wrapping RPC calls. */
  circuitBreaker?: CircuitBreakerConfig;
  /** Logger. Defaults to console. */
  logger?: (
    level: 'debug' | 'info' | 'warn' | 'error',
    message: string,
    data?: any
  ) => void;
  /** Whether to track per-connection statistics. Default: false. */
  enableStats?: boolean;
}

// ─── Port pair ───────────────────────────────────────────────────────────────

/**
 * A pair of entangled ports created by the platform-specific `createPortPair()`.
 * In Electron this is `MessageChannelMain`; in Node/Web it is `MessageChannel`.
 */
export interface PortPair {
  port1: any;
  port2: any;
}

// ─── Activation config sent to each participant ───────────────────────────────

/**
 * Payload delivered to a participant's `activateConnection` RPC handler.
 */
export interface ActivationConfig {
  connectionId: string;
  /** The MessagePort this participant should bind to. */
  port: any;
  /** `'initiator'` = the from-side; `'receiver'` = the to-side. */
  role: 'initiator' | 'receiver';
  /** Service handlers the *peer* wants to expose to this participant. */
  peerServices?: Record<string, (...args: any[]) => any>;
  /** Service handlers this participant should expose to its peer. */
  myServices?: Record<string, (...args: any[]) => any>;
}

/**
 * Context delivered to a participant's `activateConnection` handler.
 *
 * Extends the raw `(port: any) => void` callback with metadata that lets
 * the participant identify **which peer** the port connects to, enabling
 * correct routing in multi-pagelet topologies.
 */
export interface ActivationContext {
  /** The MessagePort this participant should bind to. */
  port: any;
  /** Canonical connection ID in the form `"fromId--toId"`. */
  connectionId: string;
  /** Whether this participant is the initiator (from-side) or receiver (to-side). */
  role: 'initiator' | 'receiver';
}
