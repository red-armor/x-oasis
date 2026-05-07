import { describe, it, expect, vi } from 'vitest';
import { NodeMessagePortChannel } from '../src/NodeMessagePortChannel';

// ─── Mock MessagePort ─────────────────────────────────────────────────────────

function makeMockPort() {
  const listeners: Map<string, Set<Function>> = new Map();

  const port = {
    _listeners: listeners,

    on(event: string, fn: Function) {
      if (!listeners.has(event)) listeners.set(event, new Set());
      listeners.get(event)!.add(fn);
      return port;
    },
    off(event: string, fn: Function) {
      listeners.get(event)?.delete(fn);
      return port;
    },
    removeListener(event: string, fn: Function) {
      listeners.get(event)?.delete(fn);
      return port;
    },
    once(event: string, fn: Function) {
      const wrapper = (...args: any[]) => {
        fn(...args);
        port.off(event, wrapper);
      };
      port.on(event, wrapper);
      return port;
    },
    postMessage: vi.fn(),
    start: vi.fn(),
    close: vi.fn(),

    emit(event: string, ...args: any[]) {
      listeners.get(event)?.forEach((fn) => fn(...args));
    },
  };

  return port;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('NodeMessagePortChannel', () => {
  describe('construction with port', () => {
    it('should call start() on the port', () => {
      const port = makeMockPort();
      new NodeMessagePortChannel({ port: port as any });
      expect(port.start).toHaveBeenCalledOnce();
    });

    it('should forward messages to listener wrapped as {data}', () => {
      const port = makeMockPort();
      const channel = new NodeMessagePortChannel({ port: port as any });
      const received: unknown[] = [];
      channel.on((msg) => received.push(msg));
      port.emit('message', { hello: 'world' });
      expect(received).toEqual([{ data: { hello: 'world' } }]);
    });

    it('should send data via postMessage', () => {
      const port = makeMockPort();
      const channel = new NodeMessagePortChannel({ port: port as any });
      channel.send({ rpc: 'call' });
      expect(port.postMessage).toHaveBeenCalledWith({ rpc: 'call' });
    });

    it('should send with transfer list when provided', () => {
      const port = makeMockPort();
      const transfer = [makeMockPort() as any];
      const channel = new NodeMessagePortChannel({ port: port as any });
      channel.send({ rpc: 'call' }, transfer);
      expect(port.postMessage).toHaveBeenCalledWith({ rpc: 'call' }, transfer);
    });

    it('should close the port on disconnect()', () => {
      const port = makeMockPort();
      const channel = new NodeMessagePortChannel({ port: port as any });
      channel.disconnect();
      expect(port.close).toHaveBeenCalledOnce();
    });

    it('should auto-disconnect when port emits close', () => {
      const port = makeMockPort();
      const channel = new NodeMessagePortChannel({ port: port as any });
      const disconnected = vi.fn();
      channel.onDidDisconnected(disconnected);
      port.emit('close');
      expect(disconnected).toHaveBeenCalled();
    });
  });

  describe('construction without port (deferred binding)', () => {
    it('should warn when sending before port is bound', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const channel = new NodeMessagePortChannel();
      channel.send({ data: 1 });
      expect(warn).toHaveBeenCalledWith(
        expect.stringContaining('send called before port was bound')
      );
      warn.mockRestore();
    });

    it('should queue listener and wire it when bindPort is called', () => {
      const channel = new NodeMessagePortChannel();
      const received: unknown[] = [];
      channel.on((msg) => received.push(msg));

      const port = makeMockPort();
      channel.bindPort(port as any);

      port.emit('message', 'hello');
      expect(received).toEqual([{ data: 'hello' }]);
    });

    it('should be a no-op if bindPort called twice', () => {
      const channel = new NodeMessagePortChannel();
      const port1 = makeMockPort();
      const port2 = makeMockPort();

      channel.bindPort(port1 as any);
      channel.bindPort(port2 as any); // should be ignored

      expect(port2.start).not.toHaveBeenCalled();
    });

    it('should remove listener when deferred unsubscribe is called before bindPort', () => {
      const channel = new NodeMessagePortChannel();
      const received: unknown[] = [];
      const dispose = channel.on((msg) => received.push(msg));

      // Unsubscribe before port arrives
      if (typeof dispose === 'function') dispose();

      const port = makeMockPort();
      channel.bindPort(port as any);
      port.emit('message', 'should not arrive');

      expect(received).toHaveLength(0);
    });
  });
});
