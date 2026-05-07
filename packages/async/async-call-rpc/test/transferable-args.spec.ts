import { expect, test, describe, vi, beforeEach } from 'vitest';
import { handleRequest } from '../src/middlewares/handleRequest';
import { RequestType, ResponseType } from '../src/types';
import AbstractChannelProtocol from '../src/protocol/AbstractChannelProtocol';
import RPCServiceHost from '../src/endpoint/RPCServiceHost';

/**
 * When all args are Transferable objects (MessagePort, ArrayBuffer, etc.),
 * they are passed via message.ports instead of serialized data.
 *
 * Two RequestTypes distinguish single vs multiple Transferable args:
 *   - TransferableArgsRequest      → single arg:  handler(ports[0])
 *   - TransferableArrayArgsRequest → array args:  handler(ports)
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

  test('TransferableArgsRequest: single port is unwrapped from ports array', async () => {
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
        [], // body is empty for Transferable requests
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

  test('TransferableArrayArgsRequest: multiple ports passed as array', async () => {
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

    const handler = vi.fn((ports) => {
      expect(ports).toEqual([fakePort1, fakePort2]);
      return 'ports-received';
    });

    serviceHost.registerServiceHandler('/service', {
      processPort: handler,
    });

    const run = handleRequest(mockProtocol as AbstractChannelProtocol);

    run({
      event: null,
      data: [
        [
          RequestType.TransferableArrayArgsRequest,
          'seq-multi',
          '/service',
          'processPort',
        ],
        [], // body is empty for Transferable requests
      ],
      ports: [fakePort1, fakePort2],
    } as any);

    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    expect(handler).toHaveBeenCalledWith([fakePort1, fakePort2]);
    expect(handler).toHaveBeenCalledTimes(1);

    expect(sendReply).toHaveBeenCalledTimes(1);
    const [data] = sendReply.mock.calls[0];
    expect(data[0][0]).toBe(ResponseType.ReturnSuccess);
    expect(data[0][1]).toBe('seq-multi');
    expect(data[1]).toEqual(['ports-received']);
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
        [],
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

  test('TransferableArgsRequest with no ports passes undefined', async () => {
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
        [],
      ],
      ports: [],
    } as any);

    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    // TransferableArgsRequest with empty ports → ports[0] = undefined
    expect(handler).toHaveBeenCalledWith(undefined);
    expect(sendReply).toHaveBeenCalledTimes(1);
    const [data] = sendReply.mock.calls[0];
    expect(data[0][0]).toBe(ResponseType.ReturnSuccess);
    expect(data[1]).toEqual(['no-args']);
  });
});
