import { expect, describe, test, vi } from 'vitest';
import NodeProcessChannel from '../src/NodeProcessChannel';

/**
 * Test suite for NodeProcessChannel
 * Covers: construction, on/send, disconnect, auto-disconnect on exit
 */
describe('NodeProcessChannel', () => {
  // Mock ChildProcess (parent side)
  const createMockChildProcess = () => ({
    on: vi.fn(),
    removeListener: vi.fn(),
    send: vi.fn(),
    kill: vi.fn(),
    disconnect: vi.fn(),
    connected: true,
  });

  // Mock NodeJS.Process (child side)
  const createMockNodeProcess = () => ({
    on: vi.fn(),
    removeListener: vi.fn(),
    send: vi.fn(),
    // No 'kill' method — distinguishes it from ChildProcess
  });

  describe('constructor', () => {
    test('should create channel with ChildProcess', () => {
      const proc = createMockChildProcess();
      const channel = new NodeProcessChannel({
        process: proc as any,
      });
      expect(channel).toBeInstanceOf(NodeProcessChannel);
    });

    test('should create channel with NodeJS.Process', () => {
      const proc = createMockNodeProcess();
      const channel = new NodeProcessChannel({
        process: proc as any,
      });
      expect(channel).toBeInstanceOf(NodeProcessChannel);
    });

    test('should register exit listener for ChildProcess', () => {
      const proc = createMockChildProcess();
      new NodeProcessChannel({ process: proc as any });

      expect(proc.on).toHaveBeenCalledWith('exit', expect.any(Function));
    });

    test('should not register exit listener for NodeJS.Process', () => {
      const proc = createMockNodeProcess();
      new NodeProcessChannel({ process: proc as any });

      // The 'on' should NOT be called with 'exit' for process (child side)
      const exitCalls = proc.on.mock.calls.filter(
        (c: any[]) => c[0] === 'exit'
      );
      expect(exitCalls.length).toBe(0);
    });
  });

  describe('on', () => {
    test('should register message listener', () => {
      const proc = createMockChildProcess();
      const channel = new NodeProcessChannel({ process: proc as any });
      const listener = vi.fn();

      channel.on(listener);

      expect(proc.on).toHaveBeenCalledWith('message', expect.any(Function));
    });

    test('should return cleanup function', () => {
      const proc = createMockChildProcess();
      const channel = new NodeProcessChannel({ process: proc as any });
      const listener = vi.fn();

      const cleanup = channel.on(listener);
      expect(typeof cleanup).toBe('function');
    });

    test('should remove listener on cleanup', () => {
      const proc = createMockChildProcess();
      const channel = new NodeProcessChannel({ process: proc as any });
      const listener = vi.fn();

      const cleanup = channel.on(listener);
      (cleanup as () => void)();

      expect(proc.removeListener).toHaveBeenCalledWith(
        'message',
        expect.any(Function)
      );
    });

    test('should wrap message in { data: message } shape', () => {
      const proc = createMockChildProcess();
      const channel = new NodeProcessChannel({ process: proc as any });
      const listener = vi.fn();

      channel.on(listener);

      // Get the registered message handler
      const messageCall = proc.on.mock.calls.find(
        (c: any[]) => c[0] === 'message'
      );
      const handler = messageCall![1];

      const rawMessage = { method: 'test', params: [] };
      handler(rawMessage);

      expect(listener).toHaveBeenCalledWith({ data: rawMessage });
    });
  });

  describe('send', () => {
    test('should call process.send with data', () => {
      const proc = createMockChildProcess();
      const channel = new NodeProcessChannel({ process: proc as any });
      const data = { method: 'test', params: [1, 2] };

      channel.send(data);

      expect(proc.send).toHaveBeenCalledWith(data);
    });

    test('should warn when process.send is not available', () => {
      const proc = {
        on: vi.fn(),
        removeListener: vi.fn(),
        // No 'send' and no 'kill' — simulates a process without IPC
      };
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const channel = new NodeProcessChannel({ process: proc as any });

      channel.send('data');

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Cannot send')
      );

      consoleSpy.mockRestore();
    });
  });

  describe('disconnect', () => {
    test('should call process.disconnect for ChildProcess', () => {
      const proc = createMockChildProcess();
      const channel = new NodeProcessChannel({ process: proc as any });

      channel.disconnect();

      expect(proc.disconnect).toHaveBeenCalled();
    });

    test('should not call process.disconnect for NodeJS.Process', () => {
      const proc = createMockNodeProcess();
      const channel = new NodeProcessChannel({ process: proc as any });

      // Should not throw
      expect(() => channel.disconnect()).not.toThrow();
    });

    test('should not call disconnect if already disconnected', () => {
      const proc = createMockChildProcess();
      proc.connected = false;
      const channel = new NodeProcessChannel({ process: proc as any });

      channel.disconnect();

      expect(proc.disconnect).not.toHaveBeenCalled();
    });
  });

  describe('auto-disconnect on exit', () => {
    test('should auto-disconnect when child process exits', () => {
      const proc = createMockChildProcess();
      const channel = new NodeProcessChannel({ process: proc as any });

      // Find the exit handler
      const exitCall = proc.on.mock.calls.find((c: any[]) => c[0] === 'exit');
      expect(exitCall).toBeDefined();

      // Simulate exit - should not throw
      const exitHandler = exitCall![1];
      expect(() => exitHandler()).not.toThrow();
    });
  });
});
