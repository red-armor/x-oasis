/**
 * Converts an AsyncIterator to a ReadableStream.
 *
 * The resulting stream uses a pull-based strategy: each time the consumer
 * requests a chunk, `iterator.next()` is called. When the iterator is
 * exhausted, the stream closes. Cancellation propagates back to the iterator
 * via `iterator.return()`.
 *
 * @template T The type of elements produced by the iterator.
 * @param iterator The AsyncIterator to convert.
 * @returns A ReadableStream providing the same data as the iterator.
 */
export function convertAsyncIteratorToReadableStream<T>(
  iterator: AsyncIterator<T>
): ReadableStream<T> {
  let cancelled = false;

  return new ReadableStream<T>({
    async pull(controller) {
      if (cancelled) return;
      try {
        const { value, done } = await iterator.next();
        if (done) {
          controller.close();
        } else {
          controller.enqueue(value);
        }
      } catch (error) {
        controller.error(error);
      }
    },

    async cancel(reason?: unknown) {
      cancelled = true;
      if (iterator.return) {
        try {
          await iterator.return(reason);
        } catch {
          // Intentionally ignore errors during cancellation.
        }
      }
    },
  });
}
