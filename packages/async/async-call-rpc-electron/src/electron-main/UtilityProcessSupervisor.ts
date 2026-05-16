import {
  BaseConnectionOrchestrator,
  ParticipantType,
  ReconnectPolicy,
  RetryContext,
} from '@x-oasis/async-call-rpc/orchestrator';
import ElectronUtilityProcessChannel from './ElectronUtilityProcessChannel';
import type { UtilityProcess } from '../types';

/**
 * Supervisor states. See D-004 §1.1 for the full state-machine diagram;
 * the implementation supports:
 *
 *   idle ──start()──► starting ──spawn ok──► running ──child exit──► restarting
 *                       │                                              │
 *                       └─spawn fail──► failed                  retry exhausted
 *                                                                      │
 *                                                                      ▼
 *                                                                   failed
 *
 *   * ──stop()──► stopped
 *   running ──restart(reason)──► restarting ──ok──► running
 */
export type SupervisorState =
  | 'idle'
  | 'starting'
  | 'running'
  | 'restarting'
  | 'failed'
  | 'stopped';

/**
 * The minimal contract we need from `electron.utilityProcess`. Surfacing
 * this as a function option makes the supervisor unit-testable without
 * pulling in Electron at all (the production fork is wired in via
 * `defaultForkFn` below).
 */
export type ForkFn = (
  entry: string,
  args?: string[],
  options?: ForkOptions
) => UtilityProcess;

export interface ForkOptions {
  env?: Record<string, string>;
  serviceName?: string;
}

/**
 * Information passed to `onSpawn`. Fires every time a fresh child is
 * created (initial start *and* every restart) — `isRestart` lets the
 * callback distinguish the two cases for things like
 * `pidNameRegistry.register()` vs. `…replace()`.
 */
export interface SpawnInfo {
  pid: number;
  restartCount: number;
  isRestart: boolean;
}

/**
 * Information passed to `onChannelReady`. Fires after the channel is
 * constructed but BEFORE it is registered (or replaced) on any
 * orchestrator — the right place to call
 * `channel.setServiceHost(serviceHost)` or attach extra listeners.
 */
export interface ChannelReadyInfo {
  channel: ElectronUtilityProcessChannel;
  pid: number;
  restartCount: number;
  isRestart: boolean;
}

/**
 * Snapshot of a state transition. Pushed to `restartHistory` on every
 * exit-driven restart attempt and emitted via `onStateChange` /
 * `subscribeStateChange()` for every state change.
 */
export interface StateChangeEvent {
  /** epoch ms */
  at: number;
  prev: SupervisorState;
  curr: SupervisorState;
  /** Free-form reason string. Restart reasons follow `'child exited (code=…)'` etc. */
  reason?: string;
}

/**
 * Single restart-history entry. One entry is pushed per restart attempt
 * (initial start does NOT count); `succeededAt` is set when the
 * supervisor reaches `running` again, `failedAt` when the restart path
 * itself fails.
 */
export interface RestartHistoryEntry {
  /** epoch ms when restart was triggered */
  triggeredAt: number;
  /** Pid of the child that died (or null when the supervisor itself triggered restart). */
  prevPid: number | null;
  /** Exit code from the previous child (null for manual restart / signal exit). */
  exitCode: number | null;
  /** Reason string (e.g. `'child exited (code=137)'`, `'manual: foo'`). */
  reason: string;
  /** restartCount at the moment the restart was triggered (post-increment value). */
  restartCount: number;
  /** Pid of the new child once spawn succeeds. */
  newPid?: number;
  /** epoch ms when the supervisor returned to `running` after this restart. */
  succeededAt?: number;
  /** epoch ms when this restart attempt itself failed. */
  failedAt?: number;
}

/**
 * Snapshot intended for inspection / metrics surfaces (G3). Cheap to
 * compute and safe to call from any process — Inspector code typically
 * calls this from a JSON-serialising RPC.
 */
