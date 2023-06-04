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
  const lastInvokeTime = 0;
  const lastCallTime = 0;
  const leading = defaultBooleanValue(options?.leading, false);
  const trailing = defaultBooleanValue(options?.trailing, true);
  const maxTimeout = defaultNumberValue(options.maxTimeout, 0);
}
