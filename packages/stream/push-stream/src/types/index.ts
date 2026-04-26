/**
 * Options for constructing a PushStream.
 */
// eslint-disable-next-line unused-imports/no-unused-vars
export interface PushStreamOptions<T> {
  /**
   * Callback invoked when the consumer calls `return()` on the iterator
   * (e.g. breaking out of a `for await...of` loop early).
   *
   * Use this to clean up resources (abort a fetch, close a socket, etc.).
   */
  onReturn?: () => void;
}

/**
 * State of the stream, observable via `stream.state`.
 *
 * - `idle`    — constructed but no events enqueued or consumed yet
 * - `flowing` — at least one event has been enqueued
 * - `error`   — terminated via `error()`
 * - `done`    — terminated via `done()` or consumer `return()`
 */
export type PushStreamState = 'idle' | 'flowing' | 'error' | 'done';
