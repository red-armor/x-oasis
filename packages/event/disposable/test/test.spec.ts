import { expect, test } from 'vitest';
import { Disposable } from '../src';

test('disposable', async () => {
  const disposable = new Disposable();
  expect(disposable).toBe(Disposable);
});
