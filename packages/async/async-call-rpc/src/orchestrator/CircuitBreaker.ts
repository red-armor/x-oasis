import { CircuitBreakerConfig } from './types';

export type CircuitBreakerState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

interface Sample {
  timestamp: number;
  success: boolean;
}

/**
 * Three-state circuit breaker inspired by Opossum / Resilience4j.
 *
 * ```
 *           success rate restored
 *      ┌──────────────────────────────┐
 *      │                              │
 *      ▼                              │
 * ┌──────────┐  failure rate ≥ threshold  ┌──────────┐
 * │  CLOSED  │ ─────────────────────────► │   OPEN   │
 * │ (normal) │                            │  (fast   │
 * └──────────┘                            │   fail)  │
 *      ▲                                  └──────────┘
 *      │ probe success                         │
 *      │                               wait openDurationMs
 *      │                                       │
 * ┌──────────────┐ ◄──────────────────────────  │
 * │  HALF_OPEN   │        (probe)               │
 * │  (probing)   │                              │
 * └──────────────┘                              │
 *      │ probe failure ──────────────────────► OPEN
 * ```
 */
export class CircuitBreaker {
  private _state: CircuitBreakerState = 'CLOSED';
  private _samples: Sample[] = [];
  private _openedAt = 0;
  private _halfOpenProbeCount = 0;
  private _successfulProbes = 0;

  private readonly failureRateThreshold: number;
  private readonly volumeThreshold: number;
  private readonly rollingWindowMs: number;
  private readonly openDurationMs: number;
  private readonly halfOpenRequests: number;
  private readonly fallback: ((...args: any[]) => any) | undefined;

  constructor(config: CircuitBreakerConfig) {
    this.failureRateThreshold = config.failureRateThreshold ?? 0.5;
    this.volumeThreshold = config.volumeThreshold ?? 5;
    this.rollingWindowMs = config.rollingWindowMs ?? 10_000;
    this.openDurationMs = config.openDurationMs ?? 30_000;
    this.halfOpenRequests = config.halfOpenRequests ?? 3;
    this.fallback = config.fallback;
  }

  /** Current breaker state. */
  get state(): CircuitBreakerState {
    return this._state;
  }

  /** Convenience booleans. */
  get isClosed(): boolean {
    return this._state === 'CLOSED';
  }
  get isOpen(): boolean {
    return this._state === 'OPEN';
  }
  get isHalfOpen(): boolean {
    return this._state === 'HALF_OPEN';
  }

  /**
   * Returns `true` if the breaker allows the next request through.
   *
   * - CLOSED → always allow
   * - OPEN   → allow only if `openDurationMs` has elapsed (transitions to HALF_OPEN)
   * - HALF_OPEN → allow only up to `halfOpenRequests` probes
   */
  allowRequest(now = Date.now()): boolean {
    if (this._state === 'CLOSED') return true;

    if (this._state === 'OPEN') {
      if (now - this._openedAt >= this.openDurationMs) {
        this._transitionTo('HALF_OPEN');
        this._halfOpenProbeCount = 0;
        this._successfulProbes = 0;
        return true;
      }
      return false;
    }

    // HALF_OPEN
    if (this._halfOpenProbeCount < this.halfOpenRequests) {
      this._halfOpenProbeCount++;
      return true;
    }
    return false;
  }

  /** Record a successful call. */
  recordSuccess(now = Date.now()): void {
    this._pruneSamples(now);
    this._samples.push({ timestamp: now, success: true });

    if (this._state === 'HALF_OPEN') {
      this._successfulProbes++;
      if (this._successfulProbes >= this._halfOpenProbeCount) {
        this._transitionTo('CLOSED');
      }
    }
  }

  /** Record a failed call. */
  recordFailure(now = Date.now()): void {
    this._pruneSamples(now);
    this._samples.push({ timestamp: now, success: false });

    if (this._state === 'HALF_OPEN') {
      this._transitionTo('OPEN');
      this._openedAt = now;
      return;
    }

    if (this._state === 'CLOSED') {
      this._evaluateThreshold(now);
    }
  }

  /** Reset to initial CLOSED state and clear all samples. */
  reset(): void {
    this._state = 'CLOSED';
    this._samples = [];
    this._openedAt = 0;
    this._halfOpenProbeCount = 0;
    this._successfulProbes = 0;
  }

  // ── Private helpers ─────────────────────────────────────────────────────────

  private _transitionTo(state: CircuitBreakerState): void {
    this._state = state;
  }

  private _pruneSamples(now: number): void {
    const cutoff = now - this.rollingWindowMs;
    this._samples = this._samples.filter((s) => s.timestamp > cutoff);
  }

  private _evaluateThreshold(now: number): void {
    if (this._samples.length < this.volumeThreshold) return;

    const failures = this._samples.filter((s) => !s.success).length;
    const rate = failures / this._samples.length;

    if (rate >= this.failureRateThreshold) {
      this._transitionTo('OPEN');
      this._openedAt = now;
    }
  }

  /** Apply the optional fallback function instead of making a live call. */
  applyFallback(...args: any[]): any {
    if (this.fallback) return this.fallback(...args);
    throw new Error(
      '[CircuitBreaker] Circuit is OPEN and no fallback is configured'
    );
  }
}
