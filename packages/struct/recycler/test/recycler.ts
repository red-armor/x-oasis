import Recycler from '../src';
import { describe, it, beforeEach, expect } from 'vitest';

export const basicSuite = (desc, data, fn?: any) => {
  describe('basic', () => {
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
    });
  });
};
