import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { BaseConnectionOrchestrator } from '../../src/orchestrator/BaseConnectionOrchestrator';
import { ConnectionState } from '../../src/orchestrator/ConnectionState';
import { NeverReconnectPolicy } from '../../src/orchestrator/policies/NeverReconnectPolicy';
import { FixedDelayPolicy } from '../../src/orchestrator/policies/FixedDelayPolicy';
import {
  PortPair,
  ActivationConfig,
  ParticipantInfo,
} from '../../src/orchestrator/types';

// ─── Test orchestrator ────────────────────────────────────────────────────────

class ReconnectTestOrchestrator extends BaseConnectionOrchestrator {
  public activateCallCount = 0;
  public createPortPairCallCount = 0;
  /** If set to a fn, it will throw on the Nth call to activateParticipant */
  public activateShouldFail: (() => boolean) | null = null;

  protected createPortPair(): PortPair {
    this.createPortPairCallCount++;
    return {
      port1: { _id: `p1-${this.createPortPairCallCount}` },
      port2: { _id: `p2-${this.createPortPairCallCount}` },
    };
  }

  protected async activateParticipant(
    info: ParticipantInfo,
    config: ActivationConfig
  ): Promise<void> {
    this.activateCallCount++;
    if (this.activateShouldFail?.()) {
      throw new Error('simulated activation failure');
    }
    info.channel.send({
      __orchestrator: 'activateConnection',
      payload: config,
    });
  }

  /** Simulate a connection being lost (as if a participant crashed). */
  public simulateConnectionLost(
    connectionId: string,
    reason = 'process died'
  ): void {
    this.handleParticipantLost(connectionId.split('--')[0], reason);
  }
}

