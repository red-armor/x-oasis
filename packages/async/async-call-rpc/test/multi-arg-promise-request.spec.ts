import { expect, test, describe, vi, beforeEach } from 'vitest';
import { handleRequest } from '../src/middlewares/handleRequest';
import { prepareNormalData } from '../src/middlewares/prepareRequestData';
import { RequestType, ResponseType } from '../src/types';
import AbstractChannelProtocol from '../src/protocol/AbstractChannelProtocol';
import RPCServiceHost from '../src/endpoint/RPCServiceHost';

/**
 * Regression: multi-arg PromiseRequest handlers must receive every positional
 * argument the caller passed.
 *
 * Bug history (telegraph 2026-05-08): the receive-side `handleRequest`
 * middleware extracted args as `body[0]` while the send-side
 * `prepareNormalData` middleware encoded them as `body = params` (the whole
 * positional list). Result: every multi-arg call silently dropped all
 * positional arguments past the first.
 *
 * Concrete repro that finally surfaced the bug — orchestrator inspector
 * called `requestConnect(fromId, toId)`; the receiver only saw `fromId`,
 * `toId` was `undefined`, and `BaseConnectionOrchestrator.connect`
 * (rightly) threw `Unknown participant: "undefined"`.
 *
 * The contract these tests lock down:
 *
 *   prepareNormalData({ args: ['a','b'] })
 *     → wire body = ['a','b']
 *   handleRequest(wire body = ['a','b'])
 *     → handler('a','b')   // spread; ctx appended only when defined
 */
describe('multi-arg PromiseRequest end-to-end', () => {
  test('prepareNormalData encodes the full positional arg list as body', () => {
    // Minimal channel stub — prepareNormalData only reads `seqId`.
    const fakeChannel = {
      seqId: 'seq-1',
    } as unknown as AbstractChannelProtocol;
    const prepare = prepareNormalData(fakeChannel);

    const out = prepare({
      requestPath: '/inspector',
      methodName: 'requestConnect',
      args: ['renderer:main', 'pagelet:design'],
    });

    expect(out.data).toBeDefined();
    const [, body] = out.data as [unknown, unknown];
    // The whole positional list lands in body — *not* nested as body[0].
    expect(body).toEqual(['renderer:main', 'pagelet:design']);
  });

  describe('handleRequest', () => {
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

    test('PromiseRequest: spreads body into the handler positional args', async () => {
      const handler = vi.fn().mockResolvedValue({ ok: true });
      serviceHost.registerServiceHandler('/inspector', {
        requestConnect: handler,
      });

      const run = handleRequest(mockProtocol as AbstractChannelProtocol);

      run({
        event: null,
        data: [
          [RequestType.PromiseRequest, 'seq-1', '/inspector', 'requestConnect'],
          ['renderer:main', 'pagelet:design'],
        ],
      } as any);

      // Wait for the async handler chain to flush — invokeHandler awaits
      // resolveContext + the handler promise, so we need a few microtask
      // ticks before sendReply has fired.
      for (let i = 0; i < 6; i++) await Promise.resolve();

      // Bug repro guard: must be ('renderer:main', 'pagelet:design') —
      // *not* ('renderer:main') with a swallowed second arg, and *not*
      // (['renderer:main', 'pagelet:design']) as a single array param.
      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith('renderer:main', 'pagelet:design');

      expect(sendReply).toHaveBeenCalledTimes(1);
      const [data] = sendReply.mock.calls[0];
      expect(data[0][0]).toBe(ResponseType.ReturnSuccess);
      expect(data[1]).toEqual([{ ok: true }]);
    });

    test('PromiseRequest: zero-arg handler still works (body = [])', async () => {
      // Anchors the original baseline: getTopology() takes no args, body
      // is empty, spread of [] is a no-op — handler must be called with
      // no positional args.
      const handler = vi.fn().mockResolvedValue({ participants: [] });
      serviceHost.registerServiceHandler('/inspector', {
        getTopology: handler,
      });

      const run = handleRequest(mockProtocol as AbstractChannelProtocol);

      run({
        event: null,
        data: [
          [RequestType.PromiseRequest, 'seq-2', '/inspector', 'getTopology'],
          [],
        ],
      } as any);

      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();

      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith();
    });

    test('PromiseRequest: 3-arg handler covers spread beyond 2 args', async () => {
      const handler = vi.fn().mockResolvedValue('done');
      serviceHost.registerServiceHandler('/svc', { triple: handler });

      const run = handleRequest(mockProtocol as AbstractChannelProtocol);

      run({
        event: null,
        data: [
          [RequestType.PromiseRequest, 'seq-3', '/svc', 'triple'],
          [1, 'two', { three: true }],
        ],
      } as any);

      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();

      expect(handler).toHaveBeenCalledWith(1, 'two', { three: true });
    });
  });
});
