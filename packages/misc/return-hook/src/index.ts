type Callback = {
  (val?: any): void;
};

export default (callback: Callback) => (val: any) => {
  if (typeof callback === 'function') callback(val);
  return val;
};

export type ReturnHook = {
  (val: any): any;
};
