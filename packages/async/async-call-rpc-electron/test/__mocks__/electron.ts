/**
 * Minimal Electron mock for unit tests.
 *
 * Provides just enough of the Electron API surface so that
 * ElectronConnectionOrchestrator can be tested without a real Electron runtime.
 */
import { vi } from 'vitest';

// ─── MockMessagePortMain ──────────────────────────────────────────────────────

function makeMockMessagePortMain() {
  const listeners: Map<string, Set<Function>> = new Map();

  const port: any = {
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

    /** Test helper: emit an event to all listeners. */
    emit(event: string, ...args: any[]) {
      listeners.get(event)?.forEach((fn) => fn(...args));
    },
  };

  return port;
}

// ─── MockMessageChannelMain ───────────────────────────────────────────────────

class MockMessageChannelMain {
  port1 = makeMockMessagePortMain();
  port2 = makeMockMessagePortMain();
}

// ─── Exports ─────────────────────────────────────────────────────────────────

export const MessageChannelMain = MockMessageChannelMain;

// Re-export other things that Electron tests might need (add as required)
export const ipcMain = {
  on: vi.fn(),
  off: vi.fn(),
  handle: vi.fn(),
  removeHandler: vi.fn(),
};

export const ipcRenderer = {
  on: vi.fn(),
  off: vi.fn(),
  send: vi.fn(),
  invoke: vi.fn(),
};

export const contextBridge = {
  exposeInMainWorld: vi.fn((key: string, api: Record<string, any>) => {
    (globalThis as any)[key] = api;
  }),
};
