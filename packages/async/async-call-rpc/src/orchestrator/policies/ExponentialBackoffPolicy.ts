import { ReconnectPolicy, RetryContext } from '../types';

export interface ExponentialBackoffOptions {
  /** Delay before the first retry. Default: 1000 ms. */
  initialDelayMs?: number;
  /** Upper cap on the delay. Default: 30_000 ms. */
  maxDelayMs?: number;
  /** Exponential growth factor. Default: 2. */
  multiplier?: number;
  /**
   * Jitter factor in [0, 1].  The actual delay is shifted by
   * `± jitterFactor × cappedDelay × random`.  Default: 0.3.
   */
  jitterFactor?: number;
  /** Maximum number of retries. Default: Infinity. */
  maxRetries?: number;
  /** Give up after this many ms have elapsed since the first failure. Default: 300_000 (5 min). */
  maxElapsedMs?: number;
}

/**
 * Exponential back-off with optional full-jitter — the Socket.IO / AWS SDK
 * industry standard for reconnect scheduling.
 *
 * Formula:
 * ```
 * base   = initialDelayMs × multiplier^attempt
 * capped = min(base, maxDelayMs)
 * jitter = capped × jitterFactor × (rand in [-1, 1])
 * actual = max(0, capped + jitter)
 * ```
 */
export class ExponentialBackoffPolicy implements ReconnectPolicy {
  private readonly initialDelayMs: number;
  private readonly maxDelayMs: number;
  private readonly multiplier: number;
  private readonly jitterFactor: number;
  private readonly maxRetries: number;
  private readonly maxElapsedMs: number;

  constructor(options: ExponentialBackoffOptions = {}) {
    this.initialDelayMs = options.initialDelayMs ?? 1_000;
    this.maxDelayMs = options.maxDelayMs ?? 30_000;
    this.multiplier = options.multiplier ?? 2;
    this.jitterFactor = options.jitterFactor ?? 0.3;
    this.maxRetries = options.maxRetries ?? Infinity;
    this.maxElapsedMs = options.maxElapsedMs ?? 300_000;
  }

  nextRetryDelayMs(context: RetryContext): number | null {
    if (context.previousRetryCount >= this.maxRetries) return null;
    if (context.elapsedMs >= this.maxElapsedMs) return null;

    const base =
      this.initialDelayMs *
      Math.pow(this.multiplier, context.previousRetryCount);
    const capped = Math.min(base, this.maxDelayMs);

    // Full jitter: shift in [-jitter, +jitter]
    const jitter = capped * this.jitterFactor * (Math.random() * 2 - 1);

    return Math.max(0, capped + jitter);
  }
}
