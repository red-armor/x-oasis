import { expect, test, describe, vi, beforeEach } from 'vitest';
import { handleRequest } from '../src/middlewares/handleRequest';
import { RequestType, ResponseType } from '../src/types';
import AbstractChannelProtocol from '../src/protocol/AbstractChannelProtocol';
import RPCServiceHost from '../src/endpoint/RPCServiceHost';

/**
 * When all args are Transferable objects (MessagePort, ArrayBuffer, etc.),
 * they are passed via message.ports instead of serialized data.
 * The handleRequest middleware must reconstruct args from message.ports.
 */
describe('handleRequest TransferableArgsRequest', () => {
  let mockProtocol: Partial<AbstractChannelProtocol>;
  let serviceHost: RPCServiceHost;
  let sendReply: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    serviceHost = new RPCServiceHost();
    sendReply = vi.fn();
    mockProtocol = {
      isConnected: () => true,
      sendReply,
      serviceHost,
      service: undefined as any,
      subscriptions: new Map(),
      requestEvents: new Map(),
      activeEventMethods: new Set(),
      writeBuffer: {
        encode: (data: any) => data,
        getFormat: () => 'json',
      },
    };
  });

  test('TransferableArgsRequest reconstructs args from message.ports', async () => {
    // Create fake MessagePorts
    const fakePort1 = {
      postMessage: vi.fn(),
      start: vi.fn(),
      on: vi.fn(),
    };
    const fakePort2 = {
      postMessage: vi.fn(),
      start: vi.fn(),
      on: vi.fn(),
    };

    // Register a handler that expects MessagePorts as arguments
    const handler = vi.fn((port1, port2) => {
      expect(port1).toBe(fakePort1);
      expect(port2).toBe(fakePort2);
      return 'ports-received';
    });

    serviceHost.registerServiceHandler('/service', {
      processPort: handler,
    });

    const run = handleRequest(mockProtocol as AbstractChannelProtocol);

    // Simulate a TransferableArgsRequest with ports in message.ports
    run({
      event: null,
      data: [
        [
          RequestType.TransferableArgsRequest,
          'seq-port',
          '/service',
          'processPort',
        ],
        [[]], // Empty body for TransferableArgsRequest
      ],
      ports: [fakePort1, fakePort2], // ← The actual ports come from transfer list
    } as any);

    // Wait for async handler execution
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    // Handler should have been called with the ports
    expect(handler).toHaveBeenCalledWith(fakePort1, fakePort2);
    expect(handler).toHaveBeenCalledTimes(1);

    // Response should be ReturnSuccess with the result
    expect(sendReply).toHaveBeenCalledTimes(1);
    const [data] = sendReply.mock.calls[0];
    expect(data[0][0]).toBe(ResponseType.ReturnSuccess);
    expect(data[0][1]).toBe('seq-port');
    expect(data[1]).toEqual(['ports-received']);
  });

  test('TransferableArgsRequest with single port', async () => {
    const fakePort = {
      postMessage: vi.fn(),
      start: vi.fn(),
      on: vi.fn(),
    };

    const handler = vi.fn((port) => {
      expect(port).toBe(fakePort);
      return 'got-port';
    });

    serviceHost.registerServiceHandler('/service', {
      assignPort: handler,
    });

    const run = handleRequest(mockProtocol as AbstractChannelProtocol);

    run({
      event: null,
      data: [
        [
          RequestType.TransferableArgsRequest,
          'seq-single',
          '/service',
          'assignPort',
        ],
        [[]],
      ],
      ports: [fakePort],
    } as any);

    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    expect(handler).toHaveBeenCalledWith(fakePort);
    expect(sendReply).toHaveBeenCalledTimes(1);
    const [data] = sendReply.mock.calls[0];
    expect(data[0][0]).toBe(ResponseType.ReturnSuccess);
    expect(data[1]).toEqual(['got-port']);
  });

  test('TransferableArgsRequest handles handler errors', async () => {
    const fakePort = {
      postMessage: vi.fn(),
      start: vi.fn(),
      on: vi.fn(),
    };

    const handler = vi.fn((_port) => {
      throw new Error('Port processing failed');
    });

    serviceHost.registerServiceHandler('/service', {
      processPort: handler,
    });

    const run = handleRequest(mockProtocol as AbstractChannelProtocol);

    run({
      event: null,
      data: [
        [
          RequestType.TransferableArgsRequest,
          'seq-err',
          '/service',
          'processPort',
        ],
        [[]],
      ],
      ports: [fakePort],
    } as any);

    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    expect(handler).toHaveBeenCalledWith(fakePort);
    expect(sendReply).toHaveBeenCalledTimes(1);
    const [data] = sendReply.mock.calls[0];
    expect(data[0][0]).toBe(ResponseType.ReturnFail);
    expect(data[0][1]).toBe('seq-err');
    expect(data[1][0].message).toContain('Port processing failed');
  });

  test('TransferableArgsRequest with no ports uses empty args', async () => {
    const handler = vi.fn(() => 'no-args');

    serviceHost.registerServiceHandler('/service', {
      process: handler,
    });

    const run = handleRequest(mockProtocol as AbstractChannelProtocol);

    run({
      event: null,
      data: [
        [
          RequestType.TransferableArgsRequest,
          'seq-empty',
          '/service',
          'process',
        ],
        [[]],
      ],
      ports: [], // No ports transferred
    } as any);

    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    expect(handler).toHaveBeenCalledWith();
    expect(sendReply).toHaveBeenCalledTimes(1);
    const [data] = sendReply.mock.calls[0];
    expect(data[0][0]).toBe(ResponseType.ReturnSuccess);
    expect(data[1]).toEqual(['no-args']);
  });
});
