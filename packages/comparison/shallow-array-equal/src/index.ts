type Comparison = (a: any, b: any) => boolean;

const defaultComparison = (a, b) => a === b;

const createReason = () => ({
  source: null,
  target: null,
});

let reason = createReason();

export function getReason() {
  return reason;
}

export default (
  a: Array<any>,
  b: Array<any>,
  comparison: Comparison = defaultComparison
) => {
  if (!Array.isArray(a) || !Array.isArray(b)) return false;
  if (a.length !== b.length) return false;
  const len = a.length;
  for (let index = 0; index < len; index++) {
    const source = a[index];
    const target = b[index];
    const falsy = comparison(a[index], b[index]);
    if (!falsy) {
      if (reason) {
        reason.source = source;
        reason.target = target;
      }
      return false;
    }
  }

  reason = createReason();

  return true;
};
