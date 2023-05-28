// https://stackoverflow.com/a/43157464
// https://stackoverflow.com/a/35737590
// https://github.com/lodash/lodash/blob/master/defaultTo.js

function defaultValue(value, defaultValue) {
  /**
   * undefined == null  => true
   * null == null       => true
   * NaN !== NaN        => true
   */
  return value == null || value !== value ? defaultValue : value;
}

export default defaultValue;
