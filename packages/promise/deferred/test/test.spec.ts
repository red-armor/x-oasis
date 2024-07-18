import { expect, test } from 'vitest';

import { createDeferred } from '../src';

test('vitest', async () => {
  const deferred = createDeferred();

  expect(deferred.resolve).toBeTypeOf('function');
  expect(deferred.promise.then).toBeTypeOf('function');
  expect(deferred.reject).toBeTypeOf('function');
});
