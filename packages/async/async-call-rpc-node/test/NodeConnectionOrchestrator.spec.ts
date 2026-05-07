import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NodeConnectionOrchestrator } from '../src/NodeConnectionOrchestrator';
import { ConnectionState } from '../../async-call-rpc/src/orchestrator/ConnectionState';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Minimal AbstractChannelProtocol stub that records send() calls. */
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

describe('NodeConnectionOrchestrator', () => {
  let orchestrator: NodeConnectionOrchestrator;

  beforeEach(() => {
    orchestrator = new NodeConnectionOrchestrator();
  });

  it('should instantiate without errors', () => {
    expect(orchestrator).toBeInstanceOf(NodeConnectionOrchestrator);
  });

  it('should register participants', () => {
    const channelA = makeStubChannel();
    orchestrator.registerParticipant('workerA', channelA, 'worker');
    // Should not throw; getConnectionInfo returns undefined (no connection yet)
    expect(
      orchestrator.getConnectionInfo('workerA', 'workerB')
    ).toBeUndefined();
  });

  it('should create a port pair and transition to READY on connect', async () => {
    const channelA = makeStubChannel();
    const channelB = makeStubChannel();

    orchestrator.registerParticipant('workerA', channelA, 'worker');
    orchestrator.registerParticipant('workerB', channelB, 'worker');

    const info = await orchestrator.connect('workerA', 'workerB');

    expect(info.state).toBe(ConnectionState.READY);
    expect(info.isReady).toBe(true);
  });

  it('should send an activateConnection message to both participants', async () => {
    const channelA = makeStubChannel();
    const channelB = makeStubChannel();

    orchestrator.registerParticipant('workerA', channelA, 'worker');
    orchestrator.registerParticipant('workerB', channelB, 'worker');

    await orchestrator.connect('workerA', 'workerB');

    // Both channels should have received an activateConnection message
    expect(channelA.send).toHaveBeenCalledOnce();
    expect(channelB.send).toHaveBeenCalledOnce();

    const [msgA] = channelA.send.mock.calls[0];
    const [msgB] = channelB.send.mock.calls[0];

    expect(msgA.__orchestrator).toBe('activateConnection');
    expect(msgB.__orchestrator).toBe('activateConnection');
    expect(msgA.payload.role).toBe('initiator');
    expect(msgB.payload.role).toBe('receiver');
  });

  it('should transfer a distinct port to each participant', async () => {
    const channelA = makeStubChannel();
    const channelB = makeStubChannel();

    orchestrator.registerParticipant('workerA', channelA, 'worker');
    orchestrator.registerParticipant('workerB', channelB, 'worker');

    await orchestrator.connect('workerA', 'workerB');

    // Transfer list (second arg to send) should contain a port
    const transferA: any[] = channelA.send.mock.calls[0][1];
    const transferB: any[] = channelB.send.mock.calls[0][1];

    expect(transferA).toHaveLength(1);
    expect(transferB).toHaveLength(1);

    // The two ports must be different objects
    expect(transferA[0]).not.toBe(transferB[0]);
  });

  it('should return idempotent ConnectionInfo for the same pair', async () => {
    const channelA = makeStubChannel();
    const channelB = makeStubChannel();

    orchestrator.registerParticipant('workerA', channelA, 'worker');
    orchestrator.registerParticipant('workerB', channelB, 'worker');

    const info1 = await orchestrator.connect('workerA', 'workerB');
    const info2 = await orchestrator.connect('workerA', 'workerB');

    expect(info1.connectionId).toBe(info2.connectionId);
    // Should not have sent additional activation messages on the second call
    expect(channelA.send).toHaveBeenCalledOnce();
  });

  it('should throw when connecting unknown participants', async () => {
    orchestrator.registerParticipant('workerA', makeStubChannel(), 'worker');

    await expect(
      orchestrator.connect('workerA', 'nonExistent')
    ).rejects.toThrow(/Unknown participant/);
  });

  it('should disconnect and move to CLOSED', async () => {
    const channelA = makeStubChannel();
    const channelB = makeStubChannel();

    orchestrator.registerParticipant('workerA', channelA, 'worker');
    orchestrator.registerParticipant('workerB', channelB, 'worker');

    const info = await orchestrator.connect('workerA', 'workerB');
    await orchestrator.disconnect(info.connectionId);

    expect(info.state).toBe(ConnectionState.CLOSED);
    expect(info.isClosed).toBe(true);
  });

  it('should fire onReady event', async () => {
    const channelA = makeStubChannel();
    const channelB = makeStubChannel();

    orchestrator.registerParticipant('workerA', channelA, 'worker');
    orchestrator.registerParticipant('workerB', channelB, 'worker');

    const onReady = vi.fn();
    orchestrator.onReady(onReady);

    await orchestrator.connect('workerA', 'workerB');

    expect(onReady).toHaveBeenCalledWith(
      expect.objectContaining({ connectionId: 'workerA--workerB' })
    );
  });

  it('should fire onClosed event on disconnect', async () => {
    const channelA = makeStubChannel();
    const channelB = makeStubChannel();

    orchestrator.registerParticipant('workerA', channelA, 'worker');
    orchestrator.registerParticipant('workerB', channelB, 'worker');

    const onClosed = vi.fn();
    orchestrator.onClosed(onClosed);

    const info = await orchestrator.connect('workerA', 'workerB');
    await orchestrator.disconnect(info.connectionId);

    expect(onClosed).toHaveBeenCalledWith(
      expect.objectContaining({ connectionId: 'workerA--workerB' })
    );
  });

  it('should clean up properly on dispose', async () => {
    const channelA = makeStubChannel();
    const channelB = makeStubChannel();

    orchestrator.registerParticipant('workerA', channelA, 'worker');
    orchestrator.registerParticipant('workerB', channelB, 'worker');

    await orchestrator.connect('workerA', 'workerB');

    // Should not throw
    expect(() => orchestrator.dispose()).not.toThrow();
  });
});