export interface InspectorSnapshot {
  participantId: string;
  state: SupervisorState;
  currentPid: number | null;
  restartCount: number;
  orchestratorCount: number;
  restartHistory: ReadonlyArray<RestartHistoryEntry>;
  /**
   * Epoch ms (`Date.now()`) the most recent {@link onChannelReady}
   * callback fired — i.e. when the supervisor's
   * `ElectronUtilityProcessChannel` was constructed and pre-registration
   * setup completed for the current child. Reset on each spawn /
   * restart so always reflects the live channel.
   *
   * `null` until the first successful spawn finishes; after that it is
   * monotonically increasing for the lifetime of the supervisor (each
   * restart bumps it).
   *
   * Useful for diagnosing zombie utility processes — if `state` is
   * `'running'` but `lastChannelReadyAt` is hours stale relative to
   * `Date.now()`, the supervisor itself is healthy but the channel may
   * be stuck (typically because the worker is blocked).
   */
  lastChannelReadyAt: number | null;
  /**
   * Epoch ms (`Date.now()`) of the most recent readiness-probe outcome,
   * either success or timeout. ONLY populated when
   * `readinessProbe.kind === 'firstMessage'`; in `'spawn'` mode there
   * is no probe to time, so this stays `null` for the supervisor's
   * lifetime.
   *
   * Inspector dashboards should display "n/a" rather than "never" for
   * `'spawn'`-mode supervisors to avoid misleading the operator.
   */
  lastReadinessProbeAt: number | null;
  /**
   * Number of consecutive readiness-probe timeouts since the last
   * successful probe. Resets to `0` the moment a probe resolves
   * successfully and on every successful `start()`/`restart()` (because
   * those paths only complete after the probe resolves).
   *
   * ONLY meaningful when `readinessProbe.kind === 'firstMessage'`. In
   * `'spawn'` mode this is permanently `0`.
   *
   * High values combined with a `'restarting'` or `'failed'` state
   * indicate the worker entry script is reaching `forkFn` but never
   * sending the ready message (likely a worker-side bug or a missing
   * `process.parentPort.postMessage` call), as opposed to crashing
   * outright (which would surface via the `exit` listener and bump
   * `restartCount` instead).
   */
  consecutiveProbeFailures: number;
}

/**
 * Readiness gating policy. Defaults to `'spawn'` — the supervisor
 * considers the child ready as soon as `forkFn` returns. Switch to
 * `'firstMessage'` when the worker performs async setup (DB open, model
 * load, etc.) and you want the orchestrator to only see the participant
 * once setup completes.
 *
 * `'firstMessage'` mode: supervisor attaches a one-shot `'message'`
 * listener on the child BEFORE registering with the orchestrator, and
 * waits for a message of shape `{ type: SUPERVISOR_READY_MESSAGE_TYPE }`
 * (or the user-provided `match` predicate). On timeout the spawn is
 * treated as a failure and the restart policy applies.
 */
export type ReadinessProbe =
  | { kind: 'spawn' }
  | {
      kind: 'firstMessage';
      /**
       * Predicate to identify the ready message. Default:
       * `(msg) => msg?.type === SUPERVISOR_READY_MESSAGE_TYPE`.
       */
      match?: (message: unknown) => boolean;
      /** Default: 30_000. */
      timeoutMs?: number;
    };

/**
 * Convention message type the supervisor recognises in `'firstMessage'`
 * readiness mode. Reserved namespace: `__supervisor_*` is intended for
 * future control messages (graceful shutdown ack, etc.) and worker
 * code MUST NOT use it for application traffic.
 */
export const SUPERVISOR_READY_MESSAGE_TYPE = '__supervisor_ready__';

/** Default ring-buffer capacity for `restartHistory`. */
const DEFAULT_RESTART_HISTORY_SIZE = 50;
const DEFAULT_READINESS_TIMEOUT_MS = 30_000;

export interface UtilityProcessSupervisorOptions {
  /**
   * The orchestrator(s) the spawned process registers with.
   *
   * Pass an array when the same utility participates in multiple
   * orchestrator topologies — e.g. a "setting" pagelet that talks
   * back to both the main renderer orchestrator and a dedicated
   * settings-window orchestrator. Each orchestrator gets the same
   * `participantId` and channel, and on restart `replaceParticipantChannel`
   * is called on every orchestrator in lock-step.
   */
  orchestrator: BaseConnectionOrchestrator | BaseConnectionOrchestrator[];

  /** Stable participant id; preserved across restarts. */
  participantId: string;

  /** Absolute path of the utility-process entry script. */
  entry: string;

  /** Participant role passed to `registerParticipant`. Default: `'utility'`. */
  role?: ParticipantType;

  /** `utilityProcess.fork()` arguments. */
  forkOptions?: {
    args?: string[];
    env?: Record<string, string>;
    serviceName?: string;
  };

