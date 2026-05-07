import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { BaseConnectionOrchestrator } from '../../src/orchestrator/BaseConnectionOrchestrator';
import { ConnectionState } from '../../src/orchestrator/ConnectionState';
import {
  PortPair,
  ActivationConfig,
  ParticipantInfo,
} from '../../src/orchestrator/types';

// ─── Concrete test orchestrator ───────────────────────────────────────────────

class TestOrchestrator extends BaseConnectionOrchestrator {
  public heartbeatsSent: Array<{ connectionId: string }> = [];
  private _portPairFactory: () => PortPair;

  constructor(
    config: ConstructorParameters<typeof BaseConnectionOrchestrator>[0] = {},
    portPairFactory?: () => PortPair
  ) {
    super(config);
    this._portPairFactory =
      portPairFactory ??
      (() => ({
        port1: { _id: 'port1' },
        port2: { _id: 'port2' },
      }));
  }

  protected createPortPair(): PortPair {
    return this._portPairFactory();
  }

  protected async activateParticipant(
    info: ParticipantInfo,
    config: ActivationConfig
  ): Promise<void> {
    info.channel.send({
      __orchestrator: 'activateConnection',
      payload: config,
    });
  }

  /** Expose protected _sendHeartbeat for tests. */
  public triggerHeartbeat(connectionId: string): void {
    const mc = (this as any).connections.get(connectionId);
    if (mc) {
      this._sendHeartbeat(mc, {
        enabled: true,
        intervalMs: 1000,
        timeoutMs: 500,
      });
    }
  }

  /** Expose protected _handleHeartbeatTimeout for tests. */
  public triggerHeartbeatTimeout(connectionId: string): void {
    const mc = (this as any).connections.get(connectionId);
    if (mc) {
      this._handleHeartbeatTimeout(mc);
    }
  }

  protected _sendHeartbeat(mc: any, hbConfig: any): void {
    this.heartbeatsSent.push({ connectionId: mc.connectionId });
    super._sendHeartbeat(mc, hbConfig);
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

describe('Heartbeat', () => {
  let orchestrator: TestOrchestrator;

  beforeEach(() => {
    vi.useFakeTimers();
    orchestrator = new TestOrchestrator();
  });

  afterEach(() => {
    orchestrator.dispose();
    vi.useRealTimers();
  });

  it('should start sending heartbeats when heartbeat.enabled = true', async () => {
    const chA = makeStubChannel();
    const chB = makeStubChannel();

    orchestrator.registerParticipant('A', chA);
    orchestrator.registerParticipant('B', chB);

    await orchestrator.connect('A', 'B', {
      heartbeat: { enabled: true, intervalMs: 1000, timeoutMs: 500 },
    });

    expect(orchestrator.heartbeatsSent).toHaveLength(0);

    // Advance by one interval
    await vi.advanceTimersByTimeAsync(1000);

    expect(orchestrator.heartbeatsSent).toHaveLength(1);
    expect(orchestrator.heartbeatsSent[0].connectionId).toBe('A--B');
  });

  it('should send multiple heartbeats over multiple intervals', async () => {
    const chA = makeStubChannel();
    const chB = makeStubChannel();

    orchestrator.registerParticipant('A', chA);
    orchestrator.registerParticipant('B', chB);

    await orchestrator.connect('A', 'B', {
      heartbeat: { enabled: true, intervalMs: 500, timeoutMs: 200 },
    });

    await vi.advanceTimersByTimeAsync(1600);

    expect(orchestrator.heartbeatsSent.length).toBeGreaterThanOrEqual(3);
  });

  it('should not send heartbeats when disabled (default)', async () => {
    const chA = makeStubChannel();
    const chB = makeStubChannel();

    orchestrator.registerParticipant('A', chA);
    orchestrator.registerParticipant('B', chB);

    await orchestrator.connect('A', 'B');
    await vi.advanceTimersByTimeAsync(60_000);

    expect(orchestrator.heartbeatsSent).toHaveLength(0);
  });

  it('should transition to TRANSIENT_FAILURE on heartbeat timeout', async () => {
    const chA = makeStubChannel();
    const chB = makeStubChannel();

    orchestrator.registerParticipant('A', chA);
    orchestrator.registerParticipant('B', chB);

    const info = await orchestrator.connect('A', 'B', {
      heartbeat: { enabled: true, intervalMs: 1000, timeoutMs: 500 },
    });

    expect(info.state).toBe(ConnectionState.READY);

    // Simulate heartbeat timeout
    orchestrator.triggerHeartbeatTimeout('A--B');

    expect(info.state).toBe(ConnectionState.TRANSIENT_FAILURE);
  });

  it('should fire onDisconnected when heartbeat times out', async () => {
    const chA = makeStubChannel();
    const chB = makeStubChannel();

    orchestrator.registerParticipant('A', chA);
    orchestrator.registerParticipant('B', chB);

    const onDisconnected = vi.fn();
    orchestrator.onDisconnected(onDisconnected);

    await orchestrator.connect('A', 'B', {
      heartbeat: { enabled: true, intervalMs: 1000, timeoutMs: 500 },
    });

    orchestrator.triggerHeartbeatTimeout('A--B');

    expect(onDisconnected).toHaveBeenCalledWith(
      expect.objectContaining({
        connectionId: 'A--B',
        error: expect.objectContaining({ message: 'heartbeat timeout' }),
      })
    );
  });

  it('should stop heartbeat after disconnect()', async () => {
    const chA = makeStubChannel();
    const chB = makeStubChannel();

    orchestrator.registerParticipant('A', chA);
    orchestrator.registerParticipant('B', chB);

    await orchestrator.connect('A', 'B', {
      heartbeat: { enabled: true, intervalMs: 500, timeoutMs: 200 },
    });

    await orchestrator.disconnect('A--B');

    const countBefore = orchestrator.heartbeatsSent.length;
    await vi.advanceTimersByTimeAsync(2000);

    // No new heartbeats after disconnect
    expect(orchestrator.heartbeatsSent.length).toBe(countBefore);
  });
});
