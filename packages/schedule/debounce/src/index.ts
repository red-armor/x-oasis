import { Options } from './types';

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
) {}
