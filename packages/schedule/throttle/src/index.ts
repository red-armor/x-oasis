// Helper function
const defaultBooleanValue = (
  value: boolean | undefined,
  defaultValue: boolean
): boolean => {
  return value !== undefined ? value : defaultValue;
};

/**
 * Options for throttle function
 * @see https://lodash.com/docs/#throttle
 */
export type ThrottleOptions = {
  /**
   * Specify invoking on the leading edge of the timeout.
   * @default true
   */
  leading?: boolean;
  /**
   * Specify invoking on the trailing edge of the timeout.
   * @default true
   */
  trailing?: boolean;
};

/**
 * Creates a throttled function that only invokes `func` at most once per every `wait` milliseconds.
 *
 * The throttled function comes with a `cancel` method to cancel delayed `func` invocations
 * and a `flush` method to immediately invoke them.
 *
 * @param func - The function to throttle
 * @param wait - The number of milliseconds to throttle invocations to
 * @param options - The options object
 * @returns Returns the new throttled function
 *
 * @example
 * ```typescript
 * // Avoid excessively updating the position while scrolling.
 * const throttled = throttle(updatePosition, 100);
 * window.addEventListener('scroll', throttled);
 *
 * // Cancel the trailing throttled invocation.
 * throttled.cancel();
 *
 * // Flush the trailing throttled invocation.
 * throttled.flush();
 * ```
 *
 * @example
 * ```typescript
 * // Invoke `renewToken` when the click event is fired, but not more than once every 5 minutes.
 * const throttled = throttle(renewToken, 300000, {
 *   'trailing': false
 * });
 * ```
 *
 * @see https://lodash.com/docs/#throttle
 */
export default function throttle(
  func: (...args: any[]) => any,
  wait = 0,
  options?: ThrottleOptions
): ((...args: any[]) => any) & {
  cancel: () => void;
  flush: () => void;
} {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  let lastArgs: any[] | null = null;
  let lastContext: any = null;
  // the last call time is the time when the last call was made (throttled function is called)
  let lastCallTime = 0;
  // the last invoke time is the time when the last invocation was made (func is called)
  let lastInvokeTime = 0;
  // the result is the result of the last invocation
  let result: any;

  const leading = defaultBooleanValue(options?.leading, true);
  const trailing = defaultBooleanValue(options?.trailing, true);

  const invokeFunc = (time: number): any => {
    const args = lastArgs;
    const thisArg = lastContext;

    lastArgs = null;
    lastContext = null;
    lastInvokeTime = time;

    return func.apply(thisArg, args ?? []);
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

    return Math.min(wait - timeSinceLastCall, wait - timeSinceLastInvoke);
  };

  const shouldInvoke = (time: number): boolean => {
    const timeSinceLastCall = time - lastCallTime;
    const timeSinceLastInvoke = time - lastInvokeTime;

    // Determine if the function should be invoked based on:
    // 1. lastCallTime === 0: First call ever (no previous call recorded)
    // 2. timeSinceLastCall >= wait: Enough time has passed since last call
    // 3. timeSinceLastCall < 0: System time went backwards (edge case handling)
    // 4. timeSinceLastInvoke !== 0 && timeSinceLastInvoke >= wait: Enough time has passed since last invocation
    return (
      lastCallTime === 0 || // First call
      timeSinceLastCall >= wait || // Enough time since last call
      timeSinceLastCall < 0 || // System time went backwards
      (timeSinceLastInvoke !== 0 && timeSinceLastInvoke >= wait) // Enough time since last invocation
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
    lastInvokeTime = 0;
    lastArgs = null;
    lastContext = null;
    timeoutId = null;
  };

  const flush = (): any => {
    return timeoutId === null ? result : trailingEdge(Date.now());
  };

  const throttled = function (this: any, ...args: any[]): any {
    const time = Date.now();
    const isInvoking = shouldInvoke(time);

    lastArgs = args;
    lastContext = this;
    lastCallTime = time;

    if (isInvoking) {
      if (timeoutId === null) {
        return leadingEdge(lastCallTime);
      }
    }
    if (timeoutId === null) {
      timeoutId = setTimeout(timerExpired, wait);
    }

    return result;
  };

  // Attach cancel and flush methods
  (throttled as any).cancel = cancel;
  (throttled as any).flush = flush;

  return throttled as any;
}
