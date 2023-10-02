import Recycler from '../src';
import { describe, it, beforeEach, expect } from 'vitest';

const finalizeIndices = (indices) => {
  return indices.reduce((acc, cur) => {
    if (!cur) {
      acc.push(undefined);
      return acc;
    }
    const meta = cur.meta;
    const type = meta.type;
    if (!acc[type]) acc[type] = [];
    acc[type].push(`${meta.index}_${type}`);
    return acc;
  }, {});
};

export const basicSuite = (desc, data, fn?: any) => {
  describe(`${desc}_basic`, () => {
    beforeEach(() => {
      fn.hooks?.beforeEach();
    });

    it('add buffer', () => {
      const recycler = new Recycler({
        recyclerTypes: ['mod3', 'mod5', 'mod7'],
      });

      expect(recycler.queue.length).toBe(3);
      expect(recycler.queue.map((buffer) => buffer.recyclerType)).toEqual([
        'mod3',
        'mod5',
        'mod7',
      ]);

      for (let index = 0; index < data.values.length; index++) {
        const item = data.values[index];
        recycler.addBuffer(item.type);
      }

      expect(recycler.queue.length).toBe(5);
      expect(recycler.queue.map((buffer) => buffer.recyclerType)).toEqual([
        'mod3',
        'mod5',
        'mod7',
        'default',
        'mod2',
      ]);
    });

    it('update indices', () => {
      const recycler = new Recycler({
        metaExtractor: (index) => data.values[index],
        indexExtractor: (meta) => {
          const index = data.values.findIndex((val) => val === meta);
          if (index === -1) return null;
          return index;
        },
        getType: (index) => {
          const item = data.values[index];
          return item.type;
        },
        recyclerTypes: ['mod3', 'mod5', 'mod7'],
      });

      recycler.updateIndices({
        safeRange: {
          startIndex: 1,
          endIndex: 10,
        },
        startIndex: 0,
        maxCount: 50,
        step: 1,
        maxIndex: 100,
      });

      console.log('get indices 2 ', finalizeIndices(recycler.getIndices()));

      recycler.updateIndices({
        safeRange: {
          startIndex: 12,
          endIndex: 20,
        },
        startIndex: 5,
        maxCount: 50,
        step: 1,
        maxIndex: 100,
      });
      console.log('get indices 3 ', finalizeIndices(recycler.getIndices()));

      recycler.updateIndices({
        safeRange: {
          startIndex: 20,
          endIndex: 28,
        },
        startIndex: 15,
        maxCount: 50,
        step: 1,
        maxIndex: 100,
      });
      console.log('get indices 4 ', finalizeIndices(recycler.getIndices()));
      fn.data.delete(20);

      recycler.updateIndices({
        safeRange: {
          startIndex: 20,
          endIndex: 28,
        },
        startIndex: 15,
        maxCount: 50,
        step: 1,
        maxIndex: 100,
      });
      console.log('get indices 5 ', finalizeIndices(recycler.getIndices()));
    });
  });
};
