type Comparison = (a: any, b: any) => boolean;

const defaultComparison = (a, b) => a === b;

export default (
  a: Array<any>,
  b: Array<any>,
  comparison: Comparison = defaultComparison
) => {
  if (!Array.isArray(a) || !Array.isArray(b)) return false;
  if (a.length !== b.length) return false;
  const len = a.length;
  for (let index = 0; index < len; index++) {
    const falsy = comparison(a[index], b[index]);
    if (!falsy) return false;
  }

  return true;
};
