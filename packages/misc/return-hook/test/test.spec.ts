import { expect, test, it } from 'vitest';
import returnHook from '../src';

test('vitest', async () => {
  it('should run callback', () => {
    let count = 0;
    const counterHook = returnHook(() => count++);
    expect(counterHook(3)).toBe(3);
    expect(count).toBe(1);
  });
});
