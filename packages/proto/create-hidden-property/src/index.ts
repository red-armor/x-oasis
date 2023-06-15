export default (target: object, prop: PropertyKey, value: any) => {
  Object.defineProperty(target, prop, {
    value,
    enumerable: false,
    writable: true,
  });
};
