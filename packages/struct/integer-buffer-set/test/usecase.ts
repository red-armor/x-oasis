import IntegerBufferSet from '../src';
import { describe, it, expect, beforeEach } from 'vitest';
import { extractTokenMetaIndex } from './utils';

export const testUseCase = (desc, data, fn) => {
  describe(`usecase - ${desc} `, () => {
    beforeEach(() => {
      fn.hooks?.beforeEach();
    });
    it(`replace total array`, () => {
      const bufferSet = new IntegerBufferSet({
        metaExtractor: (index) => data.values[index],
        indexExtractor: (meta) => {
          const index = data.values.findIndex((val) => val === meta);
          if (index === -1) return null;
          return index;
        },
      });

      const safeRange = {
        startIndex: 1,
        endIndex: 10,
      };
      bufferSet.getPosition(0, safeRange);
      bufferSet.getPosition(5, safeRange);
      bufferSet.getPosition(10, safeRange);
      bufferSet.getPosition(15, safeRange);
      bufferSet.getPosition(20, safeRange);
      bufferSet.getPosition(25, safeRange);
      bufferSet.getPosition(30, safeRange);
      bufferSet.getPosition(35, safeRange);
      bufferSet.getPosition(40, safeRange);
      bufferSet.getPosition(45, safeRange);

      expect(extractTokenMetaIndex(bufferSet.getIndices())).toEqual([
        0, 5, 10, 15, 20, 25, 30, 35, 40, 45,
      ]);

      console.log('perf =======');

      fn.data.replace();
      bufferSet.getPosition(0, safeRange);
      bufferSet.getPosition(5, safeRange);
      bufferSet.getPosition(10, safeRange);
      bufferSet.getPosition(15, safeRange);
      bufferSet.getPosition(20, safeRange);
      bufferSet.getPosition(25, safeRange);
      bufferSet.getPosition(30, safeRange);
      bufferSet.getPosition(35, safeRange);
      bufferSet.getPosition(40, safeRange);
      bufferSet.getPosition(45, safeRange);
      expect(extractTokenMetaIndex(bufferSet.getIndices())).toEqual([
        0, 5, 10, 15, 20, 25, 30, 35, 40, 45,
      ]);
    });
    it.only(`replace total array`, () => {
      const bufferSet = new IntegerBufferSet({
        metaExtractor: (index) => data.values[index],
        indexExtractor: (meta) => {
          const index = data.values.findIndex((val) => val === meta);
          if (index === -1) return null;
          return index;
        },
      });

      console.log('data ', data.values);

      const safeRange = {
        startIndex: 1,
        endIndex: 4,
      };
      bufferSet.getPosition(21, safeRange);
      bufferSet.getPosition(26, safeRange);
      bufferSet.getPosition(31, safeRange);
      bufferSet.getPosition(36, safeRange);
      bufferSet.getPosition(41, safeRange);
      bufferSet.getPosition(46, safeRange);
      bufferSet.getPosition(51, safeRange);
      bufferSet.getPosition(56, safeRange);
      bufferSet.getPosition(61, safeRange);
      bufferSet.getPosition(66, safeRange);

      expect(extractTokenMetaIndex(bufferSet.getIndices())).toEqual([
        21, 26, 31, 36, 41, 46, 51, 56, 61, 66,
      ]);

      const copy = data.values.slice();

      // @ts-ignore
      (bufferSet._indexExtractor = (meta) => {
        const index = data.values.findIndex((val) => val === meta);
        if (index !== -1) return index;
        const _index = copy.findIndex((val) => val === meta);
        if (_index === -1) return null;

        return _index;
      }),
        console.log('perf =======');

      fn.data.replace();
      bufferSet.getPosition(21, safeRange);
      bufferSet.getPosition(26, safeRange);
      bufferSet.getPosition(31, safeRange);
      bufferSet.getPosition(36, safeRange);
      bufferSet.getPosition(41, safeRange);
      bufferSet.getPosition(46, safeRange);
      bufferSet.getPosition(51, safeRange);
      bufferSet.getPosition(56, safeRange);
      bufferSet.getPosition(61, safeRange);
      bufferSet.getPosition(66, safeRange);
      // expect(extractTokenMetaIndex(bufferSet.getIndices())).toEqual([
      //   0, 5, 10, 15, 20, 25, 30, 35, 40, 45,
      // ]);
      expect(extractTokenMetaIndex(bufferSet.getIndices())).toEqual([
        // 21, 26, 31, 36, 41, 46, 51, 56, 61, 66,
        121, 126, 131, 136, 141, 146, 151, 156, 161, 121,
      ]);
    });
  });
};
