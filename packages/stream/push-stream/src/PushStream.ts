import { PushStreamOptions, PushStreamState } from './types';

/**
 * A single-consumer, push-pull bridged async stream.
 *
 * Modeled after claude-code's `Stream<T>` — a low-level transport pipe where
 * the producer pushes events via `enqueue()` and signals completion via `done()`
 * or failure via `error()`. The consumer pulls events through the
 * `AsyncIterator` protocol (`for await...of`).
 *
 * Key design choices inherited from claude-code:
 * - **Single iteration**: calling `[Symbol.asyncIterator]()` a second time throws.
 * - **Single pending reader**: only one `next()` call can be outstanding at a time.
 * - **Error propagation**: `error()` rejects the pending reader via `reject`.
 * - **Early return cleanup**: when the consumer breaks out of iteration,
 *   `return()` is called, marking the stream done and invoking the optional
 *   `onReturn` callback for resource cleanup.
 *
 * Compared to `@x-oasis/event-stream` (EventStream):
 * - No `isComplete`/`extractResult` — completion is explicit, not event-driven.
 * - No `result()` promise — this is a pure transport layer.
 * - Strict single-consumer enforcement (throws on second iteration).
 * - Error is stored and re-thrown on subsequent `next()` calls.
 *
 * @template T - The type of each value in the stream
 *
 * @example
 * ```ts
 * const stream = new PushStream<string>();
 *
 * // Producer
 * stream.enqueue('hello');
 * stream.enqueue('world');
 * stream.done();
 *
 * // Consumer
 * for await (const value of stream) {
 *   console.log(value); // 'hello', 'world'
 * }
 * ```
 */
export default class PushStream<T> implements AsyncIterator<T> {
  /** Buffered values waiting to be consumed */
  private _queue: T[] = [];

  /** Resolve callback for the single pending `next()` call */
  private _readResolve?: (value: IteratorResult<T>) => void;

  /** Reject callback for the single pending `next()` call */
  private _readReject?: (error: unknown) => void;

  /** Whether the stream has been terminated normally */
  private _isDone = false;

  /** Stored error (if any) — replayed on subsequent `next()` calls */
  private _hasError: unknown | undefined;

  /** Whether `[Symbol.asyncIterator]()` has been called */
  private _started = false;

  /** Whether at least one value has been enqueued */
  private _flowing = false;

  /** Optional cleanup callback for consumer early-return */
  private _onReturn?: () => void;

  constructor(options?: PushStreamOptions<T>) {
    this._onReturn = options?.onReturn;
  }

  // ---------------------------------------------------------------------------
  // AsyncIterable / AsyncIterator protocol
  // ---------------------------------------------------------------------------

  /**
   * Returns this stream as an `AsyncIterableIterator`.
   *
   * Enforces single-consumer semantics: calling this a second time throws.
   */
  [Symbol.asyncIterator](): AsyncIterableIterator<T> {
    if (this._started) {
      throw new Error('PushStream can only be iterated once');
    }
    this._started = true;
    return this;
  }

  /**
   * Pull the next value from the stream.
   *
   * Three-way branching:
   * 1. Queue has buffered values -> resolve immediately
   * 2. Stream is done -> return done signal
   * 3. Stream has error -> reject with stored error
   * 4. None of the above -> suspend until producer calls `enqueue()`, `done()`, or `error()`
   */
  next(): Promise<IteratorResult<T, unknown>> {
    if (this._queue.length > 0) {
      return Promise.resolve({
        done: false,
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        value: this._queue.shift()!,
      });
    }
    if (this._isDone) {
      return Promise.resolve({ done: true, value: undefined });
    }
    if (this._hasError) {
      return Promise.reject(this._hasError);
    }
    return new Promise<IteratorResult<T>>((resolve, reject) => {
      this._readResolve = resolve;
      this._readReject = reject;
    });
  }

  /**
   * Called when the consumer breaks out of iteration early.
   *
   * Marks the stream as done and invokes the optional `onReturn` callback
   * so the producer can release resources (abort fetch, close socket, etc.).
   */
  return(): Promise<IteratorResult<T, unknown>> {
    this._isDone = true;
    if (this._onReturn) {
      this._onReturn();
    }
    return Promise.resolve({ done: true, value: undefined });
  }

  // ---------------------------------------------------------------------------
  // Producer API
  // ---------------------------------------------------------------------------

  /**
   * Push a value into the stream.
   *
   * If a consumer is currently waiting (`next()` is pending), the value is
   * delivered directly. Otherwise it is buffered in the internal queue.
   *
   * Values pushed after `done()` or `error()` are silently discarded.
   */
  enqueue(value: T): void {
    if (this._isDone || this._hasError !== undefined) return;

    this._flowing = true;

    if (this._readResolve) {
      const resolve = this._readResolve;
      this._readResolve = undefined;
      this._readReject = undefined;
      resolve({ done: false, value });
    } else {
      this._queue.push(value);
    }
  }

  /**
   * Mark the stream as completed normally.
   *
   * If a consumer is currently waiting, it receives `{ done: true }`.
   * Subsequent calls to `next()` also return `{ done: true }`.
   */
  done(): void {
    if (this._isDone || this._hasError !== undefined) return;

    this._isDone = true;
    if (this._readResolve) {
      const resolve = this._readResolve;
      this._readResolve = undefined;
      this._readReject = undefined;
      resolve({ done: true, value: undefined });
    }
  }

  /**
   * Terminate the stream with an error.
   *
   * If a consumer is currently waiting, it is rejected with the error.
   * Subsequent calls to `next()` also reject with the stored error.
   */
  error(err: unknown): void {
    if (this._isDone || this._hasError !== undefined) return;

    this._hasError = err;
    if (this._readReject) {
      const reject = this._readReject;
      this._readResolve = undefined;
      this._readReject = undefined;
      reject(err);
    }
  }

  // ---------------------------------------------------------------------------
  // Introspection
  // ---------------------------------------------------------------------------

  /**
   * Current state of the stream.
   */
  get state(): PushStreamState {
    if (this._hasError !== undefined) return 'error';
    if (this._isDone) return 'done';
    if (this._flowing) return 'flowing';
    return 'idle';
  }

  /**
   * Whether the stream has been terminated (by `done()`, `error()`, or `return()`).
   */
  get isDone(): boolean {
    return this._isDone || this._hasError !== undefined;
  }

  /**
   * Number of buffered values not yet consumed.
   */
  get bufferedCount(): number {
    return this._queue.length;
  }

  /**
   * Whether a consumer is currently waiting for the next value.
   */
  get hasWaiting(): boolean {
    return this._readResolve !== undefined;
  }
}
