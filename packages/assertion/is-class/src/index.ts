export type Ctor<T = object> = new (...args: any[]) => T;

// https://stackoverflow.com/a/43197340
export function isClass(thing: any): thing is Ctor {
  const isCtorClass =
    thing.constructor &&
    thing.constructor.toString().substring(0, 5) === 'class';
  if (thing.prototype === undefined) return isCtorClass;
  const isPrototypeCtorClass =
    thing.prototype.constructor &&
    thing.prototype.constructor.toString &&
    thing.prototype.constructor.toString().substring(0, 5) === 'class';
  return isCtorClass || isPrototypeCtorClass;
}
