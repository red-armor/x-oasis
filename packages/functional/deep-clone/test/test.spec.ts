import { expect, test } from 'vitest';
import deepClone from '../src';

test('clones plain objects', () => {
  const a = { x: 1, y: { z: 2 } };
  const b = deepClone(a);
  expect(b).toEqual(a);
  expect(b).not.toBe(a);
  expect(b.y).not.toBe(a.y);
});

test('clones arrays', () => {
  const a = [{ x: 1 }, { x: 2 }];
  const b = deepClone(a);
  expect(b).toEqual(a);
  expect(b).not.toBe(a);
  expect(b[0]).not.toBe(a[0]);
});

test('keeps RegExp by reference', () => {
  const r = /abc/i;
  expect(deepClone(r)).toBe(r);
});

test('returns primitives unchanged', () => {
  expect(deepClone(1)).toBe(1);
  expect(deepClone('s')).toBe('s');
  expect(deepClone(null)).toBe(null);
  expect(deepClone(undefined)).toBe(undefined);
});
