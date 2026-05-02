import { expect, describe, test, vi, beforeEach } from 'vitest';
import ElectronMessagePortMainChannel from '../src/ElectronMessagePortMainChannel';

/**
 * Test suite for ElectronMessagePortMainChannel
 * Covers: construction, port.start(), on/send, transfer, disconnect
 */
describe('ElectronMessagePortMainChannel', () => {
  let mockPort: {
    on: ReturnType<typeof vi.fn>;
    removeListener: ReturnType<typeof vi.fn>;
    postMessage: ReturnType<typeof vi.fn>;
    start: ReturnType<typeof vi.fn>;
    close: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    mockPort = {
      on: vi.fn(),
      removeListener: vi.fn(),
      postMessage: vi.fn(),
      start: vi.fn(),
      close: vi.fn(),
    };
  });

  describe('constructor', () => {
    test('should create channel with port', () => {
      const channel = new ElectronMessagePortMainChannel({
        port: mockPort as any,
      });
      expect(channel).toBeInstanceOf(ElectronMessagePortMainChannel);
    });

    test('should call port.start() on construction', () => {
      new ElectronMessagePortMainChannel({ port: mockPort as any });
      expect(mockPort.start).toHaveBeenCalled();
    });

    test('should not throw if port.start is undefined', () => {
      const portWithoutStart = { ...mockPort, start: undefined };
      expect(() => {
        new ElectronMessagePortMainChannel({
          port: portWithoutStart as any,
        });
      }).not.toThrow();
    });

    test('should register close listener for auto-disconnect', () => {
      new ElectronMessagePortMainChannel({ port: mockPort as any });

      expect(mockPort.on).toHaveBeenCalledWith('close', expect.any(Function));
    });
  });

  describe('on', () => {
    test('should register message listener on port', () => {
      const channel = new ElectronMessagePortMainChannel({
        port: mockPort as any,
      });

      const listener = vi.fn();
      channel.on(listener);

      expect(mockPort.on).toHaveBeenCalledWith('message', expect.any(Function));
    });

    test('should return cleanup function', () => {
      const channel = new ElectronMessagePortMainChannel({
        port: mockPort as any,
      });

      const cleanup = channel.on(vi.fn());
      expect(typeof cleanup).toBe('function');
    });

    test('should remove listener on cleanup', () => {
      const channel = new ElectronMessagePortMainChannel({
        port: mockPort as any,
      });

      const cleanup = channel.on(vi.fn());
      (cleanup as () => void)();

      expect(mockPort.removeListener).toHaveBeenCalledWith(
        'message',
        expect.any(Function)
      );
    });

    test('should forward message event to listener', () => {
      const channel = new ElectronMessagePortMainChannel({
        port: mockPort as any,
      });

      const listener = vi.fn();
      channel.on(listener);

      // Find the 'message' handler
      const messageCall = mockPort.on.mock.calls.find(
        (c: any[]) => c[0] === 'message'
      );
      const handler = messageCall![1];

      const mockEvent = { data: 'test-data' };
      handler(mockEvent);

      expect(listener).toHaveBeenCalledWith(mockEvent);
    });
  });

  describe('send', () => {
    test('should post message to port', () => {
      const channel = new ElectronMessagePortMainChannel({
        port: mockPort as any,
      });

      channel.send({ type: 'request' });

      expect(mockPort.postMessage).toHaveBeenCalledWith({ type: 'request' });
    });

    test('should pass transfer list when provided', () => {
      const channel = new ElectronMessagePortMainChannel({
        port: mockPort as any,
      });

      const transferPort = { ...mockPort };
      channel.send('data', [transferPort as any]);

      expect(mockPort.postMessage).toHaveBeenCalledWith('data', [transferPort]);
    });

    test('should not pass transfer when empty', () => {
      const channel = new ElectronMessagePortMainChannel({
        port: mockPort as any,
      });

      channel.send('data', []);
      expect(mockPort.postMessage).toHaveBeenCalledWith('data');
    });
  });

  describe('disconnect', () => {
    test('should close the port', () => {
      const channel = new ElectronMessagePortMainChannel({
        port: mockPort as any,
      });

      channel.disconnect();

      expect(mockPort.close).toHaveBeenCalled();
    });
  });
});
