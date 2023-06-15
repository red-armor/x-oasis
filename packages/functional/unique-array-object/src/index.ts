// https://stackoverflow.com/a/56757215

const shimFindLastIndex = (arr: Array<any>, filter: Function) => {
  // @ts-ignore
  if (typeof Array.prototype.findLastIndex === 'function')
    // @ts-ignore
    return Array.prototype.findLastIndex.apply(arr, [filter]);

  const len = arr.length;
  for (let index = len - 1; index >= 0; index--) {
    const item = arr[index];
    if (filter(item, index)) return index;
  }
  return -1;
};

export default (
  arr: Array<{
    [key: string]: any;
  }>,
  getter: string | { (item: any): any },
  keepFirst?: boolean
) => {
  const filter = (item, _item) =>
    typeof getter === 'function'
      ? getter(_item) === getter(item)
      : _item[getter] === item[getter];

  if (keepFirst)
    return arr.filter(
      (item, index, _arr) =>
        _arr.findIndex((_item) => filter(item, _item)) === index
    );

  return arr.filter(
    (item, index, _arr) =>
      shimFindLastIndex(arr, (_item) => filter(item, _item)) === index
  );
};

// return [
//   ...new Map(
//     arr
//       .filter((v) => v)
//       .map((item) => [
//         typeof getter === 'function' ? getter(item) : item[getter],
//         item,
//       ])
//   ).values(),
// ]
