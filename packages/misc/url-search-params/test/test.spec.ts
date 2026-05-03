import { expect, test } from 'vitest';
import { flatten, setSearchParams } from '../src';

test('flatten joins params with &', () => {
  expect(flatten({ a: '1', b: '2' })).toBe('a=1&b=2');
});

test('flatten returns empty string when no params', () => {
  expect(flatten(undefined as any)).toBe('');
});

test('setSearchParams appends with ? when url has none', () => {
  expect(setSearchParams('https://x', { a: '1' })).toBe('https://x?a=1');
});

test('setSearchParams appends with & when url already has ?', () => {
  expect(setSearchParams('https://x?z=0', { a: '1' })).toBe(
    'https://x?z=0&a=1'
  );
});
