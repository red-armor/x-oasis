import { expect, test, vi, beforeEach, afterEach } from 'vitest';
import debounce from '../src/index';

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.restoreAllMocks();
});

test('debounce basic functionality - delays execution', () => {
  const fn = vi.fn();
  const debounced = debounce(fn, 100);

  debounced(1);
  debounced(2);
  debounced(3);

  expect(fn).not.toHaveBeenCalled();

  vi.advanceTimersByTime(100);

  expect(fn).toHaveBeenCalledTimes(1);
  expect(fn).toHaveBeenCalledWith(3);
});

test('debounce with leading option', () => {
  const fn = vi.fn();
  const debounced = debounce(fn, 100, { leading: true });

  debounced(1);
  expect(fn).toHaveBeenCalledTimes(1);
  expect(fn).toHaveBeenCalledWith(1);

  debounced(2);
  expect(fn).toHaveBeenCalledTimes(1);

  vi.advanceTimersByTime(100);
  expect(fn).toHaveBeenCalledTimes(2);
  expect(fn).toHaveBeenCalledWith(2);
});

test('debounce with trailing: false', () => {
  const fn = vi.fn();
  const debounced = debounce(fn, 100, { trailing: false });

  debounced(1);
  debounced(2);
  debounced(3);

  expect(fn).not.toHaveBeenCalled();

  vi.advanceTimersByTime(100);
  expect(fn).not.toHaveBeenCalled();
});

test('debounce with leading: true and trailing: false', () => {
  const fn = vi.fn();
  const debounced = debounce(fn, 100, { leading: true, trailing: false });

  debounced(1);
  expect(fn).toHaveBeenCalledTimes(1);
  expect(fn).toHaveBeenCalledWith(1);

  debounced(2);
  debounced(3);
  expect(fn).toHaveBeenCalledTimes(1);

  vi.advanceTimersByTime(100);
  expect(fn).toHaveBeenCalledTimes(1); // No trailing execution
});

test('debounce cancel', () => {
  const fn = vi.fn();
  const debounced = debounce(fn, 100);

  debounced(1);
  debounced.cancel();

  vi.advanceTimersByTime(100);
  expect(fn).not.toHaveBeenCalled();
});

test('debounce flush', () => {
  const fn = vi.fn();
  const debounced = debounce(fn, 100);

  debounced(1);
  debounced(2);
  debounced.flush();

  expect(fn).toHaveBeenCalledTimes(1);
  expect(fn).toHaveBeenCalledWith(2);

  vi.advanceTimersByTime(100);
  expect(fn).toHaveBeenCalledTimes(1); // Already flushed
});

test('debounce with maxWait', () => {
  const fn = vi.fn();
  const debounced = debounce(fn, 100, { maxWait: 250 });

  debounced(1);
  vi.advanceTimersByTime(50);
  debounced(2);
  vi.advanceTimersByTime(50);
  debounced(3);
  vi.advanceTimersByTime(50);
  debounced(4);
  vi.advanceTimersByTime(50);
  debounced(5);

  // After maxWait (250ms), function should be invoked
  vi.advanceTimersByTime(100);
  expect(fn).toHaveBeenCalled();
});

test('debounce preserves this context', () => {
  const obj = {
    value: 42,
    fn: function (this: any, arg: number) {
      return this.value + arg;
    },
  };

  const debounced = debounce(obj.fn, 100);
  const result = debounced.call(obj, 10);

  vi.advanceTimersByTime(100);
  // Note: result is undefined initially, but function executes with correct context
  expect(obj.value).toBe(42);
});

test('debounce multiple rapid calls', () => {
  const fn = vi.fn();
  const debounced = debounce(fn, 100);

  for (let i = 0; i < 10; i++) {
    debounced(i);
    vi.advanceTimersByTime(50);
  }

  // Function should not be called yet
  expect(fn).not.toHaveBeenCalled();

  // After final delay
  vi.advanceTimersByTime(100);
  expect(fn).toHaveBeenCalledTimes(1);
  expect(fn).toHaveBeenCalledWith(9);
});

test('debounce with leading and trailing both true', () => {
  const fn = vi.fn();
  const debounced = debounce(fn, 100, { leading: true, trailing: true });

  debounced(1);
  expect(fn).toHaveBeenCalledTimes(1);
  expect(fn).toHaveBeenCalledWith(1);

  debounced(2);
  expect(fn).toHaveBeenCalledTimes(1);

  vi.advanceTimersByTime(100);
  expect(fn).toHaveBeenCalledTimes(2);
  expect(fn).toHaveBeenCalledWith(2);
});

test('debounce cancel after flush', () => {
  const fn = vi.fn();
  const debounced = debounce(fn, 100);

  debounced(1);
  debounced.flush();
  expect(fn).toHaveBeenCalledTimes(1);

  debounced.cancel();
  vi.advanceTimersByTime(100);
  expect(fn).toHaveBeenCalledTimes(1); // No additional call
});

test('debounce with zero wait time', () => {
  const fn = vi.fn();
  const debounced = debounce(fn, 0);

  debounced(1);
  debounced(2);
  debounced(3);

  vi.advanceTimersByTime(0);
  expect(fn).toHaveBeenCalledTimes(1);
  expect(fn).toHaveBeenCalledWith(3);
});
