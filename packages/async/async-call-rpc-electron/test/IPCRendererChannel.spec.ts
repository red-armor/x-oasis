import { expect, describe, test, vi, beforeEach } from 'vitest';
import IPCRendererChannel from '../src/IPCRendererChannel';

/**
 * Test suite for IPCRendererChannel
 * Covers: construction, on/send, disconnect, projectName
 */
describe('IPCRendererChannel', () => {
  let mockIpcRenderer: {
    on: ReturnType<typeof vi.fn>;
    removeListener: ReturnType<typeof vi.fn>;
    removeAllListeners: ReturnType<typeof vi.fn>;
    send: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    mockIpcRenderer = {
      on: vi.fn(),
      removeListener: vi.fn(),
      removeAllListeners: vi.fn(),
      send: vi.fn(),
    };
  });

  describe('constructor', () => {
    test('should create channel with required props', () => {
      const channel = new IPCRendererChannel({
        channelName: 'test-rpc',
        ipcRenderer: mockIpcRenderer as any,
        projectName: 'my-app',
      });

      expect(channel).toBeInstanceOf(IPCRendererChannel);
      expect(channel.channelName).toBe('test-rpc');
      expect(channel.projectName).toBe('my-app');
    });
  });

  describe('on', () => {
    test('should register listener on ipcRenderer', () => {
      const channel = new IPCRendererChannel({
        channelName: 'test-rpc',
        ipcRenderer: mockIpcRenderer as any,
        projectName: 'my-app',
      });

      const listener = vi.fn();
      channel.on(listener);

      expect(mockIpcRenderer.on).toHaveBeenCalledWith(
        'test-rpc',
        expect.any(Function)
      );
    });

    test('should return cleanup function', () => {
      const channel = new IPCRendererChannel({
        channelName: 'test-rpc',
        ipcRenderer: mockIpcRenderer as any,
        projectName: 'my-app',
      });

      const cleanup = channel.on(vi.fn());
      expect(typeof cleanup).toBe('function');
    });

    test('should remove listener on cleanup', () => {
      const channel = new IPCRendererChannel({
        channelName: 'test-rpc',
        ipcRenderer: mockIpcRenderer as any,
        projectName: 'my-app',
      });

      const cleanup = channel.on(vi.fn());
      (cleanup as () => void)();

      expect(mockIpcRenderer.removeListener).toHaveBeenCalledWith(
        'test-rpc',
        expect.any(Function)
      );
    });

    test('should wrap data in { data } shape', () => {
      const channel = new IPCRendererChannel({
        channelName: 'test-rpc',
        ipcRenderer: mockIpcRenderer as any,
        projectName: 'my-app',
      });

      const listener = vi.fn();
      channel.on(listener);

      const handler = mockIpcRenderer.on.mock.calls[0][1];

      // Simulate ipcRenderer callback: (event, ...args)
      handler({}, { method: 'test' });

      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({ data: { method: 'test' } })
      );
    });

    test('should handle multiple args', () => {
      const channel = new IPCRendererChannel({
        channelName: 'test-rpc',
        ipcRenderer: mockIpcRenderer as any,
        projectName: 'my-app',
      });

      const listener = vi.fn();
      channel.on(listener);

      const handler = mockIpcRenderer.on.mock.calls[0][1];
      handler({}, 'arg1', 'arg2');

      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({ data: ['arg1', 'arg2'] })
      );
    });
  });

  describe('send', () => {
    test('should send data through ipcRenderer', () => {
      const channel = new IPCRendererChannel({
        channelName: 'test-rpc',
        ipcRenderer: mockIpcRenderer as any,
        projectName: 'my-app',
      });

      channel.send({ method: 'test', params: [] });

      expect(mockIpcRenderer.send).toHaveBeenCalledWith('test-rpc', {
        method: 'test',
        params: [],
      });
    });
  });

  describe('disconnect', () => {
    test('should remove all listeners for the channel name', () => {
      const channel = new IPCRendererChannel({
        channelName: 'test-rpc',
        ipcRenderer: mockIpcRenderer as any,
        projectName: 'my-app',
      });

      channel.disconnect();

      expect(mockIpcRenderer.removeAllListeners).toHaveBeenCalledWith(
        'test-rpc'
      );
    });
  });

  describe('properties', () => {
    test('channelName should return configured name', () => {
      const channel = new IPCRendererChannel({
        channelName: 'my-channel',
        ipcRenderer: mockIpcRenderer as any,
        projectName: 'app',
      });

      expect(channel.channelName).toBe('my-channel');
    });

    test('projectName should return configured name', () => {
      const channel = new IPCRendererChannel({
        channelName: 'my-channel',
        ipcRenderer: mockIpcRenderer as any,
        projectName: 'my-project',
      });

      expect(channel.projectName).toBe('my-project');
    });
  });
});
