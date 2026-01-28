import { expect, test, vi, beforeEach, afterEach } from 'vitest';
import Batchinator from '../src/index';

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.restoreAllMocks();
});

test('Batchinator basic functionality - batches calls', () => {
  const fn = vi.fn();
  const batchinator = new Batchinator(fn, 100);

  batchinator.schedule('First');
  batchinator.schedule('Second');
  batchinator.schedule('Third');

  expect(fn).not.toHaveBeenCalled();

  vi.advanceTimersByTime(100);

  expect(fn).toHaveBeenCalledTimes(1);
  expect(fn).toHaveBeenCalledWith('Third');
});

test('Batchinator with leading: true', () => {
  const fn = vi.fn();
  const batchinator = new Batchinator(fn, 100, { leading: true });

  batchinator.schedule('First');
  expect(fn).toHaveBeenCalledTimes(1);
  expect(fn).toHaveBeenCalledWith('First');

  batchinator.schedule('Second');
  expect(fn).toHaveBeenCalledTimes(1);

  vi.advanceTimersByTime(100);
  expect(fn).toHaveBeenCalledTimes(2);
  expect(fn).toHaveBeenCalledWith('Second');
});

test('Batchinator with trailing: false', () => {
  const fn = vi.fn();
  const batchinator = new Batchinator(fn, 100, { trailing: false });

  batchinator.schedule('First');
  batchinator.schedule('Second');
  batchinator.schedule('Third');

  expect(fn).not.toHaveBeenCalled();

  vi.advanceTimersByTime(100);
  expect(fn).not.toHaveBeenCalled();
});

test('Batchinator with leading: true and trailing: false', () => {
  const fn = vi.fn();
  const batchinator = new Batchinator(fn, 100, {
    leading: true,
    trailing: false,
  });

  batchinator.schedule('First');
  expect(fn).toHaveBeenCalledTimes(1);
  expect(fn).toHaveBeenCalledWith('First');

  batchinator.schedule('Second');
  batchinator.schedule('Third');
  expect(fn).toHaveBeenCalledTimes(1);

  vi.advanceTimersByTime(100);
  expect(fn).toHaveBeenCalledTimes(1); // No trailing execution
});

test('Batchinator with leading: false and trailing: true (default)', () => {
  const fn = vi.fn();
  const batchinator = new Batchinator(fn, 100, {
    leading: false,
    trailing: true,
  });

  batchinator.schedule('First');
  expect(fn).not.toHaveBeenCalled();

  vi.advanceTimersByTime(100);
  expect(fn).toHaveBeenCalledTimes(1);
  expect(fn).toHaveBeenCalledWith('First');
});

test('Batchinator flush', () => {
  const fn = vi.fn();
  const batchinator = new Batchinator(fn, 100);

  batchinator.schedule('First');
  batchinator.schedule('Second');
  batchinator.flush();

  expect(fn).toHaveBeenCalledTimes(1);
  expect(fn).toHaveBeenCalledWith('Second');

  vi.advanceTimersByTime(100);
  expect(fn).toHaveBeenCalledTimes(1); // Already flushed
});

test('Batchinator flush with new arguments', () => {
  const fn = vi.fn();
  const batchinator = new Batchinator(fn, 100);

  batchinator.schedule('First');
  batchinator.flush('Custom');

  expect(fn).toHaveBeenCalledTimes(1);
  expect(fn).toHaveBeenCalledWith('Custom');
});

test('Batchinator dispose without abort', () => {
  const fn = vi.fn();
  const batchinator = new Batchinator(fn, 100);

  batchinator.schedule('First');
  batchinator.schedule('Second');
  batchinator.dispose();

  expect(fn).toHaveBeenCalledTimes(1);
  expect(fn).toHaveBeenCalledWith('Second');

  vi.advanceTimersByTime(100);
  expect(fn).toHaveBeenCalledTimes(1); // Already disposed
});

