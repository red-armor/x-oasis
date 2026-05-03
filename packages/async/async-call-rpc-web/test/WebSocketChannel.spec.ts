import { expect, describe, test, vi, beforeEach } from 'vitest';
import WebSocketChannel from '../src/WebSocketChannel';

/**
 * Test suite for WebSocketChannel
 * Covers: construction, on/send, auto-activate, disconnect, readyState
 */

// Mock WebSocket constants globally
const WS_OPEN = 1;
const WS_CLOSED = 3;

// Minimal mock for global WebSocket
(globalThis as any).WebSocket = {
  OPEN: WS_OPEN,
  CLOSED: WS_CLOSED,
  CONNECTING: 0,
  CLOSING: 2,
};

describe('WebSocketChannel', () => {
  let mockSocket: {
    addEventListener: ReturnType<typeof vi.fn>;
    removeEventListener: ReturnType<typeof vi.fn>;
    send: ReturnType<typeof vi.fn>;
    close: ReturnType<typeof vi.fn>;
    readyState: number;
  };

  let eventHandlers: Map<string, Function>;

  beforeEach(() => {
    eventHandlers = new Map();
    mockSocket = {
      addEventListener: vi.fn((event: string, handler: Function) => {
        eventHandlers.set(event, handler);
      }),
      removeEventListener: vi.fn(),
      send: vi.fn(),
      close: vi.fn(),
      readyState: WS_OPEN,
    };
  });

  describe('constructor', () => {
    test('should create channel with socket', () => {
      const channel = new WebSocketChannel(mockSocket as unknown as WebSocket);
      expect(channel).toBeInstanceOf(WebSocketChannel);
    });

    test('should use default name "websocket"', () => {
      const channel = new WebSocketChannel(mockSocket as unknown as WebSocket);
      expect(channel.name).toBe('websocket');
    });

    test('should accept custom name', () => {
      const channel = new WebSocketChannel(mockSocket as unknown as WebSocket, {
        name: 'my-ws',
      });
      expect(channel.name).toBe('my-ws');
    });

    test('should setup socket event handlers', () => {
      new WebSocketChannel(mockSocket as unknown as WebSocket);

      expect(mockSocket.addEventListener).toHaveBeenCalledWith(
        'open',
        expect.any(Function)
      );
      expect(mockSocket.addEventListener).toHaveBeenCalledWith(
        'close',
        expect.any(Function)
      );
      expect(mockSocket.addEventListener).toHaveBeenCalledWith(
        'error',
        expect.any(Function)
      );
    });
  });

  describe('on', () => {
    test('should register message event listener', () => {
      const channel = new WebSocketChannel(mockSocket as unknown as WebSocket);
      const listener = vi.fn();

      channel.on(listener);

      expect(mockSocket.addEventListener).toHaveBeenCalledWith(
        'message',
        expect.any(Function)
      );
    });

    test('should return cleanup function', () => {
      const channel = new WebSocketChannel(mockSocket as unknown as WebSocket);
      const listener = vi.fn();

      const cleanup = channel.on(listener);
      expect(typeof cleanup).toBe('function');
    });

    test('should remove event listener on cleanup', () => {
      const channel = new WebSocketChannel(mockSocket as unknown as WebSocket);
      const listener = vi.fn();

      const cleanup = channel.on(listener);
      (cleanup as () => void)();

      expect(mockSocket.removeEventListener).toHaveBeenCalledWith(
        'message',
        expect.any(Function)
      );
    });

    test('should not forward null/undefined messages', () => {
      const channel = new WebSocketChannel(mockSocket as unknown as WebSocket);
      const listener = vi.fn();
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      channel.on(listener);

      // Get the handler registered for 'message'
      const messageCall = mockSocket.addEventListener.mock.calls.find(
        (c: any[]) => c[0] === 'message'
      );
      const handler = messageCall![1];

      handler(null);
      expect(listener).not.toHaveBeenCalled();

      handler(undefined);
      expect(listener).not.toHaveBeenCalled();

      consoleSpy.mockRestore();
    });
  });

  describe('send', () => {
    test('should send string data when socket is open', () => {
      const channel = new WebSocketChannel(mockSocket as unknown as WebSocket);

      channel.send('hello');

      expect(mockSocket.send).toHaveBeenCalledWith('hello');
    });

    test('should JSON.stringify non-string/non-binary data', () => {
      const channel = new WebSocketChannel(mockSocket as unknown as WebSocket);
      const data = { method: 'test', params: [1, 2] };

      channel.send(data);

      expect(mockSocket.send).toHaveBeenCalledWith(JSON.stringify(data));
    });

    test('should warn when socket is not open', () => {
      mockSocket.readyState = WS_CLOSED;
      const channel = new WebSocketChannel(mockSocket as unknown as WebSocket);
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      channel.send('hello');

      expect(mockSocket.send).not.toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });
  });

  describe('disconnect', () => {
    test('should close the socket', () => {
      const channel = new WebSocketChannel(mockSocket as unknown as WebSocket);

      channel.disconnect();

      expect(mockSocket.close).toHaveBeenCalled();
    });
  });

  describe('readyState / isOpen', () => {
    test('should return socket readyState', () => {
      mockSocket.readyState = WS_OPEN;
      const channel = new WebSocketChannel(mockSocket as unknown as WebSocket);

      expect(channel.readyState).toBe(WS_OPEN);
    });

    test('isOpen should return true when OPEN', () => {
      mockSocket.readyState = WS_OPEN;
      const channel = new WebSocketChannel(mockSocket as unknown as WebSocket);

      expect(channel.isOpen()).toBe(true);
    });

    test('isOpen should return false when not OPEN', () => {
      mockSocket.readyState = WS_CLOSED;
      const channel = new WebSocketChannel(mockSocket as unknown as WebSocket);

      expect(channel.isOpen()).toBe(false);
    });
  });

  describe('middleware decoration', () => {
    test('decorateSendMiddleware should return middlewares unchanged', () => {
      const channel = new WebSocketChannel(mockSocket as unknown as WebSocket);
      const middlewares = [vi.fn(), vi.fn()];

      const result = channel.decorateSendMiddleware(middlewares as any);

      expect(result).toBe(middlewares);
    });

    test('decorateOnMessageMiddleware should replace first middleware with normalizer', () => {
      const channel = new WebSocketChannel(mockSocket as unknown as WebSocket);
      const mw1 = vi.fn();
      const mw2 = vi.fn();

      const result = channel.decorateOnMessageMiddleware([mw1, mw2] as any);

      // Should replace first middleware and keep the rest
      expect(result.length).toBe(2);
      expect(result[1]).toBe(mw2);
      // First should be the normalizer, not the original mw1
      expect(result[0]).not.toBe(mw1);
    });

    test('decorateOnMessageMiddleware should return empty array unchanged', () => {
      const channel = new WebSocketChannel(mockSocket as unknown as WebSocket);

      const result = channel.decorateOnMessageMiddleware([] as any);

      expect(result).toEqual([]);
    });
  });
});
