import defaultValue from '@x-oasis/default-value';

function defaultBooleanValue(value, _defaultValue) {
  const _value = defaultValue(value, _defaultValue);
  return !!_value;
}

export default defaultBooleanValue;
