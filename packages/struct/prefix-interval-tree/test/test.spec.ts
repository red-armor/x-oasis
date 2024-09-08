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

    // prettier-ignore
    expect(intervalTree.getHeap()).toEqual([
                                0, 1000, 
                    800,                                  200, 
            400,                 400,               200,           0, 
        200,      200,       200,     200,      200,      0,    0,    0,
      100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 0, 0, 0, 0, 0, 0,
    ]);
    expect(intervalTree.leastStrictUpperBound(330)).toBe(4);

    expect(intervalTree.greatestLowerBound(400)).toBe(4);
    expect(intervalTree.greatestStrictLowerBound(400)).toBe(3);

    expect(intervalTree.leastStrictUpperBound(600)).toBe(7);
    expect(intervalTree.leastStrictUpperBound(700)).toBe(8);

    expect(intervalTree.leastStrictUpperBound(400)).toBe(5);
    expect(intervalTree.leastStrictUpperBound(401)).toBe(5);
    expect(intervalTree.leastStrictUpperBound(901)).toBe(10);

    intervalTree.set(7, 0);

    // prettier-ignore
    expect(intervalTree.getHeap()).toEqual([
                                    0, 900, 
                        700,                            200, 
             400,                300,             200,         0, 
        200,      200,     200,      100,     200,     0,    0,   0, 
      100, 100, 100, 100, 100, 100, 100, 0, 100, 100, 0, 0, 0, 0, 0, 0,
    ]);

    expect(intervalTree.getMaxUsefulLength()).toBe(10);
    expect(intervalTree.leastStrictUpperBound(600)).toBe(7);
    expect(intervalTree.leastStrictUpperBound(700)).toBe(9);
  });

  it('greatestLowerBound', () => {
    const intervalTree = new PrefixIntervalTree(4);
    intervalTree.set(0, 100);
    intervalTree.set(1, 0);
    intervalTree.set(2, 100);
    intervalTree.set(3, 0);
    intervalTree.set(4, 100);
    intervalTree.set(5, 100);
    intervalTree.set(6, 0);
    intervalTree.set(7, 0);
    intervalTree.set(8, 100);
    intervalTree.set(9, 100);

    // prettier-ignore
    expect(intervalTree.getHeap()).toEqual([
                                  0, 600,
                     400,                          200,            
              200,            200,            200,          0, 
          100,    100,    200,      0,    200,     0,     0,  0, 
        100, 0, 100, 0, 100, 100, 0, 0, 100, 100, 0, 0, 0, 0, 0, 0,
    ]);

    expect(intervalTree.greatestLowerBound(100)).toBe(2);
    expect(intervalTree.greatestStrictLowerBound(100)).toBe(0);
    expect(intervalTree.greatestLowerBound(200)).toBe(4);
    expect(intervalTree.greatestStrictLowerBound(200)).toBe(2);

    expect(intervalTree.greatestLowerBound(99)).toBe(0);
    expect(intervalTree.greatestStrictLowerBound(99)).toBe(0);

    expect(intervalTree.greatestLowerBound(199)).toBe(2);
    expect(intervalTree.greatestStrictLowerBound(199)).toBe(2);

    expect(intervalTree.greatestLowerBound(101)).toBe(2);
    expect(intervalTree.greatestStrictLowerBound(101)).toBe(2);

    expect(intervalTree.leastStrictUpperBound(100)).toBe(3);
    expect(intervalTree.leastUpperBound(100)).toBe(1);
  });

  it('if no zero height, leastUpperBound should equal greatestLowerBound', () => {
    const intervalTree = new PrefixIntervalTree(4);
    intervalTree.set(0, 30);
    intervalTree.set(1, 40);
    intervalTree.set(2, 10);
    intervalTree.set(3, 70);
    intervalTree.set(4, 100);
    intervalTree.set(5, 100);

    // prettier-ignore
    expect(intervalTree.getHeap()).toEqual([
                    0, 350,
            150,            200,
        70,     80,      200,    0,
      30, 40, 10, 70, 100, 100, 0, 0
    ])

    expect(intervalTree.greatestLowerBound(70)).toBe(2);
    expect(intervalTree.leastUpperBound(70)).toBe(2);

    expect(intervalTree.greatestLowerBound(35)).toBe(1);
    expect(intervalTree.greatestStrictLowerBound(35)).toBe(1);
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

    // prettier-ignore
    expect(intervalTree.getHeap()).toEqual([
                                    0, 1000, 
                       800,                               200, 
              400,               400,               200,          0, 
         200,     200,      200,      200,     200,      0,    0,    0,
      100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 0, 0, 0, 0, 0, 0,
    ]);
    expect(intervalTree.computeRange(0, 330)).toEqual({
      startIndex: 0,
      endIndex: 4,
    });
    expect(intervalTree.computeRange(0, 400)).toEqual({
      startIndex: 0,
      endIndex: 5,
    });

    expect(intervalTree.computeRange(400, 500)).toEqual({
      startIndex: 4,
      endIndex: 6,
    });

    expect(intervalTree.sumUntil(3)).toBe(300);
    expect(intervalTree.computeRange(400, 901)).toEqual({
      startIndex: 4,
      endIndex: 10,
    });
  });

  it('computeRange', () => {
    const intervalTree = new PrefixIntervalTree(4);
    intervalTree.set(0, 100);
    intervalTree.set(1, 0);
    intervalTree.set(2, 100);
    intervalTree.set(3, 0);
    intervalTree.set(4, 0);
    intervalTree.set(5, 100);
    expect(intervalTree.getHeap()).toEqual([
      0, 300, 200, 100, 100, 100, 100, 0, 100, 0, 100, 0, 0, 100, 0, 0,
    ]);
    expect(intervalTree.computeRange(100, 200)).toEqual({
      startIndex: 2,
      endIndex: 6,
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

    // prettier-ignore
    expect(intervalTree.getHeap()).toEqual([
                             0, 1000, 
                  800,                                  200, 
           400,                 400,               200,           0, 
        200,      200,       200,     200,      200,      0,    0,    0,
      100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 0, 0, 0, 0, 0, 0,
    ]);

    intervalTree.remove(3);

    // prettier-ignore
    expect(intervalTree.getHeap()).toEqual([
                                  0, 900, 
                    800,                               100, 
            400,               400,               100,           0, 
       200,      200,       200,     200,      100,      0,    0,    0,
     100, 100, 100, 100, 100, 100, 100, 100, 100, 0, 0, 0, 0, 0, 0, 0
    ]);
    expect(intervalTree.getHeap()[1]).toBe(900);

    intervalTree.remove(7);

    // prettier-ignore
    expect(intervalTree.getHeap()).toEqual([
                              0, 800, 
                    800,                             0,
            400,               400,               0,           0, 
        200,      200,       200,     200,      0,      0,    0,    0,
      100, 100, 100, 100, 100, 100, 100, 100, 0, 0, 0, 0, 0, 0, 0, 0
    ]);
    expect(intervalTree.getMaxUsefulLength()).toBe(8);
    expect(intervalTree.getHeap()[1]).toBe(800);

    intervalTree.remove(9);
    // prettier-ignore
    expect(intervalTree.getHeap()).toEqual([
                                 0, 800, 
                      800,                             0,
             400,               400,               0,           0, 
         200,      200,       200,     200,      0,      0,    0,    0,
       100, 100, 100, 100, 100, 100, 100, 100, 0, 0, 0, 0, 0, 0, 0, 0
    ]);
    expect(intervalTree.getHeap()[1]).toBe(800);
    expect(intervalTree.getMaxUsefulLength()).toBe(8);

    intervalTree.remove(0);
    // prettier-ignore
    expect(intervalTree.getHeap()).toEqual([
                               0, 700, 
                     700,                             0,
            400,                 300,               0,           0, 
        200,      200,       200,     100,      0,      0,    0,    0,
      100, 100, 100, 100, 100, 100, 100, 0, 0, 0, 0, 0, 0, 0, 0, 0
    ]);
    expect(intervalTree.getHeap()[1]).toBe(700);
    expect(intervalTree.getMaxUsefulLength()).toBe(7);
  });

  it('batch remove', () => {
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

    intervalTree.batchRemove([3, 0, 7, 9]);

    expect(intervalTree.getHeap()).toEqual([
      0, 700, 700, 0, 400, 300, 0, 0, 200, 200, 200, 100, 0, 0, 0, 0, 100, 100,
      100, 100, 100, 100, 100, 0, 0, 0, 0, 0, 0, 0, 0, 0,
    ]);
    expect(intervalTree.getHeap()[1]).toBe(700);

    expect(intervalTree.getMaxUsefulLength()).toBe(7);
  });
});
