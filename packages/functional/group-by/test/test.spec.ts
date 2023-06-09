import { expect, test } from 'vitest';
import groupBy from '../';

test('groupBy', async () => {
  const array = [6.1, 4.2, 6.3];
  const actual = groupBy(array, Math.floor);

  expect(actual).toEqual({ '4': [4.2], '6': [6.1, 6.3] });
});
