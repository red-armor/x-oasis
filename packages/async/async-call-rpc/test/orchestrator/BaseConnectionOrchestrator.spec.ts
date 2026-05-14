/**
 * Tests for BaseConnectionOrchestrator.
 *
 * A concrete `TestOrchestrator` subclass is used:
 * - `createPortPair()` returns plain objects (no real MessageChannel needed).
 * - `activateParticipant()` is a no-op by default (can be mocked per test).
 */
import { describe, expect, it, beforeEach, vi } from 'vitest';
import {
  BaseConnectionOrchestrator,
  TimeoutError,
} from '../../src/orchestrator/BaseConnectionOrchestrator';
import { ConnectionState } from '../../src/orchestrator/ConnectionState';
import {
  ParticipantInfo,
  ActivationConfig,
  PortPair,
} from '../../src/orchestrator/types';
import AbstractChannelProtocol from '../../src/protocol/AbstractChannelProtocol';

// ── Minimal stub channel (no real transport) ──────────────────────────────────

class StubChannel extends AbstractChannelProtocol {
  send() {}
  on() {}
}

// ── Mock channel that tracks ensureListenerAttached calls ─────────────────────

class MockChannel extends AbstractChannelProtocol {
  ensureListenerAttachedCalled = false;
  onHandler?: (data: unknown) => void;

  send() {}

  on(listener: (data: unknown) => void): () => void {
    this.onHandler = listener;
    return () => {
      this.onHandler = undefined;
    };
  }

  ensureListenerAttached(): void {
    this.ensureListenerAttachedCalled = true;
    super.ensureListenerAttached();
  }

  // Simulate receiving a response message (for testing response handling)
  simulateResponse(data: unknown) {
    if (this.onHandler) {
      this.onHandler(data);
    }
  }
}

// ── TestOrchestrator ──────────────────────────────────────────────────────────

class TestOrchestrator extends BaseConnectionOrchestrator {
  portPairCounter = 0;

  // Allow tests to inject an activate implementation.
  activateImpl: (
    info: ParticipantInfo,
    config: ActivationConfig
  ) => Promise<void> = async () => {};

  createPortPair(): PortPair {
    this.portPairCounter++;
    return {
      port1: `port${this.portPairCounter}a`,
      port2: `port${this.portPairCounter}b`,
    };
  }

  activateParticipant(
    info: ParticipantInfo,
    config: ActivationConfig
  ): Promise<void> {
    return this.activateImpl(info, config);
  }

  // Expose internal state for testing.
  getManagedConnection(connectionId: string) {
    return (this as any).connections.get(connectionId);
  }

  // Expose _transitionState for testing.
  testTransitionState(connectionId: string, state: ConnectionState) {
    const mc = (this as any).connections.get(connectionId);
    if (mc) (this as any)._transitionState(mc, state);
  }

