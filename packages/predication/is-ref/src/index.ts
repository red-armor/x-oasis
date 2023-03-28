import isObject from '@x-oasis/is-object';

export default (obj: any) => isObject(obj) && obj['current'];
