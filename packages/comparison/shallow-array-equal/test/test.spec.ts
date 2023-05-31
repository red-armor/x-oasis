import { expect, test } from 'vitest';
import shallowArrayEqual from '../src';

test('vitest', () => {
  expect(shallowArrayEqual([], [])).toBe(true);
});
