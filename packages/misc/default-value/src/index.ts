function defaultValue(value, defaultValue) {
  /**
   * undefined == null  => true
   * null == null       => true
   * NaN !== NaN        => true
   */
  return value == null || value !== value ? defaultValue : value;
}

export default defaultValue;
