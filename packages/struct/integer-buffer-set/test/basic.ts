import IntegerBufferSet, { defaultBufferSize } from '../src';
import { describe, it, expect, beforeEach } from 'vitest';

const extractTokenTargetIndex = (val) => val.map((v) => v.targetIndex);

export const basicSuite = (hooks?: any) => {
  describe('basic', () => {
    beforeEach(() => {
      hooks?.beforeEach();
    });
    it('constructor', () => {
      const bufferSet = new IntegerBufferSet();
      expect(bufferSet.getSize()).toBe(0);
      expect(bufferSet.isBufferFull).toBe(false);
      expect(bufferSet.bufferSize).toBe(defaultBufferSize);
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
      expect(extractTokenTargetIndex(bufferSet.getIndices())).toEqual([
        10, 11, 2, 3, 4, 5, 6, 7, 8, 9,
      ]);
    });
    it('no safeRange', () => {
      const bufferSet = new IntegerBufferSet();
      const safeRange = {
        startIndex: 0,
        endIndex: 7,
      };
      expect(bufferSet.getPosition(0, safeRange)).toBe(0);
      expect(bufferSet.getPosition(1, safeRange)).toBe(1);
      expect(bufferSet.getPosition(2, safeRange)).toBe(2);
      expect(bufferSet.getPosition(3, safeRange)).toBe(3);
      expect(bufferSet.getPosition(4, safeRange)).toBe(4);
      expect(bufferSet.getPosition(5, safeRange)).toBe(5);
      expect(bufferSet.getPosition(6, safeRange)).toBe(6);
      expect(bufferSet.getPosition(7, safeRange)).toBe(7);
      expect(bufferSet.getPosition(8, safeRange)).toBe(8);
      expect(bufferSet.getPosition(9, safeRange)).toBe(9);
      expect(bufferSet.getPosition(10, safeRange)).toBe(9);
      expect(bufferSet.getPosition(11, safeRange)).toBe(8);

      expect(extractTokenTargetIndex(bufferSet.getIndices())).toEqual([
        0, 1, 2, 3, 4, 5, 6, 7, 11, 10,
      ]);
    });

    it('place same item twice', () => {
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
      const safeRange = {
        startIndex: 1,
        endIndex: 6,
      };
      expect(bufferSet.getPosition(10, safeRange)).toBe(9);
      expect(bufferSet.getPosition(10, safeRange)).toBe(9);
      expect(bufferSet.getPosition(1, safeRange)).toBe(1);
      expect(extractTokenTargetIndex(bufferSet.getIndices())).toEqual([
        0, 1, 2, 3, 4, 5, 6, 7, 8, 10,
      ]);
    });

    it('safeRange - inner', () => {
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

      expect(extractTokenTargetIndex(bufferSet.getIndices())).toEqual([
        0, 1, 2, 3, 4, 5, 6, 7, 8, 9,
      ]);

      const safeRange = {
        startIndex: 1,
        endIndex: 6,
      };
      expect(bufferSet.getPosition(10, safeRange)).toBe(9);
      expect(bufferSet.getPosition(11, safeRange)).toBe(8);
      expect(bufferSet.getPosition(12, safeRange)).toBe(7);
      expect(bufferSet.getPosition(13, safeRange)).toBe(0);
      expect(bufferSet.getPosition(14, safeRange)).toBe(null);
      expect(bufferSet.getPosition(15, safeRange)).toBe(null);
      expect(bufferSet.getPosition(16, safeRange)).toBe(null);
      expect(bufferSet.getPosition(17, safeRange)).toBe(null);
      expect(bufferSet.getPosition(18, safeRange)).toBe(null);
      expect(extractTokenTargetIndex(bufferSet.getIndices())).toEqual([
        13, 1, 2, 3, 4, 5, 6, 12, 11, 10,
      ]);
    });

    it('safeRange - outside', () => {
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
      expect(extractTokenTargetIndex(bufferSet.getIndices())).toEqual([
        0, 1, 2, 3, 4, 5, 6, 7, 8, 9,
      ]);

      const safeRange = {
        startIndex: 5,
        endIndex: 14,
      };
      expect(bufferSet.getPosition(4)).toBe(4);
      expect(bufferSet.getPosition(5)).toBe(5);
      expect(bufferSet.getPosition(6)).toBe(6);
      expect(bufferSet.getPosition(7)).toBe(7);
      expect(bufferSet.getPosition(8)).toBe(8);
      expect(bufferSet.getPosition(9)).toBe(9);
      expect(bufferSet.getPosition(10, safeRange)).toBe(0);
      expect(bufferSet.getPosition(11, safeRange)).toBe(1);
      expect(bufferSet.getPosition(12, safeRange)).toBe(2);
      expect(bufferSet.getPosition(13, safeRange)).toBe(3);
      expect(bufferSet.getPosition(14, safeRange)).toBe(4);
      expect(bufferSet.getPosition(15, safeRange)).toBe(null);
      expect(bufferSet.getPosition(16, safeRange)).toBe(null);
      expect(bufferSet.getPosition(17, safeRange)).toBe(null);
      expect(bufferSet.getPosition(18, safeRange)).toBe(null);
      expect(extractTokenTargetIndex(bufferSet.getIndices())).toEqual([
        10, 11, 12, 13, 14, 5, 6, 7, 8, 9,
      ]);
    });
  });
};

export const discreteSuite = (desc, data, fn) => {
  describe(`${desc} - discrete`, () => {
    beforeEach(() => {
      fn.hooks?.beforeEach();
    });

    it.only('recycler mod % 3 === 0', () => {
      const bufferSet = new IntegerBufferSet();

      for (let count = 0; count < data.values.length; count++) {}
    });
  });
};
