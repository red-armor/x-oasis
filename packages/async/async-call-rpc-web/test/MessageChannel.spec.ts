import { expect, describe, test, vi, beforeEach } from 'vitest';
import RPCMessageChannel from '../src/MessageChannel';

/**
 * Test suite for RPCMessageChannel
 * Covers: construction, port.start(), on/send, transfer, disconnect
 *
 * NOTE: RPCMessageChannel defaults `sender` to `window`, which does not exist
 * in a Node/Vitest environment. Every construction must pass an explicit
 * `sender` (a plain mock object suffices) to avoid `ReferenceError: window is not defined`.
 */
describe('RPCMessageChannel', () => {
  let mockPort: {
    addEventListener: ReturnType<typeof vi.fn>;
    removeEventListener: ReturnType<typeof vi.fn>;
    postMessage: ReturnType<typeof vi.fn>;
    start: ReturnType<typeof vi.fn>;
    close: ReturnType<typeof vi.fn>;
  };

  /** A stub sender so that the constructor never tries to read `window`. */
  const mockSender = { postMessage: vi.fn() };

  beforeEach(() => {
    mockPort = {
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      postMessage: vi.fn(),
      start: vi.fn(),
      close: vi.fn(),
    };
  });

  describe('constructor', () => {
    test('should create channel with port', () => {
      const channel = new RPCMessageChannel({
        port: mockPort as unknown as MessagePort,
        sender: mockSender,
      });
      expect(channel).toBeInstanceOf(RPCMessageChannel);
    });

    test('should call port.start() on construction', () => {
      new RPCMessageChannel({
        port: mockPort as unknown as MessagePort,
        sender: mockSender,
      });
      expect(mockPort.start).toHaveBeenCalled();
    });

    test('should not throw if port.start is undefined', () => {
      const portWithoutStart = { ...mockPort, start: undefined };
      expect(() => {
        new RPCMessageChannel({
          port: portWithoutStart as unknown as MessagePort,
          sender: mockSender,
        });
      }).not.toThrow();
    });
  });

  describe('on', () => {
    test('should register message event listener on port', () => {
      const channel = new RPCMessageChannel({
        port: mockPort as unknown as MessagePort,
        sender: mockSender,
      });
      const listener = vi.fn();

      channel.on(listener);

      expect(mockPort.addEventListener).toHaveBeenCalledWith(
        'message',
        expect.any(Function)
      );
    });

    test('should return cleanup function', () => {
      const channel = new RPCMessageChannel({
        port: mockPort as unknown as MessagePort,
        sender: mockSender,
      });
      const listener = vi.fn();

      const cleanup = channel.on(listener);
      expect(typeof cleanup).toBe('function');
    });

    test('should remove event listener on cleanup', () => {
      const channel = new RPCMessageChannel({
        port: mockPort as unknown as MessagePort,
        sender: mockSender,
      });
      const listener = vi.fn();

      const cleanup = channel.on(listener);
      (cleanup as () => void)();

      expect(mockPort.removeEventListener).toHaveBeenCalledWith(
        'message',
        expect.any(Function)
      );
    });

    test('should forward MessageEvent to listener', () => {
      const channel = new RPCMessageChannel({
        port: mockPort as unknown as MessagePort,
        sender: mockSender,
      });
      const listener = vi.fn();

      channel.on(listener);

      const registeredHandler = mockPort.addEventListener.mock.calls[0][1];
      const mockEvent = { data: 'test' } as MessageEvent;
      registeredHandler(mockEvent);

      expect(listener).toHaveBeenCalledWith(mockEvent);
    });
  });

  describe('send', () => {
    test('should post message to port', () => {
      const channel = new RPCMessageChannel({
        port: mockPort as unknown as MessagePort,
        sender: mockSender,
      });

      channel.send({ type: 'request' });

      expect(mockPort.postMessage).toHaveBeenCalledWith({ type: 'request' });
    });

    test('should pass transfer list when provided', () => {
      const channel = new RPCMessageChannel({
        port: mockPort as unknown as MessagePort,
        sender: mockSender,
      });
      const buffer = new ArrayBuffer(8);

      channel.send({ data: buffer }, [buffer]);

      expect(mockPort.postMessage).toHaveBeenCalledWith({ data: buffer }, [
        buffer,
      ]);
    });

    test('should not pass transfer when empty array', () => {
      const channel = new RPCMessageChannel({
        port: mockPort as unknown as MessagePort,
        sender: mockSender,
      });

      channel.send('data', []);

      // Empty array should not trigger the transfer branch
      expect(mockPort.postMessage).toHaveBeenCalledWith('data');
    });
  });

  describe('disconnect', () => {
    test('should close the port', () => {
      const channel = new RPCMessageChannel({
        port: mockPort as unknown as MessagePort,
        sender: mockSender,
      });

      channel.disconnect();

      expect(mockPort.close).toHaveBeenCalled();
    });
  });

  describe('middleware decoration', () => {
    test('decorateSendMiddleware should return middlewares unchanged', () => {
      const channel = new RPCMessageChannel({
        port: mockPort as unknown as MessagePort,
        sender: mockSender,
      });
      const middlewares = [vi.fn(), vi.fn()];

      const result = channel.decorateSendMiddleware(middlewares as any);

      expect(result).toBe(middlewares);
    });

    test('decorateOnMessageMiddleware should return middlewares unchanged', () => {
      const channel = new RPCMessageChannel({
        port: mockPort as unknown as MessagePort,
        sender: mockSender,
      });
      const middlewares = [vi.fn(), vi.fn()];

      const result = channel.decorateOnMessageMiddleware(middlewares as any);

      expect(result).toBe(middlewares);
    });
  });

  describe('late port binding (bindPort)', () => {
    /**
     * Mirror of the Electron-side bindPort coverage. The web channel
     * supports the same "construct now, bind later" flow used when a
     * port arrives via a later transferred MessageEvent.
     */
    test('constructed without a port: starts disconnected, activates on bindPort', () => {
      const channel = new RPCMessageChannel({ sender: mockSender });
      expect(channel.isConnected()).toBe(false);
      expect(mockPort.start).not.toHaveBeenCalled();

      channel.bindPort(mockPort as unknown as MessagePort);
      expect(mockPort.start).toHaveBeenCalled();
      expect(channel.isConnected()).toBe(true);
    });

    test('bindPort flushes any queued send entries', () => {
      const channel = new RPCMessageChannel({ sender: mockSender });
      // Simulate a pending entry the way handleDisconnectedRequest would.
      channel.addPendingSendEntry({ middlewareContext: {} } as any);
      expect(channel.pendingSendEntries.size).toBe(1);

      channel.bindPort(mockPort as unknown as MessagePort);
      expect(channel.pendingSendEntries.size).toBe(0);
    });

    test('bindPort wires a previously-registered listener', () => {
      const channel = new RPCMessageChannel({ sender: mockSender });
      const listener = vi.fn();

      // Listener registered BEFORE the port arrives — common when
      // setServiceHost is called early.
      channel.on(listener);
      expect(mockPort.addEventListener).not.toHaveBeenCalled();

      channel.bindPort(mockPort as unknown as MessagePort);
      expect(mockPort.addEventListener).toHaveBeenCalledWith(
        'message',
        expect.any(Function)
      );

      const handler = mockPort.addEventListener.mock.calls[0][1];
      const mockEvent = { data: 'late-msg' } as MessageEvent;
      handler(mockEvent);
      expect(listener).toHaveBeenCalledWith(mockEvent);
    });

    test('bindPort is a no-op when a port is already bound', () => {
      const channel = new RPCMessageChannel({
        port: mockPort as unknown as MessagePort,
        sender: mockSender,
      });
      const otherPort = {
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        postMessage: vi.fn(),
        start: vi.fn(),
        close: vi.fn(),
      };
      channel.bindPort(otherPort as unknown as MessagePort);
      // The second port is ignored — its start() must NOT fire.
      expect(otherPort.start).not.toHaveBeenCalled();
    });

    test('send before bindPort warns and is a no-op (does not throw)', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const channel = new RPCMessageChannel({ sender: mockSender });
      expect(() => channel.send({ x: 1 })).not.toThrow();
      expect(warn).toHaveBeenCalledWith(
        '[RPCMessageChannel] send called before port was bound.'
      );
      expect(mockPort.postMessage).not.toHaveBeenCalled();
      warn.mockRestore();
    });
  });
});
