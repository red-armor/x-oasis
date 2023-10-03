import Recycler from '../src';
import { describe, it, beforeEach, expect } from 'vitest';

const extractRecycleKeyIndex = (val) => val.match(/_([0-9]*)/)[1];

const finalizeIndices = (indices) => {
  return indices.reduce((acc, cur) => {
    if (!cur) return acc;
    const { meta, recyclerKey } = cur;
    const type = meta.type;
    if (!acc[type]) acc[type] = [];
    const index = extractRecycleKeyIndex(recyclerKey);
    acc[type][index] = `${meta.index}_${type}`;
    return acc;
  }, {});
};

export const basicSuite = (desc, data, fn?: any) => {
  describe(`recycler - ${desc}`, () => {
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
      });

      expect(finalizeIndices(recycler.getIndices())).toEqual({
        mod3: ['3_mod3', '9_mod3', '21_mod3', '27_mod3', '33_mod3', '39_mod3'],
        mod5: [
          '0_mod5',
          '5_mod5',
          '10_mod5',
          '15_mod5',
          '20_mod5',
          '25_mod5',
          '30_mod5',
          '35_mod5',
          '40_mod5',
          '45_mod5',
        ],
        mod7: ['7_mod7', '49_mod7'],
        default: [
          '1_default',
          '11_default',
          '13_default',
          '17_default',
          '19_default',
          '23_default',
          '29_default',
          '31_default',
          '47_default',
          '43_default',
        ],
        mod2: [
          '2_mod2',
          '4_mod2',
          '6_mod2',
          '8_mod2',
          '38_mod2',
          '36_mod2',
          '34_mod2',
          '32_mod2',
          '28_mod2',
          '26_mod2',
        ],
      });

      recycler.updateIndices({
        safeRange: {
          startIndex: 12,
          endIndex: 20,
        },
        startIndex: 5,
        maxCount: 50,
      });

      expect(finalizeIndices(recycler.getIndices())).toEqual({
        mod3: [
          '3_mod3',
          '9_mod3',
          '21_mod3',
          '27_mod3',
          '33_mod3',
          '39_mod3',
          '51_mod3',
        ],
        mod5: [
          '0_mod5',
          '5_mod5',
          '10_mod5',
          '15_mod5',
          '20_mod5',
          '25_mod5',
          '30_mod5',
          '35_mod5',
          '40_mod5',
          '50_mod5',
        ],
        mod7: ['7_mod7', '49_mod7'],
        default: [
          '1_default',
          '11_default',
          '13_default',
          '17_default',
          '19_default',
          '23_default',
          '29_default',
          '53_default',
          '47_default',
          '43_default',
        ],
        mod2: [
          '52_mod2',
          '54_mod2',
          '6_mod2',
          '8_mod2',
          '38_mod2',
          '36_mod2',
          '34_mod2',
          '32_mod2',
          '28_mod2',
          '26_mod2',
        ],
      });

      recycler.updateIndices({
        safeRange: {
          startIndex: 20,
          endIndex: 28,
        },
        startIndex: 15,
        maxCount: 50,
      });

      expect(finalizeIndices(recycler.getIndices())).toEqual({
        mod3: [
          '3_mod3',
          '9_mod3',
          '21_mod3',
          '27_mod3',
          '33_mod3',
          '39_mod3',
          '51_mod3',
          '57_mod3',
          '63_mod3',
        ],
        mod5: [
          '55_mod5',
          '60_mod5',
          '10_mod5',
          '15_mod5',
          '20_mod5',
          '25_mod5',
          '30_mod5',
          '35_mod5',
          '40_mod5',
          '50_mod5',
        ],
        mod7: ['7_mod7', '49_mod7'],
        default: [
          '59_default',
          '61_default',
          '13_default',
          '17_default',
          '19_default',
          '23_default',
          '29_default',
          '53_default',
          '47_default',
          '43_default',
        ],
        mod2: [
          '52_mod2',
          '54_mod2',
          '56_mod2',
          '58_mod2',
          '38_mod2',
          '36_mod2',
          '34_mod2',
          '32_mod2',
          '28_mod2',
          '26_mod2',
        ],
      });

      fn.data.delete(20);

      recycler.updateIndices({
        safeRange: {
          startIndex: 20,
          endIndex: 28,
        },
        startIndex: 15,
        maxCount: 50,
      });
      expect(finalizeIndices(recycler.getIndices())).toEqual({
        mod3: [
          '3_mod3',
          '9_mod3',
          '21_mod3',
          '27_mod3',
          '33_mod3',
          '39_mod3',
          '51_mod3',
          '57_mod3',
          '63_mod3',
        ],
        mod5: [
          '55_mod5',
          '60_mod5',
          '65_mod5',
          '15_mod5',
          undefined,
          '25_mod5',
          '30_mod5',
          '35_mod5',
          '45_mod5',
          '50_mod5',
        ],
        mod7: ['7_mod7', '49_mod7'],
        default: [
          '59_default',
          '61_default',
          '31_default',
          '37_default',
          '19_default',
          '23_default',
          '41_default',
          '53_default',
          '47_default',
          '43_default',
        ],
        mod2: [
          '52_mod2',
          '54_mod2',
          '56_mod2',
          '58_mod2',
          '38_mod2',
          '36_mod2',
          '34_mod2',
          '32_mod2',
          '28_mod2',
          '26_mod2',
        ],
      });
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
        maxCount: 20,
      });

      expect(finalizeIndices(recycler.getIndices())).toEqual({
        mod3: ['3_mod3', '9_mod3'],
        mod5: ['0_mod5', '5_mod5', '10_mod5', '15_mod5'],
        mod7: ['7_mod7'],
        default: [
          '1_default',
          '11_default',
          '13_default',
          '17_default',
          '19_default',
        ],
        mod2: [
          '2_mod2',
          '4_mod2',
          '6_mod2',
          '8_mod2',
          '12_mod2',
          '14_mod2',
          '16_mod2',
          '18_mod2',
        ],
      });

      recycler.updateIndices({
        safeRange: {
          startIndex: 25,
          endIndex: 30,
        },
        startIndex: 20,
        maxCount: 5,
        onProcess: (type) => {
          if (type === 'mod3') return true;
          if (type === 'mod5') return true;
          return false;
        },
      });

      expect(finalizeIndices(recycler.getIndices())).toEqual({
        mod3: ['3_mod3', '9_mod3', '21_mod3', '27_mod3'],
        mod5: [
          '0_mod5',
          '5_mod5',
          '10_mod5',
          '15_mod5',
          '20_mod5',
          '25_mod5',
          '30_mod5',
        ],
        mod7: ['7_mod7'],
        default: [
          '1_default',
          '11_default',
          '13_default',
          '17_default',
          '19_default',
          '23_default',
          '29_default',
        ],
        mod2: [
          '26_mod2',
          '28_mod2',
          '6_mod2',
          '8_mod2',
          '12_mod2',
          '14_mod2',
          '16_mod2',
          '18_mod2',
          '22_mod2',
          '24_mod2',
        ],
      });
    });
  });
};
