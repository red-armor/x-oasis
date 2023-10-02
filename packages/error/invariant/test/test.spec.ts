import { expect, test } from 'vitest';
import invariant from '../src';

test('vitest', async () => {
  expect(() => invariant(false, 'my message')).toThrowError(
    'Invariant failed: my message'
  );
});
