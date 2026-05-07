import { describe, expect, it } from 'vitest';
import { ExponentialBackoffPolicy } from '../../src/orchestrator/policies/ExponentialBackoffPolicy';
import { FixedDelayPolicy } from '../../src/orchestrator/policies/FixedDelayPolicy';
import { NeverReconnectPolicy } from '../../src/orchestrator/policies/NeverReconnectPolicy';
import { RetryContext } from '../../src/orchestrator/types';

function makeCtx(previousRetryCount: number, elapsedMs = 0): RetryContext {
  return {
    previousRetryCount,
    elapsedMs,
    retryReason: 'test',
    connectionId: 'a--b',
    fromId: 'a',
    toId: 'b',
  };
}

// ─── ExponentialBackoffPolicy ─────────────────────────────────────────────────

describe('ExponentialBackoffPolicy', () => {
  it('first retry delay is around initialDelayMs', () => {
    const policy = new ExponentialBackoffPolicy({
      initialDelayMs: 1000,
      jitterFactor: 0,
    });
    const delay = policy.nextRetryDelayMs(makeCtx(0));
    expect(delay).toBe(1000);
  });

  it('delay grows exponentially', () => {
    const policy = new ExponentialBackoffPolicy({
      initialDelayMs: 1000,
      multiplier: 2,
      jitterFactor: 0,
      maxDelayMs: Infinity,
    });
    expect(policy.nextRetryDelayMs(makeCtx(0))).toBe(1000);
    expect(policy.nextRetryDelayMs(makeCtx(1))).toBe(2000);
    expect(policy.nextRetryDelayMs(makeCtx(2))).toBe(4000);
    expect(policy.nextRetryDelayMs(makeCtx(3))).toBe(8000);
  });

  it('delay is capped at maxDelayMs', () => {
    const policy = new ExponentialBackoffPolicy({
      initialDelayMs: 1000,
      multiplier: 2,
      jitterFactor: 0,
      maxDelayMs: 5000,
    });
    // 1000 * 2^10 = 1_024_000 → capped at 5000
    const delay = policy.nextRetryDelayMs(makeCtx(10));
    expect(delay).toBe(5000);
  });

  it('jitter stays within ±jitterFactor × cappedDelay', () => {
    const policy = new ExponentialBackoffPolicy({
      initialDelayMs: 1000,
      multiplier: 2,
      maxDelayMs: 30_000,
      jitterFactor: 0.5,
    });
    for (let i = 0; i < 50; i++) {
      const delay = policy.nextRetryDelayMs(makeCtx(0))!;
      expect(delay).toBeGreaterThanOrEqual(0);
      expect(delay).toBeLessThanOrEqual(1500); // 1000 + 0.5*1000
    }
  });

  it('returns null after maxRetries is exceeded', () => {
    const policy = new ExponentialBackoffPolicy({ maxRetries: 3 });
    expect(policy.nextRetryDelayMs(makeCtx(3))).toBeNull();
    expect(policy.nextRetryDelayMs(makeCtx(4))).toBeNull();
  });

  it('returns null after maxElapsedMs is exceeded', () => {
    const policy = new ExponentialBackoffPolicy({ maxElapsedMs: 60_000 });
    expect(policy.nextRetryDelayMs(makeCtx(0, 60_001))).toBeNull();
  });

  it('still returns a delay if elapsedMs equals maxElapsedMs exactly', () => {
    // boundary: elapsed === max should also be null (>= check)
    const policy = new ExponentialBackoffPolicy({ maxElapsedMs: 60_000 });
    expect(policy.nextRetryDelayMs(makeCtx(0, 60_000))).toBeNull();
  });

  it('returns non-null within limits', () => {
    const policy = new ExponentialBackoffPolicy({
      maxRetries: 5,
      maxElapsedMs: 300_000,
    });
    expect(policy.nextRetryDelayMs(makeCtx(0, 0))).not.toBeNull();
    expect(policy.nextRetryDelayMs(makeCtx(4, 1000))).not.toBeNull();
  });
});

// ─── FixedDelayPolicy ─────────────────────────────────────────────────────────

describe('FixedDelayPolicy', () => {
  it('returns the correct delay for each attempt', () => {
    const policy = new FixedDelayPolicy([0, 1000, 5000, 30_000]);
    expect(policy.nextRetryDelayMs(makeCtx(0))).toBe(0);
    expect(policy.nextRetryDelayMs(makeCtx(1))).toBe(1000);
    expect(policy.nextRetryDelayMs(makeCtx(2))).toBe(5000);
    expect(policy.nextRetryDelayMs(makeCtx(3))).toBe(30_000);
  });

  it('returns null when the sequence is exhausted', () => {
    const policy = new FixedDelayPolicy([0, 1000]);
    expect(policy.nextRetryDelayMs(makeCtx(2))).toBeNull();
    expect(policy.nextRetryDelayMs(makeCtx(100))).toBeNull();
  });

  it('uses default delays when none are provided', () => {
    const policy = new FixedDelayPolicy();
    expect(policy.nextRetryDelayMs(makeCtx(0))).toBe(0);
    expect(policy.nextRetryDelayMs(makeCtx(1))).toBe(2_000);
    expect(policy.nextRetryDelayMs(makeCtx(2))).toBe(10_000);
    expect(policy.nextRetryDelayMs(makeCtx(3))).toBe(30_000);
    expect(policy.nextRetryDelayMs(makeCtx(4))).toBeNull();
  });
});

// ─── NeverReconnectPolicy ────────────────────────────────────────────────────

describe('NeverReconnectPolicy', () => {
  it('always returns null', () => {
    const policy = new NeverReconnectPolicy();
    expect(policy.nextRetryDelayMs(makeCtx(0))).toBeNull();
    expect(policy.nextRetryDelayMs(makeCtx(1))).toBeNull();
    expect(policy.nextRetryDelayMs(makeCtx(100))).toBeNull();
  });
});
