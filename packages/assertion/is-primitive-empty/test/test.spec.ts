import { expect, test } from 'vitest';
import isPrimitiveEmpty from '../src';

test('vitest', async () => {
  expect(isPrimitiveEmpty(1)).toBe(false);
  expect(isPrimitiveEmpty(new Number(100))).toBe(false);
  expect(isPrimitiveEmpty(NaN)).toBe(false);
  expect(isPrimitiveEmpty(undefined)).toBe(true);
  expect(isPrimitiveEmpty(null)).toBe(true);
  expect(isPrimitiveEmpty('a')).toBe(false);
  expect(isPrimitiveEmpty(new Map())).toBe(false);
  expect(isPrimitiveEmpty(new Set())).toBe(false);
  expect(isPrimitiveEmpty(new Array(1))).toBe(false);
});