  /**
   * Restart policy applied when the child exits unexpectedly. Reuses
   * `ReconnectPolicy` so callers can share `ExponentialBackoffPolicy`
   * instances with `ConnectionConfig.reconnectPolicy`.
   *
   * Default: undefined ⇒ no auto-restart (state goes `running → failed`).
   */
  restartPolicy?: ReconnectPolicy;

  /**
   * Readiness gating. Default: `{ kind: 'spawn' }`.
   * See {@link ReadinessProbe} for the `'firstMessage'` semantics.
   */
  readinessProbe?: ReadinessProbe;

  /**
   * Invoked every time a child is spawned (initial start AND every
   * restart). Intended for side-effects keyed on the new pid such as
   * `pidNameRegistry.register(...)` or "Activity Monitor" labelling.
   *
   * Errors thrown synchronously here are swallowed and logged (a
   * registry hiccup must not knock the supervisor offline).
   */
  onSpawn?: (info: SpawnInfo) => void;

  /**
   * Invoked after the channel is constructed but BEFORE it is
   * registered with the orchestrator(s). Intended for one-shot channel
   * configuration that the supervisor doesn't otherwise know about —
   * the canonical example is `channel.setServiceHost(serviceHost)`,
   * which has to happen before any RPC arrives.
   *
   * Fires on the initial start AND on every restart so the new channel
   * receives the same setup.
   */
  onChannelReady?: (info: ChannelReadyInfo) => void;

  /**
   * Convenience callback for state transitions. Equivalent to calling
   * `subscribeStateChange()` once at construction. Errors are caught.
   */
  onStateChange?: (event: StateChangeEvent) => void;

  /**
   * Maximum number of entries kept in `restartHistory` (oldest dropped).
   * Default: {@link DEFAULT_RESTART_HISTORY_SIZE}.
   */
  restartHistorySize?: number;

  /**
   * Injection point for `electron.utilityProcess.fork`. Tests pass a
   * stub; production callers omit this and the supervisor falls back
   * to `require('electron').utilityProcess.fork`.
   */
  forkFn?: ForkFn;

  /** Optional structured logger; defaults to no-op. */
  logger?: (
    level: 'debug' | 'info' | 'warn' | 'error',
    msg: string,
    data?: Record<string, unknown>
  ) => void;
}

/**
 * Lifecycle manager for an Electron `utilityProcess` that participates in
 * a `ConnectionOrchestrator` topology.
 *
 * Implements (D-004 §1):
 *   - `start()`: fork → optional readiness probe → register channel → wire `exit` listener
 *   - auto-restart on child exit when `restartPolicy.nextRetryDelayMs()`
 *     returns a non-null delay; uses `replaceParticipantChannel` so all
 *     existing connections transparently re-establish
 *   - `restart(reason?)`: manually trigger the same restart path used
 *     after an unexpected exit (no exit code; reason marked `manual:…`)
 *   - `stop()`: detach exit listener → unregister participant → kill child
 *
 * Inspection (G3 / D-006 v2):
 *   - `state`, `currentPid`, `restartCount` getters
 *   - `restartHistory` ring buffer
 *   - `subscribeStateChange(listener)` — multi-listener event bus
 *   - `getInspectorSnapshot()` — JSON-friendly aggregate view
 */
export class UtilityProcessSupervisor {
  private readonly opts: UtilityProcessSupervisorOptions;
  private readonly forkFn: ForkFn;
  private readonly orchestrators: BaseConnectionOrchestrator[];
  private readonly logger: NonNullable<
    UtilityProcessSupervisorOptions['logger']
  >;
  private readonly readinessProbe: ReadinessProbe;
  private readonly restartHistorySize: number;

  private _state: SupervisorState = 'idle';
  private _currentChild: UtilityProcess | null = null;
  private _currentChannel: ElectronUtilityProcessChannel | null = null;
  private _restartCount = 0;
  private _firstFailureAt: number | null = null;
  private _restartHistory: RestartHistoryEntry[] = [];
  private _stateChangeListeners = new Set<(e: StateChangeEvent) => void>();
  /**
   * Health-snapshot bookkeeping (see {@link InspectorSnapshot} for the
   * external contract). Updated from `_fireChannelReady` and
   * `_awaitReadiness` only — getters reflect them verbatim.
   */
  private _lastChannelReadyAt: number | null = null;
  private _lastReadinessProbeAt: number | null = null;
  private _consecutiveProbeFailures = 0;

