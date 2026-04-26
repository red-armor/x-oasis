import { EventStreamOptions, EventStreamState } from './types';

/**
 * A generic push-pull bridged async event stream.
 *
 * **Producer side**: call `push(event)` to emit events, `end(result?)` to terminate.
 * **Consumer side**: use `for await...of` to pull events one by one, or `await result()`
 * to get the final aggregated value.
 *
 * Internally uses a queue/waiting pair as a mutual-exclusion buffer:
 * - When producer is faster: events accumulate in `queue`
 * - When consumer is faster: consumer promises accumulate in `waiting`
 *
 * @template T - The type of each event in the stream
 * @template R - The type of the final aggregated result (defaults to T)
 *
 * @example
 * ```ts
 * const stream = new EventStream<number, number>({
 *   isComplete: (n) => n === -1,
 *   extractResult: (n) => n,
 * });
 *
 * // Producer
 * stream.push(1);
 * stream.push(2);
 * stream.push(-1); // terminal event
 *
 * // Consumer
 * for await (const event of stream) {
 *   console.log(event); // 1, 2, -1
 * }
 * ```
 */
export default class EventStream<T, R = T> implements AsyncIterable<T> {
  /** Buffered events waiting to be consumed */
  private _queue: T[] = [];

  /** Pending consumer resolve callbacks waiting for events */
  private _waiting: Array<(value: IteratorResult<T>) => void> = [];

  /** Whether the stream has been terminated */
  private _done = false;

  /** Whether at least one event has been pushed */
  private _started = false;

  /** Promise that resolves to the final aggregated result */
  private _finalResultPromise: Promise<R>;

  /** Resolve handle for the final result promise */
  private _resolveFinalResult!: (result: R) => void;

  /** Reject handle for the final result promise */
  private _rejectFinalResult!: (reason: unknown) => void;

  /** Predicate: does this event signal stream completion? */
  private _isComplete: (event: T) => boolean;

  /** Extractor: pull final result out of the terminal event */
  private _extractResult: (event: T) => R;

  constructor(options: EventStreamOptions<T, R>) {
    this._isComplete = options.isComplete;
    this._extractResult = options.extractResult;

    this._finalResultPromise = new Promise<R>((resolve, reject) => {
      this._resolveFinalResult = resolve;
      this._rejectFinalResult = reject;
    });

    // Prevent unhandled rejection warnings when error() is called
    // but no one has awaited result() yet. The rejection is still
    // observable via result() -- this just suppresses the Node.js warning.
    this._finalResultPromise.catch(() => {});
  }

  // ---------------------------------------------------------------------------
  // Producer API
  // ---------------------------------------------------------------------------

  /**
   * Push an event into the stream.
   *
   * If the event satisfies `isComplete`, the stream marks itself as done and
   * resolves the final result promise. The terminal event is still delivered
   * to consumers (they can see it via iteration).
   *
   * If the stream is already done, the event is silently discarded.
   */
  push(event: T): void {
    if (this._done) return;

    this._started = true;

    if (this._isComplete(event)) {
      this._done = true;
      this._resolveFinalResult(this._extractResult(event));
    }

    // Deliver to a waiting consumer, or buffer it
    const waiter = this._waiting.shift();
    if (waiter) {
      waiter({ value: event, done: false });
    } else {
      this._queue.push(event);
    }

    // If done, drain any remaining waiters
    if (this._done) {
      this._drainWaiters();
    }
  }

  /**
   * Terminate the stream externally without pushing a terminal event.
   *
   * Use this when the completion signal comes from outside the event protocol
   * (e.g. a Promise resolving, an abort signal, etc.).
   *
   * If `result` is provided, it resolves the final result promise.
   * All pending consumers are notified that iteration is over.
   */
  end(result?: R): void {
    if (this._done) return;
    this._done = true;

    if (result !== undefined) {
      this._resolveFinalResult(result);
    }

    this._drainWaiters();
  }

  /**
   * Terminate the stream with an error.
   *
   * The final result promise is rejected with the given reason.
   * All pending consumers are notified that iteration is over.
   */
  error(reason: unknown): void {
    if (this._done) return;
    this._done = true;
    this._rejectFinalResult(reason);
    this._drainWaiters();
  }

  // ---------------------------------------------------------------------------
  // Consumer API
  // ---------------------------------------------------------------------------

  /**
   * Async iterator protocol. Enables `for await (const event of stream)`.
   *
   * Three-way branching on each pull:
   * 1. Queue has buffered events -> yield immediately
   * 2. Stream is done -> return (end iteration)
   * 3. Neither -> suspend until producer calls push() or end()
   */
  async *[Symbol.asyncIterator](): AsyncIterator<T> {
    while (true) {
      if (this._queue.length > 0) {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        yield this._queue.shift()!;
      } else if (this._done) {
        return;
      } else {
        const result = await new Promise<IteratorResult<T>>((resolve) =>
          this._waiting.push(resolve)
        );
        if (result.done) return;
        yield result.value;
      }
    }
  }

  /**
   * Returns a promise that resolves to the final aggregated result.
   *
   * The result is determined by:
   * - `extractResult(event)` when a terminal event is pushed, or
   * - The `result` argument passed to `end(result)`.
   *
   * Consumers can skip iteration and just `await stream.result()`.
   */
  result(): Promise<R> {
    return this._finalResultPromise;
  }

  // ---------------------------------------------------------------------------
  // Introspection
  // ---------------------------------------------------------------------------

  /**
   * Current state of the stream.
   */
  get state(): EventStreamState {
    if (this._done) return 'done';
    if (this._started) return 'flowing';
    return 'idle';
  }

  /**
   * Whether the stream has been terminated (by terminal event, end(), or error()).
   */
  get isDone(): boolean {
    return this._done;
  }

  /**
   * Number of buffered events not yet consumed.
   */
  get bufferedCount(): number {
    return this._queue.length;
  }

  /**
   * Number of consumers currently waiting for events.
   */
  get waitingCount(): number {
    return this._waiting.length;
  }

  // ---------------------------------------------------------------------------
  // Internal
  // ---------------------------------------------------------------------------

  /** Notify all pending waiters that the stream is over */
  private _drainWaiters(): void {
    while (this._waiting.length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      const waiter = this._waiting.shift()!;
      waiter({ value: undefined as never, done: true });
    }
  }
}
