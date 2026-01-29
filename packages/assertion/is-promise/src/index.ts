import toString from '@x-oasis/to-string';

// https://github.com/lodash/lodash/blob/main/src/isEmpty.ts
// https://stackoverflow.com/a/53751866

export default (obj: any) => {
  if (toString(obj) === '[object Promise]') return true;
  if (toString(obj) === '[object Object]') {
    return typeof obj.then === 'function';
  }
  return false;
};
