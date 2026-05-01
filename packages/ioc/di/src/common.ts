import isFunction from '@x-oasis/is-function';

export { isFunction };

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
  return (isObject(thing) || isFunction(thing)) && thing[IS_INJECTABLE];
};

export const createId = (str: string) => Symbol(str);
