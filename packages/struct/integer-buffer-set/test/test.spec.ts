import IntegerBufferSet from '../src';
import { describe, it, expect } from 'vitest';

describe('basic', () => {
  it('constructor', () => {
    const bufferSet = new IntegerBufferSet();
    expect(bufferSet.getSize()).toBe(0);
    const value = bufferSet.replaceFurthestIndexPosition({
      startIndex: 0,
      endIndex: 10,
    });
    // const value = bufferSet.replaceFurthestIndexPosition(0, 10, 0);
    if (!value) {
      const position = bufferSet.getPosition(0);
      console.log('position ', position);
    }

    const value2 = bufferSet.replaceFurthestIndexPosition({
      startIndex: 0,
      endIndex: 10,
    });
    // const value2 = bufferSet.replaceFurthestIndexPosition(0, 10, 1);

    if (!value2) {
      const position = bufferSet.getPosition(1);
      console.log('position 2', position);
    }

    bufferSet.getPosition(2);
    bufferSet.getPosition(3);
    bufferSet.getPosition(4);
    bufferSet.getPosition(5);
    bufferSet.getPosition(6);
    bufferSet.getPosition(7);
    bufferSet.getPosition(8);
    bufferSet.getPosition(9);
    bufferSet.getPosition(10);
    bufferSet.getPosition(11);
    bufferSet.getPosition(12);
    bufferSet.getPosition(13);

    console.log('bufferSet position ', bufferSet.getIndexPosition(10));

    const position = bufferSet.replaceFurthestIndexPosition({
      startIndex: 7,
      endIndex: 15,
    });
    // const position = bufferSet.replaceFurthestIndexPosition(7, 15, 14);
    console.log('positions ', position);

    const position2 = bufferSet.replaceFurthestIndexPosition({
      startIndex: 15,
      endIndex: 20,
    });
    bufferSet.replaceFurthestIndexPosition({
      startIndex: 15,
      endIndex: 20,
    });
    bufferSet.replaceFurthestIndexPosition({
      startIndex: 15,
      endIndex: 20,
    });
    bufferSet.replaceFurthestIndexPosition({
      startIndex: 15,
      endIndex: 20,
    });
    bufferSet.replaceFurthestIndexPosition({
      startIndex: 15,
      endIndex: 20,
    });
    bufferSet.replaceFurthestIndexPosition({
      startIndex: 20,
      endIndex: 25,
    });
    bufferSet.replaceFurthestIndexPosition({
      startIndex: 20,
      endIndex: 25,
    });
    bufferSet.replaceFurthestIndexPosition({
      startIndex: 20,
      endIndex: 25,
    });
    bufferSet.replaceFurthestIndexPosition({
      startIndex: 20,
      endIndex: 25,
    });
    bufferSet.replaceFurthestIndexPosition({
      startIndex: 20,
      endIndex: 25,
    });

    // const position2 = bufferSet.replaceFurthestIndexPosition(15, 20, 16);
    // bufferSet.replaceFurthestIndexPosition(15, 20, 17);
    // bufferSet.replaceFurthestIndexPosition(15, 20, 18);
    // bufferSet.replaceFurthestIndexPosition(15, 20, 19);
    // bufferSet.replaceFurthestIndexPosition(15, 20, 20);
    // bufferSet.replaceFurthestIndexPosition(20, 25, 21);
    // bufferSet.replaceFurthestIndexPosition(20, 25, 22);
    // bufferSet.replaceFurthestIndexPosition(20, 25, 23);
    // bufferSet.replaceFurthestIndexPosition(20, 25, 24);
    // bufferSet.replaceFurthestIndexPosition(20, 25, 25);
    console.log('positions ', position2);

    // @ts-ignore
    console.log('buffer._valueToPositionMap ', bufferSet._valueToPositionMap);
    // @ts-ignore
    console.log('buffer small ', bufferSet._smallValues);
    // @ts-ignore
    console.log('buffer large - ', bufferSet._largeValues);
    console.log('value ', value2);

    console.log('========================');

    bufferSet.replaceFurthestIndexPosition({
      startIndex: 5,
      endIndex: 15,
    });
    bufferSet.replaceFurthestIndexPosition({
      startIndex: 5,
      endIndex: 15,
    });
    bufferSet.replaceFurthestIndexPosition({
      startIndex: 5,
      endIndex: 15,
    });
    // bufferSet.replaceFurthestIndexPosition(5, 15, 5);
    // bufferSet.replaceFurthestIndexPosition(5, 15, 6);
    // bufferSet.replaceFurthestIndexPosition(5, 15, 7);

    console.log('positions ', position2);

    // @ts-ignore
    console.log('buffer._valueToPositionMap ', bufferSet._valueToPositionMap);
    // @ts-ignore
    console.log('buffer small ', bufferSet._smallValues);
    // @ts-ignore
    console.log('buffer large - ', bufferSet._largeValues);
    console.log('value ', value2);
  });
});
