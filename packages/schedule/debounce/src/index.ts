// Helper functions
const defaultBooleanValue = (value: boolean | undefined, defaultValue: boolean): boolean => {
  return value !== undefined ? value : defaultValue;
};

const defaultNumberValue = (value: number | undefined, defaultValue: number): number => {
  return value !== undefined && value !== null ? value : defaultValue;
};

/**
 * Options for debounce function
 * @see https://lodash.com/docs/#debounce
 */
export type DebounceOptions = {
  /**
   * Specify invoking on the leading edge of the timeout.
   * @default false
   */
  leading?: boolean;
  /**
   * Specify invoking on the trailing edge of the timeout.
   * @default true
   */
  trailing?: boolean;
  /**
   * The maximum time `func` is allowed to be delayed before it's invoked.
   */
  maxWait?: number;
};

/**
 * Creates a debounced function that delays invoking `func` until after `wait` milliseconds
 * have elapsed since the last time the debounced function was invoked.
 *
 * The debounced function comes with a `cancel` method to cancel delayed `func` invocations
 * and a `flush` method to immediately invoke them.
 *
 * @param func - The function to debounce
 * @param wait - The number of milliseconds to delay
 * @param options - The options object
 * @returns Returns the new debounced function
 *
 * @example
 * ```typescript
 * // Avoid costly calculations while the window size is in flux.
 * const debounced = debounce(calculateLayout, 150);
 * window.addEventListener('resize', debounced);
 *
 * // Cancel the trailing debounced invocation.
 * debounced.cancel();
 *
 * // Flush the trailing debounced invocation.
 * debounced.flush();
 * ```
 *
 * @example
 * ```typescript
 * // Invoke `sendMail` when clicked, debouncing subsequent calls.
 * const debounced = debounce(sendMail, 300, {
 *   'leading': true,
 *   'trailing': false
 * });
 * ```
 *
 * @example
 * ```typescript
 * // Ensure `batchLog` is invoked at most once per 250ms.
 * const debounced = debounce(batchLog, 250, { maxWait: 1000 });
 * ```
 *
 * @see https://lodash.com/docs/#debounce
 */
export default function debounce(
  func: (...args: any[]) => any,
  wait: number,
  options?: DebounceOptions
): ((...args: any[]) => any) & {
  cancel: () => void;
  flush: () => void;
} {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  let maxWaitId: ReturnType<typeof setTimeout> | null = null;
  let lastCallTime = 0;
  let lastInvokeTime = 0;
  let lastArgs: any[] | null = null;
  let lastContext: any = null;
  let result: any;

  const leading = defaultBooleanValue(options?.leading, false);
  const trailing = defaultBooleanValue(options?.trailing, true);
  const maxWait = defaultNumberValue(options?.maxWait, 0);

  const invokeFunc = (time: number): any => {
    const args = lastArgs;
    const thisArg = lastContext;

    lastArgs = null;
    lastContext = null;
    lastInvokeTime = time;

    return func.apply(thisArg, args!);
  };

  const leadingEdge = (time: number): any => {
    // Reset any `maxWait` timer.
    lastInvokeTime = time;
    // Start the timer for the trailing edge.
    timeoutId = setTimeout(timerExpired, wait);
    // Invoke the leading edge.
    return leading ? invokeFunc(time) : result;
  };

  const remainingWait = (time: number): number => {
    const timeSinceLastCall = time - lastCallTime;
    const timeSinceLastInvoke = time - lastInvokeTime;
    const timeWaiting = wait - timeSinceLastCall;

    return maxWait
      ? Math.min(timeWaiting, maxWait - timeSinceLastInvoke)
      : timeWaiting;
  };

  const shouldInvoke = (time: number): boolean => {
    const timeSinceLastCall = time - lastCallTime;
    const timeSinceLastInvoke = time - lastInvokeTime;

    // Either this is the first call, activity has stopped and we're at the
    // trailing edge, the system time has gone backwards and we're treating
    // it as the trailing edge, or we've hit the `maxWait` limit.
    return (
      lastCallTime === 0 ||
      timeSinceLastCall >= wait ||
      timeSinceLastCall < 0 ||
      (maxWait && timeSinceLastInvoke >= maxWait)
    );
  };

  const timerExpired = (): any => {
    const time = Date.now();
    if (shouldInvoke(time)) {
      return trailingEdge(time);
    }
    // Restart the timer.
    timeoutId = setTimeout(timerExpired, remainingWait(time));
  };

  const trailingEdge = (time: number): any => {
    timeoutId = null;

    // Only invoke if we have `args` which means `func` has been
    // debounced at least once.
    if (trailing && lastArgs) {
      return invokeFunc(time);
    }
    lastArgs = null;
    lastContext = null;
    return result;
  };

  const cancel = (): void => {
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
    }
    if (maxWaitId !== null) {
      clearTimeout(maxWaitId);
    }
    lastInvokeTime = 0;
    lastArgs = null;
    lastContext = null;
    timeoutId = null;
    maxWaitId = null;
  };

  const flush = (): any => {
    return timeoutId === null ? result : trailingEdge(Date.now());
  };

  const debounced = function (this: any, ...args: any[]): any {
    const time = Date.now();
    const isInvoking = shouldInvoke(time);

    lastArgs = args;
    lastContext = this;
    lastCallTime = time;

    if (isInvoking) {
      if (timeoutId === null) {
        return leadingEdge(lastCallTime);
      }
      if (maxWait) {
        // Handle invocations in a tight loop.
        timeoutId = setTimeout(timerExpired, wait);
        return invokeFunc(lastCallTime);
      }
    }
    if (timeoutId === null) {
      timeoutId = setTimeout(timerExpired, wait);
    }

    // Handle maxWait
    if (maxWait && !maxWaitId) {
      maxWaitId = setTimeout(() => {
        if (shouldInvoke(Date.now())) {
          flush();
        }
      }, maxWait);
    }

    return result;
  };

  // Attach cancel and flush methods
  (debounced as any).cancel = cancel;
  (debounced as any).flush = flush;

  return debounced as any;
}
