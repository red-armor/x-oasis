export default function omit (
  obj: {
    [key: string]: any;
  },
  keys: Array<string>
) {
  if (Object.prototype.toString.call(obj) === '[object Object]') {
    return Object.keys(obj).reduce((acc, cur) => {
      if (keys.indexOf(cur) !== -1) return acc;
      acc[cur] = obj[cur];
      return acc;
    }, {});
  }

  return obj;
};