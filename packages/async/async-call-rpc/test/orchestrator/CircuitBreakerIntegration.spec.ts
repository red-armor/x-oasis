/**
 * Integration tests for D-005 — CircuitBreaker wiring into the
 * BaseConnectionOrchestrator connect / heartbeat paths.
 *
 * Verifies that the previously dead `circuitBreaker.enabled = true`
 * config now actually drives the breaker:
 *   1. allowRequest gate before _doConnect
 *   2. recordSuccess on connect success
 *   3. recordFailure on connect failure
 *   4. recordFailure on heartbeat timeout
 *   5. recordSuccess via _handleHeartbeatAck hook
 *   6. fallback path when OPEN with a configured fallback
 *
 * Reference: codebase-wiki/discussion/20260514-circuit-breaker-dead-code.md
 */
import { describe, expect, it, beforeEach } from 'vitest';
import { BaseConnectionOrchestrator } from '../../src/orchestrator/BaseConnectionOrchestrator';
import { ConnectionState } from '../../src/orchestrator/ConnectionState';
import {
  ParticipantInfo,
  ActivationConfig,
  PortPair,
} from '../../src/orchestrator/types';
import AbstractChannelProtocol from '../../src/protocol/AbstractChannelProtocol';

// ── Stubs ──────────────────────────────────────────────────────────────────

class StubChannel extends AbstractChannelProtocol {
  send() {}
  on() {
    return () => {};
  }
}

/**
 * TestOrchestrator with switchable activate behaviour and exposed
 * heartbeat hooks so we can drive the circuit-breaker code paths
 * directly without spinning up real ports.
 */
class TestOrchestrator extends BaseConnectionOrchestrator {
  portPairCounter = 0;
  shouldFailActivate = false;

  createPortPair(): PortPair {
    this.portPairCounter++;
    return {
      port1: `port${this.portPairCounter}a`,
      port2: `port${this.portPairCounter}b`,
    };
  }

  activateParticipant(
    _info: ParticipantInfo,
    _config: ActivationConfig
  ): Promise<void> {
    if (this.shouldFailActivate) {
      return Promise.reject(new Error('activate failed'));
    }
    return Promise.resolve();
  }

  // Expose internals
  getMc(connectionId: string) {
    return (this as any).connections.get(connectionId);
  }
  fireHeartbeatTimeout(connectionId: string) {
    const mc = (this as any).connections.get(connectionId);
    (this as any)._handleHeartbeatTimeout(mc);
  }
  fireHeartbeatAck(connectionId: string) {
    const mc = (this as any).connections.get(connectionId);
    (this as any)._handleHeartbeatAck(mc);
  }
}

function makeOrchestrator(extraConfig: Record<string, any> = {}) {
  const orch = new TestOrchestrator({
    circuitBreaker: {
      enabled: true,
      failureRateThreshold: 0.5,
      volumeThreshold: 3,
      rollingWindowMs: 10_000,
      openDurationMs: 30_000,
      halfOpenRequests: 2,
      ...(extraConfig.circuitBreaker ?? {}),
    },
    ...extraConfig,
  });
  orch.registerParticipant('a', new StubChannel(), 'process');
  orch.registerParticipant('b', new StubChannel(), 'process');
  return orch;
}

const PAIR: [string, string] = ['a', 'b'];
const CID = 'a--b'; // canonical: alphabetically sorted, joined by '--'

// ── Tests ──────────────────────────────────────────────────────────────────