  /**
   * When `_currentChild` exits we close over this listener so we can
   * detach it during `stop()` (otherwise `stop()` itself would trigger
   * an "unexpected exit ⇒ restart" path).
   */
  private _exitListener: ((code: number | null) => void) | null = null;

  constructor(opts: UtilityProcessSupervisorOptions) {
    this.opts = opts;
    this.forkFn = opts.forkFn ?? defaultForkFn;
    this.orchestrators = Array.isArray(opts.orchestrator)
      ? [...opts.orchestrator]
      : [opts.orchestrator];
    if (this.orchestrators.length === 0) {
      throw new Error(
        '[UtilityProcessSupervisor] orchestrator option must contain at least one orchestrator'
      );
    }
    this.logger = opts.logger ?? (() => {});
    this.readinessProbe = opts.readinessProbe ?? { kind: 'spawn' };
    this.restartHistorySize =
      opts.restartHistorySize ?? DEFAULT_RESTART_HISTORY_SIZE;
    if (opts.onStateChange) {
      this._stateChangeListeners.add(opts.onStateChange);
    }
  }

  get state(): SupervisorState {
    return this._state;
  }

  get currentPid(): number | null {
    return this._currentChild?.pid ?? null;
  }

  get restartCount(): number {
    return this._restartCount;
  }

  /**
   * Snapshot of all restart attempts so far (oldest first; capped at
   * `restartHistorySize`).
   */
  get restartHistory(): ReadonlyArray<RestartHistoryEntry> {
    return this._restartHistory;
  }

  /**
   * Subscribe to every state transition. Returns a disposer that
   * detaches the listener. Listener errors are caught and logged.
   */
  subscribeStateChange(
    listener: (event: StateChangeEvent) => void
  ): () => void {
    this._stateChangeListeners.add(listener);
    return () => {
      this._stateChangeListeners.delete(listener);
    };
  }

  /**
   * JSON-friendly snapshot consumed by Inspector / metrics surfaces.
   * Safe to expose over RPC; contains no live references.
   */
  getInspectorSnapshot(): InspectorSnapshot {
    return {
      participantId: this.opts.participantId,
      state: this._state,
      currentPid: this.currentPid,
      restartCount: this._restartCount,
      orchestratorCount: this.orchestrators.length,
      // Defensive copy so the caller cannot mutate internals.
      restartHistory: this._restartHistory.map((e) => ({ ...e })),
      lastChannelReadyAt: this._lastChannelReadyAt,
      lastReadinessProbeAt: this._lastReadinessProbeAt,
      consecutiveProbeFailures: this._consecutiveProbeFailures,
    };
  }

  /**
   * Spawn the utility process for the first time. Throws if the
   * supervisor is not in `idle`.
   */
  async start(): Promise<void> {
    if (this._state !== 'idle') {
      throw new Error(
        `[UtilityProcessSupervisor] start() in state "${this._state}" — only allowed from "idle"`
      );
    }
    this._transition('starting');

    let child: UtilityProcess;
    try {
      child = this._spawn(false);
    } catch (err) {
      this._transition(
        'failed',
        err instanceof Error ? err.message : String(err)
      );
      throw err;
    }

    try {
      await this._awaitReadiness(child);
    } catch (err) {
      // Readiness probe failed (timeout). Treat as a spawn failure: kill
      // the child if still alive and surface a clean rejection.
      try {
        child.kill();
      } catch {
        /* already dead */
      }
      this._transition(
        'failed',
        err instanceof Error ? err.message : String(err)
      );
      throw err;
    }

    const channel = new ElectronUtilityProcessChannel({
      process: child,
      description: this.opts.participantId,
    });

    this._fireChannelReady(channel, child.pid, false);

    const role = this.opts.role ?? 'utility';
    for (const orch of this.orchestrators) {
      orch.registerParticipant(this.opts.participantId, channel, role);
    }

    this._currentChild = child;
    this._currentChannel = channel;
    this._wireChildExitListener(child);

    this._transition('running');
  }

