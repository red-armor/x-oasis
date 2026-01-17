import { describe, expect, test, vi, beforeEach } from 'vitest';
import {
  Disposable,
  DisposableStore,
  dispose,
  toDisposable,
  isDisposable,
} from '../src';

describe('toDisposable', () => {
  test('should create a disposable from a function', () => {
    const fn = vi.fn();
    const disposable = toDisposable(fn);

    expect(isDisposable(disposable)).toBe(true);
    disposable.dispose();
    expect(fn).toHaveBeenCalledTimes(1);
  });

  test('should call the function when disposed', () => {
    let called = false;
    const disposable = toDisposable(() => {
      called = true;
    });

    expect(called).toBe(false);
    disposable.dispose();
    expect(called).toBe(true);
  });

  test('should handle errors in dispose function', () => {
    const error = new Error('Test error');
    const disposable = toDisposable(() => {
      throw error;
    });

    expect(() => disposable.dispose()).toThrow('Test error');
  });
});

describe('isDisposable', () => {
  test('should return true for objects with dispose method', () => {
    const obj = {
      dispose() {},
    };
    expect(isDisposable(obj)).toBe(true);
  });

  test('should return false for objects without dispose method', () => {
    const obj = {
      cleanup() {},
    };
    expect(isDisposable(obj)).toBe(false);
  });

  test('should return false for null', () => {
    expect(isDisposable(null as any)).toBe(false);
  });

  test('should return false for undefined', () => {
    expect(isDisposable(undefined as any)).toBe(false);
  });

  test('should return false for primitives', () => {
    expect(isDisposable(123 as any)).toBe(false);
    expect(isDisposable('string' as any)).toBe(false);
    expect(isDisposable(true as any)).toBe(false);
  });

  test('should narrow type correctly', () => {
    const obj: unknown = {
      dispose() {},
    };

    if (isDisposable(obj as object)) {
      // TypeScript should know obj is IDisposable here
      const disposable = obj as { dispose: () => void };
      expect(typeof disposable.dispose).toBe('function');
    }
  });
});

describe('Disposable', () => {
  test('should dispose all registered disposables', () => {
    const disposable = new Disposable();
    const cleanup1 = vi.fn();
    const cleanup2 = vi.fn();

    disposable.registerDisposable(toDisposable(cleanup1));
    disposable.registerDisposable(toDisposable(cleanup2));

    expect(cleanup1).not.toHaveBeenCalled();
    expect(cleanup2).not.toHaveBeenCalled();

    disposable.dispose();

    expect(cleanup1).toHaveBeenCalledTimes(1);
    expect(cleanup2).toHaveBeenCalledTimes(1);
  });

  test('should prevent registering itself', () => {
    const disposable = new Disposable();

    expect(() => {
      disposable.registerDisposable(disposable as any);
    }).toThrow('Can not register itself');
  });

  test('Disposable.None should be a no-op', () => {
    expect(Disposable.None).toBeDefined();
    expect(() => Disposable.None.dispose()).not.toThrow();
  });

  test('should handle errors in registered disposables', () => {
    const disposable = new Disposable();
    const error = new Error('Test error');
    const cleanup1 = vi.fn();
    const cleanup2 = vi.fn(() => {
      throw error;
    });

    disposable.registerDisposable(toDisposable(cleanup1));
    disposable.registerDisposable(toDisposable(cleanup2));

    // Should not throw, but cleanup1 should still be called
    expect(() => disposable.dispose()).not.toThrow();
    expect(cleanup1).toHaveBeenCalledTimes(1);
  });
});

describe('DisposableStore', () => {
  let store: DisposableStore;

  beforeEach(() => {
    store = new DisposableStore();
  });

  test('should add disposables', () => {
    const cleanup = vi.fn();
    const disposable = toDisposable(cleanup);

    store.add(disposable);
    expect(store.isDisposed).toBe(false);
  });

  test('should dispose all added disposables', () => {
    const cleanup1 = vi.fn();
    const cleanup2 = vi.fn();
    const cleanup3 = vi.fn();

    store.add(toDisposable(cleanup1));
    store.add(toDisposable(cleanup2));
    store.add(toDisposable(cleanup3));

    expect(cleanup1).not.toHaveBeenCalled();
    expect(cleanup2).not.toHaveBeenCalled();
    expect(cleanup3).not.toHaveBeenCalled();

    store.dispose();

    expect(cleanup1).toHaveBeenCalledTimes(1);
    expect(cleanup2).toHaveBeenCalledTimes(1);
    expect(cleanup3).toHaveBeenCalledTimes(1);
    expect(store.isDisposed).toBe(true);
  });

  test('should not dispose twice', () => {
    const cleanup = vi.fn();
    store.add(toDisposable(cleanup));

    store.dispose();
    expect(cleanup).toHaveBeenCalledTimes(1);

    store.dispose();
    expect(cleanup).toHaveBeenCalledTimes(1); // Should not be called again
  });

  test('should clear all disposables and dispose them', () => {
    const cleanup1 = vi.fn();
    const cleanup2 = vi.fn();

    store.add(toDisposable(cleanup1));
    store.add(toDisposable(cleanup2));

    store.clear();

    // clear() calls dispose() internally, so disposables should be disposed
    expect(cleanup1).toHaveBeenCalledTimes(1);
    expect(cleanup2).toHaveBeenCalledTimes(1);
    expect(store.isDisposed).toBe(false); // clear() doesn't set isDisposed to true
  });

  test('should delete and dispose a specific disposable', () => {
    const cleanup1 = vi.fn();
    const cleanup2 = vi.fn();
    const cleanup3 = vi.fn();

    const d1 = toDisposable(cleanup1);
    const d2 = toDisposable(cleanup2);
    const d3 = toDisposable(cleanup3);

    store.add(d1);
    store.add(d2);
    store.add(d3);

    store.delete(d2);

    expect(cleanup1).not.toHaveBeenCalled();
    expect(cleanup2).toHaveBeenCalledTimes(1); // Should be disposed when deleted
    expect(cleanup3).not.toHaveBeenCalled();

    store.dispose();

    expect(cleanup1).toHaveBeenCalledTimes(1);
    expect(cleanup2).toHaveBeenCalledTimes(1); // Should not be called again
    expect(cleanup3).toHaveBeenCalledTimes(1);
  });

  test('should handle null/undefined in add', () => {
    expect(() => store.add(null as any)).not.toThrow();
    expect(() => store.add(undefined as any)).not.toThrow();
  });

  test('should handle null/undefined in delete', () => {
    expect(() => store.delete(null as any)).not.toThrow();
    expect(() => store.delete(undefined as any)).not.toThrow();
  });

  test('should prevent adding itself', () => {
    expect(() => {
      store.add(store);
    }).toThrow('Cannot register a disposable on itself!');
  });

  test('should prevent deleting itself', () => {
    expect(() => {
      store.delete(store);
    }).toThrow('Cannot dispose a disposable on itself!');
  });

  test('should return the added disposable', () => {
    const disposable = toDisposable(() => {});
    const result = store.add(disposable);
    expect(result).toBe(disposable);
  });
});

