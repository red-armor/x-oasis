import debounce from '@x-oasis/debounce';

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
  const leading = options?.leading !== undefined ? options.leading : true;
  const trailing = options?.trailing !== undefined ? options.trailing : true;

  // Throttle is essentially debounce with maxWait set to wait
  // This ensures the function is invoked at most once per wait period
  return debounce(func, wait, {
    leading,
    trailing,
    maxWait: wait,
  });
}
