import { expect, test } from 'vitest';
import booleanWithDefault from '../src';

test('boolean with default', async () => {
  expect(booleanWithDefault(undefined, false)).toBe(false);
  expect(booleanWithDefault(undefined, true)).toBe(true);
  expect(booleanWithDefault(false, true)).toBe(false);
  expect(booleanWithDefault(true, false)).toBe(true);
  expect(booleanWithDefault(true)).toBe(true);
  expect(booleanWithDefault(false)).toBe(false);
  expect(booleanWithDefault(undefined)).toBe(false);
});
