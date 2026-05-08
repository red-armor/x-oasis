import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WebConnectionOrchestrator } from '../src/WebConnectionOrchestrator';
import { ConnectionState } from '../../async-call-rpc/src/orchestrator/ConnectionState';

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

describe('WebConnectionOrchestrator', () => {
  let orchestrator: WebConnectionOrchestrator;

  beforeEach(() => {
    orchestrator = new WebConnectionOrchestrator();
  });

  it('should instantiate without errors', () => {
    expect(orchestrator).toBeInstanceOf(WebConnectionOrchestrator);
  });

  it('should connect two participants and reach READY state', async () => {
    const channelA = makeStubChannel();
    const channelB = makeStubChannel();

    orchestrator.registerParticipant('workerA', channelA, 'worker');
    orchestrator.registerParticipant('workerB', channelB, 'worker');

    const info = await orchestrator.connect('workerA', 'workerB');

    expect(info.state).toBe(ConnectionState.READY);
    expect(info.isReady).toBe(true);
  });

  it('should send activateConnection messages to both participants', async () => {
    const channelA = makeStubChannel();
    const channelB = makeStubChannel();

    orchestrator.registerParticipant('workerA', channelA, 'worker');
    orchestrator.registerParticipant('workerB', channelB, 'worker');

    await orchestrator.connect('workerA', 'workerB');

    expect(channelA.send).toHaveBeenCalledOnce();
    expect(channelB.send).toHaveBeenCalledOnce();

    const [msgA] = channelA.send.mock.calls[0];
    const [msgB] = channelB.send.mock.calls[0];

    expect(msgA.__orchestrator).toBe('activateConnection');
    expect(msgB.__orchestrator).toBe('activateConnection');
    expect(msgA.payload.role).toBe('initiator');
    expect(msgB.payload.role).toBe('receiver');
  });

  it('should include the connectionId in each activation payload', async () => {
    const channelA = makeStubChannel();
    const channelB = makeStubChannel();

    orchestrator.registerParticipant('workerA', channelA, 'worker');
    orchestrator.registerParticipant('workerB', channelB, 'worker');

    await orchestrator.connect('workerA', 'workerB');

    const payloadA = channelA.send.mock.calls[0][0].payload;
    const payloadB = channelB.send.mock.calls[0][0].payload;

    expect(payloadA.connectionId).toBe('workerA--workerB');
    expect(payloadB.connectionId).toBe('workerA--workerB');
  });

  it('should transfer a distinct MessagePort to each participant', async () => {
    const channelA = makeStubChannel();
    const channelB = makeStubChannel();

    orchestrator.registerParticipant('workerA', channelA, 'worker');
    orchestrator.registerParticipant('workerB', channelB, 'worker');

    await orchestrator.connect('workerA', 'workerB');

    const transferA: any[] = channelA.send.mock.calls[0][1];
    const transferB: any[] = channelB.send.mock.calls[0][1];

    expect(transferA).toHaveLength(1);
    expect(transferB).toHaveLength(1);

    // port1 ≠ port2
    expect(transferA[0]).not.toBe(transferB[0]);
  });

  it('should be idempotent: second connect call returns same info without re-activating', async () => {
    const channelA = makeStubChannel();
    const channelB = makeStubChannel();

    orchestrator.registerParticipant('workerA', channelA, 'worker');
    orchestrator.registerParticipant('workerB', channelB, 'worker');

    const info1 = await orchestrator.connect('workerA', 'workerB');
    const info2 = await orchestrator.connect('workerA', 'workerB');

    expect(info1.connectionId).toBe(info2.connectionId);
    expect(channelA.send).toHaveBeenCalledOnce();
  });

  it('should throw for unknown participants', async () => {
    orchestrator.registerParticipant('workerA', makeStubChannel(), 'worker');

    await expect(orchestrator.connect('workerA', 'ghost')).rejects.toThrow(
      /Unknown participant/
    );
  });

  it('should move to CLOSED on disconnect()', async () => {
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

  it('should support stats tracking when enableStats is true', async () => {
    orchestrator = new WebConnectionOrchestrator({ enableStats: true });

    const channelA = makeStubChannel();
    const channelB = makeStubChannel();

    orchestrator.registerParticipant('workerA', channelA, 'worker');
    orchestrator.registerParticipant('workerB', channelB, 'worker');

    await orchestrator.connect('workerA', 'workerB');

    const stats = orchestrator.getConnectionStats('workerA--workerB');
    expect(stats).toBeDefined();
    expect(stats!.connectionId).toBe('workerA--workerB');
  });

  it('should dispose cleanly', async () => {
    const channelA = makeStubChannel();
    const channelB = makeStubChannel();

    orchestrator.registerParticipant('workerA', channelA, 'worker');
    orchestrator.registerParticipant('workerB', channelB, 'worker');

    await orchestrator.connect('workerA', 'workerB');
    expect(() => orchestrator.dispose()).not.toThrow();
  });
});
