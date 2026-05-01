/**
 * Constants used for JSONRPC implementation
 */

import isObject from '@x-oasis/is-object';

export const ERROR = 'Error';

export const isArray = Array.isArray;

export { isObject };

export const isFunction = (val: unknown): val is Function => {
  return typeof val === 'function';
};

export const UNDEFINED = void 0;
