import IntegerBufferSet, { defaultBufferSize } from '../src';
import { describe, it, expect } from 'vitest';

describe('basic', () => {
  it('constructor', () => {
    const bufferSet = new IntegerBufferSet();
    expect(bufferSet.getSize()).toBe(0);
    expect(bufferSet.isBufferFull).toBe(false);
    expect(bufferSet.bufferSize).toBe(defaultBufferSize);

    // const position = bufferSet.replaceFurthestIndexPosition({
    //   startIndex: 7,
    //   endIndex: 15,
    // });
    // // const position = bufferSet.replaceFurthestIndexPosition(7, 15, 14);
    // console.log('positions ', position);

    // const position2 = bufferSet.replaceFurthestIndexPosition({
    //   startIndex: 15,
    //   endIndex: 20,
    // });
    // bufferSet.replaceFurthestIndexPosition({
    //   startIndex: 15,
    //   endIndex: 20,
    // });
    // bufferSet.replaceFurthestIndexPosition({
    //   startIndex: 15,
    //   endIndex: 20,
    // });
    // bufferSet.replaceFurthestIndexPosition({
    //   startIndex: 15,
    //   endIndex: 20,
    // });
    // bufferSet.replaceFurthestIndexPosition({
    //   startIndex: 15,
    //   endIndex: 20,
    // });
    // bufferSet.replaceFurthestIndexPosition({
    //   startIndex: 20,
    //   endIndex: 25,
    // });
    // bufferSet.replaceFurthestIndexPosition({
    //   startIndex: 20,
    //   endIndex: 25,
    // });
    // bufferSet.replaceFurthestIndexPosition({
    //   startIndex: 20,
    //   endIndex: 25,
    // });
    // bufferSet.replaceFurthestIndexPosition({
    //   startIndex: 20,
    //   endIndex: 25,
    // });
    // bufferSet.replaceFurthestIndexPosition({
    //   startIndex: 20,
    //   endIndex: 25,
    // });

    // // const position2 = bufferSet.replaceFurthestIndexPosition(15, 20, 16);
    // // bufferSet.replaceFurthestIndexPosition(15, 20, 17);
    // // bufferSet.replaceFurthestIndexPosition(15, 20, 18);
    // // bufferSet.replaceFurthestIndexPosition(15, 20, 19);
    // // bufferSet.replaceFurthestIndexPosition(15, 20, 20);
    // // bufferSet.replaceFurthestIndexPosition(20, 25, 21);
    // // bufferSet.replaceFurthestIndexPosition(20, 25, 22);
    // // bufferSet.replaceFurthestIndexPosition(20, 25, 23);
    // // bufferSet.replaceFurthestIndexPosition(20, 25, 24);
    // // bufferSet.replaceFurthestIndexPosition(20, 25, 25);
    // console.log('positions ', position2);

    // // @ts-ignore
    // console.log('buffer._valueToPositionMap ', bufferSet._valueToPositionMap);
    // // @ts-ignore
    // console.log('buffer small ', bufferSet._smallValues);
    // // @ts-ignore
    // console.log('buffer large - ', bufferSet._largeValues);
    // console.log('value ', value2);

    // console.log('========================');

    // bufferSet.replaceFurthestIndexPosition({
    //   startIndex: 5,
    //   endIndex: 15,
    // });
    // bufferSet.replaceFurthestIndexPosition({
    //   startIndex: 5,
    //   endIndex: 15,
    // });
    // bufferSet.replaceFurthestIndexPosition({
    //   startIndex: 5,
    //   endIndex: 15,
    // });
    // // bufferSet.replaceFurthestIndexPosition(5, 15, 5);
    // // bufferSet.replaceFurthestIndexPosition(5, 15, 6);
    // // bufferSet.replaceFurthestIndexPosition(5, 15, 7);

    // console.log('positions ', position2);

    // // @ts-ignore
    // console.log('buffer._valueToPositionMap ', bufferSet._valueToPositionMap);
    // // @ts-ignore
    // console.log('buffer small ', bufferSet._smallValues);
    // // @ts-ignore
    // console.log('buffer large - ', bufferSet._largeValues);
    // console.log('value ', value2);
  });

  it('no safeRange', () => {
    const bufferSet = new IntegerBufferSet();
    expect(bufferSet.getPosition(0)).toBe(0);
    expect(bufferSet.getPosition(1)).toBe(1);
    expect(bufferSet.getPosition(2)).toBe(2);
    expect(bufferSet.getPosition(3)).toBe(3);
    expect(bufferSet.getPosition(4)).toBe(4);
    expect(bufferSet.getPosition(5)).toBe(5);
    expect(bufferSet.getPosition(6)).toBe(6);
    expect(bufferSet.getPosition(7)).toBe(7);
    expect(bufferSet.getPosition(8)).toBe(8);
    expect(bufferSet.getPosition(9)).toBe(9);
    expect(bufferSet.getPosition(10)).toBe(0);
    expect(bufferSet.getPosition(11)).toBe(1);
  });

  it('with safeRange', () => {
    const bufferSet = new IntegerBufferSet();
    expect(bufferSet.getPosition(0)).toBe(0);
    expect(bufferSet.getPosition(1)).toBe(1);
    expect(bufferSet.getPosition(2)).toBe(2);
    expect(bufferSet.getPosition(3)).toBe(3);
    expect(bufferSet.getPosition(4)).toBe(4);
    expect(bufferSet.getPosition(5)).toBe(5);
    expect(bufferSet.getPosition(6)).toBe(6);
    expect(bufferSet.getPosition(7)).toBe(7);
    expect(bufferSet.getPosition(8)).toBe(8);
    expect(bufferSet.getPosition(9)).toBe(9);
    expect(
      bufferSet.getPosition(10, {
        startIndex: 1,
        endIndex: 6,
      })
    ).toBe(9);
    expect(
      bufferSet.getPosition(10, {
        startIndex: 1,
        endIndex: 6,
      })
    ).toBe(9);
  });
});
