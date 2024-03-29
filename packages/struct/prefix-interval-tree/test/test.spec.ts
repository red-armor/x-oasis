import { expect, describe, it } from 'vitest';

import PrefixIntervalTree from '../src';

describe('basic', () => {
  it('init with number ', () => {
    const intervalTree = new PrefixIntervalTree(4);
    expect(intervalTree.getHeap()).toEqual([0, 0, 0, 0, 0, 0, 0, 0]);
  });

  it('init with arr ', () => {
    const intervalTree = new PrefixIntervalTree([0, 2, 3, 1]);
    expect(intervalTree.getHeap()).toEqual([0, 6, 2, 4, 0, 2, 3, 1]);
  });

  it('this.heap[1] should be the total value', () => {
    const intervalTree = new PrefixIntervalTree([0, 2, 3, 1]);
    expect(intervalTree.getHeap()[1]).toEqual(6);
  });

  it('heap size should be the power of 2', () => {
    const intervalTree = new PrefixIntervalTree(10);
    expect(intervalTree.getSize()).toBe(16);
  });
});

describe('leastStrictUpperBound', () => {
  it('set index value', () => {
    const intervalTree = new PrefixIntervalTree(4);
    intervalTree.set(0, 100);
    intervalTree.set(1, 100);
    intervalTree.set(2, 100);
    intervalTree.set(3, 100);
    intervalTree.set(4, 100);
    intervalTree.set(5, 100);
    intervalTree.set(6, 100);
    intervalTree.set(7, 100);
    intervalTree.set(8, 100);
    intervalTree.set(9, 100);
    expect(intervalTree.getHeap()).toEqual([
      0, 1000, 800, 200, 400, 400, 200, 0, 200, 200, 200, 200, 200, 0, 0, 0,
      100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 0, 0, 0, 0, 0, 0,
    ]);
    expect(intervalTree.leastStrictUpperBound(330)).toBe(3);
    expect(intervalTree.leastStrictUpperBound(400)).toBe(3);
    expect(intervalTree.leastStrictUpperBound(401)).toBe(4);
    expect(intervalTree.leastStrictUpperBound(901)).toBe(9);
    expect(intervalTree.leastStrictUpperBound(1001)).toBe(9);
    expect(intervalTree.leastStrictUpperBound(1100)).toBe(9);
  });

  it('computeRange', () => {
    const intervalTree = new PrefixIntervalTree(4);
    intervalTree.set(0, 100);
    intervalTree.set(1, 100);
    intervalTree.set(2, 100);
    intervalTree.set(3, 100);
    intervalTree.set(4, 100);
    intervalTree.set(5, 100);
    intervalTree.set(6, 100);
    intervalTree.set(7, 100);
    intervalTree.set(8, 100);
    intervalTree.set(9, 100);
    expect(intervalTree.getHeap()).toEqual([
      0, 1000, 800, 200, 400, 400, 200, 0, 200, 200, 200, 200, 200, 0, 0, 0,
      100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 0, 0, 0, 0, 0, 0,
    ]);
    expect(intervalTree.computeRange(0, 330)).toEqual({
      startIndex: 0,
      endIndex: 3,
    });
    expect(intervalTree.computeRange(0, 400)).toEqual({
      startIndex: 0,
      endIndex: 3,
    });

    expect(intervalTree.computeRange(400, 500)).toEqual({
      startIndex: 3,
      endIndex: 4,
    });

    expect(intervalTree.sumUntil(3)).toBe(300);
    expect(intervalTree.computeRange(400, 901)).toEqual({
      startIndex: 3,
      endIndex: 9,
    });
  });

  it('sumUntil', () => {
    const intervalTree = new PrefixIntervalTree(4);
    intervalTree.set(0, 100);
    intervalTree.set(1, 100);
    intervalTree.set(2, 100);
    intervalTree.set(3, 100);
    intervalTree.set(4, 100);
    intervalTree.set(5, 100);
    intervalTree.set(6, 100);
    intervalTree.set(7, 100);
    intervalTree.set(8, 100);
    intervalTree.set(9, 100);

    expect(intervalTree.sumUntil(0)).toBe(0);
    expect(intervalTree.sumUntil(-1)).toBe(0);
    expect(intervalTree.sumUntil(-2)).toBe(0);
    expect(intervalTree.sumUntil(1)).toBe(100);
    expect(intervalTree.sumUntil(9)).toBe(900);
    expect(intervalTree.sumUntil(10)).toBe(1000);
  });

  it('sumTo', () => {
    const intervalTree = new PrefixIntervalTree(4);
    intervalTree.set(0, 100);
    intervalTree.set(1, 100);
    intervalTree.set(2, 100);
    intervalTree.set(3, 100);
    intervalTree.set(4, 100);
    intervalTree.set(5, 100);
    intervalTree.set(6, 100);
    intervalTree.set(7, 100);
    intervalTree.set(8, 100);
    intervalTree.set(9, 100);

    expect(intervalTree.sumTo(0)).toBe(100);
    expect(intervalTree.sumTo(-1)).toBe(0);
    expect(intervalTree.sumTo(-2)).toBe(0);
    expect(intervalTree.sumTo(1)).toBe(200);
    expect(intervalTree.sumTo(9)).toBe(1000);
    expect(intervalTree.sumTo(10)).toBe(1000);
  });
});

describe('testing remove heap index', () => {
  it('basic usage', () => {
    const intervalTree = new PrefixIntervalTree(4);
    intervalTree.set(0, 100);
    intervalTree.set(1, 100);
    intervalTree.set(2, 100);
    intervalTree.set(3, 100);
    intervalTree.set(4, 100);
    intervalTree.set(5, 100);
    intervalTree.set(6, 100);
    intervalTree.set(7, 100);
    intervalTree.set(8, 100);
    intervalTree.set(9, 100);

    intervalTree.remove(3);
    expect(intervalTree.getHeap()[1]).toBe(900);
    intervalTree.remove(7);
    expect(intervalTree.getHeap()[1]).toBe(800);
    intervalTree.remove(9);
    expect(intervalTree.getHeap()[1]).toBe(800);
    intervalTree.remove(0);
    expect(intervalTree.getHeap()[1]).toBe(700);
  });
});
