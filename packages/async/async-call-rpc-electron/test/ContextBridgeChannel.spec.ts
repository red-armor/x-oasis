import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import ContextBridgeChannel from '../src/electron-browser/ContextBridgeChannel';
import { createPageChannel } from '../src/electron-browser/createPageChannel';

const BRIDGE_KEY = '__rpc_bridge__';

function makeMockBridge() {
  const sent: unknown[] = [];
  const messageHandlers = new Set<(data: unknown) => void>();

  const bridge = {
    _send: vi.fn((data: unknown) => {
      sent.push(data);
    }),
    _onMessage: vi.fn((cb: (data: unknown) => void) => {
      messageHandlers.add(cb);
    }),
    _offMessage: vi.fn(() => {
      messageHandlers.clear();
    }),
    _simulateIncoming: (data: unknown) => {
      messageHandlers.forEach((cb) => cb(data));
    },
    sent,
  };

  return bridge;
}

describe('ContextBridgeChannel', () => {
  let bridge: ReturnType<typeof makeMockBridge>;

  beforeEach(() => {
    bridge = makeMockBridge();
    (globalThis as any)[BRIDGE_KEY] = bridge;
  });

  afterEach(() => {
    delete (globalThis as any)[BRIDGE_KEY];
  });

  it('should start disconnected', () => {
    const channel = new ContextBridgeChannel();
    expect(channel.isConnected()).toBe(false);
  });

  it('should connect after activate()', () => {
    const channel = new ContextBridgeChannel();
    channel.activate();
    expect(channel.isConnected()).toBe(true);
  });

  it('should call bridge._onMessage on activate', () => {
    const channel = new ContextBridgeChannel();
    channel.activate();
    expect(bridge._onMessage).toHaveBeenCalled();
  });

  it('should deliver incoming messages to listeners', () => {
    const channel = new ContextBridgeChannel();
    channel.activate();

    const listener = vi.fn();
    channel.on(listener);

    const testData = { type: 'test', payload: 42 };
    bridge._simulateIncoming(testData);

    expect(listener).toHaveBeenCalledWith(testData);
  });

  it('should deliver to multiple listeners', () => {
    const channel = new ContextBridgeChannel();
    channel.activate();

    const listener1 = vi.fn();
    const listener2 = vi.fn();
    channel.on(listener1);
    channel.on(listener2);

    bridge._simulateIncoming({ msg: 'hello' });

    expect(listener1).toHaveBeenCalledWith({ msg: 'hello' });
    expect(listener2).toHaveBeenCalledWith({ msg: 'hello' });
  });

  it('should unsubscribe via cleanup function', () => {
    const channel = new ContextBridgeChannel();
    channel.activate();

    const listener = vi.fn();
    const unsub = channel.on(listener);

    unsub();
    bridge._simulateIncoming({ msg: 'hello' });

    expect(listener).not.toHaveBeenCalled();
  });

  it('should send data through bridge._send', () => {
    const channel = new ContextBridgeChannel();
    channel.activate();

    channel.send({ type: 'request', payload: 'test' });

    expect(bridge._send).toHaveBeenCalledWith({
      type: 'request',
      payload: 'test',
    });
  });

  it('should warn and no-op on send before activate', () => {
    const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const channel = new ContextBridgeChannel();

    channel.send({ type: 'request' });

    expect(bridge._send).not.toHaveBeenCalled();
    expect(consoleWarn).toHaveBeenCalledWith(
      expect.stringContaining('send called before bridge')
    );

    consoleWarn.mockRestore();
  });

  it('should warn on activate when bridge is not available', () => {
    delete (globalThis as any)[BRIDGE_KEY];
    const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const channel = new ContextBridgeChannel();
    channel.activate();

    expect(consoleWarn).toHaveBeenCalledWith(
      expect.stringContaining('__rpc_bridge__ not found')
    );

    consoleWarn.mockRestore();
  });

  it('should call bridge._offMessage on disconnect', () => {
    const channel = new ContextBridgeChannel();
    channel.activate();
    channel.disconnect();

    expect(bridge._offMessage).toHaveBeenCalled();
    expect(channel.isConnected()).toBe(false);
  });

  it('should clear listeners on disconnect', () => {
    const channel = new ContextBridgeChannel();
    channel.activate();

    const listener = vi.fn();
    channel.on(listener);

    channel.disconnect();
    bridge._simulateIncoming({ msg: 'after-disconnect' });

    expect(listener).not.toHaveBeenCalled();
  });

  it('should fire onDidConnected on activate', () => {
    const channel = new ContextBridgeChannel();
    const onConnected = vi.fn();
    channel.onDidConnected(onConnected);

    channel.activate();

    expect(onConnected).toHaveBeenCalled();
  });

  it('should fire onDidDisconnected on disconnect', () => {
    const channel = new ContextBridgeChannel();
    channel.activate();

    const onDisconnected = vi.fn();
    channel.onDidDisconnected(onDisconnected);

    channel.disconnect();

    expect(onDisconnected).toHaveBeenCalled();
  });
});

describe('createPageChannel', () => {
  let bridge: ReturnType<typeof makeMockBridge>;

  beforeEach(() => {
    bridge = makeMockBridge();
    (globalThis as any)[BRIDGE_KEY] = bridge;
  });

  afterEach(() => {
    delete (globalThis as any)[BRIDGE_KEY];
  });

  it('should return an activated channel', () => {
    const channel = createPageChannel();
    expect(channel.isConnected()).toBe(true);
  });

  it('should use custom description', () => {
    const channel = createPageChannel('my-page-channel');
    expect(channel.description).toBe('my-page-channel');
  });

  it('should use default description when not provided', () => {
    const channel = createPageChannel();
    expect(channel.description).toBe('page-rpc');
  });

  it('should be able to send and receive', () => {
    const channel = createPageChannel();

    const listener = vi.fn();
    channel.on(listener);

    channel.send({ type: 'test' });
    expect(bridge._send).toHaveBeenCalledWith({ type: 'test' });

    bridge._simulateIncoming({ type: 'response' });
    expect(listener).toHaveBeenCalledWith({ type: 'response' });
  });
});
