import { expect, test } from 'vitest';
import { colors, getUseColor, setUserColor } from '../src';

test('wraps with ansi escape codes', () => {
  expect(colors.red('x')).toBe('\x1b[31mx\x1b[39m');
});

test('isColorSupported defaults to true', () => {
  expect(colors.isColorSupported).toBe(true);
});

test('toggles useColor via setUserColor', () => {
  expect(getUseColor()).toBe(true);
  setUserColor(false);
  expect(getUseColor()).toBe(false);
  setUserColor(true);
});
