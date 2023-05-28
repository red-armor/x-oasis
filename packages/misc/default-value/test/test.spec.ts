import { expect, test } from 'vitest';
import defaultValue from '../src';

test('boolean with default', async () => {
  expect(defaultValue(undefined, false)).toBe(false);
  expect(defaultValue(undefined, true)).toBe(true);
  expect(defaultValue(NaN, false)).toBe(false);
  expect(defaultValue(NaN, true)).toBe(true);
  expect(defaultValue(null, false)).toBe(false);
  expect(defaultValue(null, true)).toBe(true);
  expect(defaultValue(false, false)).toBe(false);
  expect(defaultValue(true, true)).toBe(true);
  expect(defaultValue(3, true)).toBe(3);
  expect(defaultValue(0, true)).toBe(0);
});
