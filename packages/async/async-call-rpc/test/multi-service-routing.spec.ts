import { expect, test, describe, vi, beforeEach } from 'vitest';
import { handleRequest } from '../src/middlewares/handleRequest';
import { RequestType, ResponseType } from '../src/types';
import AbstractChannelProtocol from '../src/protocol/AbstractChannelProtocol';
import RPCServiceHost from '../src/endpoint/RPCServiceHost';

/**
 * Multi-service-per-channel routing.
 *
 * The channel is bound to an `RPCServiceHost` (rather than a single
 * `RPCService`). `handleRequest` then routes by `requestPath` and silently
 * ignores requests for paths the host doesn't know — which is what makes
 * one transport safe to share across multiple `RPCServiceHost` instances.
 */
describe('handleRequest with serviceHost routing', () => {
  let mockProtocol: Partial<AbstractChannelProtocol>;
  let serviceHost: RPCServiceHost;

  beforeEach(() => {
    serviceHost = new RPCServiceHost();
    mockProtocol = {
      isConnected: () => true,
      sendReply: vi.fn(),
      serviceHost,
      service: undefined as any,
      subscriptions: new Map(),
      requestEvents: new Map(),
      activeEventMethods: new Set(),
      writeBuffer: { encode: (data: any) => data },
    };
  });

  test('routes by requestPath to the right registered service', async () => {
    const aHello = vi.fn().mockReturnValue('a-hello');
    const bHello = vi.fn().mockReturnValue('b-hello');
    serviceHost.registerServiceHandler('/a', { hello: aHello });
    serviceHost.registerServiceHandler('/b', { hello: bHello });

    const run = handleRequest(mockProtocol as AbstractChannelProtocol);

    run({
      event: null,
      data: [[RequestType.PromiseRequest, 'seq-1', '/a', 'hello'], [[]]],
    } as any);
    run({
      event: null,
      data: [[RequestType.PromiseRequest, 'seq-2', '/b', 'hello'], [[]]],
    } as any);

    // give the async invokeHandler chain a tick
    await Promise.resolve();
    await Promise.resolve();

    expect(aHello).toHaveBeenCalledTimes(1);
    expect(bHello).toHaveBeenCalledTimes(1);
  });

  test('silently ignores requests for unknown requestPath (no Method-not-found reply)', () => {
    serviceHost.registerServiceHandler('/known', { hello: () => 'ok' });
    const run = handleRequest(mockProtocol as AbstractChannelProtocol);

    run({
      event: null,
      data: [[RequestType.PromiseRequest, 'seq-99', '/unknown', 'hello'], [[]]],
    } as any);

    // No reply should ever be sent for an unrouted path. This is what stops
    // multiple channels-on-one-transport from cross-talking.
    expect(mockProtocol.sendReply).not.toHaveBeenCalled();
  });

  test('class instance: prototype methods resolve through getHandler', async () => {
    class Greeter {
      greeting = 'hi'; // own property — not a function
      hello() {
        return `${this.greeting} world`;
      }
    }
    const instance = new Greeter();
    serviceHost.registerServiceHandler('/greeter', instance);

    expect(typeof serviceHost.getHandler('/greeter', 'hello')).toBe('function');
    expect(serviceHost.getHandler('/greeter', 'hello')!()).toBe('hi world');
    expect(serviceHost.getHandler('/greeter', 'nope')).toBeUndefined();

    const run = handleRequest(mockProtocol as AbstractChannelProtocol);
    run({
      event: null,
      data: [[RequestType.PromiseRequest, 'seq-3', '/greeter', 'hello'], [[]]],
    } as any);

    await Promise.resolve();
    await Promise.resolve();

    expect((mockProtocol.sendReply as any).mock.calls[0][0][0][0]).toBe(
      ResponseType.ReturnSuccess
    );
  });

  test('handler-map shape (every value is a function): handlers map wins', () => {
    const handlers = { foo: () => 1, bar: () => 2 };
    serviceHost.registerServiceHandler('/m', handlers);
    expect(serviceHost.getHandler('/m', 'foo')!()).toBe(1);
    expect(serviceHost.getHandler('/m', 'bar')!()).toBe(2);
  });
});
