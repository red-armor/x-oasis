import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ElectronConnectionOrchestrator } from '../src/ElectronConnectionOrchestrator';
import { ConnectionState } from '../../async-call-rpc/src/orchestrator/ConnectionState';

// ─── Mock port factory ────────────────────────────────────────────────────────

/**
 * Creates a mock MessagePortMain-like object with EventEmitter-style API.
 */
function makeMockPort() {
  const listeners: Map<string, Set<Function>> = new Map();

  const port: any = {
    _listeners: listeners,
    on(event: string, fn: Function) {
      if (!listeners.has(event)) listeners.set(event, new Set());
      listeners.get(event)!.add(fn);
      return port;
    },
    off(event: string, fn: Function) {
      listeners.get(event)?.delete(fn);
      return port;
    },
    removeListener(event: string, fn: Function) {
      listeners.get(event)?.delete(fn);
      return port;
    },
    postMessage: vi.fn(),
    start: vi.fn(),
    close: vi.fn(),
    emit(event: string, ...args: any[]) {
      listeners.get(event)?.forEach((fn) => fn(...args));
    },
  };
  return port;
}

/**
 * Minimal port factory that returns mock MessagePortMain pairs.
 * Supplied to ElectronConnectionOrchestrator in place of MessageChannelMain,
 * so tests run without a real Electron runtime.
 */
function makePortFactory() {
  return () => ({
    port1: makeMockPort(),
    port2: makeMockPort(),
  });
}

// ─── Stub channel ─────────────────────────────────────────────────────────────

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

