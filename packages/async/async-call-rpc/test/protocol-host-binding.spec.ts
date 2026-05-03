import { expect, describe, test, vi, beforeEach } from 'vitest';
import AbstractChannelProtocol from '../src/protocol/AbstractChannelProtocol';
import RPCServiceHost from '../src/endpoint/RPCServiceHost';

/**
 * Coverage for the abstract-channel APIs added for multi-service routing
 * and shared-transport safety:
 *
 * - `setServiceHost(host)`        — bind a routing host (idempotent)
 * - `ensureListenerAttached()`    — wire `onMessage` to the transport once
 *
 * The "exactly one listener" guarantee is what makes it safe for a single
 * channel to be referenced by both an `RPCServiceHost` and one or more
 * `ProxyRPCClient` instances — without it, every incoming message would be
 * processed N times.
 */

class StubChannel extends AbstractChannelProtocol {
  public sentMessages: any[] = [];
  // Tracks every listener actually wired into the transport.
  public attachedListeners: Array<(...args: any[]) => any> = [];

  send(data: unknown): void {
    this.sentMessages.push(data);
  }

  on(listener: (data: unknown) => void): () => void {
    this.attachedListeners.push(listener);
    return () => {
      const idx = this.attachedListeners.indexOf(listener);
      if (idx >= 0) this.attachedListeners.splice(idx, 1);
    };
  }
}

describe('AbstractChannelProtocol — host binding & listener attach', () => {
  let channel: StubChannel;

  beforeEach(() => {
    channel = new StubChannel();
  });

  describe('ensureListenerAttached', () => {
    test('attaches exactly one listener no matter how many times it is called', () => {
      channel.ensureListenerAttached();
      channel.ensureListenerAttached();
      channel.ensureListenerAttached();
      expect(channel.attachedListeners).toHaveLength(1);
    });

    test('the attached listener routes to onMessage', () => {
      // Replace onMessage with a no-op spy so we don't trigger the
      // full deserialize/handleRequest pipeline on a synthetic payload.
      const spy = vi.fn();
      (channel as any).onMessage = spy;
      channel.ensureListenerAttached();
      const [listener] = channel.attachedListeners;
      listener({ hello: 'world' });
      expect(spy).toHaveBeenCalledWith({ hello: 'world' });
    });
  });

  describe('setServiceHost', () => {
    test('binds the host and exposes it via the serviceHost getter', () => {
      const host = new RPCServiceHost();
      channel.setServiceHost(host);
      expect(channel.serviceHost).toBe(host);
    });

    test('is a no-op when called twice with the same host', () => {
      const host = new RPCServiceHost();
      channel.setServiceHost(host);
      channel.setServiceHost(host);
      // Single listener attached, single host bound.
      expect(channel.attachedListeners).toHaveLength(1);
      expect(channel.serviceHost).toBe(host);
    });

    test('re-binds when a different host is passed', () => {
      const a = new RPCServiceHost();
      const b = new RPCServiceHost();
      channel.setServiceHost(a);
      channel.setServiceHost(b);
      expect(channel.serviceHost).toBe(b);
      // Listener stays at one — ensureListenerAttached is the gate.
      expect(channel.attachedListeners).toHaveLength(1);
    });

    test('triggers ensureListenerAttached on first bind', () => {
      const host = new RPCServiceHost();
      expect(channel.attachedListeners).toHaveLength(0);
      channel.setServiceHost(host);
      expect(channel.attachedListeners).toHaveLength(1);
    });
  });

  test('serviceHost defaults to null before any bind', () => {
    expect(channel.serviceHost).toBeNull();
  });
});
