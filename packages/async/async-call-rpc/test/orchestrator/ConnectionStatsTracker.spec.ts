import { describe, expect, it, beforeEach } from 'vitest';
import { ConnectionStatsTracker } from '../../src/orchestrator/ConnectionStatsTracker';
import { ConnectionState } from '../../src/orchestrator/ConnectionState';

describe('ConnectionStatsTracker', () => {
  let tracker: ConnectionStatsTracker;
  const CONN_ID = 'a--b';

  beforeEach(() => {
    tracker = new ConnectionStatsTracker(CONN_ID, 10_000); // 10 s window
  });

  // ── Counters ───────────────────────────────────────────────────────────────

  it('starts with all counters at zero', () => {
    const snap = tracker.snapshot(ConnectionState.READY);
    expect(snap.totalRpcCalls).toBe(0);
    expect(snap.successfulCalls).toBe(0);
    expect(snap.failedCalls).toBe(0);
    expect(snap.timeouts).toBe(0);
  });

  it('increments counters on recordCall(success=true)', () => {
    tracker.recordCall(50, true);
    const snap = tracker.snapshot(ConnectionState.READY);
    expect(snap.totalRpcCalls).toBe(1);
    expect(snap.successfulCalls).toBe(1);
    expect(snap.failedCalls).toBe(0);
  });

  it('increments counters on recordCall(success=false)', () => {
    tracker.recordCall(200, false);
    const snap = tracker.snapshot(ConnectionState.READY);
    expect(snap.totalRpcCalls).toBe(1);
    expect(snap.successfulCalls).toBe(0);
    expect(snap.failedCalls).toBe(1);
  });

  it('increments timeouts and failedCalls on recordTimeout', () => {
    tracker.recordTimeout();
    const snap = tracker.snapshot(ConnectionState.READY);
    expect(snap.timeouts).toBe(1);
    expect(snap.failedCalls).toBe(1);
    expect(snap.totalRpcCalls).toBe(1);
  });

  // ── Average latency ───────────────────────────────────────────────────────

  it('computes average latency correctly', () => {
    tracker.recordCall(100, true);
    tracker.recordCall(200, true);
    tracker.recordCall(300, true);
    const snap = tracker.snapshot(ConnectionState.READY);
    expect(snap.avgLatencyMs).toBeCloseTo(200);
  });

  // ── P99 latency ──────────────────────────────────────────────────────────

  it('computes p99 latency correctly', () => {
    // 100 samples: 99 at 10 ms, 1 at 1000 ms → p99 ≈ 10 ms (index 98)
    for (let i = 0; i < 99; i++) tracker.recordCall(10, true);
    tracker.recordCall(1000, true);

    const snap = tracker.snapshot(ConnectionState.READY);
    // p99 index = floor(100 * 0.99) = 99 → last element = 1000
    expect(snap.p99LatencyMs).toBe(1000);
  });

  // ── Recent failure rate ───────────────────────────────────────────────────

  it('computes windowed failure rate', () => {
    const now = 1_000_000;
    tracker.recordCall(10, true, now); // success
    tracker.recordCall(10, false, now + 1); // failure
    const snap = tracker.snapshot(ConnectionState.READY, now + 2);
    // 1 fail / 2 total = 0.5
    expect(snap.recentFailureRate).toBeCloseTo(0.5);
  });

  it('excludes old samples from recent failure rate', () => {
    const now = 1_000_000;
    // old failures (before window)
    tracker.recordCall(10, false, now);
    tracker.recordCall(10, false, now + 1);

    // recent success (11 s later, inside a 10 s window check from 11001)
    tracker.recordCall(10, true, now + 11_001);
    tracker.recordCall(10, true, now + 11_002);

    const snap = tracker.snapshot(ConnectionState.READY, now + 11_002);
    // only the 2 recent successes fall inside the window → rate 0
    expect(snap.recentFailureRate).toBe(0);
  });

  // ── Recent average latency ────────────────────────────────────────────────

  it('computes recent average latency using windowed records', () => {
    const now = 1_000_000;
    tracker.recordCall(100, true, now);
    tracker.recordCall(200, true, now + 1);
    const snap = tracker.snapshot(ConnectionState.READY, now + 2);
    expect(snap.recentAvgLatencyMs).toBeCloseTo(150);
  });

  // ── Reconnect / disconnect history ───────────────────────────────────────

  it('tracks reconnect count', () => {
    tracker.recordReconnect();
    tracker.recordReconnect();
    expect(tracker.snapshot(ConnectionState.READY).totalReconnects).toBe(2);
  });

  it('tracks last disconnect time', () => {
    const t = Date.now();
    tracker.recordDisconnect(t);
    expect(
      tracker.snapshot(ConnectionState.TRANSIENT_FAILURE).lastDisconnectedAt
    ).toBe(t);
  });

  // ── reset() ──────────────────────────────────────────────────────────────

  it('reset() clears all counters and samples', () => {
    tracker.recordCall(100, true);
    tracker.recordCall(200, false);
    tracker.recordReconnect();
    tracker.reset();

    const snap = tracker.snapshot(ConnectionState.IDLE);
    expect(snap.totalRpcCalls).toBe(0);
    expect(snap.successfulCalls).toBe(0);
    expect(snap.failedCalls).toBe(0);
    expect(snap.avgLatencyMs).toBe(0);
    expect(snap.p99LatencyMs).toBe(0);
    expect(snap.totalReconnects).toBe(0);
    expect(snap.recentFailureRate).toBe(0);
  });

  // ── G3 stateTransitions ring buffer ──────────────────────────────────────

  describe('stateTransitions ring buffer', () => {
    it('starts empty', () => {
      const snap = tracker.snapshot(ConnectionState.IDLE);
      expect(snap.stateTransitions).toEqual([]);
    });

    it('appends each recordStateTransition() call (oldest first)', () => {
      tracker.recordStateTransition(
        ConnectionState.IDLE,
        ConnectionState.CONNECTING,
        undefined,
        100
      );
      tracker.recordStateTransition(
        ConnectionState.CONNECTING,
        ConnectionState.READY,
        'connected',
        200
      );

      const snap = tracker.snapshot(ConnectionState.READY);
      expect(snap.stateTransitions).toHaveLength(2);
      expect(snap.stateTransitions[0]).toEqual({
        at: 100,
        prev: ConnectionState.IDLE,
        curr: ConnectionState.CONNECTING,
        reason: undefined,
      });
      expect(snap.stateTransitions[1]).toEqual({
        at: 200,
        prev: ConnectionState.CONNECTING,
        curr: ConnectionState.READY,
        reason: 'connected',
      });
    });

    it('caps at configured size, dropping oldest', () => {
      const small = new ConnectionStatsTracker(CONN_ID, 10_000, 3);
      for (let i = 0; i < 5; i++) {
        small.recordStateTransition(
          ConnectionState.IDLE,
          ConnectionState.CONNECTING,
          `r${i}`,
          1000 + i
        );
      }
      const snap = small.snapshot(ConnectionState.CONNECTING);
      expect(snap.stateTransitions).toHaveLength(3);
      expect(snap.stateTransitions.map((t) => t.reason)).toEqual([
        'r2',
        'r3',
        'r4',
      ]);
    });

    it('snapshot returns a defensive copy', () => {
      tracker.recordStateTransition(
        ConnectionState.IDLE,
        ConnectionState.CONNECTING,
        'first',
        100
      );

      const snap = tracker.snapshot(ConnectionState.CONNECTING);
      // mutate the snapshot — internal state must be untouched
      (snap.stateTransitions as Array<{ reason?: string }>)[0].reason =
        'mutated';
      const snap2 = tracker.snapshot(ConnectionState.CONNECTING);
      expect(snap2.stateTransitions[0].reason).toBe('first');
    });

    it('reset() clears the ring buffer', () => {
      tracker.recordStateTransition(
        ConnectionState.IDLE,
        ConnectionState.CONNECTING,
        undefined,
        100
      );
      tracker.reset();
      expect(tracker.snapshot(ConnectionState.IDLE).stateTransitions).toEqual(
        []
      );
    });
  });
});
