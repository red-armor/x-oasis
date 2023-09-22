import toString from '@x-oasis/to-string';

// https://github.com/lodash/lodash/blob/main/src/isEmpty.ts
// https://stackoverflow.com/a/53751866

const hasOwnProperty = Object.prototype.hasOwnProperty;

export default (value: any) => {
  // null or undefined
  if (value == null) return true;
  if (Array.isArray(value)) return !value.length;

  const type = toString(value);
  if (type === '[object Map]' || type === '[object Set]') return !value.size;
  for (const key in value) {
    if (hasOwnProperty.call(value, key)) {
      return false;
    }
  }
  if (type === '[object Number]') return false;
  if (type === '[object Boolean]') return false;
  return true;
};
