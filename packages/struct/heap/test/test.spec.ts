import { expect, describe, it } from 'vitest';
import Heap from '../src';

describe('basic', () => {
  it('basic', () => {
    const heap = new Heap([3, 4, 8, 2]);
    expect(heap.pop()).toEqual(2);
  });
});
