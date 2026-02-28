// import { isFunction, isObject } from '@redcity/core/common/assertion/types';

export function isFunction(thing: any): thing is Function {
  return typeof thing === 'function';
}

export function isObject(thing: any): thing is object {
  return typeof thing === 'object' && thing !== null;
}

export const hasSymbol = typeof Symbol !== 'undefined';

export const DEPENDENCIES: unique symbol = hasSymbol
  ? Symbol.for('__dependencies__')
  : ('__dependencies__' as any);

export const IS_INJECTABLE: unique symbol = hasSymbol
  ? Symbol.for('__is_injectable__')
  : ('__is_injectable__' as any);

export const createHiddenProperty = (
  target: object,
  prop: PropertyKey,
  value: any
) => {
  Object.defineProperty(target, prop, {
    value,
    enumerable: false,
    writable: true,
  });
};

export const isInjectable = (thing: any) => {
  if (!isObject(thing) && !isFunction(thing)) return false;
  if (thing[IS_INJECTABLE]) return true;
};

export const createId = (str: string) => Symbol(str);
