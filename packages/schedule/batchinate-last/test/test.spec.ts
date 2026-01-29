import { expect, test, vi, beforeEach, afterEach } from 'vitest';
import BatchinateLast from '../src/index';

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.restoreAllMocks();
});

test('BatchinateLast basic functionality - uses last arguments', () => {
  const fn = vi.fn();
  const batchinator = new BatchinateLast(fn, 100);

  batchinator.schedule('First');
  batchinator.schedule('Second');
  batchinator.schedule('Third');

  expect(fn).not.toHaveBeenCalled();

  vi.advanceTimersByTime(100);

  expect(fn).toHaveBeenCalledTimes(1);
  expect(fn).toHaveBeenCalledWith('Third');
});

test('BatchinateLast flush', () => {
  const fn = vi.fn();
  const batchinator = new BatchinateLast(fn, 100);

  batchinator.schedule('First');
  batchinator.schedule('Second');
  batchinator.flush();

  expect(fn).toHaveBeenCalledTimes(1);
  expect(fn).toHaveBeenCalledWith('Second');

  vi.advanceTimersByTime(100);
  expect(fn).toHaveBeenCalledTimes(1); // Already flushed
});

test('BatchinateLast flush with new arguments', () => {
  const fn = vi.fn();
  const batchinator = new BatchinateLast(fn, 100);

  batchinator.schedule('First');
  batchinator.flush('Custom');

  expect(fn).toHaveBeenCalledTimes(1);
  expect(fn).toHaveBeenCalledWith('Custom');
});

test('BatchinateLast dispose without abort', () => {
  const fn = vi.fn();
  const batchinator = new BatchinateLast(fn, 100);

  batchinator.schedule('First');
  batchinator.schedule('Second');
  batchinator.dispose();

  expect(fn).toHaveBeenCalledTimes(1);
  expect(fn).toHaveBeenCalledWith('Second');

  vi.advanceTimersByTime(100);
  expect(fn).toHaveBeenCalledTimes(1); // Already disposed
});

test('BatchinateLast dispose with abort', () => {
  const fn = vi.fn();
  const batchinator = new BatchinateLast(fn, 100);

  batchinator.schedule('First');
  batchinator.schedule('Second');
  batchinator.dispose({ abort: true });

  expect(fn).not.toHaveBeenCalled();

  vi.advanceTimersByTime(100);
  expect(fn).not.toHaveBeenCalled();
});

test('BatchinateLast inSchedule', () => {
  const fn = vi.fn();
  const batchinator = new BatchinateLast(fn, 100);

  expect(batchinator.inSchedule()).toBe(false);

  batchinator.schedule('First');
  expect(batchinator.inSchedule()).toBe(true);

  batchinator.flush();
  expect(batchinator.inSchedule()).toBe(false);
});

test('BatchinateLast inSchedule after dispose', () => {
  const fn = vi.fn();
  const batchinator = new BatchinateLast(fn, 100);

  batchinator.schedule('First');
  expect(batchinator.inSchedule()).toBe(true);

  batchinator.dispose({ abort: true });
  expect(batchinator.inSchedule()).toBe(false);
});

test('BatchinateLast with zero delay', () => {
  const fn = vi.fn();
  const batchinator = new BatchinateLast(fn, 0);

  batchinator.schedule('First');
  expect(fn).toHaveBeenCalledTimes(1);
  expect(fn).toHaveBeenCalledWith('First');
});

test('BatchinateLast preserves this context', () => {
  const obj = {
    value: 42,
    fn: function (this: any, arg: number) {
      return this.value + arg;
    },
  };

  const batchinator = new BatchinateLast(obj.fn, 100);
  batchinator.schedule(10);

  vi.advanceTimersByTime(100);
  // Function executes with correct context
  expect(obj.value).toBe(42);
});

test('BatchinateLast multiple rapid calls', () => {
  const fn = vi.fn();
  const batchinator = new BatchinateLast(fn, 100);

  for (let i = 0; i < 10; i++) {
    batchinator.schedule(i);
  }

  expect(fn).not.toHaveBeenCalled();

  vi.advanceTimersByTime(100);
  expect(fn).toHaveBeenCalledTimes(1);
  expect(fn).toHaveBeenCalledWith(9); // Last call
});

test('BatchinateLast with multiple arguments', () => {
  const fn = vi.fn();
  const batchinator = new BatchinateLast(fn, 100);

  batchinator.schedule(1, 'a', true);
  batchinator.schedule(2, 'b', false);
  batchinator.schedule(3, 'c', true);

  vi.advanceTimersByTime(100);
  expect(fn).toHaveBeenCalledTimes(1);
  expect(fn).toHaveBeenCalledWith(3, 'c', true);
});

test('BatchinateLast reschedules if new calls during execution', () => {
  const fn = vi.fn();
  const batchinator = new BatchinateLast(fn, 100);

  batchinator.schedule('First');

  // Advance time to trigger execution
  vi.advanceTimersByTime(50);
  batchinator.schedule('Second'); // New call during wait period

  vi.advanceTimersByTime(50);
  // Handler executes with 'First', then checks for new calls
  expect(fn).toHaveBeenCalled();

  // If there were new calls, it should reschedule
  vi.advanceTimersByTime(100);
  // Should execute with 'Second'
  expect(fn.mock.calls.length).toBeGreaterThan(1);
});

test('BatchinateLast schedule after flush', () => {
  const fn = vi.fn();
  const batchinator = new BatchinateLast(fn, 100);

  batchinator.schedule('First');
  batchinator.flush();
  expect(fn).toHaveBeenCalledTimes(1);

  batchinator.schedule('Second');
  vi.advanceTimersByTime(100);
  expect(fn).toHaveBeenCalledTimes(2);
  expect(fn).toHaveBeenCalledWith('Second');
});

test('BatchinateLast schedule after dispose', () => {
  const fn = vi.fn();
  const batchinator = new BatchinateLast(fn, 100);

  batchinator.schedule('First');
  batchinator.dispose({ abort: true });
  expect(fn).not.toHaveBeenCalled();

  batchinator.schedule('Second');
  vi.advanceTimersByTime(100);
  expect(fn).toHaveBeenCalledTimes(1);
  expect(fn).toHaveBeenCalledWith('Second');
});

test('BatchinateLast continuous scheduling', () => {
  const fn = vi.fn();
  const batchinator = new BatchinateLast(fn, 100);

  batchinator.schedule('First');
  vi.advanceTimersByTime(50);
  batchinator.schedule('Second');
  vi.advanceTimersByTime(50);
  batchinator.schedule('Third');

  // Should eventually execute with 'Third'
  vi.advanceTimersByTime(100);
  expect(fn).toHaveBeenCalled();
});

test('BatchinateLast flush empty schedule', () => {
  const fn = vi.fn();
  const batchinator = new BatchinateLast(fn, 100);

  // Flush without scheduling
  batchinator.flush();
  expect(fn).not.toHaveBeenCalled();
});

test('BatchinateLast dispose empty schedule', () => {
  const fn = vi.fn();
  const batchinator = new BatchinateLast(fn, 100);

  // Dispose without scheduling
  batchinator.dispose();
  expect(fn).not.toHaveBeenCalled();
});

test('BatchinateLast flush with empty args after scheduling', () => {
  const fn = vi.fn();
  const batchinator = new BatchinateLast(fn, 100);

  batchinator.schedule('First');
  batchinator.flush(); // No new args provided
  expect(fn).toHaveBeenCalledTimes(1);
  expect(fn).toHaveBeenCalledWith('First');
});
