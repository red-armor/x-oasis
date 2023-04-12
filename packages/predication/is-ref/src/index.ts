import isObject from '@x-oasis/is-object';

export default (obj: any) =>
  isObject(obj) && Object.prototype.hasOwnProperty.call(obj, 'current');
