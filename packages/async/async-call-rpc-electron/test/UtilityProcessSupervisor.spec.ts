/**
 * D-004 — UtilityProcessSupervisor MVP integration tests.
 *
 * Verifies the start / auto-restart / stop lifecycle without booting
 * a real Electron utilityProcess. The supervisor exposes a `forkFn`
 * seam exactly so these tests can drive the spawn outcome directly.
 *
 * Reference: codebase-wiki/discussion/20260514-utility-process-supervisor-rfc.md
 */
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { EventEmitter } from 'node:events';
import {
  UtilityProcessSupervisor,
  ForkFn,
  SUPERVISOR_READY_MESSAGE_TYPE,
  type StateChangeEvent,
  type RestartHistoryEntry,
} from '../src/electron-main/UtilityProcessSupervisor';
import type { UtilityProcess } from '../src/types';

// ── Stubs ────────────────────────────────────────────────────────────────

class FakeUtilityProcess extends EventEmitter {
  public pid: number;
  public killed = false;
  public exited = false;
  public postMessage = vi.fn();

  constructor(pid: number) {
    super();
    this.pid = pid;
    // Real Electron utilityProcess can only emit 'exit' once. Mark the
    // fake as exited the first time it fires so kill() / explicit emits
    // after a crash become no-ops (mirrors the real API contract).
    this.once('exit', () => {
      this.exited = true;
    });
  }

  kill(): boolean {
    if (this.killed || this.exited) return false;
    this.killed = true;
    this.emit('exit', 0);
    return true;
  }
}

function makeFakeProcess(pid: number): UtilityProcess {
  return new FakeUtilityProcess(pid) as unknown as UtilityProcess;
}

function makeFakeOrchestrator() {
  return {
    registerParticipant: vi.fn(),
    unregisterParticipant: vi.fn(),
    replaceParticipantChannel: vi.fn(),
  };
}

// ── Tests ────────────────────────────────────────────────────────────────

