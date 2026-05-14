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

export interface UtilityProcessSupervisorOptions {
  /** The orchestrator the spawned process registers with. */
  orchestrator: BaseConnectionOrchestrator;

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
      child = this._spawn();
    } catch (err) {
      this._transition('failed', err);
      throw err;
    }

    const channel = new ElectronUtilityProcessChannel({
      process: child,
      description: this.opts.participantId,
    });

    this.opts.orchestrator.registerParticipant(
      this.opts.participantId,
      channel,
      this.opts.role ?? 'utility'
    );

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

    this.opts.orchestrator.unregisterParticipant(this.opts.participantId);

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

  private _spawn(): UtilityProcess {
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
    });
    return child;
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

    let newChild: UtilityProcess;
    try {
      newChild = this._spawn();
    } catch (err) {
      // Spawn itself failed — defer to restart policy again.
      this._handleUnexpectedExit(null);
      return;
    }

    const newChannel = new ElectronUtilityProcessChannel({
      process: newChild,
      description: `${this.opts.participantId} (restart #${
        this._restartCount + 1
      })`,
    });

    this.opts.orchestrator.replaceParticipantChannel(
      this.opts.participantId,
      newChannel,
      { autoReconnect: true }
    );

    // Old child cleanup: it has already emitted `exit` (that is what
    // brought us here), so we just drop our references. The channel
    // is dead too. Detach old exit listener defensively.
    this._currentChild = newChild;
    this._currentChannel = newChannel;
    this._restartCount += 1;
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
