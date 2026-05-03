import { expect, test, describe, vi, beforeEach } from 'vitest';
import { handleRequest } from '../src/middlewares/handleRequest';
import { RequestType, ResponseType } from '../src/types';
import AbstractChannelProtocol from '../src/protocol/AbstractChannelProtocol';
import RPCServiceHost from '../src/endpoint/RPCServiceHost';

/**
 * MessagePort-like return values must be sent as a `PortSuccess` response
 * with the port queued in the channel's transfer list — NOT serialized.
 */
describe('handleRequest port-return', () => {
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
      writeBuffer: { encode: (data: any) => data },
    };
  });

  test('handler returning a port-like value sends PortSuccess with transfer list', async () => {
    const fakePort = {
      postMessage: vi.fn(),
      start: vi.fn(),
      on: vi.fn(),
    };
    serviceHost.registerServiceHandler('/svc', {
      acquirePort: () => fakePort,
    });

    const run = handleRequest(mockProtocol as AbstractChannelProtocol);
    run({
      event: null,
      data: [
        [RequestType.PromiseRequest, 'seq-port', '/svc', 'acquirePort'],
        [[]],
      ],
    } as any);

    // Wait for the async invokeHandler chain (await Promise.resolve(result))
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    expect(sendReply).toHaveBeenCalledTimes(1);
    const [data, transfer] = sendReply.mock.calls[0];
    expect(data[0][0]).toBe(ResponseType.PortSuccess);
    expect(data[0][1]).toBe('seq-port');
    expect(data[1]).toEqual([]);
    expect(transfer).toEqual([fakePort]);
  });

  test('handler returning a regular value still sends ReturnSuccess (no transfer)', async () => {
    serviceHost.registerServiceHandler('/svc', {
      compute: () => 42,
    });

    const run = handleRequest(mockProtocol as AbstractChannelProtocol);
    run({
      event: null,
      data: [[RequestType.PromiseRequest, 'seq-num', '/svc', 'compute'], [[]]],
    } as any);

    await Promise.resolve();
    await Promise.resolve();

    expect(sendReply).toHaveBeenCalledTimes(1);
    const [data, transfer] = sendReply.mock.calls[0];
    expect(data[0][0]).toBe(ResponseType.ReturnSuccess);
    expect(data[1]).toEqual([42]);
    expect(transfer).toBeUndefined();
  });
});
