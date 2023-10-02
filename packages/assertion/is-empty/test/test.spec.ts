import { expect, test } from 'vitest';
import isEmpty from '../src';

test('vitest', async () => {
  expect(isEmpty({})).toBe(true);
  expect(isEmpty([])).toBe(true);
  expect(isEmpty(new Map())).toBe(true);
  expect(isEmpty(new Set())).toBe(true);
  expect(isEmpty(false)).toBe(false);
  expect(isEmpty(0)).toBe(false);
  expect(isEmpty(1)).toBe(false);
});
