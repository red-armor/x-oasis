import { expect, describe, test, vi } from 'vitest';
import ElectronUtilityProcessChannel from '../src/electron-main/ElectronUtilityProcessChannel';

describe('ElectronUtilityProcessChannel', () => {
  const createMockUtilityProcess = () => ({
    on: vi.fn(),
    removeListener: vi.fn(),
    postMessage: vi.fn(),
    kill: vi.fn(),
  });

  const createMockParentPort = () => ({
    on: vi.fn(),
    removeListener: vi.fn(),
    postMessage: vi.fn(),
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

    test('should default killOnDisconnect to true for UtilityProcess', () => {
      const proc = createMockUtilityProcess();
      const channel = new ElectronUtilityProcessChannel({
        process: proc as any,
      });
      channel.disconnect();
      expect(proc.kill).toHaveBeenCalled();
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
      channel.on(vi.fn());
      expect(proc.on).toHaveBeenCalledWith('message', expect.any(Function));
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
  });

  describe('disconnect (New Gap F: disconnect/kill separation)', () => {
    test('should kill process when killOnDisconnect is true (default for UtilityProcess)', () => {
      const proc = createMockUtilityProcess();
      const channel = new ElectronUtilityProcessChannel({
        process: proc as any,
      });
      channel.disconnect();
      expect(proc.kill).toHaveBeenCalled();
    });

    test('should NOT kill process when killOnDisconnect is false', () => {
      const proc = createMockUtilityProcess();
      const channel = new ElectronUtilityProcessChannel({
        process: proc as any,
      });
      channel.setKillOnDisconnect(false);
      channel.disconnect();
      expect(proc.kill).not.toHaveBeenCalled();
    });

    test('should not call kill for ParentPort', () => {
      const port = createMockParentPort();
      const channel = new ElectronUtilityProcessChannel({
        parentPort: port as any,
      });
      expect(() => channel.disconnect()).not.toThrow();
    });

    test('setKillOnDisconnect can re-enable kill after being disabled', () => {
      const proc = createMockUtilityProcess();
      const channel = new ElectronUtilityProcessChannel({
        process: proc as any,
      });
      channel.setKillOnDisconnect(false);
      channel.setKillOnDisconnect(true);
      channel.disconnect();
      expect(proc.kill).toHaveBeenCalled();
    });
  });

  describe('auto-disconnect on exit', () => {
    test('should auto-disconnect when utility process exits', () => {
      const proc = createMockUtilityProcess();
      new ElectronUtilityProcessChannel({ process: proc as any });
      const exitCall = proc.on.mock.calls.find((c: any[]) => c[0] === 'exit');
      expect(exitCall).toBeDefined();
      expect(() => exitCall![1]()).not.toThrow();
    });
  });
});