describe('dispose', () => {
  test('should dispose a single disposable', () => {
    const cleanup = vi.fn();
    const disposable = toDisposable(cleanup);

    const result = dispose(disposable);

    expect(cleanup).toHaveBeenCalledTimes(1);
    expect(result).toBe(disposable);
  });

  test('should handle undefined', () => {
    const result = dispose(undefined);
    expect(result).toBeUndefined();
  });

  test('should dispose an array of disposables', () => {
    const cleanup1 = vi.fn();
    const cleanup2 = vi.fn();
    const cleanup3 = vi.fn();

    const disposables = [
      toDisposable(cleanup1),
      toDisposable(cleanup2),
      toDisposable(cleanup3),
    ];

    const result = dispose(disposables);

    expect(cleanup1).toHaveBeenCalledTimes(1);
    expect(cleanup2).toHaveBeenCalledTimes(1);
    expect(cleanup3).toHaveBeenCalledTimes(1);
    expect(result).toEqual([]);
  });

  test('should dispose an iterable (Set) of disposables', () => {
    const cleanup1 = vi.fn();
    const cleanup2 = vi.fn();

    const disposables = new Set([
      toDisposable(cleanup1),
      toDisposable(cleanup2),
    ]);

    const result = dispose(disposables);

    expect(cleanup1).toHaveBeenCalledTimes(1);
    expect(cleanup2).toHaveBeenCalledTimes(1);
    expect(result).toBeUndefined();
  });

  test('should handle errors in dispose without throwing', () => {
    const error = new Error('Test error');
    const cleanup1 = vi.fn();
    const cleanup2 = vi.fn(() => {
      throw error;
    });
    const cleanup3 = vi.fn();

    const disposables = [
      toDisposable(cleanup1),
      toDisposable(cleanup2),
      toDisposable(cleanup3),
    ];

    // dispose() catches errors internally, so it should not throw
    expect(() => dispose(disposables)).not.toThrow();
    expect(cleanup1).toHaveBeenCalledTimes(1);
    expect(cleanup2).toHaveBeenCalledTimes(1);
    expect(cleanup3).toHaveBeenCalledTimes(1);
  });

  test('should handle empty array', () => {
    const result = dispose([]);
    expect(result).toEqual([]);
  });

  test('should handle array with undefined/null', () => {
    const cleanup = vi.fn();
    const disposables = [toDisposable(cleanup), undefined, null] as any;

    // dispose() uses optional chaining, so undefined/null won't cause errors
    expect(() => dispose(disposables)).not.toThrow();
    expect(cleanup).toHaveBeenCalledTimes(1);
  });
});

describe('Integration tests', () => {
  test('should work with DisposableStore in dispose', () => {
    const store = new DisposableStore();
    const cleanup1 = vi.fn();
    const cleanup2 = vi.fn();

    store.add(toDisposable(cleanup1));
    store.add(toDisposable(cleanup2));

    dispose(store);

    expect(cleanup1).toHaveBeenCalledTimes(1);
    expect(cleanup2).toHaveBeenCalledTimes(1);
    expect(store.isDisposed).toBe(true);
  });

  test('should work with Disposable in dispose', () => {
    const disposable = new Disposable();
    const cleanup1 = vi.fn();
    const cleanup2 = vi.fn();

    disposable.registerDisposable(toDisposable(cleanup1));
    disposable.registerDisposable(toDisposable(cleanup2));

    dispose(disposable);

    expect(cleanup1).toHaveBeenCalledTimes(1);
    expect(cleanup2).toHaveBeenCalledTimes(1);
  });

  test('should handle nested disposables', () => {
    const outerStore = new DisposableStore();
    const innerStore = new DisposableStore();
    const cleanup = vi.fn();

    innerStore.add(toDisposable(cleanup));
    outerStore.add(innerStore);

    outerStore.dispose();

    expect(cleanup).toHaveBeenCalledTimes(1);
    expect(innerStore.isDisposed).toBe(true);
    expect(outerStore.isDisposed).toBe(true);
  });
});
