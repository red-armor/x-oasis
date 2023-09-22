import { expect, test, it } from 'vitest';
import returnHook from '../src';

test('vitest', async () => {
  it('should run callback', () => {
    let count = 0;
    const counterHook = returnHook(() => count++);
    expect(counterHook(3)).toBe(3);
    expect(count).toBe(1);
  });

  it('consume `val` in callback', () => {
    let count = 0;
    const counterHook = returnHook((val) => {
      if (val > 0) count++;
    });
    expect(counterHook(3)).toBe(3);
    expect(count).toBe(1);
    expect(counterHook(0)).toBe(0);
    expect(count).toBe(1);
    expect(counterHook(4)).toBe(4);
    expect(count).toBe(2);
  });
});