  /**
   * Manually trigger a restart. Only valid from `'running'`. The same
   * restart path used by an unexpected exit runs (history entry, retry
   * count bump, `replaceParticipantChannel` on every orchestrator) but
   * `exitCode` is `null` and the reason is `'manual: <reason>'`.
   *
   * Awaits the new child reaching `'running'` (or rejects on failure).
   */
  async restart(reason?: string): Promise<void> {
    if (this._state !== 'running') {
      throw new Error(
        `[UtilityProcessSupervisor] restart() in state "${this._state}" — only allowed from "running"`
      );
    }

    const tag = `manual${reason ? `: ${reason}` : ''}`;
    this.logger('info', 'manual restart requested', {
      participantId: this.opts.participantId,
      reason: tag,
    });

    // Detach current exit listener so kill()-of-old-child below does not
    // trigger the unexpected-exit auto-restart code path; we drive the
    // restart ourselves via _performRestart().
    const oldChild = this._currentChild;
    if (oldChild && this._exitListener) {
      try {
        oldChild.removeListener('exit', this._exitListener);
      } catch {
        /* ignore */
      }
    }
    this._exitListener = null;

    // Bump restartCount BEFORE the history entry so newPid reads the
    // post-increment value (mirrors the auto-restart path).
    this._restartCount += 1;
    const entry: RestartHistoryEntry = {
      triggeredAt: Date.now(),
      prevPid: oldChild?.pid ?? null,
      exitCode: null,
      reason: tag,
      restartCount: this._restartCount,
    };
    this._pushRestartHistory(entry);

    this._transition('restarting', tag);

    // Kill the old child so it doesn't linger; the listener was detached
    // above so this is silent w.r.t. our state machine.
    if (oldChild) {
      try {
        oldChild.kill();
      } catch {
        /* already dead */
      }
    }

    // _performRestartCore already marks entry.failedAt and rolls back
    // restartCount on failure; we just await + let the rejection
    // propagate so the manual caller sees the actual error.
    await this._performRestartCore(entry);
  }

  /**
   * Stop the supervisor permanently. Idempotent for `stopped` /
   * `failed`; from any other state it detaches the exit listener,
   * unregisters the participant, and kills the child.
   *
   * Does not currently implement a graceful timeout — `kill()` is
   * synchronous and the supervisor moves to `stopped` immediately.
   */
  stop(): void {
    if (this._state === 'stopped' || this._state === 'failed') {
      this._state = 'stopped';
      return;
    }

    const child = this._currentChild;
    const channel = this._currentChannel;

    // Detach our exit listener BEFORE killing so the kill doesn't
    // re-enter our restart code path.
    if (child && this._exitListener) {
      try {
        child.removeListener('exit', this._exitListener);
      } catch {
        /* listener may already be gone */
      }
    }
    this._exitListener = null;

    for (const orch of this.orchestrators) {
      orch.unregisterParticipant(this.opts.participantId);
    }

    if (channel) {
      // We are intentionally killing the child below; let the channel
      // tear down without redundantly issuing kill() itself.
      channel.setKillOnDisconnect(false);
      try {
        channel.disconnect();
      } catch {
        /* already disconnected */
      }
    }

    if (child) {
      try {
        child.kill();
      } catch {
        /* already dead */
      }
    }

    this._currentChild = null;
    this._currentChannel = null;
    this._transition('stopped');
  }

  // ── Internals ───────────────────────────────────────────────────────────

