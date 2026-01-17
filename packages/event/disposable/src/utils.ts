export function isObject(thing: any): thing is Object {
  return typeof thing === 'object' && thing !== null;
}

export function isFunction(thing: any): thing is Function {
  return typeof thing === 'function';
}

export function isArray(thing: any): thing is any[] {
  return Array.isArray(thing);
}

export function isIterable<T = any>(thing: any): thing is Iterable<T> {
  return (
    thing &&
    typeof thing === 'object' &&
    typeof thing[Symbol.iterator] === 'function'
  );
}
