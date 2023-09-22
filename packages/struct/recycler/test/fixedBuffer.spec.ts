import { describe, it, expect } from 'vitest';
import FixedBuffer from '../src/FixedBuffer';
import { FixedBufferState } from '../src/types';

type Item = {
  key: string;
  label: string;
};

const finalizeState = (state: FixedBufferState) =>
  state.map((s) => s?.targetIndex);

const buildData = (count: number, startIndex = 0) => {
  const arr = [] as Array<Item>;
  for (let idx = 0; idx < count; idx++) {
    arr.push({ key: `data_${idx}`, label: `label_${startIndex + idx}` });
  }

  return arr;
};

describe('basic', () => {
  it('constructor', () => {
    const data = buildData(100);

    // @ts-ignore
    data.getFinalItemMeta = () => ({ recyclerType: 'default' });
    // @ts-ignore
    data.getData = () => data;

    const buffer = new FixedBuffer({
      owner: data,
    });

    const safeRange = { startIndex: 0, endIndex: 9 };
    buffer.place(0, data[0], safeRange);
    expect(finalizeState(buffer.getState())).toEqual([
      0,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
    ]);
    buffer.place(1, data[1], safeRange);
    buffer.place(2, data[2], safeRange);
    buffer.place(3, data[3], safeRange);
    buffer.place(4, data[4], safeRange);
    buffer.place(5, data[5], safeRange);
    buffer.place(6, data[6], safeRange);
    buffer.place(7, data[7], safeRange);
    buffer.place(8, data[8], safeRange);
    buffer.place(9, data[9], safeRange);
    buffer.place(10, data[10], safeRange);
    buffer.place(11, data[11], safeRange);

    expect(finalizeState(buffer.getState())).toEqual([
      0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12,
    ]);
  });
});
