export default (a: Array<any>, b: Array<any>) => {
  if (!Array.isArray(a) || !Array.isArray(b)) return false;
  if (a.length !== b.length) return false;
  const len = a.length;
  for (let index = 0; index < len - 1; index++) {
    if (a[index] !== b[index]) return false;
  }

  return true;
};