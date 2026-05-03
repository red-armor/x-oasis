import { expect, describe, test, vi } from 'vitest';
import ElectronUtilityProcessChannel from '../src/ElectronUtilityProcessChannel';

/**
 * Test suite for ElectronUtilityProcessChannel
 * Covers: construction (both sides), on/send, disconnect, auto-disconnect
 */
describe('ElectronUtilityProcessChannel', () => {
  // Mock UtilityProcess (main process side)
  const createMockUtilityProcess = () => ({
    on: vi.fn(),
    removeListener: vi.fn(),
    postMessage: vi.fn(),
    kill: vi.fn(),
  });

  // Mock ParentPort (utility process side)
  const createMockParentPort = () => ({
    on: vi.fn(),
    removeListener: vi.fn(),
    postMessage: vi.fn(),
    // No 'kill' — distinguishes from UtilityProcess
  });

  describe('constructor with UtilityProcess', () => {
    test('should create channel with process prop', () => {
      const proc = createMockUtilityProcess();
      const channel = new ElectronUtilityProcessChannel({
        process: proc as any,
      });
      expect(channel).toBeInstanceOf(ElectronUtilityProcessChannel);
    });

    test('should register exit listener for UtilityProcess', () => {
      const proc = createMockUtilityProcess();
      new ElectronUtilityProcessChannel({ process: proc as any });

      expect(proc.on).toHaveBeenCalledWith('exit', expect.any(Function));
    });
  });

  describe('constructor with ParentPort', () => {
    test('should create channel with parentPort prop', () => {
      const port = createMockParentPort();
      const channel = new ElectronUtilityProcessChannel({
        parentPort: port as any,
      });
      expect(channel).toBeInstanceOf(ElectronUtilityProcessChannel);
    });

    test('should not register exit listener for ParentPort', () => {
      const port = createMockParentPort();
      new ElectronUtilityProcessChannel({ parentPort: port as any });

      const exitCalls = port.on.mock.calls.filter(
        (c: any[]) => c[0] === 'exit'
      );
      expect(exitCalls.length).toBe(0);
    });
  });

  describe('on', () => {
    test('should register message listener on UtilityProcess', () => {
      const proc = createMockUtilityProcess();
      const channel = new ElectronUtilityProcessChannel({
        process: proc as any,
      });

      const listener = vi.fn();
      channel.on(listener);

      expect(proc.on).toHaveBeenCalledWith('message', expect.any(Function));
    });

    test('should register message listener on ParentPort', () => {
      const port = createMockParentPort();
      const channel = new ElectronUtilityProcessChannel({
        parentPort: port as any,
      });

      const listener = vi.fn();
      channel.on(listener);

      expect(port.on).toHaveBeenCalledWith('message', expect.any(Function));
    });

    test('should return cleanup function', () => {
      const proc = createMockUtilityProcess();
      const channel = new ElectronUtilityProcessChannel({
        process: proc as any,
      });

      const cleanup = channel.on(vi.fn());
      expect(typeof cleanup).toBe('function');
    });

    test('should remove listener on cleanup', () => {
      const proc = createMockUtilityProcess();
      const channel = new ElectronUtilityProcessChannel({
        process: proc as any,
      });

      const cleanup = channel.on(vi.fn());
      (cleanup as () => void)();

      expect(proc.removeListener).toHaveBeenCalledWith(
        'message',
        expect.any(Function)
      );
    });

    test('should forward message event to listener', () => {
      const proc = createMockUtilityProcess();
      const channel = new ElectronUtilityProcessChannel({
        process: proc as any,
      });

      const listener = vi.fn();
      channel.on(listener);

      const messageCall = proc.on.mock.calls.find(
        (c: any[]) => c[0] === 'message'
      );
      const handler = messageCall![1];

      const mockEvent = { data: 'test' };
      handler(mockEvent);

      expect(listener).toHaveBeenCalledWith(mockEvent);
    });
  });

  describe('send', () => {
    test('should call postMessage on UtilityProcess', () => {
      const proc = createMockUtilityProcess();
      const channel = new ElectronUtilityProcessChannel({
        process: proc as any,
      });

      channel.send({ method: 'test' });

      expect(proc.postMessage).toHaveBeenCalledWith({ method: 'test' });
    });

    test('should call postMessage on ParentPort', () => {
      const port = createMockParentPort();
      const channel = new ElectronUtilityProcessChannel({
        parentPort: port as any,
      });

      channel.send('data');

      expect(port.postMessage).toHaveBeenCalledWith('data');
    });

    test('should pass transfer list to postMessage when provided', () => {
      const proc = createMockUtilityProcess();
      const channel = new ElectronUtilityProcessChannel({
        process: proc as any,
      });

      const fakePort = { id: 'port-1' };
      channel.send({ envelope: 'with-port' }, [fakePort as any]);

      expect(proc.postMessage).toHaveBeenCalledWith({ envelope: 'with-port' }, [
        fakePort,
      ]);
    });

    test('should not pass transfer when empty', () => {
      const port = createMockParentPort();
      const channel = new ElectronUtilityProcessChannel({
        parentPort: port as any,
      });

      channel.send('data', []);
      expect(port.postMessage).toHaveBeenCalledWith('data');
    });

    test('should warn when postMessage is not available', () => {
      const target = {
        on: vi.fn(),
        removeListener: vi.fn(),
        // No postMessage, no kill
      };
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const channel = new ElectronUtilityProcessChannel({
        parentPort: target as any,
      });

      channel.send('data');

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Cannot send')
      );

      consoleSpy.mockRestore();
    });
  });

  describe('disconnect', () => {
    test('should kill process for UtilityProcess', () => {
      const proc = createMockUtilityProcess();
      const channel = new ElectronUtilityProcessChannel({
        process: proc as any,
      });

      channel.disconnect();

      expect(proc.kill).toHaveBeenCalled();
    });

    test('should not call kill for ParentPort', () => {
      const port = createMockParentPort();
      const channel = new ElectronUtilityProcessChannel({
        parentPort: port as any,
      });

      // Should not throw
      expect(() => channel.disconnect()).not.toThrow();
    });
  });

  describe('auto-disconnect on exit', () => {
    test('should auto-disconnect when utility process exits', () => {
      const proc = createMockUtilityProcess();
      new ElectronUtilityProcessChannel({ process: proc as any });

      const exitCall = proc.on.mock.calls.find((c: any[]) => c[0] === 'exit');
      expect(exitCall).toBeDefined();

      // Should not throw
      expect(() => exitCall![1]()).not.toThrow();
    });
  });
});
