import { describe, expect, it, beforeEach } from 'vitest';
import { CircuitBreaker } from '../../src/orchestrator/CircuitBreaker';
import { CircuitBreakerConfig } from '../../src/orchestrator/types';

function makeBreaker(
  overrides: Partial<CircuitBreakerConfig> = {}
): CircuitBreaker {
  return new CircuitBreaker({
    enabled: true,
    failureRateThreshold: 0.5,
    volumeThreshold: 4,
    rollingWindowMs: 10_000,
    openDurationMs: 5_000,
    halfOpenRequests: 2,
    ...overrides,
  });
}

describe('CircuitBreaker', () => {
  let breaker: CircuitBreaker;

  beforeEach(() => {
    breaker = makeBreaker();
  });

  // ── Initial state ───────────────────────────────────────────────────────────

  it('starts CLOSED', () => {
    expect(breaker.state).toBe('CLOSED');
    expect(breaker.isClosed).toBe(true);
    expect(breaker.isOpen).toBe(false);
    expect(breaker.isHalfOpen).toBe(false);
  });

  it('allows requests when CLOSED', () => {
    expect(breaker.allowRequest()).toBe(true);
  });

  // ── CLOSED → OPEN ──────────────────────────────────────────────────────────

  it('opens when failure rate exceeds threshold (>= volumeThreshold samples)', () => {
    const now = 1_000_000;
    // 2 success, 2 failures → 50% = threshold → should open
    breaker.recordSuccess(now);
    breaker.recordSuccess(now + 1);
    breaker.recordFailure(now + 2);
    breaker.recordFailure(now + 3);

    expect(breaker.state).toBe('OPEN');
    expect(breaker.isOpen).toBe(true);
  });

  it('does NOT open before volumeThreshold samples', () => {
    // volumeThreshold = 4, only 3 samples, all failures → should stay CLOSED
    const now = 1_000_000;
    breaker.recordFailure(now);
    breaker.recordFailure(now + 1);
    breaker.recordFailure(now + 2);

    expect(breaker.state).toBe('CLOSED');
  });

  // ── OPEN: blocks requests ──────────────────────────────────────────────────

  it('blocks requests when OPEN (before openDurationMs)', () => {
    const now = 1_000_000;
    // open the breaker (all same ts → _openedAt = now)
    for (let i = 0; i < 4; i++) breaker.recordFailure(now);
    expect(breaker.state).toBe('OPEN');

    // 10ms after opening — still within openDurationMs (5000ms)
    expect(breaker.allowRequest(now + 10)).toBe(false);
  });

  // ── OPEN → HALF_OPEN ───────────────────────────────────────────────────────

  it('transitions to HALF_OPEN after openDurationMs', () => {
    const now = 1_000_000;
    // all 4 failures at the same timestamp → _openedAt = now
    for (let i = 0; i < 4; i++) breaker.recordFailure(now);
    expect(breaker.state).toBe('OPEN');

    // after 5 s (openDurationMs = 5000): now + 5001 - now = 5001 >= 5000 ✓
    expect(breaker.allowRequest(now + 5_001)).toBe(true);
    expect(breaker.state).toBe('HALF_OPEN');
  });

  // ── HALF_OPEN → CLOSED ────────────────────────────────────────────────────

  it('transitions HALF_OPEN → CLOSED after all probes succeed', () => {
    const now = 1_000_000;
    // open (all same ts so _openedAt = now)
    for (let i = 0; i < 4; i++) breaker.recordFailure(now);
    // transition to HALF_OPEN
    breaker.allowRequest(now + 5_001);
    expect(breaker.state).toBe('HALF_OPEN');

    // halfOpenRequests = 2: allow one more probe
    breaker.allowRequest(now + 5_002); // probe 2

    // record success for each probe
    breaker.recordSuccess(now + 5_003);
    breaker.recordSuccess(now + 5_004);

    expect(breaker.state).toBe('CLOSED');
  });

  // ── HALF_OPEN → OPEN ─────────────────────────────────────────────────────

  it('transitions HALF_OPEN → OPEN on probe failure', () => {
    const now = 1_000_000;
    for (let i = 0; i < 4; i++) breaker.recordFailure(now);
    breaker.allowRequest(now + 5_001); // → HALF_OPEN
    expect(breaker.state).toBe('HALF_OPEN');

    // one failure while HALF_OPEN → back to OPEN
    breaker.recordFailure(now + 5_002);
    expect(breaker.state).toBe('OPEN');
  });

  // ── Sliding window pruning ────────────────────────────────────────────────

  it('prunes old samples outside the rolling window', () => {
    const now = 1_000_000;
    // Record 4 failures, then wait past the window
    for (let i = 0; i < 4; i++) breaker.recordFailure(now + i);
    expect(breaker.state).toBe('OPEN');

    // reset and record fresh samples 15 s later — old samples pruned
    breaker.reset();
    const later = now + 15_000; // outside rollingWindowMs (10 s)
    breaker.recordSuccess(later);
    breaker.recordSuccess(later + 1);
    // only 2 samples, below volumeThreshold (4) → stays CLOSED
    expect(breaker.state).toBe('CLOSED');
  });

  // ── reset() ──────────────────────────────────────────────────────────────

  it('reset() brings breaker back to CLOSED with no samples', () => {
    const now = 1_000_000;
    for (let i = 0; i < 4; i++) breaker.recordFailure(now);
    expect(breaker.state).toBe('OPEN');

    breaker.reset();
    expect(breaker.state).toBe('CLOSED');
    expect(breaker.allowRequest()).toBe(true);
  });

  // ── fallback ─────────────────────────────────────────────────────────────

  it('applyFallback calls the configured fallback function', () => {
    const fb = makeBreaker({ fallback: () => 'cached' });
    expect(fb.applyFallback()).toBe('cached');
  });

  it('applyFallback throws when no fallback is configured', () => {
    const now = Date.now();
    for (let i = 0; i < 4; i++) breaker.recordFailure(now + i);
    expect(() => breaker.applyFallback()).toThrow('[CircuitBreaker]');
  });
});