  private _spawn(isRestart: boolean): UtilityProcess {
    const args = this.opts.forkOptions?.args;
    const forkOpts: ForkOptions = {};
    if (this.opts.forkOptions?.env !== undefined) {
      forkOpts.env = this.opts.forkOptions.env;
    }
    if (this.opts.forkOptions?.serviceName !== undefined) {
      forkOpts.serviceName = this.opts.forkOptions.serviceName;
    }
    const child = this.forkFn(this.opts.entry, args, forkOpts);
    this.logger('info', 'utility process spawned', {
      participantId: this.opts.participantId,
      pid: child.pid,
      restartCount: this._restartCount,
      isRestart,
    });

    if (this.opts.onSpawn) {
      try {
        this.opts.onSpawn({
          pid: child.pid,
          restartCount: this._restartCount,
          isRestart,
        });
      } catch (err) {
        this.logger('warn', 'onSpawn callback threw', {
          participantId: this.opts.participantId,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    return child;
  }

  /**
   * Honour `readinessProbe`. For `'spawn'` resolves immediately; for
   * `'firstMessage'` attaches a one-shot listener that resolves on the
   * first matching message and rejects on timeout.
   */
  private _awaitReadiness(child: UtilityProcess): Promise<void> {
    if (this.readinessProbe.kind === 'spawn') {
      return Promise.resolve();
    }

    const probe = this.readinessProbe;
    const match =
      probe.match ??
      ((msg: unknown): boolean =>
        typeof msg === 'object' &&
        msg !== null &&
        (msg as { type?: unknown }).type === SUPERVISOR_READY_MESSAGE_TYPE);
    const timeoutMs = probe.timeoutMs ?? DEFAULT_READINESS_TIMEOUT_MS;

    return new Promise<void>((resolve, reject) => {
      let settled = false;
      let timer: ReturnType<typeof setTimeout> | null = null;

      const cleanup = (): void => {
        if (timer !== null) {
          clearTimeout(timer);
          timer = null;
        }
        try {
          child.removeListener('message', onMessage);
        } catch {
          /* listener already detached */
        }
      };

      const onMessage = (event: unknown): void => {
        // Main side: UtilityProcess emits the raw value. Tolerate both
        // shapes (raw value or `{ data }`) so the probe works regardless
        // of how the worker postMessage's.
        const value =
          event && typeof event === 'object' && 'data' in (event as object)
            ? (event as { data: unknown }).data
            : event;
        if (!match(value)) return;
        if (settled) return;
        settled = true;
        cleanup();
        // Health snapshot: probe succeeded — stamp time + reset the
        // consecutive-failure run.
        this._lastReadinessProbeAt = Date.now();
        this._consecutiveProbeFailures = 0;
        resolve();
      };

      timer = setTimeout(() => {
        if (settled) return;
        settled = true;
        cleanup();
        // Health snapshot: probe timed out — stamp time + bump the
        // consecutive-failure counter (caller will then transition to
        // 'failed' or schedule a restart, depending on policy).
        this._lastReadinessProbeAt = Date.now();
        this._consecutiveProbeFailures += 1;
        reject(
          new Error(
            `[UtilityProcessSupervisor] readiness probe timed out after ${timeoutMs}ms (participant="${this.opts.participantId}", pid=${child.pid})`
          )
        );
      }, timeoutMs);

      child.on('message', onMessage);
    });
  }

  private _fireChannelReady(
    channel: ElectronUtilityProcessChannel,
    pid: number,
    isRestart: boolean
  ): void {
    // Always stamp the health snapshot, even if the user did not
    // register an onChannelReady callback — Inspector consumers should
    // still see when the channel last came up.
    this._lastChannelReadyAt = Date.now();
    if (!this.opts.onChannelReady) return;
    try {
      this.opts.onChannelReady({
        channel,
        pid,
        restartCount: this._restartCount,
        isRestart,
      });
    } catch (err) {
      this.logger('warn', 'onChannelReady callback threw', {
        participantId: this.opts.participantId,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  private _wireChildExitListener(child: UtilityProcess): void {
    const listener = (code: number | null): void => {
      // Only react if this child is still the current one — guards
      // against late `exit` events from already-replaced processes.
      if (child !== this._currentChild) return;
      this._handleUnexpectedExit(code);
    };
    this._exitListener = listener;
    child.on('exit', listener);
  }

  private _handleUnexpectedExit(code: number | null): void {
    const prevPid = this._currentChild?.pid ?? null;
    const reason = `child exited (code=${code})`;
    this.logger('warn', 'utility process exited unexpectedly', {
      participantId: this.opts.participantId,
      pid: prevPid,
      code,
    });

    const policy = this.opts.restartPolicy;
    if (!policy) {
      this._transition('failed', `${reason} and no restartPolicy`);
      return;
    }

    if (this._firstFailureAt === null) {
      this._firstFailureAt = Date.now();
    }

    const ctx: RetryContext = {
      previousRetryCount: this._restartCount,
      elapsedMs: Date.now() - this._firstFailureAt,
      retryReason: reason,
      // The supervisor is participant-scoped, not connection-scoped —
      // these fields exist for ReconnectPolicy compatibility but only
      // `previousRetryCount` / `elapsedMs` actually drive scheduling.
      connectionId: this.opts.participantId,
      fromId: this.opts.participantId,
      toId: this.opts.participantId,
    };

    const delay = policy.nextRetryDelayMs(ctx);
    if (delay === null) {
      this._transition('failed', 'restartPolicy exhausted');
      return;
    }

    // Push the history entry here (pre-restart) so callers querying
    // restartHistory mid-flight see the in-progress attempt. Bump
    // restartCount BEFORE the history entry so its `restartCount`
    // matches the eventual onSpawn callback value.
    this._restartCount += 1;
    const entry: RestartHistoryEntry = {
      triggeredAt: Date.now(),
      prevPid,
      exitCode: code,
      reason,
      restartCount: this._restartCount,
    };
    this._pushRestartHistory(entry);

    this._transition('restarting', reason);
    setTimeout(() => {
      void this._performRestartFromExit(entry);
    }, delay);
  }

  /**
   * Auto-restart wrapper around `_performRestartCore`. Increments /
   * decrements the retry counter on spawn failure to keep the policy
   * accurate, and re-enters `_handleUnexpectedExit` to schedule the next
   * attempt (or transition to `failed`).
   */
  private async _performRestartFromExit(
    entry: RestartHistoryEntry
  ): Promise<void> {
    if (this._state !== 'restarting') {
      // Most likely stop() raced ahead of the scheduled restart.
      return;
    }
    try {
      await this._performRestartCore(entry);
    } catch {
      // _performRestartCore already rolled back restartCount and marked
      // entry.failedAt; re-enter the exit-handling path so the policy
      // gets another shot (or exhausts).
      this._handleUnexpectedExit(null);
    }
  }

  /**
   * Shared core: spawn new child → channel-ready → register or replace
   * → wire exit listener → mark history entry succeeded.
   *
   * Throws on spawn or readiness failure with `entry.failedAt` set and
   * `restartCount` rolled back. Does NOT transition to `failed` itself
   * (caller decides — auto-restart re-enters the policy; manual restart
   * propagates the rejection to the user).
   */
  private async _performRestartCore(entry: RestartHistoryEntry): Promise<void> {
    let newChild: UtilityProcess;
    try {
      newChild = this._spawn(true);
    } catch (err) {
      // Roll back the increment so policy retry counts stay accurate.
      this._restartCount -= 1;
      entry.failedAt = Date.now();
      throw err;
    }

    try {
      await this._awaitReadiness(newChild);
    } catch (err) {
      try {
        newChild.kill();
      } catch {
        /* already dead */
      }
      this._restartCount -= 1;
      entry.failedAt = Date.now();
      throw err;
    }

    const newChannel = new ElectronUtilityProcessChannel({
      process: newChild,
      description: `${this.opts.participantId} (restart #${this._restartCount})`,
    });

    this._fireChannelReady(newChannel, newChild.pid, true);

    for (const orch of this.orchestrators) {
      orch.replaceParticipantChannel(this.opts.participantId, newChannel, {
        autoReconnect: true,
      });
    }

    // Old child cleanup: it has already emitted `exit` (or been killed
    // by the manual restart path), so we just drop our references.
    this._currentChild = newChild;
    this._currentChannel = newChannel;
    this._wireChildExitListener(newChild);

    entry.newPid = newChild.pid;
    entry.succeededAt = Date.now();

    this._transition('running');
  }

  private _pushRestartHistory(entry: RestartHistoryEntry): void {
    this._restartHistory.push(entry);
    if (this._restartHistory.length > this.restartHistorySize) {
      // Drop oldest. `splice` keeps the array reference stable, which
      // matters because `restartHistory` getter returns the live array.
      this._restartHistory.splice(
        0,
        this._restartHistory.length - this.restartHistorySize
      );
    }
  }

  private _transition(next: SupervisorState, reason?: string): void {
    const previous = this._state;
    if (previous === next) return;
    this._state = next;
    const event: StateChangeEvent = {
      at: Date.now(),
      prev: previous,
      curr: next,
      reason,
    };
    this.logger('debug', `supervisor state: ${previous} → ${next}`, {
      participantId: this.opts.participantId,
      reason,
    });
    for (const listener of this._stateChangeListeners) {
      try {
        listener(event);
      } catch (err) {
        this.logger('warn', 'state-change listener threw', {
          participantId: this.opts.participantId,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
  }
}

/**
 * Production fork: lazily resolves `electron.utilityProcess.fork` so
 * that consumers in non-Electron contexts (tests, type-only imports)
 * never trigger the require.
 */
const defaultForkFn: ForkFn = (entry, args, options) => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { utilityProcess } = require('electron') as typeof import('electron');
  return utilityProcess.fork(entry, args, options) as unknown as UtilityProcess;
};
