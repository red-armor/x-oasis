import { expect, test } from 'vitest';
import isNaN from '../src';

test('vitest', async () => {
  expect(isNaN(NaN)).toBe(true);
  expect(isNaN(1)).toBe(false);
  expect(isNaN('a')).toBe(false);
});