describe('ElectronConnectionOrchestrator', () => {
  let orchestrator: ElectronConnectionOrchestrator;

  beforeEach(() => {
    // Inject a mock port factory so tests don't need Electron installed
    orchestrator = new ElectronConnectionOrchestrator({}, makePortFactory());
  });

  it('should instantiate without errors', () => {
    expect(orchestrator).toBeInstanceOf(ElectronConnectionOrchestrator);
  });

  it('should connect two participants and reach READY state', async () => {
    const channelA = makeStubChannel();
    const channelB = makeStubChannel();

    orchestrator.registerParticipant('renderer', channelA, 'renderer');
    orchestrator.registerParticipant('utility', channelB, 'utility');

    const info = await orchestrator.connect('renderer', 'utility');

    expect(info.state).toBe(ConnectionState.READY);
    expect(info.isReady).toBe(true);
  });

  it('should send activateConnection to both participants', async () => {
    const channelA = makeStubChannel();
    const channelB = makeStubChannel();

    orchestrator.registerParticipant('renderer', channelA, 'renderer');
    orchestrator.registerParticipant('utility', channelB, 'utility');

    await orchestrator.connect('renderer', 'utility');

    expect(channelA.send).toHaveBeenCalledOnce();
    expect(channelB.send).toHaveBeenCalledOnce();

    const msgA = channelA.send.mock.calls[0][0];
    const msgB = channelB.send.mock.calls[0][0];

    expect(msgA.__orchestrator).toBe('activateConnection');
    expect(msgB.__orchestrator).toBe('activateConnection');
    expect(msgA.payload.role).toBe('initiator');
    expect(msgB.payload.role).toBe('receiver');
  });

  it('should transfer a distinct port to each participant', async () => {
    const channelA = makeStubChannel();
    const channelB = makeStubChannel();

    orchestrator.registerParticipant('renderer', channelA, 'renderer');
    orchestrator.registerParticipant('utility', channelB, 'utility');

    await orchestrator.connect('renderer', 'utility');

    const transferA: any[] = channelA.send.mock.calls[0][1];
    const transferB: any[] = channelB.send.mock.calls[0][1];

    expect(transferA).toHaveLength(1);
    expect(transferB).toHaveLength(1);
    expect(transferA[0]).not.toBe(transferB[0]);
  });

  it('should be idempotent for the same participant pair', async () => {
    const channelA = makeStubChannel();
    const channelB = makeStubChannel();

    orchestrator.registerParticipant('renderer', channelA, 'renderer');
    orchestrator.registerParticipant('utility', channelB, 'utility');

    const info1 = await orchestrator.connect('renderer', 'utility');
    const info2 = await orchestrator.connect('renderer', 'utility');

    expect(info1.connectionId).toBe(info2.connectionId);
    expect(channelA.send).toHaveBeenCalledOnce();
  });

  it('should throw for unknown participants', async () => {
    orchestrator.registerParticipant('renderer', makeStubChannel(), 'renderer');

    await expect(orchestrator.connect('renderer', 'ghost')).rejects.toThrow(
      /Unknown participant/
    );
  });

  it('should disconnect and move to CLOSED', async () => {
    const channelA = makeStubChannel();
    const channelB = makeStubChannel();

    orchestrator.registerParticipant('renderer', channelA, 'renderer');
    orchestrator.registerParticipant('utility', channelB, 'utility');

    const info = await orchestrator.connect('renderer', 'utility');
    await orchestrator.disconnect(info.connectionId);

    expect(info.state).toBe(ConnectionState.CLOSED);
    expect(info.isClosed).toBe(true);
  });

  it('should fire onReady event', async () => {
    const channelA = makeStubChannel();
    const channelB = makeStubChannel();

    orchestrator.registerParticipant('renderer', channelA, 'renderer');
    orchestrator.registerParticipant('utility', channelB, 'utility');

    const onReady = vi.fn();
    orchestrator.onReady(onReady);

    await orchestrator.connect('renderer', 'utility');

    expect(onReady).toHaveBeenCalledWith(
      expect.objectContaining({ connectionId: 'renderer--utility' })
    );
  });

  it('should fire onClosed on disconnect', async () => {
    const channelA = makeStubChannel();
    const channelB = makeStubChannel();

    orchestrator.registerParticipant('renderer', channelA, 'renderer');
    orchestrator.registerParticipant('utility', channelB, 'utility');

    const onClosed = vi.fn();
    orchestrator.onClosed(onClosed);

    const info = await orchestrator.connect('renderer', 'utility');
    await orchestrator.disconnect(info.connectionId);

    expect(onClosed).toHaveBeenCalledWith(
      expect.objectContaining({ connectionId: 'renderer--utility' })
    );
  });

  it('should support stats tracking', async () => {
    orchestrator = new ElectronConnectionOrchestrator(
      { enableStats: true },
      makePortFactory()
    );

    const channelA = makeStubChannel();
    const channelB = makeStubChannel();

    orchestrator.registerParticipant('renderer', channelA, 'renderer');
    orchestrator.registerParticipant('utility', channelB, 'utility');

    await orchestrator.connect('renderer', 'utility');

    const stats = orchestrator.getConnectionStats('renderer--utility');
    expect(stats).toBeDefined();
    expect(stats!.connectionId).toBe('renderer--utility');
  });

  it('should handle multiple independent connections', async () => {
    const chA = makeStubChannel();
    const chB = makeStubChannel();
    const chC = makeStubChannel();

    orchestrator.registerParticipant('renderer', chA, 'renderer');
    orchestrator.registerParticipant('utility', chB, 'utility');
    orchestrator.registerParticipant('worker', chC, 'worker');

    const info1 = await orchestrator.connect('renderer', 'utility');
    const info2 = await orchestrator.connect('renderer', 'worker');

    expect(info1.connectionId).toBe('renderer--utility');
    expect(info2.connectionId).toBe('renderer--worker');
    expect(info1.state).toBe(ConnectionState.READY);
    expect(info2.state).toBe(ConnectionState.READY);
  });

  it('should dispose cleanly', async () => {
    const channelA = makeStubChannel();
    const channelB = makeStubChannel();

    orchestrator.registerParticipant('renderer', channelA, 'renderer');
    orchestrator.registerParticipant('utility', channelB, 'utility');

    await orchestrator.connect('renderer', 'utility');
    expect(() => orchestrator.dispose()).not.toThrow();
  });
});