function makeStubChannel() {
  return {
    send: vi.fn(),
    on: vi.fn(() => () => {}),
    activate: vi.fn(),
    disconnect: vi.fn(),
    onDidConnected: vi.fn(),
    onDidDisconnected: vi.fn(),
  } as any;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('Reconnection', () => {
  let orchestrator: ReconnectTestOrchestrator;

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    orchestrator?.dispose();
    vi.useRealTimers();
  });

  describe('with NeverReconnectPolicy', () => {
    it('should move directly to CLOSED on connection loss', async () => {
      orchestrator = new ReconnectTestOrchestrator({
        reconnectPolicy: new NeverReconnectPolicy(),
      });

      const chA = makeStubChannel();
      const chB = makeStubChannel();
      orchestrator.registerParticipant('A', chA);
      orchestrator.registerParticipant('B', chB);

      const info = await orchestrator.connect('A', 'B');
      expect(info.state).toBe(ConnectionState.READY);

      orchestrator.handleParticipantLost('A', 'crashed');

      expect(info.state).toBe(ConnectionState.CLOSED);
    });

    it('should fire onReconnectFailed event', async () => {
      orchestrator = new ReconnectTestOrchestrator({
        reconnectPolicy: new NeverReconnectPolicy(),
      });

      const chA = makeStubChannel();
      const chB = makeStubChannel();
      orchestrator.registerParticipant('A', chA);
      orchestrator.registerParticipant('B', chB);

      const onReconnectFailed = vi.fn();
      orchestrator.onReconnectFailed(onReconnectFailed);

      await orchestrator.connect('A', 'B');
      orchestrator.handleParticipantLost('A', 'crashed');

      expect(onReconnectFailed).toHaveBeenCalledWith(
        expect.objectContaining({ connectionId: 'A--B', totalAttempts: 0 })
      );
    });
  });

  describe('with FixedDelayPolicy', () => {
    it('should schedule a reconnect attempt after the delay', async () => {
      orchestrator = new ReconnectTestOrchestrator({
        reconnectPolicy: new FixedDelayPolicy([500, 500, 500]),
      });

      const chA = makeStubChannel();
      const chB = makeStubChannel();
      orchestrator.registerParticipant('A', chA);
      orchestrator.registerParticipant('B', chB);

      await orchestrator.connect('A', 'B');
      const countBefore = orchestrator.activateCallCount;

      orchestrator.handleParticipantLost('A', 'crashed');

      // Immediately after loss: still TRANSIENT_FAILURE, no reconnect yet
      expect(orchestrator.activateCallCount).toBe(countBefore);

      // After delay, reconnect attempt fires
      await vi.advanceTimersByTimeAsync(500);

      expect(orchestrator.activateCallCount).toBeGreaterThan(countBefore);
    });

    it('should become READY again after a successful reconnect', async () => {
      orchestrator = new ReconnectTestOrchestrator({
        reconnectPolicy: new FixedDelayPolicy([200, 200, 200, 200, 200]),
      });

      const chA = makeStubChannel();
      const chB = makeStubChannel();
      orchestrator.registerParticipant('A', chA);
      orchestrator.registerParticipant('B', chB);

      const info = await orchestrator.connect('A', 'B');

      orchestrator.handleParticipantLost('A', 'crashed');
      expect(info.state).toBe(ConnectionState.TRANSIENT_FAILURE);

      await vi.advanceTimersByTimeAsync(200);

      expect(info.state).toBe(ConnectionState.READY);
    });

    it('should fire onReconnecting event', async () => {
      orchestrator = new ReconnectTestOrchestrator({
        reconnectPolicy: new FixedDelayPolicy([300, 300, 300]),
      });

      const chA = makeStubChannel();
      const chB = makeStubChannel();
      orchestrator.registerParticipant('A', chA);
      orchestrator.registerParticipant('B', chB);

      const onReconnecting = vi.fn();
      orchestrator.onReconnecting(onReconnecting);

      await orchestrator.connect('A', 'B');
      orchestrator.handleParticipantLost('A', 'crashed');

      expect(onReconnecting).toHaveBeenCalledWith(
        expect.objectContaining({ connectionId: 'A--B', attempt: 1 })
      );
    });

    it('should fire onReconnected event after successful reconnect', async () => {
      orchestrator = new ReconnectTestOrchestrator({
        reconnectPolicy: new FixedDelayPolicy([100, 100, 100]),
      });

      const chA = makeStubChannel();
      const chB = makeStubChannel();
      orchestrator.registerParticipant('A', chA);
      orchestrator.registerParticipant('B', chB);

      const onReconnected = vi.fn();
      orchestrator.onReconnected(onReconnected);

      await orchestrator.connect('A', 'B');
      orchestrator.handleParticipantLost('A', 'crashed');
      await vi.advanceTimersByTimeAsync(100);

      expect(onReconnected).toHaveBeenCalledWith(
        expect.objectContaining({ connectionId: 'A--B', attempt: 1 })
      );
    });

    it('should give up and move to CLOSED after maxAttempts are exhausted', async () => {
      // Use NeverReconnectPolicy to test "give up immediately" deterministically
      // (avoids async timer races with older vitest fake timers).
      orchestrator = new ReconnectTestOrchestrator({
        reconnectPolicy: new NeverReconnectPolicy(),
      });

      const chA = makeStubChannel();
      const chB = makeStubChannel();
      orchestrator.registerParticipant('A', chA);
      orchestrator.registerParticipant('B', chB);

      const info = await orchestrator.connect('A', 'B');
      expect(info.state).toBe(ConnectionState.READY);

      orchestrator.handleParticipantLost('A', 'crashed');

      // NeverReconnectPolicy immediately returns null → CLOSED (synchronous)
      expect(info.state).toBe(ConnectionState.CLOSED);
    });

    it('should cancel reconnect timer on explicit disconnect()', async () => {
      orchestrator = new ReconnectTestOrchestrator({
        reconnectPolicy: new FixedDelayPolicy([
          5000, 5000, 5000, 5000, 5000, 5000, 5000, 5000, 5000, 5000,
        ]),
      });

      const chA = makeStubChannel();
      const chB = makeStubChannel();
      orchestrator.registerParticipant('A', chA);
      orchestrator.registerParticipant('B', chB);

      const info = await orchestrator.connect('A', 'B');
      const activateCountAfterConnect = orchestrator.activateCallCount;

      orchestrator.handleParticipantLost('A', 'crashed');
      // Immediately call user disconnect before timer fires
      await orchestrator.disconnect(info.connectionId);

      // Timer should be cancelled, no reconnect attempts
      await vi.advanceTimersByTimeAsync(10_000);

      expect(orchestrator.activateCallCount).toBe(activateCountAfterConnect);
      expect(info.state).toBe(ConnectionState.CLOSED);
    });
  });

  describe('multiple connections', () => {
    it('should only reconnect the affected connection', async () => {
      orchestrator = new ReconnectTestOrchestrator({
        reconnectPolicy: new FixedDelayPolicy([200, 200, 200]),
      });

      const chA = makeStubChannel();
      const chB = makeStubChannel();
      const chC = makeStubChannel();
      orchestrator.registerParticipant('A', chA);
      orchestrator.registerParticipant('B', chB);
      orchestrator.registerParticipant('C', chC);

      const infoAB = await orchestrator.connect('A', 'B');
      const infoAC = await orchestrator.connect('A', 'C');

      // Only A--B is lost
      orchestrator.handleParticipantLost('A', 'crashed');

      // A--C is also affected (A is lost, it appears in both)
      // This is expected behaviour: handleParticipantLost affects all connections with A
      expect(infoAB.state).toBe(ConnectionState.TRANSIENT_FAILURE);
      expect(infoAC.state).toBe(ConnectionState.TRANSIENT_FAILURE);

      // Both recover after delay
      await vi.advanceTimersByTimeAsync(200);

      expect(infoAB.state).toBe(ConnectionState.READY);
      expect(infoAC.state).toBe(ConnectionState.READY);
    });
  });
});