test('Batchinator dispose with abort', () => {
  const fn = vi.fn();
  const batchinator = new Batchinator(fn, 100);

  batchinator.schedule('First');
  batchinator.schedule('Second');
  batchinator.dispose({ abort: true });

  expect(fn).not.toHaveBeenCalled();

  vi.advanceTimersByTime(100);
  expect(fn).not.toHaveBeenCalled();
});

test('Batchinator inSchedule', () => {
  const fn = vi.fn();
  const batchinator = new Batchinator(fn, 100);

  expect(batchinator.inSchedule()).toBe(false);

  batchinator.schedule('First');
  expect(batchinator.inSchedule()).toBe(true);

  batchinator.flush();
  expect(batchinator.inSchedule()).toBe(false);
});

test('Batchinator inSchedule after dispose', () => {
  const fn = vi.fn();
  const batchinator = new Batchinator(fn, 100);

  batchinator.schedule('First');
  expect(batchinator.inSchedule()).toBe(true);

  batchinator.dispose({ abort: true });
  expect(batchinator.inSchedule()).toBe(false);
});

test('Batchinator with zero delay', () => {
  const fn = vi.fn();
  const batchinator = new Batchinator(fn, 0, { leading: true });

  batchinator.schedule('First');
  expect(fn).toHaveBeenCalledTimes(1);
  expect(fn).toHaveBeenCalledWith('First');
});

test('Batchinator with zero delay and trailing: true', () => {
  const fn = vi.fn();
  const batchinator = new Batchinator(fn, 0, {
    leading: false,
    trailing: true,
  });

  batchinator.schedule('First');
  expect(fn).toHaveBeenCalledTimes(1);
  expect(fn).toHaveBeenCalledWith('First');
});

test('Batchinator preserves this context', () => {
  const obj = {
    value: 42,
    fn: function (this: any, arg: number) {
      return this.value + arg;
    },
  };

  const batchinator = new Batchinator(obj.fn, 100);
  batchinator.schedule(10);

  vi.advanceTimersByTime(100);
  // Function executes with correct context
  expect(obj.value).toBe(42);
});

test('Batchinator multiple rapid calls', () => {
  const fn = vi.fn();
  const batchinator = new Batchinator(fn, 100);

  for (let i = 0; i < 10; i++) {
    batchinator.schedule(i);
  }

  expect(fn).not.toHaveBeenCalled();

  vi.advanceTimersByTime(100);
  expect(fn).toHaveBeenCalledTimes(1);
  expect(fn).toHaveBeenCalledWith(9); // Last call
});

test('Batchinator with multiple arguments', () => {
  const fn = vi.fn();
  const batchinator = new Batchinator(fn, 100);

  batchinator.schedule(1, 'a', true);
  batchinator.schedule(2, 'b', false);
  batchinator.schedule(3, 'c', true);

  vi.advanceTimersByTime(100);
  expect(fn).toHaveBeenCalledTimes(1);
  expect(fn).toHaveBeenCalledWith(3, 'c', true);
});

test('Batchinator schedule after flush', () => {
  const fn = vi.fn();
  const batchinator = new Batchinator(fn, 100);

  batchinator.schedule('First');
  batchinator.flush();
  expect(fn).toHaveBeenCalledTimes(1);

  batchinator.schedule('Second');
  vi.advanceTimersByTime(100);
  expect(fn).toHaveBeenCalledTimes(2);
  expect(fn).toHaveBeenCalledWith('Second');
});

test('Batchinator schedule after dispose', () => {
  const fn = vi.fn();
  const batchinator = new Batchinator(fn, 100);

  batchinator.schedule('First');
  batchinator.dispose({ abort: true });
  expect(fn).not.toHaveBeenCalled();

  batchinator.schedule('Second');
  vi.advanceTimersByTime(100);
  expect(fn).toHaveBeenCalledTimes(1);
  expect(fn).toHaveBeenCalledWith('Second');
});
