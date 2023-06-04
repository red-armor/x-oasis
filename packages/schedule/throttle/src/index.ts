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
  let _args = [];

  return function throttled(...args: any[]) {
    const now = Date.now();

    const persistArgs =
      typeof fallbackOptions === 'object' ? fallbackOptions.persistArgs : null;

    _args = args;

    if (typeof persistArgs === 'function') {
      _args = persistArgs(args);
    }

    if (now - last > threshold) {
      last = now;

      return fn.apply(this, args);
    }
  };
}
