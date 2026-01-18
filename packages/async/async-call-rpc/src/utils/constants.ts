/**
 * Constants used for JSONRPC implementation
 */

export const ERROR = 'Error';

export const isArray = Array.isArray;

export const isObject = (val: unknown): val is object => {
  return val !== null && typeof val === 'object' && !isArray(val);
};

export const isFunction = (val: unknown): val is Function => {
  return typeof val === 'function';
};

export const UNDEFINED = void 0;