  // Expose _handleConnectionLost.
  testHandleConnectionLost(connectionId: string, error?: Error) {
    const mc = (this as any).connections.get(connectionId);
    if (mc) (this as any)._handleConnectionLost(mc, error);
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeOrchestrator(config = {}) {
  const orch = new TestOrchestrator(config);
  const chanA = new StubChannel();
  const chanB = new StubChannel();
  orch.registerParticipant('a', chanA, 'process');
  orch.registerParticipant('b', chanB, 'process');
  return orch;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('BaseConnectionOrchestrator', () => {
  let orch: TestOrchestrator;

  beforeEach(() => {
    orch = makeOrchestrator();
  });

  // ── registerParticipant / unregisterParticipant ────────────────────────────

  describe('registerParticipant', () => {
    it('adds participants to the registry', () => {
      expect((orch as any).participants.size).toBe(2);
      expect((orch as any).participants.has('a')).toBe(true);
      expect((orch as any).participants.has('b')).toBe(true);
    });

    it('removes participant on unregister', () => {
      orch.unregisterParticipant('a');
      expect((orch as any).participants.has('a')).toBe(false);
    });

    it('calls ensureListenerAttached on the channel to receive responses', () => {
      const mockChannel = new MockChannel();
      expect(mockChannel.ensureListenerAttachedCalled).toBe(false);

      const testOrch = new TestOrchestrator();
      testOrch.registerParticipant('test', mockChannel, 'process');

      // This is the fix for the bug where connect() would hang in CONNECTING
      // state because responses to activateParticipant RPC calls were never
      // processed - the channel's onMessage listener was never registered.
      expect(mockChannel.ensureListenerAttachedCalled).toBe(true);
    });

    it('ensures channel can receive responses after registerParticipant (regression test)', () => {
      // Regression test for: connection stuck in CONNECTING state because
      // activateParticipant RPC responses were never processed.
      //
      // Root cause: registerParticipant did not call channel.ensureListenerAttached(),
      // so the channel's onMessage listener was never registered. When orchestrator
      // sent activateConnection RPC via makeRequest(), the response came back but
      // was dropped because no listener was attached to process it.
      const mockChannel = new MockChannel();
      expect(mockChannel.ensureListenerAttachedCalled).toBe(false);

      const testOrch = new TestOrchestrator();
      testOrch.registerParticipant('test', mockChannel, 'process');

      // After registerParticipant, ensureListenerAttached should be called
      expect(mockChannel.ensureListenerAttachedCalled).toBe(true);

      testOrch.dispose();
    });
  });

  // ── connect: happy path ────────────────────────────────────────────────────

  describe('connect', () => {
    it('transitions IDLE → CONNECTING → READY on success', async () => {
      const states: ConnectionState[] = [];
      orch.onStateChange((e) => states.push(e.currentState));

      const info = await orch.connect('a', 'b');

      expect(info.state).toBe(ConnectionState.READY);
      expect(info.isReady).toBe(true);
      expect(states).toContain(ConnectionState.CONNECTING);
      expect(states).toContain(ConnectionState.READY);
    });

    it('calls createPortPair once', async () => {
      await orch.connect('a', 'b');
      expect(orch.portPairCounter).toBe(1);
    });

    it('calls activateParticipant for both sides', async () => {
      const activated: string[] = [];
      orch.activateImpl = async (info) => {
        activated.push(info.id);
      };
      await orch.connect('a', 'b');
      expect(activated).toContain('a');
      expect(activated).toContain('b');
    });

    it('sends port1 to from-side and port2 to to-side', async () => {
      const portMap: Record<string, any> = {};
      orch.activateImpl = async (info, cfg) => {
        portMap[info.id] = cfg.port;
      };
      await orch.connect('a', 'b');
      expect(portMap['a']).toBe('port1a');
      expect(portMap['b']).toBe('port1b');
    });

    it('returns idempotent ConnectionInfo for the same pair', async () => {
      const info1 = await orch.connect('a', 'b');
      const info2 = await orch.connect('a', 'b');
      expect(info2.connectionId).toBe(info1.connectionId);
    });

    it('throws when fromId is not registered', async () => {
      await expect(orch.connect('unknown', 'b')).rejects.toThrow(
        'Unknown participant'
      );
    });

    it('throws when toId is not registered', async () => {
      await expect(orch.connect('a', 'unknown')).rejects.toThrow(
        'Unknown participant'
      );
    });

    it('transitions CONNECTING → IDLE when activateParticipant throws', async () => {
      orch.activateImpl = async () => {
        throw new Error('activation failed');
      };
      await expect(orch.connect('a', 'b')).rejects.toThrow('activation failed');

      const mc = orch.getManagedConnection('a--b');
      expect(mc?.state).toBe(ConnectionState.IDLE);
    });

    it('fires onReady event on success', async () => {
      const readyEvents: string[] = [];
      orch.onReady((e) => readyEvents.push(e.connectionId));
      await orch.connect('a', 'b');
      expect(readyEvents).toContain('a--b');
    });
  });

  // ── disconnect ────────────────────────────────────────────────────────────

  describe('disconnect', () => {
    it('transitions READY → DISCONNECTING → CLOSED', async () => {
      await orch.connect('a', 'b');
      const states: ConnectionState[] = [];
      orch.onStateChange((e) => states.push(e.currentState));

      await orch.disconnect('a--b');

      expect(states).toContain(ConnectionState.DISCONNECTING);
      expect(states).toContain(ConnectionState.CLOSED);
      const info = orch.getConnectionInfo('a', 'b');
      expect(info?.isClosed).toBe(true);
    });

    it('fires onClosed event', async () => {
      await orch.connect('a', 'b');
      const closed: string[] = [];
      orch.onClosed((e) => closed.push(e.connectionId));
      await orch.disconnect('a--b');
      expect(closed).toContain('a--b');
    });

    it('is a no-op for unknown connectionId', async () => {
      await expect(orch.disconnect('x--y')).resolves.toBeUndefined();
    });
  });

  // ── getConnectionInfo ─────────────────────────────────────────────────────

  describe('getConnectionInfo', () => {
    it('returns undefined before any connect call', () => {
      expect(orch.getConnectionInfo('a', 'b')).toBeUndefined();
    });

    it('returns a live view after connect', async () => {
      await orch.connect('a', 'b');
      const info = orch.getConnectionInfo('a', 'b');
      expect(info).toBeDefined();
      expect(info!.connectionId).toBe('a--b');
      expect(info!.fromId).toBe('a');
      expect(info!.toId).toBe('b');
    });

    it('reflects state changes in real time', async () => {
      await orch.connect('a', 'b');
      const info = orch.getConnectionInfo('a', 'b')!;
      expect(info.state).toBe(ConnectionState.READY);

      // Simulate disconnection.
      orch.testHandleConnectionLost('a--b');

      // info is a live view via getters.
      expect(info.state).toBe(ConnectionState.TRANSIENT_FAILURE);
      expect(info.isFailed).toBe(true);
      expect(info.isReady).toBe(false);
    });
  });

  // ── waitForStateChange ────────────────────────────────────────────────────

  describe('waitForStateChange', () => {
    it('resolves immediately if already past currentState', async () => {
      await orch.connect('a', 'b');
      const info = orch.getConnectionInfo('a', 'b')!;
      // State is READY; waiting for CONNECTING should resolve immediately.
      const nextState = await info.waitForStateChange(
        ConnectionState.CONNECTING
      );
      expect(nextState).toBe(ConnectionState.READY);
    });

    it('resolves when the state actually changes', async () => {
      await orch.connect('a', 'b');
      const info = orch.getConnectionInfo('a', 'b')!;
      expect(info.state).toBe(ConnectionState.READY);

      // Start waiting for READY to change (i.e., a state OTHER than READY)
      const waiter = info.waitForStateChange(ConnectionState.READY);

      // Force a transition away from READY.
      orch.testHandleConnectionLost('a--b', new Error('test'));

      const resolved = await waiter;
      expect(resolved).toBe(ConnectionState.TRANSIENT_FAILURE);
    });

    it('rejects with TimeoutError when deadline passes', async () => {
      await orch.connect('a', 'b');
      const info = orch.getConnectionInfo('a', 'b')!;

      // Waiting for READY (already in READY) → resolves immediately.
      // Waiting for TRANSIENT_FAILURE (not yet in that state) → should timeout.
      await expect(
        info.waitForStateChange(ConnectionState.READY, 50)
      ).rejects.toThrow(TimeoutError);
    });
  });

  // ── handleParticipantLost ─────────────────────────────────────────────────

  describe('handleParticipantLost', () => {
    it('transitions to TRANSIENT_FAILURE when a connected participant is lost', async () => {
      await orch.connect('a', 'b');
      orch.handleParticipantLost('a', 'process exited');

      const info = orch.getConnectionInfo('a', 'b')!;
      expect(info.state).toBe(ConnectionState.TRANSIENT_FAILURE);
    });

    it('fires onDisconnected event', async () => {
      await orch.connect('a', 'b');
      const disconnected: string[] = [];
      orch.onDisconnected((e) => disconnected.push(e.connectionId));
      orch.handleParticipantLost('b', 'test');
      expect(disconnected).toContain('a--b');
    });
  });

  // ── Events ────────────────────────────────────────────────────────────────

  describe('events', () => {
    it('fires stateChange for every transition', async () => {
      const transitions: string[] = [];
      orch.onStateChange((e) => {
        transitions.push(`${e.previousState}→${e.currentState}`);
      });

      await orch.connect('a', 'b');
      await orch.disconnect('a--b');

      expect(transitions).toContain(
        `${ConnectionState.IDLE}→${ConnectionState.CONNECTING}`
      );
      expect(transitions).toContain(
        `${ConnectionState.CONNECTING}→${ConnectionState.READY}`
      );
      expect(transitions).toContain(
        `${ConnectionState.READY}→${ConnectionState.DISCONNECTING}`
      );
      expect(transitions).toContain(
        `${ConnectionState.DISCONNECTING}→${ConnectionState.CLOSED}`
      );
    });
  });

  // ── dispose ───────────────────────────────────────────────────────────────

  describe('dispose', () => {
    it('clears participants and connections', async () => {
      await orch.connect('a', 'b');
      orch.dispose();
      expect((orch as any).participants.size).toBe(0);
      expect((orch as any).connections.size).toBe(0);
    });

    it('rejects pending waitForStateChange promises', async () => {
      await orch.connect('a', 'b');
      const info = orch.getConnectionInfo('a', 'b')!;

      const waiter = info.waitForStateChange(ConnectionState.READY);
      orch.dispose();

      await expect(waiter).rejects.toThrow('Orchestrator disposed');
    });
  });

  // ── getConnectionStats ────────────────────────────────────────────────────

  describe('getConnectionStats', () => {
    it('returns undefined when enableStats is false (default)', async () => {
      await orch.connect('a', 'b');
      expect(orch.getConnectionStats('a--b')).toBeUndefined();
    });

    it('returns stats when enableStats is true', async () => {
      const orchWithStats = new TestOrchestrator({ enableStats: true });
      const ch1 = new StubChannel();
      const ch2 = new StubChannel();
      orchWithStats.registerParticipant('x', ch1);
      orchWithStats.registerParticipant('y', ch2);

      await orchWithStats.connect('x', 'y');

      const stats = orchWithStats.getConnectionStats('x--y');
      expect(stats).toBeDefined();
      expect(stats!.connectionId).toBe('x--y');
      expect(stats!.state).toBe(ConnectionState.READY);
      orchWithStats.dispose();
    });

    // ── G3 stateTransitions ring buffer (driven by _transitionState) ─────

    it('records state transitions into stats.stateTransitions', async () => {
      const orchWithStats = new TestOrchestrator({ enableStats: true });
      const ch1 = new StubChannel();
      const ch2 = new StubChannel();
      orchWithStats.registerParticipant('x', ch1);
      orchWithStats.registerParticipant('y', ch2);

      await orchWithStats.connect('x', 'y');

      const stats = orchWithStats.getConnectionStats('x--y');
      expect(stats).toBeDefined();
      const transitions = stats!.stateTransitions.map(
        (t) => `${t.prev}→${t.curr}`
      );
      // connect path: IDLE → CONNECTING → READY
      expect(transitions).toContain(
        `${ConnectionState.IDLE}→${ConnectionState.CONNECTING}`
      );
      expect(transitions).toContain(
        `${ConnectionState.CONNECTING}→${ConnectionState.READY}`
      );
      // every entry has a timestamp
      expect(
        stats!.stateTransitions.every((t) => typeof t.at === 'number')
      ).toBe(true);
      orchWithStats.dispose();
    });

    it('does not record stateTransitions when enableStats is false', async () => {
      // Default orch has enableStats: false; getConnectionStats returns
      // undefined so there is no buffer to inspect — just confirming
      // the no-stats path stays cheap (no tracker created).
      await orch.connect('a', 'b');
      expect(orch.getConnectionStats('a--b')).toBeUndefined();
    });
  });

  // ─── Gap 1: replaceParticipantChannel ─────────────────────────────────────

  describe('replaceParticipantChannel', () => {
    it('throws for unknown participant', () => {
      const newChannel = new StubChannel();
      expect(() => orch.replaceParticipantChannel('ghost', newChannel)).toThrow(
        /Cannot replace channel for unknown participant/
      );
    });

    it('replaces the channel while preserving participant metadata', () => {
      const newChannel = new StubChannel();
      orch.replaceParticipantChannel('a', newChannel);

      const participants = orch.listParticipants();
      const p = participants.find((entry) => entry.id === 'a');
      expect(p).toBeDefined();
      expect(p!.type).toBe('process');
    });

    it('triggers TRANSIENT_FAILURE → reconnect for READY connections', async () => {
      await orch.connect('a', 'b');

      const onReconnecting = vi.fn();
      orch.onReconnecting(onReconnecting);

      const newChannel = new StubChannel();
      orch.replaceParticipantChannel('a', newChannel);

      const info = orch.getConnectionInfo('a', 'b');
      expect(
        info!.state === ConnectionState.TRANSIENT_FAILURE ||
          info!.state === ConnectionState.CONNECTING
      ).toBe(true);
    });

    it('preserves stats across channel replacement', async () => {
      const orchWithStats = new TestOrchestrator({ enableStats: true });
      const ch1 = new StubChannel();
      const ch2 = new StubChannel();
      orchWithStats.registerParticipant('x', ch1);
      orchWithStats.registerParticipant('y', ch2);
      await orchWithStats.connect('x', 'y');

      const newCh1 = new StubChannel();
      orchWithStats.replaceParticipantChannel('x', newCh1, {
        autoReconnect: false,
      });

      const stats = orchWithStats.getConnectionStats('x--y');
      expect(stats).toBeDefined();
      orchWithStats.dispose();
    });

    it('does not reconnect when autoReconnect is false', async () => {
      await orch.connect('a', 'b');

      const onReconnecting = vi.fn();
      orch.onReconnecting(onReconnecting);

      const newChannel = new StubChannel();
      orch.replaceParticipantChannel('a', newChannel, { autoReconnect: false });

      expect(onReconnecting).not.toHaveBeenCalled();
    });

    it('cleans up old onDidDisconnected subscription', async () => {
      const oldChannel = new StubChannel();
      const orch2 = new TestOrchestrator();
      orch2.registerParticipant('a', oldChannel, 'process');
      orch2.registerParticipant('b', new StubChannel(), 'process');

      const newChannel = new StubChannel();
      orch2.replaceParticipantChannel('a', newChannel);

      // Disconnecting the OLD channel should NOT trigger handleParticipantLost
      const onDisconnected = vi.fn();
      orch2.onDisconnected(onDisconnected);

      await orch2.connect('a', 'b');
      oldChannel.disconnect();

      expect(onDisconnected).not.toHaveBeenCalled();
      orch2.dispose();
    });
  });

  // ─── Gap 4: listParticipants / listConnections ────────────────────────────

  describe('listParticipants', () => {
    it('lists all registered participants', () => {
      const participants = orch.listParticipants();
      expect(participants).toHaveLength(2);
      expect(participants.map((p) => p.id)).toContain('a');
      expect(participants.map((p) => p.id)).toContain('b');
    });

    it('includes type and registeredAt', () => {
      const participants = orch.listParticipants();
      expect(participants[0].type).toBe('process');
      expect(participants[0].registeredAt).toBeGreaterThan(0);
    });

    it('reflects unregistration', () => {
      orch.unregisterParticipant('a');
      const participants = orch.listParticipants();
      expect(participants).toHaveLength(1);
      expect(participants[0].id).toBe('b');
    });
  });

  describe('listConnections', () => {
    it('returns empty before any connect', () => {
      expect(orch.listConnections()).toHaveLength(0);
    });

    it('lists connections after connect', async () => {
      await orch.connect('a', 'b');
      const connections = orch.listConnections();
      expect(connections).toHaveLength(1);
      expect(connections[0].state).toBe(ConnectionState.READY);
    });

    it('includes stats when enabled', async () => {
      const orchWithStats = new TestOrchestrator({ enableStats: true });
      const ch1 = new StubChannel();
      const ch2 = new StubChannel();
      orchWithStats.registerParticipant('x', ch1);
      orchWithStats.registerParticipant('y', ch2);
      await orchWithStats.connect('x', 'y');

      const connections = orchWithStats.listConnections();
      expect(connections[0].stats).toBeDefined();
      orchWithStats.dispose();
    });
  });

  // ─── Gap 5: createEventForwarder ──────────────────────────────────────────

  describe('createEventForwarder', () => {
    it('forwards all event types to sink', async () => {
      const events: any[] = [];
      const forwarder = orch.createEventForwarder((event) => {
        events.push(event);
      });

      await orch.connect('a', 'b');

      expect(events.some((e) => e.type === 'stateChange')).toBe(true);
      expect(events.some((e) => e.type === 'ready')).toBe(true);

      forwarder.dispose();
    });

    it('stops forwarding after dispose', async () => {
      const events: any[] = [];
      const forwarder = orch.createEventForwarder((event) => {
        events.push(event);
      });

      forwarder.dispose();
      await orch.connect('a', 'b');

      expect(events).toHaveLength(0);
    });

    it('forwards disconnected event', async () => {
      await orch.connect('a', 'b');
      const events: any[] = [];
      const forwarder = orch.createEventForwarder((event) => {
        events.push(event);
      });

      orch.testHandleConnectionLost('a--b');

      expect(events.some((e) => e.type === 'disconnected')).toBe(true);
      forwarder.dispose();
    });
  });

  // ─── New Gap D: handleParticipantLost for CONNECTING state ──────────────

  describe('handleParticipantLost (extended)', () => {
    it('handles CONNECTING state connections', async () => {
      // Directly test the state machine: set connection to CONNECTING
      // then call handleParticipantLost
      const orch3 = new TestOrchestrator();
      const ch1 = new StubChannel();
      const ch2 = new StubChannel();
      orch3.registerParticipant('a', ch1, 'process');
      orch3.registerParticipant('b', ch2, 'process');

      // Connect normally
      await orch3.connect('a', 'b');

      // Force the connection back to CONNECTING for test purposes
      const connectionId = orch3.getConnectionInfo('a', 'b')!.connectionId;
      orch3.testTransitionState(connectionId, ConnectionState.CONNECTING);

      // Now simulate participant loss while in CONNECTING state
      orch3.handleParticipantLost('a', 'process died during handshake');

      const infoAfter = orch3.getConnectionInfo('a', 'b');
      expect(infoAfter!.state).toBe(ConnectionState.TRANSIENT_FAILURE);
      orch3.dispose();
    });
  });

  // ─── New Gap G: bidirectional connection dedup ────────────────────────────

  describe('bidirectional connection dedup', () => {
    it('connect(a,b) and connect(b,a) return same connectionId', async () => {
      const info1 = await orch.connect('a', 'b');
      const info2 = await orch.connect('b', 'a');
      expect(info1.connectionId).toBe(info2.connectionId);
    });

    it('getConnectionInfo works regardless of argument order', async () => {
      await orch.connect('a', 'b');
      const info1 = orch.getConnectionInfo('a', 'b');
      const info2 = orch.getConnectionInfo('b', 'a');
      expect(info1).toBeDefined();
      expect(info2).toBeDefined();
      expect(info1!.connectionId).toBe(info2!.connectionId);
    });
  });

  // ─── New Gap C: reconnect preserves fromServices/toServices ────────────

  describe('reconnect preserves service config', () => {
    it('stores lastConfig on connect', async () => {
      const fromServices = { hello: () => 'world' };
      const toServices = { ping: () => 'pong' };

      await orch.connect('a', 'b', { fromServices, toServices });

      const mc = orch.getManagedConnection(
        orch.getConnectionInfo('a', 'b')!.connectionId
      );
      expect(mc.lastConfig).toBeDefined();
      expect(mc.lastConfig!.fromServices).toBe(fromServices);
      expect(mc.lastConfig!.toServices).toBe(toServices);
    });
  });

  // ─── connect with retryOnInitialFailure ────────────────────────────────

  describe('connect with retryOnInitialFailure', () => {
    it('schedules reconnect instead of throwing when set to true', async () => {
      const orch2 = new TestOrchestrator();
      const ch1 = new StubChannel();
      const ch2 = new StubChannel();
      orch2.registerParticipant('a', ch1, 'process');
      orch2.registerParticipant('b', ch2, 'process');

      // First: verify that without retryOnInitialFailure, it throws
      orch2.activateImpl = async () => {
        throw new Error('first attempt fails');
      };
      await expect(orch2.connect('a', 'b')).rejects.toThrow(
        'first attempt fails'
      );

      // After failed connect, state should be IDLE
      const connId = orch2.getConnectionInfo('a', 'b')!.connectionId;
      const mc = orch2.getManagedConnection(connId);
      expect(mc.state).toBe(ConnectionState.IDLE);

      // With retryOnInitialFailure → should not throw, should be TRANSIENT_FAILURE
      const info = await orch2.connect('a', 'b', {
        retryOnInitialFailure: true,
      });
      expect(info.state).toBe(ConnectionState.TRANSIENT_FAILURE);
      orch2.dispose();
    });
  });

  // ─── PendingRequestBehavior ─────────────────────────────────────────────

  describe('PendingRequestBehavior', () => {
    it('does not crash when handleParticipantLost is called with pendingRequests config', async () => {
      const orchWithPending = new TestOrchestrator({
        pendingRequests: {
          onDisconnect: 'reject',
          duringReconnect: 'reject',
          maxQueueSize: 100,
          queueTimeoutMs: 5000,
        },
      });

      const ch1 = new StubChannel();
      const ch2 = new StubChannel();
      orchWithPending.registerParticipant('a', ch1, 'process');
      orchWithPending.registerParticipant('b', ch2, 'process');

      await orchWithPending.connect('a', 'b');

      // Should not crash or stack overflow
      orchWithPending.handleParticipantLost('a', 'test');

      const info = orchWithPending.getConnectionInfo('a', 'b');
      expect(info!.state).toBe(ConnectionState.TRANSIENT_FAILURE);
      orchWithPending.dispose();
    });
  });
});
