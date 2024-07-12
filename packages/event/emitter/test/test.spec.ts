import { expect, test } from 'vitest';
import each from '../';

test('each', async () => {
  const array = [6.1, 4.2, 6.3];
  const actual = each(array, Math.floor);

  expect(actual).toEqual({ '4': [4.2], '6': [6.1, 6.3] });
});
