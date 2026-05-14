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
});