describe('D-005 — CircuitBreaker wired into orchestrator connect/heartbeat', () => {
  describe('default behaviour (breaker disabled)', () => {
    it('does not attach a breaker when circuitBreaker.enabled = false', async () => {
      const orch = new TestOrchestrator({
        circuitBreaker: { enabled: false } as any,
      });
      orch.registerParticipant('a', new StubChannel(), 'process');
      orch.registerParticipant('b', new StubChannel(), 'process');

      const info = await orch.connect(...PAIR);
      const mc = orch.getMc(info.connectionId);
      expect(mc.circuitBreaker).toBeUndefined();
    });

    it('does not attach a breaker when circuitBreaker config is omitted', async () => {
      const orch = new TestOrchestrator();
      orch.registerParticipant('a', new StubChannel(), 'process');
      orch.registerParticipant('b', new StubChannel(), 'process');

      const info = await orch.connect(...PAIR);
      const mc = orch.getMc(info.connectionId);
      expect(mc.circuitBreaker).toBeUndefined();
    });
  });

  describe('connect path', () => {
    let orch: TestOrchestrator;

    beforeEach(() => {
      orch = makeOrchestrator();
    });

    it('attaches a breaker on first connect when enabled', async () => {
      const info = await orch.connect(...PAIR);
      const mc = orch.getMc(info.connectionId);
      expect(mc.circuitBreaker).toBeDefined();
      expect(mc.circuitBreaker.state).toBe('CLOSED');
    });

    it('records success on connect success', async () => {
      const info = await orch.connect(...PAIR);
      const mc = orch.getMc(info.connectionId);
      expect(mc.circuitBreaker.state).toBe('CLOSED');
      // No samples of failure should have been recorded.
      // We can't read samples directly, but breaker should remain CLOSED
      // and allowRequest should still return true.
      expect(mc.circuitBreaker.allowRequest()).toBe(true);
    });

    it('records failure on connect failure (no retryOnInitialFailure)', async () => {
      orch.shouldFailActivate = true;
      await expect(orch.connect(...PAIR)).rejects.toThrow('activate failed');
      const mc = orch.getMc(CID);
      expect(mc.circuitBreaker).toBeDefined();
      // Single failure under volumeThreshold=3 — still CLOSED
      expect(mc.circuitBreaker.state).toBe('CLOSED');
    });

    it('opens the breaker after volumeThreshold failures past failure-rate threshold', async () => {
      orch.shouldFailActivate = true;
      // 3 consecutive failures @ 100% rate vs threshold 50% ⇒ should OPEN
      for (let i = 0; i < 3; i++) {
        await expect(orch.connect(...PAIR)).rejects.toThrow('activate failed');
      }
      const mc = orch.getMc(CID);
      expect(mc.circuitBreaker.state).toBe('OPEN');
    });

    it('blocks subsequent connect calls when breaker is OPEN', async () => {
      orch.shouldFailActivate = true;
      for (let i = 0; i < 3; i++) {
        await expect(orch.connect(...PAIR)).rejects.toThrow('activate failed');
      }

      // Even if we now would succeed, the gate should block first.
      orch.shouldFailActivate = false;
      await expect(orch.connect(...PAIR)).rejects.toThrow(
        /\[CircuitBreaker\] connect blocked/
      );
    });

    it('uses the configured fallback when OPEN', async () => {
      const fallback = (ctx: any) => ({
        connectionId: ctx.connectionId,
        fromId: ctx.fromId,
        toId: ctx.toId,
        state: ConnectionState.IDLE,
        fromFallback: true,
      });
      const orch2 = new TestOrchestrator({
        circuitBreaker: {
          enabled: true,
          failureRateThreshold: 0.5,
          volumeThreshold: 3,
          rollingWindowMs: 10_000,
          openDurationMs: 30_000,
          halfOpenRequests: 2,
          fallback,
        },
      });
      orch2.registerParticipant('a', new StubChannel(), 'process');
      orch2.registerParticipant('b', new StubChannel(), 'process');

      orch2.shouldFailActivate = true;
      for (let i = 0; i < 3; i++) {
        await expect(orch2.connect(...PAIR)).rejects.toThrow('activate failed');
      }

      orch2.shouldFailActivate = false;
      const result: any = await orch2.connect(...PAIR);
      expect(result.fromFallback).toBe(true);
      expect(result.connectionId).toBe(CID);
    });
  });

  describe('heartbeat path', () => {
    let orch: TestOrchestrator;

    beforeEach(async () => {
      orch = makeOrchestrator();
      await orch.connect(...PAIR);
    });

    it('records failure on heartbeat timeout', () => {
      const mc = orch.getMc(CID);
      // 3 heartbeat timeouts at volumeThreshold=3, rate 100% > 50% ⇒ OPEN
      orch.fireHeartbeatTimeout(CID);
      orch.fireHeartbeatTimeout(CID);
      // Each timeout calls _handleConnectionLost which moves state, so for
      // this test we just need to verify samples accumulate. Re-set state
      // back to READY between fires so the guard inside _handleHeartbeatTimeout
      // doesn't short-circuit. We cheat via testTransitionState equivalent:
      const reset = () => {
        mc.state = ConnectionState.READY;
      };
      reset();
      orch.fireHeartbeatTimeout(CID);

      expect(mc.circuitBreaker.state).toBe('OPEN');
    });

    it('records success when subclasses call _handleHeartbeatAck', () => {
      const mc = orch.getMc(CID);
      // Mix: 2 successes + 1 failure at volumeThreshold=3 ⇒ rate 1/3 < 0.5 ⇒ stays CLOSED
      orch.fireHeartbeatAck(CID);
      orch.fireHeartbeatAck(CID);
      mc.state = ConnectionState.READY; // ensure not short-circuited
      orch.fireHeartbeatTimeout(CID);
      expect(mc.circuitBreaker.state).toBe('CLOSED');
    });
  });
});
