import { expect, test, describe, vi, beforeEach } from 'vitest';
import { handleRequest } from '../src/middlewares/handleRequest';
import { ResponseType, RequestType } from '../src/types';
import AbstractChannelProtocol from '../src/protocol/AbstractChannelProtocol';

/**
 * Mock setup for testing handleRequest middleware
 */
describe('handleRequest middleware', () => {
  let mockProtocol: Partial<AbstractChannelProtocol>;
  let requestHandler: any;

  beforeEach(() => {
    // Create a mock protocol with necessary methods
    mockProtocol = {
      isConnected: () => true,
      sendReply: vi.fn(),
      service: {
        getHandler: vi.fn(),
      },
      subscriptions: new Map(),
      requestEvents: new Map(),
      activeEventMethods: new Set(),
      writeBuffer: {
        encode: (data: any) => data, // Simple mock: return data as-is
      },
    };

    requestHandler = handleRequest(mockProtocol as AbstractChannelProtocol);
  });

  describe('ping-pong event methods (on* methods)', () => {
    test('should invoke event method with remote callback', () => {
      // Arrange
      const handler = vi.fn();
      (mockProtocol.service!.getHandler as any).mockReturnValue(handler);

      const message = {
        event: null,
        data: [
          [RequestType.PromiseRequest, 'seq-1', '/service', 'onPing'], // header
          [['arg1']], // body
        ],
      };

      // Act
      const result = requestHandler(message);

      // Assert
      expect(handler).toHaveBeenCalledTimes(1);
      // The handler should receive a remote callback function as the first argument
      expect(typeof handler.mock.calls[0][0]).toBe('function');
      expect(result).toBe(message);
    });

    test('should send response when remote callback is invoked', () => {
      // Arrange
      let capturedCallback: any;
      const handler = vi.fn((callback) => {
        capturedCallback = callback;
      });
      (mockProtocol.service!.getHandler as any).mockReturnValue(handler);

      const message = {
        event: null,
        data: [
          [RequestType.PromiseRequest, 'seq-1', '/service', 'onPing'],
          [[]],
        ],
      };

      requestHandler(message);

      // Act - invoke the remote callback
      capturedCallback('ping-response');

      // Assert
      expect(mockProtocol.sendReply).toHaveBeenCalledTimes(1);
      const sentData = (mockProtocol.sendReply as any).mock.calls[0][0];
      expect(sentData[0][0]).toBe(ResponseType.ReturnSuccess);
      expect(sentData[0][1]).toBe('seq-1');
    });

    test('should handle multiple callback invocations', () => {
      // Arrange
      let capturedCallback: any;
      const handler = vi.fn((callback) => {
        capturedCallback = callback;
      });
      (mockProtocol.service!.getHandler as any).mockReturnValue(handler);

      const message = {
        event: null,
        data: [
          [RequestType.PromiseRequest, 'seq-1', '/service', 'onPing'],
          [[]],
        ],
      };

      requestHandler(message);

      // Act - invoke multiple times (simulating periodic pings)
      capturedCallback('ping-1');
      capturedCallback('ping-2');
      capturedCallback('ping-3');

      // Assert
      expect(mockProtocol.sendReply).toHaveBeenCalledTimes(3);
    });

    test('should handle callback with multiple arguments', () => {
      // Arrange
      let capturedCallback: any;
      const handler = vi.fn((callback) => {
        capturedCallback = callback;
      });
      (mockProtocol.service!.getHandler as any).mockReturnValue(handler);

      const message = {
        event: null,
        data: [
          [RequestType.PromiseRequest, 'seq-1', '/service', 'onCustom'],
          [[]],
        ],
      };

      requestHandler(message);

      // Act
      capturedCallback('arg1', 'arg2', 'arg3');

      // Assert
      expect(mockProtocol.sendReply).toHaveBeenCalledTimes(1);
    });

    test('should handle error during handler initialization', () => {
      // Arrange
      const error = new Error('Handler initialization failed');
      const handler = vi.fn(() => {
        throw error;
      });
      (mockProtocol.service!.getHandler as any).mockReturnValue(handler);

      const message = {
        event: null,
        data: [
          [RequestType.PromiseRequest, 'seq-1', '/service', 'onPing'],
          [[]],
        ],
      };

      // Act
      const result = requestHandler(message);

      // Assert
      expect(mockProtocol.sendReply).toHaveBeenCalledTimes(1);
      const sentData = (mockProtocol.sendReply as any).mock.calls[0][0];
      expect(sentData[0][0]).toBe(ResponseType.ReturnFail);
      expect(result).toBe(message);
    });

    test('should handle encode errors gracefully', () => {
      // Arrange
      let capturedCallback: any;
      const handler = vi.fn((callback) => {
        capturedCallback = callback;
      });
      (mockProtocol.service!.getHandler as any).mockReturnValue(handler);

      // Mock encode to throw error
      const encodeError = new Error('Encode failed');
      (mockProtocol.writeBuffer!.encode as any) = vi
        .fn()
        .mockImplementationOnce(() => {
          throw encodeError;
        })
        .mockImplementationOnce(() => [
          [ResponseType.ReturnSuccess, 'seq-1'],
          [],
        ]); // Fallback

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation();

      const message = {
        event: null,
        data: [
          [RequestType.PromiseRequest, 'seq-1', '/service', 'onPing'],
          [[]],
        ],
      };

      requestHandler(message);

      // Act
      capturedCallback('data');

      // Assert
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('[handleRequest] Encode error'),
        encodeError
      );
      expect(mockProtocol.sendReply).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    test('should not send if protocol is disconnected', () => {
      // Arrange
      (mockProtocol.isConnected as any) = () => false;

      let capturedCallback: any;
      const handler = vi.fn((callback) => {
        capturedCallback = callback;
      });
      (mockProtocol.service!.getHandler as any).mockReturnValue(handler);

      const message = {
        event: null,
        data: [
          [RequestType.PromiseRequest, 'seq-1', '/service', 'onPing'],
          [[]],
        ],
      };

      requestHandler(message);

      // Act
      capturedCallback('ping');

      // Assert
      expect(mockProtocol.sendReply).not.toHaveBeenCalled();
    });

    test('should stop sending after EventMethodStop is received', () => {
      // Arrange
      let capturedCallback: any;
      const handler = vi.fn((callback) => {
        capturedCallback = callback;
      });
      (mockProtocol.service!.getHandler as any).mockReturnValue(handler);

      const initialMessage = {
        event: null,
        data: [
          [RequestType.PromiseRequest, 'seq-1', '/service', 'onPing'],
          [[]],
        ],
      };

      requestHandler(initialMessage);

      // Act - send initial ping
      capturedCallback('ping-1');
      expect(mockProtocol.sendReply).toHaveBeenCalledTimes(1);

      // Now send EventMethodStop
      const stopMessage = {
        event: null,
        data: [
          [RequestType.EventMethodStop, 'seq-1', '/service', 'onPing'],
          [[]],
        ],
      };

      requestHandler(stopMessage);

      // Act - try to send another ping (should be ignored)
      capturedCallback('ping-2');

      // Assert - should still only have been called once (the first ping)
      expect(mockProtocol.sendReply).toHaveBeenCalledTimes(2); // 1 for ping + 1 for EventMethodStopped response
      expect(mockProtocol.activeEventMethods?.has('seq-1')).toBe(false);
      expect(mockProtocol.requestEvents?.has('seq-1')).toBe(false);
    });

    test('should send EventMethodStopped acknowledgement', () => {
      // Arrange
      let capturedCallback: any;
      const handler = vi.fn((callback) => {
        capturedCallback = callback;
      });
      (mockProtocol.service!.getHandler as any).mockReturnValue(handler);

      const initialMessage = {
        event: null,
        data: [
          [RequestType.PromiseRequest, 'seq-1', '/service', 'onPing'],
          [[]],
        ],
      };

      requestHandler(initialMessage);

      // Verify event method is registered
      expect(mockProtocol.activeEventMethods?.has('seq-1')).toBe(true);

      // Act - send EventMethodStop
      const stopMessage = {
        event: null,
        data: [
          [RequestType.EventMethodStop, 'seq-1', '/service', 'onPing'],
          [[]],
        ],
      };

      requestHandler(stopMessage);

      // Assert - should send EventMethodStopped response
      const lastCall = (mockProtocol.sendReply as any).mock.calls[0][0];
      expect(lastCall[0][0]).toBe(ResponseType.EventMethodStopped);
      expect(lastCall[0][1]).toBe('seq-1');
    });

    test('should clean up activeEventMethods on handler error', () => {
      // Arrange
      const error = new Error('Handler initialization failed');
      const handler = vi.fn(() => {
        throw error;
      });
      (mockProtocol.service!.getHandler as any).mockReturnValue(handler);

      const message = {
        event: null,
        data: [
          [RequestType.PromiseRequest, 'seq-1', '/service', 'onPing'],
          [[]],
        ],
      };

      // Act
      requestHandler(message);

      // Assert - should be cleaned up on error
      expect(mockProtocol.activeEventMethods?.has('seq-1')).toBe(false);
      expect(mockProtocol.requestEvents?.has('seq-1')).toBe(false);
    });
  });

  describe('subscription streaming (SubscriptionRequest)', () => {
    test('should handle subscription request with observable', async () => {
      // Arrange
      const observable = {
        subscribe: vi.fn((observer: any) => {
          // Simulate data stream
          setTimeout(() => observer.next('data-1'), 10);
          setTimeout(() => observer.next('data-2'), 20);
          setTimeout(() => observer.complete(), 30);

          return { unsubscribe: vi.fn() };
        }),
      };

      const handler = vi.fn().mockResolvedValue(observable);
      (mockProtocol.service!.getHandler as any).mockReturnValue(handler);

      const message = {
        event: null,
        data: [
          [RequestType.SubscriptionRequest, 'seq-1', '/service', 'onStream'],
          [[]],
        ],
      };

      // Act
      requestHandler(message);

      // Wait for async operations
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Assert
      expect(handler).toHaveBeenCalledTimes(1);
      expect(observable.subscribe).toHaveBeenCalledTimes(1);
      // Should have registered the subscription
      expect(mockProtocol.subscriptions?.has('seq-1')).toBe(true);
    });

    test('should handle subscription stop', () => {
      // Arrange
      const unsubscribeFn = vi.fn();
      const subscription = { unsubscribe: unsubscribeFn };
      mockProtocol.subscriptions?.set('seq-1', subscription as any);

      const message = {
        event: null,
        data: [
          [RequestType.SubscriptionStop, 'seq-1', '/service', 'dummy'],
          [[]],
        ],
      };

      // Act
      const result = requestHandler(message);

      // Assert
      expect(unsubscribeFn).toHaveBeenCalledTimes(1);
      expect(mockProtocol.subscriptions?.has('seq-1')).toBe(false);
      expect(mockProtocol.sendReply).toHaveBeenCalledWith(
        expect.objectContaining({
          0: expect.objectContaining({
            0: ResponseType.SubscriptionStopped,
          }),
        })
      );
      expect(result).toBe(message);
    });
  });

  describe('regular promise requests', () => {
    test('should invoke regular handler and return promise', () => {
      // Arrange
      const handler = vi.fn().mockResolvedValue('result');
      (mockProtocol.service!.getHandler as any).mockReturnValue(handler);

      // Wire format from prepareRequestData (sender):
      //   data = [header, body]   where  body = params  (the positional arg list itself)
      // So a 2-arg call serialises as body === ['arg1', 'arg2'].
      // The previous fixture wrapped one level too many ([['arg1','arg2']]);
      // that masked the receive-side bug where `args = body[0]` silently
      // dropped every positional past the first.
      const message = {
        event: null,
        data: [
          [RequestType.PromiseRequest, 'seq-1', '/service', 'regularMethod'],
          ['arg1', 'arg2'],
        ],
      };

      // Act
      const result = requestHandler(message);

      // Assert
      expect(handler).toHaveBeenCalledWith('arg1', 'arg2');
      expect(result).toBe(message);
    });
  });

  describe('method not found', () => {
    test('should return method not found error', () => {
      // Arrange
      (mockProtocol.service!.getHandler as any).mockReturnValue(null);

      const message = {
        event: null,
        data: [
          [RequestType.PromiseRequest, 'seq-1', '/service', 'nonExistent'],
          [[]],
        ],
      };

      // Act
      const result = requestHandler(message);

      // Assert
      expect(mockProtocol.sendReply).toHaveBeenCalledTimes(1);
      const sentData = (mockProtocol.sendReply as any).mock.calls[0][0];
      expect(sentData[0][0]).toBe(ResponseType.ReturnFail);
      expect(result).toBe(message);
    });
  });

  describe('response pass-through', () => {
    test('should pass through response messages without processing', () => {
      // Arrange
      const message = {
        event: null,
        data: [
          [ResponseType.ReturnSuccess, 'seq-1'], // Already a response
          [['result']],
        ],
      };

      // Act
      const result = requestHandler(message);

      // Assert
      expect(mockProtocol.service!.getHandler).not.toHaveBeenCalled();
      expect(result).toBe(message);
    });
  });
});
