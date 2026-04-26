/**
 * A type that combines AsyncIterable and ReadableStream.
 * This allows a ReadableStream to be consumed using for-await-of syntax.
 */
export type AsyncIterableStream<T> = AsyncIterable<T> & ReadableStream<T>;

/**
 * Wraps a ReadableStream and returns an object that is both a ReadableStream
 * and an AsyncIterable. This enables consumption using `for await...of` with
 * proper resource cleanup on early exit or error.
 *
 * The source is piped through an identity TransformStream to ensure
 * the returned stream has a fresh, unlocked reader.
 *
 * @template T The type of the stream's chunks.
 * @param source The source ReadableStream to wrap.
 * @returns An AsyncIterableStream usable as both ReadableStream and AsyncIterable.
 */
export function createAsyncIterableStream<T>(
  source: ReadableStream<T>
): AsyncIterableStream<T> {
  // Pipe through an identity TransformStream to get a fresh, unlocked stream.
  const stream = source.pipeThrough(new TransformStream<T, T>());

  (stream as AsyncIterableStream<T>)[Symbol.asyncIterator] = function (
    this: ReadableStream<T>
  ): AsyncIterator<T> {
    const reader = this.getReader();
    let finished = false;

    async function cleanup(cancelStream: boolean) {
      if (finished) return;
      finished = true;
      try {
        if (cancelStream) {
          await reader.cancel?.();
        }
      } finally {
        try {
          reader.releaseLock();
        } catch {
          // Intentionally swallow — lock may already be released.
        }
      }
    }

    return {
      async next(): Promise<IteratorResult<T>> {
        if (finished) {
          return { done: true, value: undefined };
        }

        const { done, value } = await reader.read();

        if (done) {
          await cleanup(true);
          return { done: true, value: undefined };
        }

        return { done: false, value };
      },

      async return(): Promise<IteratorResult<T>> {
        await cleanup(true);
        return { done: true, value: undefined };
      },

      async throw(err: unknown): Promise<IteratorResult<T>> {
        await cleanup(true);
        throw err;
      },
    };
  };

  return stream as AsyncIterableStream<T>;
}
