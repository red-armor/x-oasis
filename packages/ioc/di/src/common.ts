export const hasSymbol = typeof Symbol !== 'undefined';

const isFunction = (val: unknown): val is Function => {
  return typeof val === 'function';
};

const isObject = (val: unknown): val is object => {
  return val !== null && typeof val === 'object' && !Array.isArray(val);
};

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
  return false;
};

export const createId = (str: string) => Symbol(str);
