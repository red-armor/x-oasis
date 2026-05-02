import { expect, describe, test, vi, beforeEach } from 'vitest';

import IPCMainChannel from '../src/IPCMainChannel';

/**
 * IPCMainChannel.on() uses `require('electron').ipcMain` at runtime (CJS).
 * vitest's `vi.mock` only intercepts ESM imports, so we inject our mock
 * directly into Node's CJS module cache before importing the source.
 */
const mockIpcMain = {
  on: vi.fn(),
  removeListener: vi.fn(),
};

// Pre-populate Node's require cache so `require('electron')` returns our mock.
// We must use `require.resolve` carefully — electron isn't actually installed,
// so we manually register a fake entry.
const electronModuleId = 'electron';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const Module = require('module');
const originalResolveFilename = Module._resolveFilename;
Module._resolveFilename = function (request: string, ...args: any[]) {
  if (request === 'electron') {
    return electronModuleId;
  }
  return originalResolveFilename.call(this, request, ...args);
};
require.cache[electronModuleId] = {
  id: electronModuleId,
  filename: electronModuleId,
  loaded: true,
  exports: { ipcMain: mockIpcMain },
} as any;

/**
 * Test suite for IPCMainChannel
 * Covers: construction, on/send, WebContents filtering, auto-disconnect
 */
describe('IPCMainChannel', () => {
  let mockWebContents: {
    on: ReturnType<typeof vi.fn>;
    send: ReturnType<typeof vi.fn>;
    isDestroyed: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockWebContents = {
      on: vi.fn(),
      send: vi.fn(),
      isDestroyed: vi.fn().mockReturnValue(false),
    };
  });

  describe('constructor', () => {
    test('should create channel with channelName and webContents', () => {
      const channel = new IPCMainChannel({
        channelName: 'test-rpc',
        webContents: mockWebContents as any,
      });

      expect(channel).toBeInstanceOf(IPCMainChannel);
      expect(channel.channelName).toBe('test-rpc');
    });

    test('should register destroyed listener on webContents', () => {
      new IPCMainChannel({
        channelName: 'test-rpc',
        webContents: mockWebContents as any,
      });

      expect(mockWebContents.on).toHaveBeenCalledWith(
        'destroyed',
        expect.any(Function)
      );
    });
  });

  describe('channelName', () => {
    test('should return the configured channel name', () => {
      const channel = new IPCMainChannel({
        channelName: 'my-channel',
        webContents: mockWebContents as any,
      });

      expect(channel.channelName).toBe('my-channel');
    });
  });

  describe('on', () => {
    test('should register listener on ipcMain with channel name', () => {
      const channel = new IPCMainChannel({
        channelName: 'test-rpc',
        webContents: mockWebContents as any,
      });

      const listener = vi.fn();
      channel.on(listener);

      expect(mockIpcMain.on).toHaveBeenCalledWith(
        'test-rpc',
        expect.any(Function)
      );
    });

    test('should return cleanup function', () => {
      const channel = new IPCMainChannel({
        channelName: 'test-rpc',
        webContents: mockWebContents as any,
      });

      const cleanup = channel.on(vi.fn());
      expect(typeof cleanup).toBe('function');
    });

    test('should remove listener on cleanup', () => {
      const channel = new IPCMainChannel({
        channelName: 'test-rpc',
        webContents: mockWebContents as any,
      });

      const cleanup = channel.on(vi.fn());
      (cleanup as () => void)();

      expect(mockIpcMain.removeListener).toHaveBeenCalledWith(
        'test-rpc',
        expect.any(Function)
      );
    });

    test('should filter messages from other WebContents', () => {
      const channel = new IPCMainChannel({
        channelName: 'test-rpc',
        webContents: mockWebContents as any,
      });

      const listener = vi.fn();
      channel.on(listener);

      // Get the registered handler
      const handler = mockIpcMain.on.mock.calls[0][1];

      // Simulate message from a different sender
      const otherSender = { id: 999 };
      handler({ sender: otherSender }, 'data');

      // Should NOT forward the message
      expect(listener).not.toHaveBeenCalled();
    });

    test('should forward messages from bound WebContents', () => {
      const channel = new IPCMainChannel({
        channelName: 'test-rpc',
        webContents: mockWebContents as any,
      });

      const listener = vi.fn();
      channel.on(listener);

      const handler = mockIpcMain.on.mock.calls[0][1];

      // Simulate message from the bound sender
      handler({ sender: mockWebContents }, 'data');

      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({ data: 'data', sender: mockWebContents })
      );
    });

    test('should unwrap single-element args array', () => {
      const channel = new IPCMainChannel({
        channelName: 'test-rpc',
        webContents: mockWebContents as any,
      });

      const listener = vi.fn();
      channel.on(listener);

      const handler = mockIpcMain.on.mock.calls[0][1];

      // Single arg → data = args[0]
      handler({ sender: mockWebContents }, { method: 'test' });

      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({ data: { method: 'test' } })
      );
    });
  });

  describe('send', () => {
    test('should send data through webContents', () => {
      const channel = new IPCMainChannel({
        channelName: 'test-rpc',
        webContents: mockWebContents as any,
      });

      channel.send({ result: 42 });

      expect(mockWebContents.send).toHaveBeenCalledWith('test-rpc', {
        result: 42,
      });
    });

    test('should warn if webContents is destroyed', () => {
      mockWebContents.isDestroyed.mockReturnValue(true);
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const channel = new IPCMainChannel({
        channelName: 'test-rpc',
        webContents: mockWebContents as any,
      });

      channel.send('data');

      expect(mockWebContents.send).not.toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('destroyed')
      );

      consoleSpy.mockRestore();
    });
  });

  describe('auto-disconnect on destroyed', () => {
    test('should auto-disconnect when webContents is destroyed', () => {
      new IPCMainChannel({
        channelName: 'test-rpc',
        webContents: mockWebContents as any,
      });

      const destroyedHandler = mockWebContents.on.mock.calls.find(
        (c: any[]) => c[0] === 'destroyed'
      );
      expect(destroyedHandler).toBeDefined();

      // Triggering should not throw
      expect(() => destroyedHandler![1]()).not.toThrow();
    });
  });
});
