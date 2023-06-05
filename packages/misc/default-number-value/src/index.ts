import defaultValue from '@x-oasis/default-value';

function defaultNumberValue(value, _defaultValue) {
  const _value = defaultValue(value, _defaultValue);
  const _n = Number(_value);
  if (typeof _n !== 'number') return 0;
  return _n;
}

export default defaultNumberValue;
