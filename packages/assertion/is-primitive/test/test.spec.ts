import { expect, test } from 'vitest';
import isPrimitive from '../src';

test('vitest', async () => {
  expect(isPrimitive(1)).toBe(true);
  expect(isPrimitive(new Number(100))).toBe(false);
  expect(isPrimitive(NaN)).toBe(true);
  expect(isPrimitive(undefined)).toBe(true);
  expect(isPrimitive(null)).toBe(true);
  expect(isPrimitive('a')).toBe(true);
  expect(isPrimitive(new Map())).toBe(false);
  expect(isPrimitive(new Set())).toBe(false);
  expect(isPrimitive(new Array(1))).toBe(false);
});
