import { Options } from './types';
import defaultBooleanValue from '@x-oasis/default-boolean-value';
import defaultNumberValue from '@x-oasis/default-number-value';

const DEFAULT_TIMEOUT = 200;

/**
 *
 * @param func
 * @param timeout
 * @returns
 *
 * trigger first, then trigger on the last
 */

export default function debounce(
  func: Function,
  timeout = DEFAULT_TIMEOUT,
  options: Options
) {
  let lastPerformTime = 0;
  let lastCallTime = 0;
  const leading = defaultBooleanValue(options?.leading, false);
  const trailing = defaultBooleanValue(options?.trailing, true);
  const maxTime = defaultNumberValue(options?.maxTime, 0);
  const resetTime = defaultNumberValue(options?.resetTime, 0);
  let timeoutId = undefined;
  let lastArgs = undefined;
  let result = undefined;
  let lastThis = undefined;

  function clock() {}

  function shouldPerform(time) {
    if (!lastPerformTime) return true;
    if (Date.now() - time > timeout) return true;
    return false;
  }

  function perform() {
    result = func.apply(lastThis, lastArgs);
    lastPerformTime = Date.now();
    timeoutId = undefined;
    lastArgs = undefined;
  }

  function maxTimeoutHandler() {}

  function performLeading() {
    if (leading) perform();
  }

  function performTrailing() {}

  return function (...args) {
    const now = Date.now();
    lastCallTime = now;
    lastArgs = args;
    lastThis = this; // eslint-disable-line

    if (shouldPerform(now)) {
      if (!timeoutId) {
        performLeading();
      }
    }
  };
}
