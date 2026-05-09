import { expect, describe, test, vi, beforeEach } from 'vitest';
import ElectronMessagePortMainChannel from '../src/electron-main/ElectronMessagePortMainChannel';

describe('ElectronMessagePortMainChannel', () => {
  let mockPort: {
    on: ReturnType<typeof vi.fn>;
    removeListener: ReturnType<typeof vi.fn>;
    postMessage: ReturnType<typeof vi.fn>;
    start: ReturnType<typeof vi.fn>;
    close: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    mockPort = {
      on: vi.fn(),
      removeListener: vi.fn(),
      postMessage: vi.fn(),
      start: vi.fn(),
      close: vi.fn(),
    };
  });

  describe('constructor', () => {
    test('should create channel with port', () => {
      const channel = new ElectronMessagePortMainChannel({
        port: mockPort as any,
      });
      expect(channel).toBeInstanceOf(ElectronMessagePortMainChannel);
    });

    test('should call port.start() on construction', () => {
      new ElectronMessagePortMainChannel({ port: mockPort as any });
      expect(mockPort.start).toHaveBeenCalled();
    });

    test('should register close listener for auto-disconnect', () => {
      new ElectronMessagePortMainChannel({ port: mockPort as any });
      expect(mockPort.on).toHaveBeenCalledWith('close', expect.any(Function));
    });
  });

  describe('on', () => {
    test('should register message listener on port', () => {
      const channel = new ElectronMessagePortMainChannel({
        port: mockPort as any,
      });
      channel.on(vi.fn());
      expect(mockPort.on).toHaveBeenCalledWith('message', expect.any(Function));
    });

    test('should return cleanup function', () => {
      const channel = new ElectronMessagePortMainChannel({
        port: mockPort as any,
      });
      const cleanup = channel.on(vi.fn());
      expect(typeof cleanup).toBe('function');
    });
  });

  describe('send', () => {
    test('should post message to port', () => {
      const channel = new ElectronMessagePortMainChannel({
        port: mockPort as any,
      });
      channel.send({ type: 'request' });
      expect(mockPort.postMessage).toHaveBeenCalledWith({ type: 'request' });
    });

    test('should pass transfer list when provided', () => {
      const channel = new ElectronMessagePortMainChannel({
        port: mockPort as any,
      });
      const transferPort = { ...mockPort };
      channel.send('data', [transferPort as any]);
      expect(mockPort.postMessage).toHaveBeenCalledWith('data', [transferPort]);
    });
  });

  describe('disconnect', () => {
    test('should close the port', () => {
      const channel = new ElectronMessagePortMainChannel({
        port: mockPort as any,
      });
      channel.disconnect();
      expect(mockPort.close).toHaveBeenCalled();
    });
  });

  describe('late port binding (bindPort)', () => {
    test('constructed without a port: starts disconnected, activates on bindPort', () => {
      const channel = new ElectronMessagePortMainChannel();
      expect(channel.isConnected()).toBe(false);

      channel.bindPort(mockPort as any);
      expect(mockPort.start).toHaveBeenCalled();
      expect(channel.isConnected()).toBe(true);
    });

    test('bindPort flushes any queued send entries', () => {
      const channel = new ElectronMessagePortMainChannel();
      const fakeEntry = { middlewareContext: {} } as any;
      channel.addPendingSendEntry(fakeEntry);
      expect(channel.pendingSendEntries.size).toBe(1);

      channel.bindPort(mockPort as any);
      expect(channel.pendingSendEntries.size).toBe(0);
    });

    test('bindPort is a no-op when a port is already bound (default)', () => {
      const channel = new ElectronMessagePortMainChannel({
        port: mockPort as any,
      });
      const otherPort = { ...mockPort, start: vi.fn(), on: vi.fn() };
      channel.bindPort(otherPort as any);
      expect(otherPort.start).not.toHaveBeenCalled();
    });

    // ─── Gap 7: bindPort rebind ───────────────────────────────────────────

    describe('rebind option', () => {
      test('bindPort with rebind:true should replace the existing port', () => {
        const channel = new ElectronMessagePortMainChannel({
          port: mockPort as any,
        });

        const newPort = {
          on: vi.fn(),
          removeListener: vi.fn(),
          postMessage: vi.fn(),
          start: vi.fn(),
          close: vi.fn(),
        };

        channel.bindPort(newPort as any, { rebind: true });

        // Old port should be closed
        expect(mockPort.close).toHaveBeenCalled();
        // New port should be started
        expect(newPort.start).toHaveBeenCalled();
        // Channel should be connected
        expect(channel.isConnected()).toBe(true);
      });

      test('bindPort with rebind:true should close old port and activate new one', () => {
        const channel = new ElectronMessagePortMainChannel({
          port: mockPort as any,
        });

        // Send on old port should work
        channel.send('old-msg');
        expect(mockPort.postMessage).toHaveBeenCalledWith('old-msg');

        const newPort = {
          on: vi.fn(),
          removeListener: vi.fn(),
          postMessage: vi.fn(),
          start: vi.fn(),
          close: vi.fn(),
        };

        channel.bindPort(newPort as any, { rebind: true });

        // Send should now go to the new port
        channel.send('new-msg');
        expect(newPort.postMessage).toHaveBeenCalledWith('new-msg');
      });

      test('bindPort with rebind:false (default) should NOT replace existing port', () => {
        const channel = new ElectronMessagePortMainChannel({
          port: mockPort as any,
        });

        const newPort = {
          on: vi.fn(),
          removeListener: vi.fn(),
          postMessage: vi.fn(),
          start: vi.fn(),
          close: vi.fn(),
        };

        channel.bindPort(newPort as any, { rebind: false });

        // New port should NOT be started
        expect(newPort.start).not.toHaveBeenCalled();
        // Old port should NOT be closed
        expect(mockPort.close).not.toHaveBeenCalled();
      });
    });
  });
});
