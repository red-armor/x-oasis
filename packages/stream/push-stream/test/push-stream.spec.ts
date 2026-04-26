import { describe, expect, test, vi } from 'vitest';
import { PushStream } from '../src';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Collect all values from a stream into an array */
async function collectAll<T>(stream: AsyncIterable<T>): Promise<T[]> {
  const values: T[] = [];
  for await (const v of stream) {
    values.push(v);
  }
  return values;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('PushStream', () => {
  // ---- Construction & State ----

  describe('construction and initial state', () => {
    test('should start in idle state', () => {
      const stream = new PushStream<number>();
      expect(stream.state).toBe('idle');
      expect(stream.isDone).toBe(false);
      expect(stream.bufferedCount).toBe(0);
      expect(stream.hasWaiting).toBe(false);
    });

    test('should accept optional options', () => {
      const onReturn = vi.fn();
      const stream = new PushStream<number>({ onReturn });
      expect(stream.state).toBe('idle');
    });
  });

  // ---- Single-consumer enforcement ----

  describe('single-consumer enforcement', () => {
    test('should allow first iteration', () => {
      const stream = new PushStream<number>();
      expect(() => stream[Symbol.asyncIterator]()).not.toThrow();
    });

    test('should throw on second iteration', () => {
      const stream = new PushStream<number>();
      stream[Symbol.asyncIterator]();
      expect(() => stream[Symbol.asyncIterator]()).toThrow(
        'PushStream can only be iterated once'
      );
    });
  });

  // ---- enqueue() ----

  describe('enqueue', () => {
    test('should buffer values when no consumer is waiting', () => {
      const stream = new PushStream<number>();
      stream.enqueue(1);
      stream.enqueue(2);
      stream.enqueue(3);

      expect(stream.bufferedCount).toBe(3);
      expect(stream.state).toBe('flowing');
    });

    test('should deliver directly to waiting consumer', async () => {
      const stream = new PushStream<number>();

      const consumePromise = (async () => {
        const values: number[] = [];
        for await (const v of stream) {
          values.push(v);
        }
        return values;
      })();

      // Give consumer time to enter waiting state
      await sleep(10);
      expect(stream.hasWaiting).toBe(true);

      stream.enqueue(1);
      stream.enqueue(2);
      await sleep(10);

      stream.done();

      const values = await consumePromise;
      expect(values).toEqual([1, 2]);
    });

    test('should silently discard values after done()', () => {
      const stream = new PushStream<number>();
      stream.enqueue(1);
      stream.done();
      stream.enqueue(999); // should be discarded

      expect(stream.bufferedCount).toBe(1); // only 1
    });

    test('should silently discard values after error()', () => {
      const stream = new PushStream<number>();
      stream.enqueue(1);
      stream.error(new Error('fail'));
      stream.enqueue(999); // should be discarded

      expect(stream.bufferedCount).toBe(1); // only 1
    });
  });

  // ---- done() ----

  describe('done', () => {
    test('should mark stream as done', () => {
      const stream = new PushStream<number>();
      stream.done();
      expect(stream.isDone).toBe(true);
      expect(stream.state).toBe('done');
    });

    test('should stop consumer iteration', async () => {
      const stream = new PushStream<number>();

      const consumePromise = (async () => {
        const values: number[] = [];
        for await (const v of stream) {
          values.push(v);
        }
        return values;
      })();

      await sleep(10);

      stream.enqueue(1);
      stream.enqueue(2);
      await sleep(10);

      stream.done();

      const values = await consumePromise;
      expect(values).toEqual([1, 2]);
    });

    test('should resolve waiting consumer with done signal', async () => {
      const stream = new PushStream<number>();
      const iter = stream[Symbol.asyncIterator]();

      const nextPromise = iter.next();
      await sleep(10);

      stream.done();

      const result = await nextPromise;
      expect(result.done).toBe(true);
    });

    test('should be idempotent', () => {
      const stream = new PushStream<number>();
      stream.done();
      stream.done(); // should not throw

      expect(stream.isDone).toBe(true);
    });

    test('subsequent next() after done() returns done', async () => {
      const stream = new PushStream<number>();
      stream.done();

      const iter = stream[Symbol.asyncIterator]();
      const result = await iter.next();
      expect(result.done).toBe(true);
    });
  });

  // ---- error() ----

  describe('error', () => {
    test('should mark stream as errored', () => {
      const stream = new PushStream<number>();
      stream.error(new Error('fail'));

      expect(stream.isDone).toBe(true);
      expect(stream.state).toBe('error');
    });

    test('should reject waiting consumer', async () => {
      const stream = new PushStream<number>();
      const iter = stream[Symbol.asyncIterator]();

      const nextPromise = iter.next();
      await sleep(10);

      stream.error(new Error('boom'));

      await expect(nextPromise).rejects.toThrow('boom');
    });

    test('subsequent next() after error() rejects', async () => {
      const stream = new PushStream<number>();
      stream.error(new Error('stored'));

      const iter = stream[Symbol.asyncIterator]();
      await expect(iter.next()).rejects.toThrow('stored');
    });

    test('should be idempotent', () => {
      const stream = new PushStream<number>();
      stream.error(new Error('first'));
      stream.error(new Error('second')); // should not throw

      expect(stream.isDone).toBe(true);
    });
  });

  // ---- return() / early break ----

  describe('return / early break', () => {
    test('should mark stream as done', async () => {
      const stream = new PushStream<number>();
      const iter = stream[Symbol.asyncIterator]();

      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      await iter.return!(undefined);

      expect(stream.isDone).toBe(true);
      expect(stream.state).toBe('done');
    });

    test('should invoke onReturn callback', async () => {
      const onReturn = vi.fn();
      const stream = new PushStream<number>({ onReturn });
      const iter = stream[Symbol.asyncIterator]();

      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      await iter.return!(undefined);

      expect(onReturn).toHaveBeenCalledTimes(1);
    });

    test('should work with for-await break', async () => {
      const onReturn = vi.fn();
      const stream = new PushStream<number>({ onReturn });

      stream.enqueue(1);
      stream.enqueue(2);
      stream.enqueue(3);

      const values: number[] = [];
      for await (const v of stream) {
        values.push(v);
        if (v === 2) break;
      }

      expect(values).toEqual([1, 2]);
      expect(onReturn).toHaveBeenCalledTimes(1);
      expect(stream.isDone).toBe(true);
    });
  });

  // ---- Async iteration ----

  describe('async iteration', () => {
    test('should yield all buffered values then stop', async () => {
      const stream = new PushStream<number>();
      stream.enqueue(10);
      stream.enqueue(20);
      stream.enqueue(30);
      stream.done();

      const values = await collectAll(stream);
      expect(values).toEqual([10, 20, 30]);
    });

    test('should wait for future values', async () => {
      const stream = new PushStream<number>();
      const order: string[] = [];

      const consumePromise = (async () => {
        for await (const v of stream) {
          order.push(`consume:${v}`);
        }
      })();

      await sleep(10);
      order.push('push:1');
      stream.enqueue(1);

      await sleep(10);
      order.push('push:2');
      stream.enqueue(2);

      await sleep(10);
      order.push('done');
      stream.done();

      await consumePromise;

      expect(order).toEqual([
        'push:1',
        'consume:1',
        'push:2',
        'consume:2',
        'done',
      ]);
    });

    test('should handle mixed buffered and future values', async () => {
      const stream = new PushStream<number>();

      // Buffer some values
      stream.enqueue(1);
      stream.enqueue(2);

      const consumePromise = (async () => {
        const values: number[] = [];
        for await (const v of stream) {
          values.push(v);
        }
        return values;
      })();

      // Let consumer drain the buffer
      await sleep(10);

      // Push more values
      stream.enqueue(3);
      await sleep(10);
      stream.done();

      const values = await consumePromise;
      expect(values).toEqual([1, 2, 3]);
    });

    test('empty stream terminated by done()', async () => {
      const stream = new PushStream<number>();
      stream.done();

      const values = await collectAll(stream);
      expect(values).toEqual([]);
    });
  });

  // ---- State introspection ----

  describe('state introspection', () => {
    test('state transitions: idle -> flowing -> done', () => {
      const stream = new PushStream<number>();

      expect(stream.state).toBe('idle');

      stream.enqueue(1);
      expect(stream.state).toBe('flowing');

      stream.done();
      expect(stream.state).toBe('done');
    });

    test('state transitions: idle -> flowing -> error', () => {
      const stream = new PushStream<number>();

      expect(stream.state).toBe('idle');

      stream.enqueue(1);
      expect(stream.state).toBe('flowing');

      stream.error(new Error('fail'));
      expect(stream.state).toBe('error');
    });

    test('bufferedCount reflects queued values', async () => {
      const stream = new PushStream<number>();

      expect(stream.bufferedCount).toBe(0);

      stream.enqueue(1);
      stream.enqueue(2);
      expect(stream.bufferedCount).toBe(2);

      // Start consuming
      const iter = stream[Symbol.asyncIterator]();
      await iter.next(); // consume 1
      expect(stream.bufferedCount).toBe(1);

      await iter.next(); // consume 2
      expect(stream.bufferedCount).toBe(0);

      stream.done();
    });

    test('hasWaiting reflects pending consumer', async () => {
      const stream = new PushStream<number>();

      expect(stream.hasWaiting).toBe(false);

      // Start iterating (will wait since no values)
      const iter = stream[Symbol.asyncIterator]();
      const nextPromise = iter.next();

      await sleep(10);
      expect(stream.hasWaiting).toBe(true);

      stream.enqueue(1);
      await nextPromise;
      expect(stream.hasWaiting).toBe(false);

      stream.done();
    });
  });

  // ---- Typed values ----

  describe('typed values', () => {
    type Event = { type: 'data'; payload: string } | { type: 'end' };

    test('should work with discriminated union types', async () => {
      const stream = new PushStream<Event>();

      stream.enqueue({ type: 'data', payload: 'hello' });
      stream.enqueue({ type: 'data', payload: 'world' });
      stream.enqueue({ type: 'end' });
      stream.done();

      const events = await collectAll(stream);
      expect(events).toEqual([
        { type: 'data', payload: 'hello' },
        { type: 'data', payload: 'world' },
        { type: 'end' },
      ]);
    });
  });

  // ---- Edge cases ----

  describe('edge cases', () => {
    test('done() after error() is ignored', () => {
      const stream = new PushStream<number>();
      stream.error(new Error('fail'));
      stream.done(); // should not change state

      expect(stream.state).toBe('error');
    });

    test('error() after done() is ignored', () => {
      const stream = new PushStream<number>();
      stream.done();
      stream.error(new Error('fail')); // should not change state

      expect(stream.state).toBe('done');
    });

    test('producer-faster scenario', async () => {
      const stream = new PushStream<number>();

      // Push many values before any consumer
      for (let i = 0; i < 100; i++) {
        stream.enqueue(i);
      }
      stream.done();

      const values = await collectAll(stream);
      expect(values).toHaveLength(100);
      expect(values[0]).toBe(0);
      expect(values[99]).toBe(99);
    });

    test('consumer-faster scenario', async () => {
      const stream = new PushStream<number>();
      const received: number[] = [];

      const consumePromise = (async () => {
        for await (const v of stream) {
          received.push(v);
        }
      })();

      // Slow producer
      for (let i = 0; i < 5; i++) {
        await sleep(20);
        stream.enqueue(i);
      }
      stream.done();

      await consumePromise;
      expect(received).toEqual([0, 1, 2, 3, 4]);
    });
  });
});
