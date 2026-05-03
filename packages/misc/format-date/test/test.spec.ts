import { expect, test } from 'vitest';
import { format } from '../src';

test('format yyyy/MM/dd', () => {
  const d = new Date(2026, 4, 2, 9, 7, 5, 12); // 2026-05-02 09:07:05.012 local
  expect(format('yyyy/MM/dd', d)).toBe('2026/05/02');
});

test('format HH:mm:ss', () => {
  const d = new Date(2026, 4, 2, 9, 7, 5, 12);
  expect(format('HH:mm:ss', d)).toBe('09:07:05');
});

test('returns undefined when not a Date', () => {
  expect(format('yyyy', 'nope' as unknown as Date)).toBe(undefined);
});
