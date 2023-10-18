import { expect, test } from 'vitest';
import getMapKeyByValue from '../src';

test('vitest', async () => {
  const v = new Map();
  v.set('first', 1);
  v.set('second', 2);
  expect(getMapKeyByValue(v, 1)).toBe('first');
});
