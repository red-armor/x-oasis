/**
 * Options for constructing an EventStream.
 *
 * @template T - The type of each event in the stream
 * @template R - The type of the final aggregated result
 */
export interface EventStreamOptions<T, R> {
  /**
   * Predicate that determines whether a given event signals the end of the stream.
   * When this returns `true`, the stream marks itself as done and resolves the
   * final result promise via `extractResult`.
   */
  isComplete: (event: T) => boolean;

  /**
   * Extracts the final aggregated result from the terminal event.
   * Only called when `isComplete` returns `true`.
   */
  extractResult: (event: T) => R;
}

/**
 * State of the stream, observable via `stream.state`.
 */
export type EventStreamState = 'idle' | 'flowing' | 'done';
