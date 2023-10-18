import { expect, test } from 'vitest';
import findLastIndex from '../src';

test('vitest', async () => {
  expect(findLastIndex([1, 2, 3, 4, 5, 1], (v) => v === 1)).toBe(5);
  expect(findLastIndex([1, 2, 3, 4, 5, 1], (v) => v === 0)).toBe(-1);
});
