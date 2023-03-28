/**
 *
 * @param fn
 * @param threshold
 * @returns
 *
 * trigger first, then trigger on the last
 */

export default function throttle(
  fn: Function,
  threshold = 250,
  fallbackOptions?:
    | {
        persistArgs?: (...args: any[]) => any;
      }
    | boolean
) {
  let last = 0;
  let timeoutHandler = null;
  const fallback = !!fallbackOptions;

  let queue = [];

  return function throttled(...args: any[]) {
    const now = Date.now();

    if (now - last > threshold) {
      last = now;
      if (timeoutHandler) {
        clearTimeout(timeoutHandler);
        timeoutHandler = null;
        queue = [];
      }

      fn.apply(null, args);
      return;
    }

    if (!fallback) return;

    timeoutHandler = setTimeout(() => {
      const len = queue.length;
      if (len) {
        const currentArgs = queue[len - 1];
        queue = [];
        fn.apply(null, currentArgs);
      }
    }, threshold);

    let nextArgs = args;
    const persistArgs =
      typeof fallbackOptions === 'object' ? fallbackOptions.persistArgs : null;

    if (typeof persistArgs === 'function') {
      nextArgs = persistArgs(args);
    }

    queue.push(nextArgs);
  };
}
