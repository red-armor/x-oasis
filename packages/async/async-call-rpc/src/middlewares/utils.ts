import {
  MiddlewareContext,
  PendingSendEntry,
  MiddlewareFunction,
  SendMiddlewareLifecycle,
} from '../types';

/**
 * Check whether a middleware should be skipped based on lifecycle ordering.
 *
 * A middleware is skipped when the pipeline's `minLifecycle` (set by an
 * earlier middleware, e.g. `handleDisconnectedRequest`) is greater than the
 * current middleware's lifecycle. This allows earlier stages to "abort"
 * the pipeline by raising `minLifecycle` to `Aborted`.
 */
const shouldSkip = (accum: any, middleware: MiddlewareFunction): boolean => {
  const targetLifecycle = accum?.middlewareContext?.minLifecycle;
  const currentLifecycle = middleware?.lifecycle;
  return !!(
    targetLifecycle &&
    currentLifecycle &&
    currentLifecycle < targetLifecycle
  );
};

/**
 * Resume a send-middleware pipeline from a saved `PendingSendEntry`.
 *
 * Used for offline queueing: when the channel disconnects, a
 * `PendingSendEntry` is stored. On reconnection the pipeline
 * resumes from where it left off.
 *
 * @param middlewares - The full array of bound send middlewares.
 * @param entry       - The queued entry containing saved state.
 */
export const resumeMiddlewares = (
  middlewares: MiddlewareFunction[],
  entry: PendingSendEntry
) => {
  let start = false;

  return middlewares.reduce((a: any, b: MiddlewareFunction) => {
    if (!b.lifecycle) return a;

    // Find the middleware that originally queued this entry
    if (a.lifecycle >= b.lifecycle && b.displayName === a.methodName) {
      start = true;
    }
    if (!start) return a;

    if (shouldSkip(a, b)) return a;

    return b(a);
  }, entry);
};

/**
 * Execute a middleware pipeline.
 *
 * **Send pipeline** (outgoing requests):
 *   `args` → `prepareRequestData(…args)` → `updateSeqInfo(prev)` → `serialize(prev)` → `sendRequest(prev)`
 *
 * **Receive pipeline** (incoming messages):
 *   `args` → `normalizeRawMessage(…args)` → `deserialize(prev)` → `handleRequest(prev)` → `handleResponse(prev)`
 *
 * The first middleware receives `...args` (spread). Each subsequent
 * middleware receives the return value of the previous one.
 *
 * The `middlewareContext` attached at index 1 allows middlewares to
 * communicate ordering constraints (e.g. setting `minLifecycle` to
 * `Aborted` to skip remaining stages).
 *
 * @param middlewares - The array of bound middleware functions.
 * @param args        - Initial arguments passed to the first middleware.
 * @param _context    - Optional context overrides.
 */
export const runMiddlewares = (
  middlewares: MiddlewareFunction[],
  args: any[],
  _context?: MiddlewareContext
) => {
  const context: MiddlewareContext = {
    isResumed: false,
    startLifecycle: SendMiddlewareLifecycle.Initial,
    minLifecycle: SendMiddlewareLifecycle.Initial,
    ...(_context || {}),
  } as MiddlewareContext;

  return middlewares.reduce((a: any, b: MiddlewareFunction, index: number) => {
    // First middleware: spread the initial args
    if (!index) return b(...a);

    // Attach context to the accumulator after the first middleware
    if (index === 1) {
      a.middlewareContext = context;
    }

    if (shouldSkip(a, b)) return a;

    return b(a);
  }, args);
};
