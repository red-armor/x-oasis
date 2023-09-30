export default (callback: Function) => (val: any) => {
  if (typeof callback === 'function') callback();
  return val;
};

export type ReturnHook = {
  (val: any): any;
};
