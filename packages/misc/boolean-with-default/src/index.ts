export default (value: any, defaultValue?: boolean) => {
  if (typeof value === 'boolean') return value;
  if (typeof defaultValue === 'boolean') return defaultValue;
  return !!value;
};
