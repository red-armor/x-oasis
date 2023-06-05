import { expect, test } from 'vitest';
import defaultNumberValue from '../src';

test('boolean with default', async () => {
  expect(defaultNumberValue(undefined, 1)).toBe(1);
  expect(defaultNumberValue(NaN, 1)).toBe(1);
  expect(defaultNumberValue(null, 1)).toBe(1);
  expect(defaultNumberValue(3, 4)).toBe(3);
  expect(defaultNumberValue(0, 4)).toBe(0);
});
