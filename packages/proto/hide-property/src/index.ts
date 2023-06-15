export default (target: object, prop: PropertyKey) => {
  Object.defineProperty(target, prop, {
    enumerable: false,
    configurable: false,
  });
};
