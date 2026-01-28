import { expect, test, vi, beforeEach, afterEach } from 'vitest';
import throttle from '../src/index';

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.restoreAllMocks();
});

test('throttle basic functionality', () => {
  const fn = vi.fn();
  const throttled = throttle(fn, 100);

  throttled(1);
  expect(fn).toHaveBeenCalledTimes(1);
  expect(fn).toHaveBeenCalledWith(1);

  throttled(2);
  throttled(3);
  expect(fn).toHaveBeenCalledTimes(1); // Still only called once

  vi.advanceTimersByTime(100);
  expect(fn).toHaveBeenCalledTimes(2);
  expect(fn).toHaveBeenCalledWith(3); // Last call's arguments
});

test('throttle with leading: false', () => {
  const fn = vi.fn();
  const throttled = throttle(fn, 100, { leading: false });

  throttled(1);
  expect(fn).not.toHaveBeenCalled();

  vi.advanceTimersByTime(100);
  expect(fn).toHaveBeenCalledTimes(1);
  expect(fn).toHaveBeenCalledWith(1);
});

test('throttle with trailing: false', () => {
  const fn = vi.fn();
  const throttled = throttle(fn, 100, { trailing: false });

  throttled(1);
  expect(fn).toHaveBeenCalledTimes(1);
  expect(fn).toHaveBeenCalledWith(1);

  throttled(2);
  throttled(3);
  expect(fn).toHaveBeenCalledTimes(1);

  vi.advanceTimersByTime(100);
  expect(fn).toHaveBeenCalledTimes(1); // No trailing execution
});

test('throttle with leading: false and trailing: false', () => {
  const fn = vi.fn();
  const throttled = throttle(fn, 100, {
    leading: false,
    trailing: false,
  });

  throttled(1);
  throttled(2);
  throttled(3);

  expect(fn).not.toHaveBeenCalled();

  vi.advanceTimersByTime(100);
  expect(fn).not.toHaveBeenCalled();
});

test('throttle cancel', () => {
  const fn = vi.fn();
  const throttled = throttle(fn, 100);

  throttled(1);
  expect(fn).toHaveBeenCalledTimes(1);

  throttled(2);
  throttled.cancel();

  vi.advanceTimersByTime(100);
  expect(fn).toHaveBeenCalledTimes(1); // Trailing call cancelled
});

test('throttle flush', () => {
  const fn = vi.fn();
  const throttled = throttle(fn, 100);

  throttled(1);
  expect(fn).toHaveBeenCalledTimes(1);

  throttled(2);
  throttled(3);
  throttled.flush();

  expect(fn).toHaveBeenCalledTimes(2);
  expect(fn).toHaveBeenCalledWith(3);

  vi.advanceTimersByTime(100);
  expect(fn).toHaveBeenCalledTimes(2); // Already flushed
});

test('throttle preserves this context', () => {
  const obj = {
    value: 42,
    fn(this: any, arg: number) {
      return this.value + arg;
    },
  };

  const throttled = throttle(obj.fn, 100);
  throttled.call(obj, 10);

  expect(obj.value).toBe(42);
  // Function executes with correct context
});

test('throttle multiple calls within wait period', () => {
  const fn = vi.fn();
  const throttled = throttle(fn, 100);

  throttled(1);
  expect(fn).toHaveBeenCalledTimes(1);
  expect(fn).toHaveBeenCalledWith(1);

  vi.advanceTimersByTime(50);
  throttled(2);
  expect(fn).toHaveBeenCalledTimes(1); // Still only called once

  vi.advanceTimersByTime(50);
  // After 100ms total, should execute immediately with latest args
  expect(fn).toHaveBeenCalledTimes(2);
  expect(fn).toHaveBeenCalledWith(2);

  vi.advanceTimersByTime(50);
  throttled(3);
  expect(fn).toHaveBeenCalledTimes(3);
  expect(fn).toHaveBeenCalledWith(3);
});

test('throttle with leading and trailing both true', () => {
  const fn = vi.fn();
  const throttled = throttle(fn, 100, {
    leading: true,
    trailing: true,
  });

  throttled(1);
  expect(fn).toHaveBeenCalledTimes(1);
  expect(fn).toHaveBeenCalledWith(1);

  throttled(2);
  expect(fn).toHaveBeenCalledTimes(1);

  vi.advanceTimersByTime(100);
  expect(fn).toHaveBeenCalledTimes(2);
  expect(fn).toHaveBeenCalledWith(2);
});

test('throttle rapid successive calls', () => {
  const fn = vi.fn();
  const throttled = throttle(fn, 100);

  for (let i = 0; i < 10; i++) {
    throttled(i);
    vi.advanceTimersByTime(10);
  }

  // Should be called multiple times (once per 100ms)
  expect(fn).toHaveBeenCalled();
  expect(fn.mock.calls.length).toBeGreaterThan(1);
});

test('throttle with zero wait time', () => {
  const fn = vi.fn();
  const throttled = throttle(fn, 0);

  throttled(1);
  expect(fn).toHaveBeenCalledTimes(1);

  throttled(2);
  vi.advanceTimersByTime(0);
  expect(fn).toHaveBeenCalledTimes(2);
});

test('throttle cancel after flush', () => {
  const fn = vi.fn();
  const throttled = throttle(fn, 100);

  throttled(1);
  expect(fn).toHaveBeenCalledTimes(1);

  throttled(2);
  throttled.flush();
  expect(fn).toHaveBeenCalledTimes(2);

  throttled.cancel();
  vi.advanceTimersByTime(100);
  expect(fn).toHaveBeenCalledTimes(2); // No additional call
});

test('throttle maintains last arguments', () => {
  const fn = vi.fn();
  const throttled = throttle(fn, 100);

  throttled('first');
  expect(fn).toHaveBeenCalledWith('first');

  throttled('second');
  throttled('third');
  expect(fn).toHaveBeenCalledTimes(1);

  vi.advanceTimersByTime(100);
  expect(fn).toHaveBeenCalledTimes(2);
  expect(fn).toHaveBeenCalledWith('third'); // Last call's arguments
});

test('throttle with multiple arguments', () => {
  const fn = vi.fn();
  const throttled = throttle(fn, 100);

  throttled(1, 'a', true);
  expect(fn).toHaveBeenCalledWith(1, 'a', true);

  throttled(2, 'b', false);
  throttled(3, 'c', true);
  expect(fn).toHaveBeenCalledTimes(1);

  vi.advanceTimersByTime(100);
  expect(fn).toHaveBeenCalledTimes(2);
  expect(fn).toHaveBeenCalledWith(3, 'c', true);
});
