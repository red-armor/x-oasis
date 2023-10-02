import IntegerBufferSet from '../src';
import { describe, it, expect, beforeEach } from 'vitest';
import { extractTokenMetaIndex, extractTokenTargetIndex } from './utils';

export const deleteSuite = (desc, data, fn) => {
  describe(`${desc} - delete`, () => {
    beforeEach(() => {
      fn.hooks?.beforeEach();
    });
    it(`no safeRange`, () => {
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

    it(`getIndices add 'meta' validation`, () => {
      const bufferSet = new IntegerBufferSet({
        metaExtractor: (index) => data.values[index],
      });
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
      data.values.splice(3, 1);

      expect(extractTokenTargetIndex(bufferSet.getIndices())).toEqual([
        0,
        1,
        2,
        7,
        3,
        4,
        5,
        6,
        10,
        undefined,
      ]);

      fn.data.delete(4);
      expect(extractTokenTargetIndex(bufferSet.getIndices())).toEqual([
        0,
        1,
        2,
        6,
        3,
        7,
        4,
        5,
        undefined,
        undefined,
      ]);
      fn.data.append(10);

      expect(bufferSet.getPosition(10, safeRange)).toBe(8);
      expect(bufferSet.getPosition(11, safeRange)).toBe(9);
    });

    it(`safeRange - inner`, () => {
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

    it(`safeRange - outside`, () => {
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

export const discreteDeleteSuite = (desc, data, fn) => {
  describe(`${desc} - usage of indexExtractor`, () => {
    beforeEach(() => {
      fn.hooks?.beforeEach();
    });

    it(`bad case: metaIndex 10 is replaced with 11`, () => {
      const bufferSet = new IntegerBufferSet({
        metaExtractor: (index) => data.values[index],
        indexExtractor: (meta) => {
          const index = data.values.findIndex((val) => val === meta);
          if (index === -1) return null;
          return index;
        },
      });

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
      expect(extractTokenTargetIndex(bufferSet.getIndices())).toEqual([
        0, 1, 2, 3, 4, 5, 6, 7, 8, 10,
      ]);
      expect(extractTokenMetaIndex(bufferSet.getIndices())).toEqual([
        0, 1, 2, 3, 4, 5, 6, 7, 8, 10,
      ]);
      fn.data.delete(3);
      expect(extractTokenTargetIndex(bufferSet.getIndices())).toEqual([
        0,
        1,
        2,
        undefined,
        3,
        4,
        5,
        6,
        7,
        9,
      ]);
      expect(extractTokenMetaIndex(bufferSet.getIndices())).toEqual([
        0,
        1,
        2,
        undefined,
        4,
        5,
        6,
        7,
        8,
        10,
      ]);
      fn.data.append(5);
      expect(bufferSet.getPosition(12, safeRange)).toBe(9);
    });

    it('bad case : all the item after 20 is disposed', () => {
      const bufferSet = new IntegerBufferSet({
        metaExtractor: (index) => data.values[index],
        indexExtractor: (meta) => {
          const index = data.values.findIndex((val) => val === meta);
          if (index === -1) return null;
          return index;
        },
      });

      for (let idx = 0; idx < 50; idx++) {
        const item = data.values[idx];
        if (item.type === 'mod3') bufferSet.getPosition(idx);
      }

      expect(extractTokenTargetIndex(bufferSet.getIndices())).toEqual([
        3,
        9,
        15,
        21,
        27,
        33,
        39,
        45,
        undefined,
        undefined,
      ]);

      for (let idx = 0; idx < 70; idx++) {
        const item = data.values[idx];
        if (item.type === 'mod3') bufferSet.getPosition(idx);
      }

      expect(extractTokenTargetIndex(bufferSet.getIndices())).toEqual([
        63, 69, 15, 21, 27, 33, 39, 45, 51, 57,
      ]);

      fn.data.delete(20);
      expect(extractTokenTargetIndex(bufferSet.getIndices())).toEqual([
        62, 68, 15, 20, 26, 32, 38, 44, 50, 56,
      ]);
      expect(extractTokenMetaIndex(bufferSet.getIndices())).toEqual([
        63, 69, 15, 21, 27, 33, 39, 45, 51, 57,
      ]);
    });

    it('bad case : all the item after 20 is disposed', () => {
      const bufferSet = new IntegerBufferSet({
        metaExtractor: (index) => data.values[index],
        indexExtractor: (meta) => {
          const index = data.values.findIndex((val) => val === meta);
          if (index === -1) return null;
          return index;
        },
      });

      for (let idx = 0; idx < 50; idx++) {
        const item = data.values[idx];
        if (item.type === 'mod3') bufferSet.getPosition(idx);
      }

      expect(extractTokenTargetIndex(bufferSet.getIndices())).toEqual([
        3,
        9,
        15,
        21,
        27,
        33,
        39,
        45,
        undefined,
        undefined,
      ]);

      for (let idx = 0; idx < 70; idx++) {
        const item = data.values[idx];
        if (item.type === 'mod3') bufferSet.getPosition(idx);
      }

      expect(extractTokenTargetIndex(bufferSet.getIndices())).toEqual([
        63, 69, 15, 21, 27, 33, 39, 45, 51, 57,
      ]);

      fn.data.delete(20);
      expect(extractTokenTargetIndex(bufferSet.getIndices())).toEqual([
        62, 68, 15, 20, 26, 32, 38, 44, 50, 56,
      ]);
      expect(extractTokenMetaIndex(bufferSet.getIndices())).toEqual([
        63, 69, 15, 21, 27, 33, 39, 45, 51, 57,
      ]);
    });
  });
};
