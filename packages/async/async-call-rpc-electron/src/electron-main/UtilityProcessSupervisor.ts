import {
  BaseConnectionOrchestrator,
  ParticipantType,
  ReconnectPolicy,
  RetryContext,
} from '@x-oasis/async-call-rpc';
import ElectronUtilityProcessChannel from './ElectronUtilityProcessChannel';
import type { UtilityProcess } from '../types';

/**
 * Supervisor states. See D-004 §1.1 for the full state-machine diagram;
 * this MVP implements:
 *
 *   idle ──start()──► starting ──spawn ok──► running ──child exit──► restarting
 *                       │                                              │
 *                       └─spawn fail──► failed                  retry exhausted
 *                                                                      │
 *                                                                      ▼
 *                                                                   failed
 *
 *   * ──stop()──► stopped
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
 * MVP scope (D-004 §1, narrowed):
 *   - `start()`: fork → register channel → wire `exit` listener
 *   - auto-restart on child exit when `restartPolicy.nextRetryDelayMs()`
 *     returns a non-null delay; uses `replaceParticipantChannel` so all
 *     existing connections transparently re-establish
 *   - `stop()`: detach exit listener → unregister participant → kill child
 *
 * Out of scope for MVP (deferred to follow-ups documented in D-004 §1.2):
 *   - `restart()` (manual)
 *   - readiness probes other than "spawn event"
 *   - rollback on failed restart
 *   - restart-history ring buffer
 *   - state-change event subscription API
 */
export class UtilityProcessSupervisor {
  private readonly opts: UtilityProcessSupervisorOptions;
  private readonly forkFn: ForkFn;
  private readonly orchestrators: BaseConnectionOrchestrator[];
  private readonly logger: NonNullable<
    UtilityProcessSupervisorOptions['logger']
  >;

  private _state: SupervisorState = 'idle';
  private _currentChild: UtilityProcess | null = null;
  private _currentChannel: ElectronUtilityProcessChannel | null = null;
  private _restartCount = 0;
  private _firstFailureAt: number | null = null;

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
      this._transition('failed', err);
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

  private _fireChannelReady(
    channel: ElectronUtilityProcessChannel,
    pid: number,
    isRestart: boolean
  ): void {
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
    this.logger('warn', 'utility process exited unexpectedly', {
      participantId: this.opts.participantId,
      pid: this._currentChild?.pid,
      code,
    });

    const policy = this.opts.restartPolicy;
    if (!policy) {
      this._transition(
        'failed',
        `child exited (code=${code}) and no restartPolicy`
      );
      return;
    }

    if (this._firstFailureAt === null) {
      this._firstFailureAt = Date.now();
    }

    const ctx: RetryContext = {
      previousRetryCount: this._restartCount,
      elapsedMs: Date.now() - this._firstFailureAt,
      retryReason: `child exited (code=${code})`,
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

    this._transition('restarting');
    setTimeout(() => {
      void this._performRestart();
    }, delay);
  }

  private async _performRestart(): Promise<void> {
    if (this._state !== 'restarting') {
      // Most likely stop() raced ahead of the scheduled restart.
      return;
    }

    // Bump restartCount BEFORE spawning so onSpawn / onChannelReady
    // see the post-restart count (matches the public `restartCount`
    // semantic = "number of completed restarts after this spawn").
    this._restartCount += 1;

    let newChild: UtilityProcess;
    try {
      newChild = this._spawn(true);
    } catch (err) {
      // Roll back the increment so policy retry counts stay accurate.
      this._restartCount -= 1;
      // Spawn itself failed — defer to restart policy again.
      this._handleUnexpectedExit(null);
      return;
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

    // Old child cleanup: it has already emitted `exit` (that is what
    // brought us here), so we just drop our references. The channel
    // is dead too. Detach old exit listener defensively.
    this._currentChild = newChild;
    this._currentChannel = newChannel;
    this._wireChildExitListener(newChild);

    this._transition('running');
  }

  private _transition(next: SupervisorState, reason?: unknown): void {
    const previous = this._state;
    if (previous === next) return;
    this._state = next;
    this.logger('debug', `supervisor state: ${previous} → ${next}`, {
      participantId: this.opts.participantId,
      reason: reason instanceof Error ? reason.message : reason,
    });
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
