import { expect, test } from 'vitest';
import defaultBooleanValue from '../src';

test('boolean with default', async () => {
  expect(defaultBooleanValue(undefined, false)).toBe(false);
  expect(defaultBooleanValue(undefined, true)).toBe(true);
  expect(defaultBooleanValue(NaN, false)).toBe(false);
  expect(defaultBooleanValue(NaN, true)).toBe(true);
  expect(defaultBooleanValue(null, false)).toBe(false);
  expect(defaultBooleanValue(null, true)).toBe(true);
  expect(defaultBooleanValue(false, false)).toBe(false);
  expect(defaultBooleanValue(true, true)).toBe(true);
  expect(defaultBooleanValue(3, true)).toBe(true);
  expect(defaultBooleanValue(0, true)).toBe(false);
});
