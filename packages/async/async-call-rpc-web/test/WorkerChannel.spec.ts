import { expect, describe, test, vi, beforeEach } from 'vitest';
import WorkerChannel from '../src/WorkerChannel';

/**
 * Test suite for WorkerChannel
 * Covers: construction, on/send, event listener setup
 */
describe('WorkerChannel', () => {
  let mockWorker: {
    addEventListener: ReturnType<typeof vi.fn>;
    removeEventListener: ReturnType<typeof vi.fn>;
    postMessage: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    mockWorker = {
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      postMessage: vi.fn(),
    };
  });

  describe('constructor', () => {
    test('should create channel with worker', () => {
      const channel = new WorkerChannel(mockWorker);
      expect(channel).toBeInstanceOf(WorkerChannel);
    });

    test('should use default name "worker"', () => {
      const channel = new WorkerChannel(mockWorker);
      expect(channel.name).toBe('worker');
    });

    test('should accept custom name', () => {
      const channel = new WorkerChannel(mockWorker, { name: 'my-worker' });
      expect(channel.name).toBe('my-worker');
    });

    test('should accept empty options', () => {
      const channel = new WorkerChannel(mockWorker, {});
      expect(channel.name).toBe('worker');
    });
  });

  describe('on', () => {
    test('should register message event listener', () => {
      const channel = new WorkerChannel(mockWorker);
      const listener = vi.fn();

      channel.on(listener);

      expect(mockWorker.addEventListener).toHaveBeenCalledWith(
        'message',
        expect.any(Function)
      );
    });

    test('should return cleanup function', () => {
      const channel = new WorkerChannel(mockWorker);
      const listener = vi.fn();

      const cleanup = channel.on(listener);

      expect(typeof cleanup).toBe('function');
    });

    test('should remove event listener on cleanup', () => {
      const channel = new WorkerChannel(mockWorker);
      const listener = vi.fn();

      const cleanup = channel.on(listener);
      (cleanup as () => void)();

      expect(mockWorker.removeEventListener).toHaveBeenCalledWith(
        'message',
        expect.any(Function)
      );
    });

    test('should forward MessageEvent to listener', () => {
      const channel = new WorkerChannel(mockWorker);
      const listener = vi.fn();

      channel.on(listener);

      // Get the registered handler
      const registeredHandler = mockWorker.addEventListener.mock.calls[0][1];
      const mockEvent = { data: 'test-data' } as MessageEvent;
      registeredHandler(mockEvent);

      expect(listener).toHaveBeenCalledWith(mockEvent);
    });
  });

  describe('send', () => {
    test('should post message to worker', () => {
      const channel = new WorkerChannel(mockWorker);
      const data = { type: 'request', method: 'test' };

      channel.send(data);

      expect(mockWorker.postMessage).toHaveBeenCalledWith(data);
    });

    test('should send string data', () => {
      const channel = new WorkerChannel(mockWorker);

      channel.send('hello');

      expect(mockWorker.postMessage).toHaveBeenCalledWith('hello');
    });

    test('should send null data', () => {
      const channel = new WorkerChannel(mockWorker);

      channel.send(null);

      expect(mockWorker.postMessage).toHaveBeenCalledWith(null);
    });
  });
});
