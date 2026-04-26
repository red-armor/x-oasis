import { describe, expect, test } from 'vitest';
import { EventStream } from '../src';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Create a simple number stream where -1 is the terminal event */
function createNumberStream() {
  return new EventStream<number, number>({
    isComplete: (n) => n === -1,
    extractResult: (n) => n,
  });
}

/** Create a typed event stream */
type TestEvent =
  | { type: 'data'; value: string }
  | { type: 'done'; result: string };

function createTypedStream() {
  return new EventStream<TestEvent, string>({
    isComplete: (event) => event.type === 'done',
    extractResult: (event) =>
      (event as { type: 'done'; result: string }).result,
  });
}

/** Collect all events from a stream into an array */
async function collectAll<T>(stream: AsyncIterable<T>): Promise<T[]> {
  const events: T[] = [];
  for await (const event of stream) {
    events.push(event);
  }
  return events;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('EventStream', () => {
  // ---- Construction & State ----

  describe('construction and initial state', () => {
    test('should start in idle state', () => {
      const stream = createNumberStream();
      expect(stream.state).toBe('idle');
      expect(stream.isDone).toBe(false);
      expect(stream.bufferedCount).toBe(0);
      expect(stream.waitingCount).toBe(0);
    });
  });

  // ---- push() ----

  describe('push', () => {
    test('should buffer events when no consumer is waiting', () => {
      const stream = createNumberStream();
      stream.push(1);
      stream.push(2);
      stream.push(3);

      expect(stream.bufferedCount).toBe(3);
      expect(stream.state).toBe('flowing');
    });

    test('should deliver directly to waiting consumer', async () => {
      const stream = createNumberStream();

      // Start consumer first (it will wait)
      const consumePromise = (async () => {
        const events: number[] = [];
        for await (const event of stream) {
          events.push(event);
        }
        return events;
      })();

      // Give consumer time to enter waiting state
      await sleep(10);
      expect(stream.waitingCount).toBe(1);

      stream.push(1);
      stream.push(2);
      stream.push(-1); // terminal

      const events = await consumePromise;
      expect(events).toEqual([1, 2, -1]);
    });

    test('should silently discard events after stream is done', () => {
      const stream = createNumberStream();
      stream.push(1);
      stream.push(-1); // terminal
      stream.push(999); // should be discarded

      expect(stream.bufferedCount).toBe(2); // only 1 and -1
    });

    test('should mark stream as done on terminal event', () => {
      const stream = createNumberStream();
      stream.push(-1);

      expect(stream.isDone).toBe(true);
      expect(stream.state).toBe('done');
    });

    test('should resolve final result on terminal event', async () => {
      const stream = createNumberStream();
      stream.push(-1);

      const result = await stream.result();
      expect(result).toBe(-1);
    });

    test('terminal event should be delivered to consumers', async () => {
      const stream = createNumberStream();
      stream.push(1);
      stream.push(-1);

      const events = await collectAll(stream);
      expect(events).toEqual([1, -1]);
    });
  });

  // ---- end() ----

  describe('end', () => {
    test('should terminate stream and resolve result', async () => {
      const stream = createNumberStream();
      stream.push(1);
      stream.push(2);
      stream.end(42);

      expect(stream.isDone).toBe(true);

      const result = await stream.result();
      expect(result).toBe(42);
    });

    test('should stop consumer iteration', async () => {
      const stream = createNumberStream();

      const consumePromise = (async () => {
        const events: number[] = [];
        for await (const event of stream) {
          events.push(event);
        }
        return events;
      })();

      await sleep(10);

      stream.push(1);
      stream.push(2);
      stream.end([1, 2] as any);

      const events = await consumePromise;
      expect(events).toEqual([1, 2]);
    });

    test('should be idempotent', () => {
      const stream = createNumberStream();
      stream.end(1);
      stream.end(2); // should not throw or change result

      expect(stream.isDone).toBe(true);
    });

    test('end() without result should still terminate', async () => {
      const stream = createNumberStream();

      const consumePromise = collectAll(stream);

      await sleep(10);
      stream.push(1);
      stream.end();

      const events = await consumePromise;
      expect(events).toEqual([1]);
    });
  });

  // ---- error() ----

  describe('error', () => {
    test('should terminate stream and reject result', async () => {
      const stream = createNumberStream();
      const error = new Error('test error');
      stream.error(error);

      expect(stream.isDone).toBe(true);

      await expect(stream.result()).rejects.toThrow('test error');
    });

    test('should stop consumer iteration', async () => {
      const stream = createNumberStream();

      const consumePromise = (async () => {
        const events: number[] = [];
        for await (const event of stream) {
          events.push(event);
        }
        return events;
      })();

      await sleep(10);

      stream.push(1);
      await sleep(10);
      stream.error(new Error('fail'));

      const events = await consumePromise;
      expect(events).toEqual([1]);
    });

    test('should be idempotent', () => {
      const stream = createNumberStream();
      stream.error(new Error('first'));
      stream.error(new Error('second')); // should not throw

      expect(stream.isDone).toBe(true);
    });
  });

  // ---- AsyncIterable / for-await-of ----

  describe('async iteration', () => {
    test('should yield all buffered events then stop', async () => {
      const stream = createNumberStream();
      stream.push(10);
      stream.push(20);
      stream.push(30);
      stream.push(-1);

      const events = await collectAll(stream);
      expect(events).toEqual([10, 20, 30, -1]);
    });

    test('should wait for future events', async () => {
      const stream = createNumberStream();
      const order: string[] = [];

      const consumePromise = (async () => {
        for await (const event of stream) {
          order.push(`consume:${event}`);
        }
      })();

      await sleep(10);
      order.push('push:1');
      stream.push(1);

      await sleep(10);
      order.push('push:2');
      stream.push(2);

      await sleep(10);
      order.push('push:-1');
      stream.push(-1);

      await consumePromise;

      expect(order).toEqual([
        'push:1',
        'consume:1',
        'push:2',
        'consume:2',
        'push:-1',
        'consume:-1',
      ]);
    });

    test('should handle mixed buffered and future events', async () => {
      const stream = createNumberStream();

      // Buffer some events
      stream.push(1);
      stream.push(2);

      const consumePromise = (async () => {
        const events: number[] = [];
        for await (const event of stream) {
          events.push(event);
        }
        return events;
      })();

      // Let consumer drain the buffer
      await sleep(10);

      // Push more events
      stream.push(3);
      stream.push(-1);

      const events = await consumePromise;
      expect(events).toEqual([1, 2, 3, -1]);
    });
  });

  // ---- result() ----

  describe('result', () => {
    test('should resolve with extracted result from terminal event', async () => {
      const stream = createTypedStream();
      stream.push({ type: 'data', value: 'hello' });
      stream.push({ type: 'done', result: 'finished' });

      const result = await stream.result();
      expect(result).toBe('finished');
    });

    test('should resolve with value from end()', async () => {
      const stream = createTypedStream();
      stream.push({ type: 'data', value: 'hello' });
      stream.end('externally-ended');

      const result = await stream.result();
      expect(result).toBe('externally-ended');
    });

    test('should be awaitable before any events are pushed', async () => {
      const stream = createTypedStream();

      // Start awaiting result before any events
      const resultPromise = stream.result();

      await sleep(10);
      stream.push({ type: 'done', result: 'late' });

      const result = await resultPromise;
      expect(result).toBe('late');
    });

    test('should return the same promise on multiple calls', () => {
      const stream = createNumberStream();
      const p1 = stream.result();
      const p2 = stream.result();
      expect(p1).toBe(p2);
    });
  });

  // ---- State introspection ----

  describe('state introspection', () => {
    test('state transitions: idle -> flowing -> done', () => {
      const stream = createNumberStream();

      expect(stream.state).toBe('idle');

      stream.push(1);
      expect(stream.state).toBe('flowing');

      stream.push(-1);
      expect(stream.state).toBe('done');
    });

    test('bufferedCount reflects queued events', async () => {
      const stream = createNumberStream();

      expect(stream.bufferedCount).toBe(0);

      stream.push(1);
      stream.push(2);
      expect(stream.bufferedCount).toBe(2);

      // Start consuming
      const iter = stream[Symbol.asyncIterator]();
      await iter.next(); // consume 1
      expect(stream.bufferedCount).toBe(1);

      await iter.next(); // consume 2
      expect(stream.bufferedCount).toBe(0);

      stream.end(0);
    });

    test('waitingCount reflects pending consumers', async () => {
      const stream = createNumberStream();

      expect(stream.waitingCount).toBe(0);

      // Start iterating (will wait since no events)
      const iter = stream[Symbol.asyncIterator]();
      const nextPromise = iter.next();

      await sleep(10);
      expect(stream.waitingCount).toBe(1);

      stream.push(1);
      await nextPromise;
      expect(stream.waitingCount).toBe(0);

      stream.end(0);
    });
  });

  // ---- Typed event protocol ----

  describe('typed event protocol', () => {
    test('should work with discriminated union events', async () => {
      const stream = createTypedStream();

      stream.push({ type: 'data', value: 'a' });
      stream.push({ type: 'data', value: 'b' });
      stream.push({ type: 'done', result: 'ab' });

      const events = await collectAll(stream);

      expect(events).toEqual([
        { type: 'data', value: 'a' },
        { type: 'data', value: 'b' },
        { type: 'done', result: 'ab' },
      ]);

      const result = await stream.result();
      expect(result).toBe('ab');
    });
  });

  // ---- Edge cases ----

  describe('edge cases', () => {
    test('empty stream terminated by end()', async () => {
      const stream = createNumberStream();
      stream.end(0);

      const events = await collectAll(stream);
      expect(events).toEqual([]);
    });

    test('push after error is discarded', () => {
      const stream = createNumberStream();
      stream.push(1);
      stream.error(new Error('fail'));
      stream.push(2); // should be discarded

      expect(stream.bufferedCount).toBe(1); // only 1
    });

    test('end after error is ignored', () => {
      const stream = createNumberStream();
      stream.error(new Error('fail'));
      stream.end(42); // should not change anything

      expect(stream.isDone).toBe(true);
    });

    test('error after end is ignored', () => {
      const stream = createNumberStream();
      stream.end(42);
      stream.error(new Error('fail')); // should not change anything

      expect(stream.isDone).toBe(true);
    });

    test('multiple consumers see events once (single-consumer)', async () => {
      const stream = createNumberStream();
      stream.push(1);
      stream.push(2);
      stream.push(-1);

      // First consumer takes all events
      const events1 = await collectAll(stream);
      expect(events1).toEqual([1, 2, -1]);

      // Second consumer gets nothing (all events already consumed)
      const events2 = await collectAll(stream);
      expect(events2).toEqual([]);
    });
  });
});
