import { expect, test } from 'vitest';
import is from '../src';

test('vitest', async () => {
  expect(is(1, 1)).toBe(true);
  expect(is(NaN, NaN)).toBe(true);
});
