type Fn = (value: any, index: number, arr: Array<any>) => boolean;

export default function findLastIndex(arr: Array<any>, fn: Fn) {
  // @ts-ignore
  if (Array.prototype.findLastIndex) return arr.findLastIndex(fn);
  const len = arr.length;
  for (let index = len - 1; index > 0; index--) {
    if (fn.apply(arr, [arr[index], index, arr])) {
      return index;
    }
  }

  return -1;
}
