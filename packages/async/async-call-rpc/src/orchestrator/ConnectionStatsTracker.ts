import { ConnectionState } from './ConnectionState';
import { ConnectionStats, StateTransitionRecord } from './types';

interface CallRecord {
  timestamp: number;
  latencyMs: number;
  success: boolean;
}

/** Default ring-buffer capacity for `stateTransitions`. */
const DEFAULT_STATE_TRANSITIONS_SIZE = 50;

/**
 * Tracks per-connection health metrics.
 *
 * Counters and latency samples are accumulated over the lifetime of the
 * connection.  "Recent" metrics use a sliding window of `windowMs` (default
 * 60 s) for failure-rate and average-latency calculations.
 */
export class ConnectionStatsTracker {
  private _totalRpcCalls = 0;
  private _successfulCalls = 0;
  private _failedCalls = 0;
  private _timeouts = 0;

  private _totalReconnects = 0;
  private _lastConnectedAt: number;
  private _lastDisconnectedAt: number | undefined = undefined;

  /** All latency samples, kept for p99 calculation. */
  private _latencySamples: number[] = [];

  /** Windowed call records for recent failure-rate and latency. */
  private _windowedRecords: CallRecord[] = [];
  private readonly _windowMs: number;

  /** Ring buffer of recent state transitions (oldest first). */
  private _stateTransitions: StateTransitionRecord[] = [];
  private readonly _stateTransitionsSize: number;

  constructor(
    private readonly connectionId: string,
    windowMs = 60_000,
    stateTransitionsSize = DEFAULT_STATE_TRANSITIONS_SIZE
  ) {
    this._windowMs = windowMs;
    this._stateTransitionsSize = stateTransitionsSize;
    this._lastConnectedAt = Date.now();
  }

  // ── Record events ──────────────────────────────────────────────────────────

  recordCall(latencyMs: number, success: boolean, now = Date.now()): void {
    this._totalRpcCalls++;
    if (success) {
      this._successfulCalls++;
    } else {
      this._failedCalls++;
    }

    this._latencySamples.push(latencyMs);
    this._windowedRecords.push({ timestamp: now, latencyMs, success });
    this._pruneWindow(now);
  }

  recordTimeout(now = Date.now()): void {
    this._timeouts++;
    this._failedCalls++;
    this._totalRpcCalls++;
    this._windowedRecords.push({
      timestamp: now,
      latencyMs: 0,
      success: false,
    });
    this._pruneWindow(now);
  }

  recordReconnect(now = Date.now()): void {
    this._totalReconnects++;
    this._lastConnectedAt = now;
  }

  recordDisconnect(now = Date.now()): void {
    this._lastDisconnectedAt = now;
  }

  /**
   * Append a state transition to the ring buffer. Oldest entry is
   * dropped when the buffer exceeds its configured size. `splice` keeps
   * the array reference stable so external `Readonly` views remain
   * valid.
   */
  recordStateTransition(
    prev: ConnectionState,
    curr: ConnectionState,
    reason: string | undefined,
    now = Date.now()
  ): void {
    this._stateTransitions.push({ at: now, prev, curr, reason });
    if (this._stateTransitions.length > this._stateTransitionsSize) {
      this._stateTransitions.splice(
        0,
        this._stateTransitions.length - this._stateTransitionsSize
      );
    }
  }

  // ── Snapshot ───────────────────────────────────────────────────────────────

  snapshot(state: ConnectionState, now = Date.now()): ConnectionStats {
    this._pruneWindow(now);

    return {
      connectionId: this.connectionId,
      state,

      totalRpcCalls: this._totalRpcCalls,
      successfulCalls: this._successfulCalls,
      failedCalls: this._failedCalls,
      timeouts: this._timeouts,

      avgLatencyMs: this._avgLatency(),
      p99LatencyMs: this._p99Latency(),

      totalReconnects: this._totalReconnects,
      lastConnectedAt: this._lastConnectedAt,
      lastDisconnectedAt: this._lastDisconnectedAt,
      uptime:
        this._lastDisconnectedAt == null
          ? now - this._lastConnectedAt
          : this._lastDisconnectedAt - this._lastConnectedAt,

      recentFailureRate: this._recentFailureRate(),
      recentAvgLatencyMs: this._recentAvgLatency(),

      // Defensive copy so callers cannot mutate the live ring buffer.
      stateTransitions: this._stateTransitions.map((t) => ({ ...t })),
    };
  }

  reset(): void {
    this._totalRpcCalls = 0;
    this._successfulCalls = 0;
    this._failedCalls = 0;
    this._timeouts = 0;
    this._totalReconnects = 0;
    this._lastConnectedAt = Date.now();
    this._lastDisconnectedAt = undefined;
    this._latencySamples = [];
    this._windowedRecords = [];
    this._stateTransitions = [];
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  private _pruneWindow(now: number): void {
    const cutoff = now - this._windowMs;
    this._windowedRecords = this._windowedRecords.filter(
      (r) => r.timestamp > cutoff
    );
  }

  private _avgLatency(): number {
    if (!this._latencySamples.length) return 0;
    const sum = this._latencySamples.reduce((a, b) => a + b, 0);
    return sum / this._latencySamples.length;
  }

  private _p99Latency(): number {
    if (!this._latencySamples.length) return 0;
    const sorted = [...this._latencySamples].sort((a, b) => a - b);
    const idx = Math.floor(sorted.length * 0.99);
    return sorted[Math.min(idx, sorted.length - 1)];
  }

  private _recentFailureRate(): number {
    if (!this._windowedRecords.length) return 0;
    const failures = this._windowedRecords.filter((r) => !r.success).length;
    return failures / this._windowedRecords.length;
  }

  private _recentAvgLatency(): number {
    const relevant = this._windowedRecords.filter((r) => r.latencyMs > 0);
    if (!relevant.length) return 0;
    const sum = relevant.reduce((a, b) => a + b.latencyMs, 0);
    return sum / relevant.length;
  }
}
