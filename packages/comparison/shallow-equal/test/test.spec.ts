import { expect, test } from 'vitest';
import shallowEqual from '../src';

test('vitest', async () => {
  expect(shallowEqual([1, 2], [1, 2])).toBe(true);
  expect(shallowEqual([1, 2], [2, 1])).toBe(false);
  expect(shallowEqual(1, 1)).toBe(true);
  expect(shallowEqual(NaN, NaN)).toBe(true);
  expect(shallowEqual(null, null)).toBe(true);
  expect(shallowEqual(undefined, undefined)).toBe(true);
});
