export default <T extends {} = {}>(
  oldItems: Array<T> = [],
  newItems: Array<T> = [],
  _equal?: (a: T, b: T) => boolean
) => {
  const removed = [] as Array<T>;
  const added = [] as Array<T>;
  const equal = typeof _equal === 'function' ? _equal : (a, b) => a === b;

  for (let index = 0; index < oldItems.length; index++) {
    const current = oldItems[index];
    const findIndex = newItems.findIndex((item) => equal(item, current));
    if (findIndex === -1) {
      removed.push(current);
    }
  }

  for (let index = 0; index < newItems.length; index++) {
    const current = newItems[index];
    const findIndex = oldItems.findIndex((item) => equal(item, current));

    if (findIndex === -1) {
      added.push(current);
    }
  }

  return {
    removed,
    added,
    isEqual: !removed.length && !added.length,
  };
};
