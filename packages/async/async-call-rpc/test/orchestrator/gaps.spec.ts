/**
 * Tests for the two telegraph D-006 P0 gaps closed in the v0.5.x cycle:
 *
 *   - Gap 2 — `BaseConnectionOrchestrator.connect()` accepts
 *     `ConnectOptions.activateTimeoutMs` and rejects with `TimeoutError`
 *     when the activation handshake doesn't complete in time.
 *
 *   - Gap 3 — `registerParticipant()` auto-wires the underlying channel's
 *     `onDidDisconnected` event to `handleParticipantLost(id, ...)`, so
 *     callers no longer need to manually subscribe to transport-level
 *     close/error events.
 *
 * Stubbing strategy mirrors `BaseConnectionOrchestrator.spec.ts`:
 * - A concrete `TestOrchestrator` subclass with overridable `activateImpl`.
 * - A `StubChannel` subclass of `AbstractChannelProtocol` so `register-
 *   Participant` exercises the real `ensureListenerAttached` /
 *   `onDidDisconnected` paths.
 */
import { describe, expect, it, vi } from 'vitest';

import {
  BaseConnectionOrchestrator,
  TimeoutError,
} from '../../src/orchestrator/BaseConnectionOrchestrator';
import { ConnectionState } from '../../src/orchestrator/ConnectionState';
import {
  ActivationConfig,
  ParticipantInfo,
  PortPair,
} from '../../src/orchestrator/types';
import AbstractChannelProtocol from '../../src/protocol/AbstractChannelProtocol';

// ── Test doubles ────────────────────────────────────────────────────────────

class StubChannel extends AbstractChannelProtocol {
  send(): void {
    /* noop */
  }
  on(): void {
    /* noop */
  }
}

class TestOrchestrator extends BaseConnectionOrchestrator {
  private _portCounter = 0;

  /** Overridable per-test activation hook. Default: resolve immediately. */
  activateImpl: (
    info: ParticipantInfo,
    config: ActivationConfig
  ) => Promise<void> = async () => {};

  protected createPortPair(): PortPair {
    this._portCounter++;
    return {
      port1: `port${this._portCounter}a`,
      port2: `port${this._portCounter}b`,
    };
  }

  protected activateParticipant(
    info: ParticipantInfo,
    config: ActivationConfig
  ): Promise<void> {
    return this.activateImpl(info, config);
  }
}

// ── Gap 2 — activateTimeoutMs ──────────────────────────────────────────────

describe('BaseConnectionOrchestrator — Gap 2 (activateTimeoutMs)', () => {
  it('rejects with TimeoutError when activation never resolves', async () => {
    const orch = new TestOrchestrator();
    orch.registerParticipant('a', new StubChannel(), 'process');
    orch.registerParticipant('b', new StubChannel(), 'process');

    // Simulate a participant that never acks `activateConnection` (the
    // scenario telegraph hit with cold-start utility processes).
    orch.activateImpl = () => new Promise<void>(() => {});

    await expect(
      orch.connect('a', 'b', { activateTimeoutMs: 50 })
    ).rejects.toBeInstanceOf(TimeoutError);

    // After timeout, the connection record exists but is back in IDLE so the
    // caller can decide whether to retry.
    const info = orch.getConnectionInfo('a', 'b');
    expect(info?.state).toBe(ConnectionState.IDLE);
    expect(info?.error).toBeInstanceOf(TimeoutError);
  });

  it('does not time out when activation resolves quickly', async () => {
    const orch = new TestOrchestrator();
    orch.registerParticipant('a', new StubChannel(), 'process');
    orch.registerParticipant('b', new StubChannel(), 'process');

    // Default activateImpl resolves synchronously — well under the timeout.
    const info = await orch.connect('a', 'b', { activateTimeoutMs: 1_000 });
    expect(info.state).toBe(ConnectionState.READY);
  });

  it('keeps backwards-compatible signature when third arg is ConnectionConfig', async () => {
    // Telegraph D-006 §2 Gap 2 introduces an overloaded third arg. The
    // pre-Gap-2 call shape `connect(a, b, { fromServices, ... })` must keep
    // working without explicit ConnectOptions.
    const orch = new TestOrchestrator();
    orch.registerParticipant('a', new StubChannel(), 'process');
    orch.registerParticipant('b', new StubChannel(), 'process');

    const info = await orch.connect('a', 'b', {
      fromServices: { ping: () => 'pong' },
    });
    expect(info.state).toBe(ConnectionState.READY);
  });
});

// ── Gap 3 — auto handleParticipantLost on channel disconnect ──────────────

describe('BaseConnectionOrchestrator — Gap 3 (auto participant loss)', () => {
  it('fires handleParticipantLost when the participant channel disconnects', async () => {
    const orch = new TestOrchestrator();
    const chanA = new StubChannel();
    const chanB = new StubChannel();
    orch.registerParticipant('a', chanA, 'process');
    orch.registerParticipant('b', chanB, 'process');

    await orch.connect('a', 'b');

    const lostSpy = vi.spyOn(orch, 'handleParticipantLost');
    const onDisconnected = vi.fn();
    orch.onDisconnected(onDisconnected);

    // Simulate the underlying transport going down (kill -9 on a utility,
    // BrowserWindow destroyed, etc). `disconnect()` is the single funnel
    // for every Electron channel subclass per
    // packages/async/async-call-rpc-electron/src/*.ts.
    chanA.disconnect();

    expect(lostSpy).toHaveBeenCalledWith('a', 'channel disconnected');
    // The connection should now be in TRANSIENT_FAILURE awaiting reconnect.
    const info = orch.getConnectionInfo('a', 'b');
    expect(info?.state).toBe(ConnectionState.TRANSIENT_FAILURE);
    expect(onDisconnected).toHaveBeenCalledWith(
      expect.objectContaining({ connectionId: 'a--b' })
    );
  });

  it('does not fire on a stale subscription after re-register', async () => {
    // Re-registering the same id should tear down the previous channel's
    // subscription so a late-firing disconnect on the OLD channel doesn't
    // wrongly mark the NEW participant as lost.
    const orch = new TestOrchestrator();
    const oldChannel = new StubChannel();
    orch.registerParticipant('a', oldChannel, 'process');

    const newChannel = new StubChannel();
    orch.registerParticipant('a', newChannel, 'process');

    const lostSpy = vi.spyOn(orch, 'handleParticipantLost');
    oldChannel.disconnect(); // late disconnect on the now-stale channel

    expect(lostSpy).not.toHaveBeenCalled();
  });

  it('cleans up the subscription on unregisterParticipant', async () => {
    const orch = new TestOrchestrator();
    const chan = new StubChannel();
    orch.registerParticipant('a', chan, 'process');

    orch.unregisterParticipant('a');

    const lostSpy = vi.spyOn(orch, 'handleParticipantLost');
    chan.disconnect();

    expect(lostSpy).not.toHaveBeenCalled();
  });
});