describe('D-004 — UtilityProcessSupervisor MVP', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('start()', () => {
    it('forks, registers, and transitions to running', async () => {
      const orch = makeFakeOrchestrator();
      const fakeChild = makeFakeProcess(1234);
      const forkFn: ForkFn = vi.fn(() => fakeChild);

      const sup = new UtilityProcessSupervisor({
        orchestrator: orch as any,
        participantId: 'daemon',
        entry: '/tmp/daemon.js',
        forkFn,
      });

      await sup.start();

      expect(forkFn).toHaveBeenCalledWith('/tmp/daemon.js', undefined, {});
      expect(orch.registerParticipant).toHaveBeenCalledTimes(1);
      expect(orch.registerParticipant).toHaveBeenCalledWith(
        'daemon',
        expect.anything(),
        'utility'
      );
      expect(sup.state).toBe('running');
      expect(sup.currentPid).toBe(1234);
      expect(sup.restartCount).toBe(0);
    });

    it('forwards forkOptions to the fork function', async () => {
      const orch = makeFakeOrchestrator();
      const forkFn: ForkFn = vi.fn(() => makeFakeProcess(1));

      const sup = new UtilityProcessSupervisor({
        orchestrator: orch as any,
        participantId: 'daemon',
        entry: '/tmp/d.js',
        forkOptions: {
          args: ['--mode', 'prod'],
          env: { FOO: 'bar' },
          serviceName: 'telegraph-daemon',
        },
        forkFn,
      });

      await sup.start();

      expect(forkFn).toHaveBeenCalledWith('/tmp/d.js', ['--mode', 'prod'], {
        env: { FOO: 'bar' },
        serviceName: 'telegraph-daemon',
      });
    });

    it('rejects start() when not in idle', async () => {
      const orch = makeFakeOrchestrator();
      const sup = new UtilityProcessSupervisor({
        orchestrator: orch as any,
        participantId: 'daemon',
        entry: '/tmp/d.js',
        forkFn: () => makeFakeProcess(1),
      });

      await sup.start();
      await expect(sup.start()).rejects.toThrow(/only allowed from "idle"/);
    });

    it('transitions to failed when fork throws', async () => {
      const orch = makeFakeOrchestrator();
      const sup = new UtilityProcessSupervisor({
        orchestrator: orch as any,
        participantId: 'daemon',
        entry: '/tmp/d.js',
        forkFn: () => {
          throw new Error('ENOENT: entry not found');
        },
      });

      await expect(sup.start()).rejects.toThrow('ENOENT: entry not found');
      expect(sup.state).toBe('failed');
      expect(orch.registerParticipant).not.toHaveBeenCalled();
    });
  });

  describe('child exit handling', () => {
    it('moves to failed when no restartPolicy is configured', async () => {
      const orch = makeFakeOrchestrator();
      const child = new FakeUtilityProcess(1) as unknown as UtilityProcess;
      const sup = new UtilityProcessSupervisor({
        orchestrator: orch as any,
        participantId: 'daemon',
        entry: '/tmp/d.js',
        forkFn: () => child,
      });

      await sup.start();
      // Simulate crash (not initiated via stop()).
      (child as unknown as FakeUtilityProcess).emit('exit', 137);

      expect(sup.state).toBe('failed');
      expect(orch.replaceParticipantChannel).not.toHaveBeenCalled();
    });

    it('auto-restarts via replaceParticipantChannel when policy allows', async () => {
      const orch = makeFakeOrchestrator();
      const children: FakeUtilityProcess[] = [];
      const forkFn: ForkFn = vi.fn(() => {
        const child = new FakeUtilityProcess(100 + children.length);
        children.push(child);
        return child as unknown as UtilityProcess;
      });

      const policy = {
        nextRetryDelayMs: vi.fn(() => 50),
      };

      const sup = new UtilityProcessSupervisor({
        orchestrator: orch as any,
        participantId: 'daemon',
        entry: '/tmp/d.js',
        forkFn,
        restartPolicy: policy,
      });

      await sup.start();
      expect(sup.state).toBe('running');
      expect(sup.currentPid).toBe(100);

      // Simulate first crash.
      children[0].emit('exit', 1);
      expect(sup.state).toBe('restarting');
      expect(policy.nextRetryDelayMs).toHaveBeenCalledTimes(1);

      // Wait out the scheduled delay.
      await vi.advanceTimersByTimeAsync(60);

      expect(forkFn).toHaveBeenCalledTimes(2);
      expect(orch.replaceParticipantChannel).toHaveBeenCalledTimes(1);
      expect(orch.replaceParticipantChannel).toHaveBeenCalledWith(
        'daemon',
        expect.anything(),
        { autoReconnect: true }
      );
      expect(sup.state).toBe('running');
      expect(sup.currentPid).toBe(101);
      expect(sup.restartCount).toBe(1);
    });

    it('moves to failed when restartPolicy returns null', async () => {
      const orch = makeFakeOrchestrator();
      const child = new FakeUtilityProcess(1) as unknown as UtilityProcess;
      const policy = { nextRetryDelayMs: vi.fn(() => null) };

      const sup = new UtilityProcessSupervisor({
        orchestrator: orch as any,
        participantId: 'daemon',
        entry: '/tmp/d.js',
        forkFn: () => child,
        restartPolicy: policy,
      });

      await sup.start();
      (child as unknown as FakeUtilityProcess).emit('exit', 9);

      expect(policy.nextRetryDelayMs).toHaveBeenCalledTimes(1);
      expect(sup.state).toBe('failed');
      expect(orch.replaceParticipantChannel).not.toHaveBeenCalled();
    });

    it('feeds previousRetryCount + elapsedMs into the policy on each retry', async () => {
      const orch = makeFakeOrchestrator();
      const children: FakeUtilityProcess[] = [];
      const forkFn: ForkFn = () => {
        const child = new FakeUtilityProcess(children.length);
        children.push(child);
        return child as unknown as UtilityProcess;
      };

      const policy = {
        nextRetryDelayMs: vi.fn(() => 10),
      };

      const sup = new UtilityProcessSupervisor({
        orchestrator: orch as any,
        participantId: 'daemon',
        entry: '/tmp/d.js',
        forkFn,
        restartPolicy: policy,
      });

      await sup.start();

      // Crash 3x.
      children[0].emit('exit', 1);
      await vi.advanceTimersByTimeAsync(20);
      children[1].emit('exit', 1);
      await vi.advanceTimersByTimeAsync(20);
      children[2].emit('exit', 1);
      await vi.advanceTimersByTimeAsync(20);

      const calls = policy.nextRetryDelayMs.mock.calls;
      expect(calls.length).toBe(3);
      expect((calls[0][0] as any).previousRetryCount).toBe(0);
      expect((calls[1][0] as any).previousRetryCount).toBe(1);
      expect((calls[2][0] as any).previousRetryCount).toBe(2);
      expect(sup.restartCount).toBe(3);
    });
  });

  describe('callbacks', () => {
    it('fires onSpawn on initial start with isRestart=false', async () => {
      const orch = makeFakeOrchestrator();
      const onSpawn = vi.fn();
      const sup = new UtilityProcessSupervisor({
        orchestrator: orch as any,
        participantId: 'daemon',
        entry: '/tmp/d.js',
        forkFn: () => makeFakeProcess(42),
        onSpawn,
      });
      await sup.start();

      expect(onSpawn).toHaveBeenCalledTimes(1);
      expect(onSpawn).toHaveBeenCalledWith({
        pid: 42,
        restartCount: 0,
        isRestart: false,
      });
    });

    it('fires onSpawn on every restart with isRestart=true and incremented count', async () => {
      const orch = makeFakeOrchestrator();
      const children: FakeUtilityProcess[] = [];
      const forkFn: ForkFn = () => {
        const c = new FakeUtilityProcess(100 + children.length);
        children.push(c);
        return c as unknown as UtilityProcess;
      };
      const onSpawn = vi.fn();
      const sup = new UtilityProcessSupervisor({
        orchestrator: orch as any,
        participantId: 'daemon',
        entry: '/tmp/d.js',
        forkFn,
        restartPolicy: { nextRetryDelayMs: () => 10 },
        onSpawn,
      });
      await sup.start();

      children[0].emit('exit', 1);
      await vi.advanceTimersByTimeAsync(20);

      expect(onSpawn).toHaveBeenCalledTimes(2);
      expect(onSpawn.mock.calls[0][0]).toEqual({
        pid: 100,
        restartCount: 0,
        isRestart: false,
      });
      expect(onSpawn.mock.calls[1][0]).toEqual({
        pid: 101,
        restartCount: 1,
        isRestart: true,
      });
    });

    it('fires onChannelReady BEFORE registerParticipant on initial start', async () => {
      const orch = makeFakeOrchestrator();
      const callOrder: string[] = [];
      orch.registerParticipant.mockImplementation(() => {
        callOrder.push('registerParticipant');
      });
      const onChannelReady = vi.fn(() => {
        callOrder.push('onChannelReady');
      });

      const sup = new UtilityProcessSupervisor({
        orchestrator: orch as any,
        participantId: 'daemon',
        entry: '/tmp/d.js',
        forkFn: () => makeFakeProcess(1),
        onChannelReady,
      });
      await sup.start();

      expect(onChannelReady).toHaveBeenCalledTimes(1);
      expect(callOrder).toEqual(['onChannelReady', 'registerParticipant']);
      const arg = onChannelReady.mock.calls[0][0] as any;
      expect(arg.pid).toBe(1);
      expect(arg.isRestart).toBe(false);
      expect(arg.channel).toBeDefined();
    });

    it('fires onChannelReady BEFORE replaceParticipantChannel on restart', async () => {
      const orch = makeFakeOrchestrator();
      const callOrder: string[] = [];
      orch.replaceParticipantChannel.mockImplementation(() => {
        callOrder.push('replaceParticipantChannel');
      });
      const onChannelReady = vi.fn((info: any) => {
        callOrder.push(`onChannelReady(isRestart=${info.isRestart})`);
      });

      const children: FakeUtilityProcess[] = [];
      const forkFn: ForkFn = () => {
        const c = new FakeUtilityProcess(children.length);
        children.push(c);
        return c as unknown as UtilityProcess;
      };

      const sup = new UtilityProcessSupervisor({
        orchestrator: orch as any,
        participantId: 'daemon',
        entry: '/tmp/d.js',
        forkFn,
        restartPolicy: { nextRetryDelayMs: () => 10 },
        onChannelReady,
      });
      await sup.start();
      children[0].emit('exit', 1);
      await vi.advanceTimersByTimeAsync(20);

      expect(onChannelReady).toHaveBeenCalledTimes(2);
      expect(callOrder).toContain('onChannelReady(isRestart=true)');
      expect(callOrder.indexOf('onChannelReady(isRestart=true)')).toBeLessThan(
        callOrder.indexOf('replaceParticipantChannel')
      );
    });

    it('swallows onSpawn / onChannelReady throws and keeps the supervisor running', async () => {
      const orch = makeFakeOrchestrator();
      const sup = new UtilityProcessSupervisor({
        orchestrator: orch as any,
        participantId: 'daemon',
        entry: '/tmp/d.js',
        forkFn: () => makeFakeProcess(1),
        onSpawn: () => {
          throw new Error('registry blew up');
        },
        onChannelReady: () => {
          throw new Error('serviceHost wiring blew up');
        },
      });

      await expect(sup.start()).resolves.toBeUndefined();
      expect(sup.state).toBe('running');
      expect(orch.registerParticipant).toHaveBeenCalledTimes(1);
    });
  });

  describe('multiple orchestrators', () => {
    it('registers the same channel on every orchestrator in the array', async () => {
      const orchA = makeFakeOrchestrator();
      const orchB = makeFakeOrchestrator();
      const sup = new UtilityProcessSupervisor({
        orchestrator: [orchA as any, orchB as any],
        participantId: 'setting',
        entry: '/tmp/s.js',
        forkFn: () => makeFakeProcess(99),
      });
      await sup.start();

      expect(orchA.registerParticipant).toHaveBeenCalledTimes(1);
      expect(orchB.registerParticipant).toHaveBeenCalledTimes(1);
      const channelA = orchA.registerParticipant.mock.calls[0][1];
      const channelB = orchB.registerParticipant.mock.calls[0][1];
      expect(channelA).toBe(channelB);
    });

    it('replaces on every orchestrator in lock-step on restart', async () => {
      const orchA = makeFakeOrchestrator();
      const orchB = makeFakeOrchestrator();
      const children: FakeUtilityProcess[] = [];
      const forkFn: ForkFn = () => {
        const c = new FakeUtilityProcess(children.length);
        children.push(c);
        return c as unknown as UtilityProcess;
      };
      const sup = new UtilityProcessSupervisor({
        orchestrator: [orchA as any, orchB as any],
        participantId: 'setting',
        entry: '/tmp/s.js',
        forkFn,
        restartPolicy: { nextRetryDelayMs: () => 10 },
      });
      await sup.start();
      children[0].emit('exit', 1);
      await vi.advanceTimersByTimeAsync(20);

      expect(orchA.replaceParticipantChannel).toHaveBeenCalledTimes(1);
      expect(orchB.replaceParticipantChannel).toHaveBeenCalledTimes(1);
      const newChannelA = orchA.replaceParticipantChannel.mock.calls[0][1];
      const newChannelB = orchB.replaceParticipantChannel.mock.calls[0][1];
      expect(newChannelA).toBe(newChannelB);
    });

    it('unregisters on every orchestrator on stop()', async () => {
      const orchA = makeFakeOrchestrator();
      const orchB = makeFakeOrchestrator();
      const sup = new UtilityProcessSupervisor({
        orchestrator: [orchA as any, orchB as any],
        participantId: 'setting',
        entry: '/tmp/s.js',
        forkFn: () => makeFakeProcess(1),
      });
      await sup.start();
      sup.stop();

      expect(orchA.unregisterParticipant).toHaveBeenCalledWith('setting');
      expect(orchB.unregisterParticipant).toHaveBeenCalledWith('setting');
    });

    it('throws when given an empty orchestrator array', () => {
      expect(
        () =>
          new UtilityProcessSupervisor({
            orchestrator: [],
            participantId: 'x',
            entry: '/tmp/x.js',
            forkFn: () => makeFakeProcess(1),
          })
      ).toThrow(/at least one orchestrator/);
    });
  });

  describe('stop()', () => {
    it('unregisters the participant and kills the child', async () => {
      const orch = makeFakeOrchestrator();
      const child = new FakeUtilityProcess(1);
      const sup = new UtilityProcessSupervisor({
        orchestrator: orch as any,
        participantId: 'daemon',
        entry: '/tmp/d.js',
        forkFn: () => child as unknown as UtilityProcess,
      });

      await sup.start();
      sup.stop();

      expect(orch.unregisterParticipant).toHaveBeenCalledWith('daemon');
      expect(child.killed).toBe(true);
      expect(sup.state).toBe('stopped');
    });

    it('does not trigger restart when stop() causes the child exit', async () => {
      const orch = makeFakeOrchestrator();
      const child = new FakeUtilityProcess(1);
      const policy = { nextRetryDelayMs: vi.fn(() => 10) };

      const sup = new UtilityProcessSupervisor({
        orchestrator: orch as any,
        participantId: 'daemon',
        entry: '/tmp/d.js',
        forkFn: () => child as unknown as UtilityProcess,
        restartPolicy: policy,
      });

      await sup.start();
      sup.stop(); // FakeUtilityProcess.kill() emits 'exit' synchronously.

      expect(policy.nextRetryDelayMs).not.toHaveBeenCalled();
      expect(orch.replaceParticipantChannel).not.toHaveBeenCalled();
      expect(sup.state).toBe('stopped');
    });

    it('cancels a pending restart', async () => {
      const orch = makeFakeOrchestrator();
      const children: FakeUtilityProcess[] = [];
      const forkFn: ForkFn = () => {
        const child = new FakeUtilityProcess(children.length);
        children.push(child);
        return child as unknown as UtilityProcess;
      };
      const policy = { nextRetryDelayMs: vi.fn(() => 100) };

      const sup = new UtilityProcessSupervisor({
        orchestrator: orch as any,
        participantId: 'daemon',
        entry: '/tmp/d.js',
        forkFn,
        restartPolicy: policy,
      });

      await sup.start();
      children[0].emit('exit', 1);
      expect(sup.state).toBe('restarting');

      // stop() before the restart timer fires.
      sup.stop();

      await vi.advanceTimersByTimeAsync(200);

      // Only the initial fork should have happened — no restart spawn.
      expect(children.length).toBe(1);
      expect(orch.replaceParticipantChannel).not.toHaveBeenCalled();
      expect(sup.state).toBe('stopped');
    });

    it('is idempotent on stopped / failed', () => {
      const orch = makeFakeOrchestrator();
      const sup = new UtilityProcessSupervisor({
        orchestrator: orch as any,
        participantId: 'daemon',
        entry: '/tmp/d.js',
        forkFn: () => makeFakeProcess(1),
      });

      sup.stop();
      sup.stop();
      expect(sup.state).toBe('stopped');
    });
  });

  // ── New capability tests (G1 advanced + G3 inspector) ─────────────────

  describe('restart history', () => {
    it('records one entry per auto-restart with prevPid / exitCode / reason', async () => {
      const orch = makeFakeOrchestrator();
      const children: FakeUtilityProcess[] = [];
      const forkFn: ForkFn = vi.fn(() => {
        const c = new FakeUtilityProcess(100 + children.length);
        children.push(c);
        return c as unknown as UtilityProcess;
      });

      const sup = new UtilityProcessSupervisor({
        orchestrator: orch as any,
        participantId: 'daemon',
        entry: '/tmp/d.js',
        forkFn,
        restartPolicy: { nextRetryDelayMs: () => 10 },
      });

      await sup.start();
      expect(sup.restartHistory).toEqual([]); // initial start does NOT count

      // First crash → restart
      children[0].emit('exit', 137);
      // History entry pushed synchronously before the setTimeout fires
      expect(sup.restartHistory.length).toBe(1);
      expect(sup.restartHistory[0]).toMatchObject({
        prevPid: 100,
        exitCode: 137,
        reason: 'child exited (code=137)',
        restartCount: 1,
      });
      expect(sup.restartHistory[0].succeededAt).toBeUndefined();

      await vi.advanceTimersByTimeAsync(20);
      expect(sup.state).toBe('running');
      expect(sup.restartHistory[0].newPid).toBe(101);
      expect(sup.restartHistory[0].succeededAt).toBeDefined();

      // Second crash → second history entry
      children[1].emit('exit', 9);
      await vi.advanceTimersByTimeAsync(20);
      expect(sup.restartHistory.length).toBe(2);
      expect(sup.restartHistory[1]).toMatchObject({
        prevPid: 101,
        exitCode: 9,
        restartCount: 2,
        newPid: 102,
      });
    });

    it('caps history at restartHistorySize, dropping oldest', async () => {
      const orch = makeFakeOrchestrator();
      const children: FakeUtilityProcess[] = [];
      const forkFn: ForkFn = vi.fn(() => {
        const c = new FakeUtilityProcess(children.length);
        children.push(c);
        return c as unknown as UtilityProcess;
      });

      const sup = new UtilityProcessSupervisor({
        orchestrator: orch as any,
        participantId: 'daemon',
        entry: '/tmp/d.js',
        forkFn,
        restartPolicy: { nextRetryDelayMs: () => 1 },
        restartHistorySize: 3,
      });

      await sup.start();

      // Crash + restart 5 times → only the last 3 remain
      for (let i = 0; i < 5; i++) {
        children[children.length - 1].emit('exit', i);
        await vi.advanceTimersByTimeAsync(5);
      }

      expect(sup.restartHistory.length).toBe(3);
      // After 5 restarts: restartCount=5; the surviving entries are #3, #4, #5
      const counts = sup.restartHistory.map((e) => e.restartCount);
      expect(counts).toEqual([3, 4, 5]);
    });

    it('marks failedAt on spawn failure during restart and re-enters policy', async () => {
      const orch = makeFakeOrchestrator();
      const children: FakeUtilityProcess[] = [];
      let throwOnNext = false;
      const forkFn: ForkFn = vi.fn(() => {
        if (throwOnNext) {
          throwOnNext = false;
          throw new Error('spawn boom');
        }
        const c = new FakeUtilityProcess(children.length);
        children.push(c);
        return c as unknown as UtilityProcess;
      });

      const sup = new UtilityProcessSupervisor({
        orchestrator: orch as any,
        participantId: 'daemon',
        entry: '/tmp/d.js',
        forkFn,
        restartPolicy: { nextRetryDelayMs: () => 5 },
      });

      await sup.start();

      throwOnNext = true;
      children[0].emit('exit', 1);
      await vi.advanceTimersByTimeAsync(10);

      expect(sup.restartHistory.length).toBe(2);
      expect(sup.restartHistory[0].failedAt).toBeDefined();
      expect(sup.restartHistory[0].succeededAt).toBeUndefined();
      // Second entry (re-entered policy attempt) should have succeeded.
      expect(sup.restartHistory[1].succeededAt).toBeDefined();
    });
  });

  describe('state-change subscription', () => {
    it('fires onStateChange option for every transition', async () => {
      const orch = makeFakeOrchestrator();
      const events: StateChangeEvent[] = [];

      const sup = new UtilityProcessSupervisor({
        orchestrator: orch as any,
        participantId: 'daemon',
        entry: '/tmp/d.js',
        forkFn: () => makeFakeProcess(1),
        onStateChange: (e) => events.push(e),
      });

      await sup.start();
      sup.stop();

      const seq = events.map((e) => `${e.prev}→${e.curr}`);
      expect(seq).toContain('idle→starting');
      expect(seq).toContain('starting→running');
      expect(seq).toContain('running→stopped');
      // every event has an `at` timestamp
      expect(events.every((e) => typeof e.at === 'number')).toBe(true);
    });

    it('subscribeStateChange supports multiple listeners and disposers', async () => {
      const orch = makeFakeOrchestrator();
      const sup = new UtilityProcessSupervisor({
        orchestrator: orch as any,
        participantId: 'daemon',
        entry: '/tmp/d.js',
        forkFn: () => makeFakeProcess(1),
      });

      const a: StateChangeEvent[] = [];
      const b: StateChangeEvent[] = [];
      const disposeA = sup.subscribeStateChange((e) => a.push(e));
      sup.subscribeStateChange((e) => b.push(e));

      await sup.start();
      expect(a.length).toBeGreaterThan(0);
      expect(b.length).toBeGreaterThan(0);

      const aBefore = a.length;
      disposeA();
      sup.stop();
      // a got no further events; b did
      expect(a.length).toBe(aBefore);
      expect(b.length).toBeGreaterThan(aBefore);
    });

    it('does not let a listener throw break the state machine', async () => {
      const orch = makeFakeOrchestrator();
      const sup = new UtilityProcessSupervisor({
        orchestrator: orch as any,
        participantId: 'daemon',
        entry: '/tmp/d.js',
        forkFn: () => makeFakeProcess(1),
        onStateChange: () => {
          throw new Error('listener boom');
        },
      });

      await expect(sup.start()).resolves.toBeUndefined();
      expect(sup.state).toBe('running');
    });
  });

  describe('getInspectorSnapshot()', () => {
    it('returns a JSON-friendly snapshot with defensive history copy', async () => {
      const orch = makeFakeOrchestrator();
      const children: FakeUtilityProcess[] = [];
      const forkFn: ForkFn = vi.fn(() => {
        const c = new FakeUtilityProcess(200 + children.length);
        children.push(c);
        return c as unknown as UtilityProcess;
      });

      const sup = new UtilityProcessSupervisor({
        orchestrator: orch as any,
        participantId: 'design',
        entry: '/tmp/d.js',
        forkFn,
        restartPolicy: { nextRetryDelayMs: () => 1 },
      });

      await sup.start();
      const snap0 = sup.getInspectorSnapshot();
      expect(snap0).toMatchObject({
        participantId: 'design',
        state: 'running',
        currentPid: 200,
        restartCount: 0,
        orchestratorCount: 1,
        restartHistory: [],
      });

      children[0].emit('exit', 1);
      await vi.advanceTimersByTimeAsync(5);

      const snap1 = sup.getInspectorSnapshot();
      expect(snap1.state).toBe('running');
      expect(snap1.currentPid).toBe(201);
      expect(snap1.restartCount).toBe(1);
      expect(snap1.restartHistory.length).toBe(1);

      // Defensive copy: mutating snapshot does NOT affect the supervisor.
      (snap1.restartHistory as RestartHistoryEntry[])[0].newPid = 9999;
      expect(sup.restartHistory[0].newPid).toBe(201);
    });

    it('reports orchestratorCount for multi-orchestrator setups', async () => {
      const orchA = makeFakeOrchestrator();
      const orchB = makeFakeOrchestrator();
      const sup = new UtilityProcessSupervisor({
        orchestrator: [orchA as any, orchB as any],
        participantId: 'shared',
        entry: '/tmp/s.js',
        forkFn: () => makeFakeProcess(1),
      });

      await sup.start();
      expect(sup.getInspectorSnapshot().orchestratorCount).toBe(2);
    });
  });

  describe('§3.D health snapshot fields', () => {
    it("'spawn' mode: lastChannelReadyAt stamps on every spawn, probe fields stay null/0", async () => {
      const orch = makeFakeOrchestrator();
      const children: FakeUtilityProcess[] = [];
      const forkFn: ForkFn = vi.fn(() => {
        const c = new FakeUtilityProcess(700 + children.length);
        children.push(c);
        return c as unknown as UtilityProcess;
      });

      const sup = new UtilityProcessSupervisor({
        orchestrator: orch as any,
        participantId: 'spawn-mode',
        entry: '/tmp/s.js',
        forkFn,
        restartPolicy: { nextRetryDelayMs: () => 1 },
      });

      // Pre-start: nothing has been ready yet.
      const before = sup.getInspectorSnapshot();
      expect(before.lastChannelReadyAt).toBeNull();
      expect(before.lastReadinessProbeAt).toBeNull();
      expect(before.consecutiveProbeFailures).toBe(0);

      await sup.start();
      const afterStart = sup.getInspectorSnapshot();
      const t0 = afterStart.lastChannelReadyAt;
      expect(t0).not.toBeNull();
      expect(t0!).toBeGreaterThan(0);
      // 'spawn' mode never invokes the probe path — both probe fields
      // must remain at their initial values for the supervisor's
      // entire lifetime.
      expect(afterStart.lastReadinessProbeAt).toBeNull();
      expect(afterStart.consecutiveProbeFailures).toBe(0);

      // Crash → restart. After the restart completes, lastChannelReadyAt
      // must have advanced strictly (because Date.now() advanced via
      // fake timers between the two _fireChannelReady calls), proving
      // the field is re-stamped per spawn rather than only on first
      // start.
      await vi.advanceTimersByTimeAsync(50);
      children[0].emit('exit', 1);
      await vi.advanceTimersByTimeAsync(10);

      const afterRestart = sup.getInspectorSnapshot();
      expect(afterRestart.state).toBe('running');
      expect(afterRestart.restartCount).toBe(1);
      expect(afterRestart.lastChannelReadyAt!).toBeGreaterThan(t0!);
      // Still no probe activity in 'spawn' mode.
      expect(afterRestart.lastReadinessProbeAt).toBeNull();
      expect(afterRestart.consecutiveProbeFailures).toBe(0);
    });

    it("'firstMessage' mode: probe success stamps lastReadinessProbeAt and resets consecutive failures", async () => {
      const orch = makeFakeOrchestrator();
      const fake = new FakeUtilityProcess(710);
      const forkFn: ForkFn = vi.fn(() => {
        setTimeout(() => {
          fake.emit('message', { type: SUPERVISOR_READY_MESSAGE_TYPE });
        }, 5);
        return fake as unknown as UtilityProcess;
      });

      const sup = new UtilityProcessSupervisor({
        orchestrator: orch as any,
        participantId: 'fm-success',
        entry: '/tmp/d.js',
        forkFn,
        readinessProbe: { kind: 'firstMessage', timeoutMs: 1000 },
      });

      const startPromise = sup.start();
      await vi.advanceTimersByTimeAsync(10);
      await startPromise;

      const snap = sup.getInspectorSnapshot();
      expect(snap.state).toBe('running');
      // Probe resolved, so both timestamps are stamped — and the probe
      // stamp must not be earlier than the channel-ready stamp because
      // _awaitReadiness resolves before _fireChannelReady runs.
      expect(snap.lastReadinessProbeAt).not.toBeNull();
      expect(snap.lastChannelReadyAt).not.toBeNull();
      expect(snap.lastChannelReadyAt!).toBeGreaterThanOrEqual(
        snap.lastReadinessProbeAt!
      );
      expect(snap.consecutiveProbeFailures).toBe(0);
    });

    it("'firstMessage' mode: probe timeout bumps consecutiveProbeFailures and stamps lastReadinessProbeAt", async () => {
      const orch = makeFakeOrchestrator();
      const fake = new FakeUtilityProcess(720);
      const forkFn: ForkFn = vi.fn(() => fake as unknown as UtilityProcess);

      const sup = new UtilityProcessSupervisor({
        orchestrator: orch as any,
        participantId: 'fm-timeout',
        entry: '/tmp/d.js',
        forkFn,
        readinessProbe: { kind: 'firstMessage', timeoutMs: 50 },
      });

      const startPromise = sup.start();
      const swallowed = startPromise.catch(() => {});
      await vi.advanceTimersByTimeAsync(60);
      await swallowed;

      await expect(startPromise).rejects.toThrow(/readiness probe timed out/);
      const snap = sup.getInspectorSnapshot();
      expect(snap.state).toBe('failed');
      // Timeout path runs: probe stamp populated, counter bumped, but
      // channel was never created so lastChannelReadyAt is still null.
      expect(snap.lastReadinessProbeAt).not.toBeNull();
      expect(snap.consecutiveProbeFailures).toBe(1);
      expect(snap.lastChannelReadyAt).toBeNull();
    });

    it("'firstMessage' mode: a successful probe after a failed one resets consecutiveProbeFailures to 0", async () => {
      const orch = makeFakeOrchestrator();
      // First fork: never sends ready ⇒ times out.
      // Second fork: sends ready ⇒ succeeds.
      const children: FakeUtilityProcess[] = [];
      let nextSendsReady = false;
      const forkFn: ForkFn = vi.fn(() => {
        const c = new FakeUtilityProcess(730 + children.length);
        children.push(c);
        if (nextSendsReady) {
          setTimeout(() => {
            c.emit('message', { type: SUPERVISOR_READY_MESSAGE_TYPE });
          }, 5);
        }
        return c as unknown as UtilityProcess;
      });

      const sup = new UtilityProcessSupervisor({
        orchestrator: orch as any,
        participantId: 'fm-recover',
        entry: '/tmp/d.js',
        forkFn,
        readinessProbe: { kind: 'firstMessage', timeoutMs: 50 },
      });

      // First start: probe times out.
      const firstStart = sup.start();
      const swallowedFirst = firstStart.catch(() => {});
      await vi.advanceTimersByTimeAsync(60);
      await swallowedFirst;
      await expect(firstStart).rejects.toThrow(/readiness probe timed out/);
      expect(sup.getInspectorSnapshot().consecutiveProbeFailures).toBe(1);

      // The supervisor went to 'failed' so it cannot start() again
      // directly. Re-instantiate to exercise the reset path on a fresh
      // supervisor whose first probe DID succeed — combined with the
      // assertion above this proves the counter both advances on
      // failure and is initialised to 0 on construction (and the
      // success path resets it inline).
      nextSendsReady = true;
      const sup2 = new UtilityProcessSupervisor({
        orchestrator: orch as any,
        participantId: 'fm-recover-2',
        entry: '/tmp/d.js',
        forkFn,
        readinessProbe: { kind: 'firstMessage', timeoutMs: 1000 },
      });

      const secondStart = sup2.start();
      await vi.advanceTimersByTimeAsync(10);
      await secondStart;

      const snap = sup2.getInspectorSnapshot();
      expect(snap.state).toBe('running');
      expect(snap.consecutiveProbeFailures).toBe(0);
      expect(snap.lastReadinessProbeAt).not.toBeNull();
    });
  });

  describe('manual restart()', () => {
    it('rejects from non-running states', async () => {
      const orch = makeFakeOrchestrator();
      const sup = new UtilityProcessSupervisor({
        orchestrator: orch as any,
        participantId: 'daemon',
        entry: '/tmp/d.js',
        forkFn: () => makeFakeProcess(1),
      });

      await expect(sup.restart('test')).rejects.toThrow(
        /only allowed from "running"/
      );
    });

    it('replaces participant channel and records a manual history entry', async () => {
      const orch = makeFakeOrchestrator();
      const children: FakeUtilityProcess[] = [];
      const forkFn: ForkFn = vi.fn(() => {
        const c = new FakeUtilityProcess(300 + children.length);
        children.push(c);
        return c as unknown as UtilityProcess;
      });

      const sup = new UtilityProcessSupervisor({
        orchestrator: orch as any,
        participantId: 'daemon',
        entry: '/tmp/d.js',
        forkFn,
      });

      await sup.start();
      expect(orch.replaceParticipantChannel).not.toHaveBeenCalled();

      await sup.restart('config-changed');

      expect(sup.state).toBe('running');
      expect(orch.replaceParticipantChannel).toHaveBeenCalledTimes(1);
      expect(sup.restartCount).toBe(1);
      expect(sup.restartHistory.length).toBe(1);
      expect(sup.restartHistory[0]).toMatchObject({
        prevPid: 300,
        exitCode: null,
        reason: 'manual: config-changed',
        restartCount: 1,
        newPid: 301,
      });
      expect(sup.restartHistory[0].succeededAt).toBeDefined();
    });

    it('does not auto-restart from manual kill (exit listener detached)', async () => {
      const orch = makeFakeOrchestrator();
      const children: FakeUtilityProcess[] = [];
      const forkFn: ForkFn = vi.fn(() => {
        const c = new FakeUtilityProcess(400 + children.length);
        children.push(c);
        return c as unknown as UtilityProcess;
      });

      const sup = new UtilityProcessSupervisor({
        orchestrator: orch as any,
        participantId: 'daemon',
        entry: '/tmp/d.js',
        forkFn,
        // Sentinel: if the manual-kill ever leaks into auto-restart this
        // policy would fire and the assertions below would fail.
        restartPolicy: { nextRetryDelayMs: () => 1 },
      });

      await sup.start();
      await sup.restart();
      // Drain any stray timers — there should be none scheduled.
      await vi.advanceTimersByTimeAsync(20);

      // Exactly two children: original + manual-restart replacement.
      expect(children.length).toBe(2);
      expect(sup.restartCount).toBe(1);
    });
  });

  describe("readinessProbe 'firstMessage'", () => {
    it('start() awaits the matching ready message before transitioning to running', async () => {
      const orch = makeFakeOrchestrator();
      const fake = new FakeUtilityProcess(500);
      const forkFn: ForkFn = vi.fn(() => {
        // Schedule the ready message on the next macrotask so the
        // supervisor's `_awaitReadiness` listener has time to attach.
        setTimeout(() => {
          fake.emit('message', { type: SUPERVISOR_READY_MESSAGE_TYPE });
        }, 5);
        return fake as unknown as UtilityProcess;
      });

      const sup = new UtilityProcessSupervisor({
        orchestrator: orch as any,
        participantId: 'design',
        entry: '/tmp/d.js',
        forkFn,
        readinessProbe: { kind: 'firstMessage', timeoutMs: 1000 },
      });

      const startPromise = sup.start();
      // Before the ready message fires, supervisor must NOT have registered.
      expect(sup.state).toBe('starting');
      expect(orch.registerParticipant).not.toHaveBeenCalled();

      await vi.advanceTimersByTimeAsync(10);
      await startPromise;

      expect(sup.state).toBe('running');
      expect(orch.registerParticipant).toHaveBeenCalledTimes(1);
    });

    it('rejects + transitions to failed on readiness timeout, killing the child', async () => {
      const orch = makeFakeOrchestrator();
      const fake = new FakeUtilityProcess(501);
      const forkFn: ForkFn = vi.fn(() => fake as unknown as UtilityProcess);

      const sup = new UtilityProcessSupervisor({
        orchestrator: orch as any,
        participantId: 'design',
        entry: '/tmp/d.js',
        forkFn,
        readinessProbe: { kind: 'firstMessage', timeoutMs: 50 },
      });

      const startPromise = sup.start();
      // Attach a swallowing handler immediately so the rejection that
      // fires when timers advance is never "unhandled".
      const swallowed = startPromise.catch(() => {});
      await vi.advanceTimersByTimeAsync(60);
      await swallowed;

      await expect(startPromise).rejects.toThrow(/readiness probe timed out/);
      expect(sup.state).toBe('failed');
      expect(fake.killed).toBe(true);
      expect(orch.registerParticipant).not.toHaveBeenCalled();
    });

    it('honours a custom match predicate', async () => {
      const orch = makeFakeOrchestrator();
      const fake = new FakeUtilityProcess(502);
      const forkFn: ForkFn = vi.fn(() => {
        setTimeout(() => {
          fake.emit('message', { kind: 'app-ready' });
        }, 5);
        return fake as unknown as UtilityProcess;
      });

      const sup = new UtilityProcessSupervisor({
        orchestrator: orch as any,
        participantId: 'design',
        entry: '/tmp/d.js',
        forkFn,
        readinessProbe: {
          kind: 'firstMessage',
          match: (m) => (m as { kind?: string })?.kind === 'app-ready',
          timeoutMs: 1000,
        },
      });

      const startPromise = sup.start();
      await vi.advanceTimersByTimeAsync(10);
      await startPromise;

      expect(sup.state).toBe('running');
    });

    it('ignores non-matching messages (does not falsely resolve)', async () => {
      const orch = makeFakeOrchestrator();
      const fake = new FakeUtilityProcess(503);
      const forkFn: ForkFn = vi.fn(() => {
        // Emit garbage first; only the second message matches.
        setTimeout(() => fake.emit('message', { type: 'nope' }), 5);
        setTimeout(
          () => fake.emit('message', { type: SUPERVISOR_READY_MESSAGE_TYPE }),
          15
        );
        return fake as unknown as UtilityProcess;
      });

      const sup = new UtilityProcessSupervisor({
        orchestrator: orch as any,
        participantId: 'design',
        entry: '/tmp/d.js',
        forkFn,
        readinessProbe: { kind: 'firstMessage', timeoutMs: 1000 },
      });

      const startPromise = sup.start();
      await vi.advanceTimersByTimeAsync(10);
      // The garbage message fired but supervisor must still be starting.
      expect(sup.state).toBe('starting');
      await vi.advanceTimersByTimeAsync(10);
      await startPromise;
      expect(sup.state).toBe('running');
    });
  });
});
