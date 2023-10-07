import IntegerBufferSet from '@x-oasis/integer-buffer-set';
import { OnProcess, RecyclerProps } from './types';
import {
  DEFAULT_RECYCLER_TYPE,
  RECYCLER_BUFFER_SIZE,
  RECYCLER_RESERVED_BUFFER_PER_BATCH,
  RECYCLER_THRESHOLD_INDEX_VALUE,
} from './common';

class Recycler {
  private _queue: Array<IntegerBufferSet> = [];

  /**
   * start index
   */
  private _thresholdIndexValue = 0;
  private _recyclerReservedBufferPerBatch: number;
  /**
   * buffer size, the oversize node will run into recycle strategy
   */
  private _recyclerBufferSize: number;
  private _metaExtractor: (index: number) => any;
  private _indexExtractor: (meta: any) => number;
  private _getType: (index: number) => string;

  constructor(props?: RecyclerProps) {
    const {
      getType,
      metaExtractor,
      indexExtractor,
      recyclerTypes = [],
      recyclerBufferSize = RECYCLER_BUFFER_SIZE,
      thresholdIndexValue = RECYCLER_THRESHOLD_INDEX_VALUE,
      recyclerReservedBufferPerBatch = RECYCLER_RESERVED_BUFFER_PER_BATCH,
    } = props || {};

    this._metaExtractor = metaExtractor;
    this._indexExtractor = indexExtractor;
    this._getType = getType;
    this._recyclerBufferSize = recyclerBufferSize;
    this._thresholdIndexValue = thresholdIndexValue;
    this._recyclerReservedBufferPerBatch = recyclerReservedBufferPerBatch;
    recyclerTypes.forEach((type) => this.addBuffer(type));
  }

  get queue() {
    return this._queue;
  }

  get thresholdIndexValue() {
    return this._thresholdIndexValue;
  }

  get recyclerReservedBufferPerBatch() {
    return this._recyclerReservedBufferPerBatch;
  }

  getIndices() {
    return this._queue.reduce((acc, cur) => acc.concat(cur.getIndices()), []);
  }

  addBuffer(type: string) {
    if (!type) return null;
    const index = this._queue.findIndex((buffer) => buffer.getType() === type);
    if (index !== -1) return this._queue[index];
    const buffer = new IntegerBufferSet({
      type,
      metaExtractor: this._metaExtractor,
      indexExtractor: this._indexExtractor,
      bufferSize: this._recyclerBufferSize,
    });
    this._queue.push(buffer);
    return buffer;
  }

  ensureBuffer(type: string) {
    return this.addBuffer(type || DEFAULT_RECYCLER_TYPE);
  }

  reset() {
    this.queue.forEach((buffer) => buffer.reset());
  }

  updateIndices(props: {
    /**
     * index in range should not be recycled
     */
    safeRange: {
      startIndex: number;
      endIndex: number;
    };
    startIndex: number;
    maxCount: number;
    step?: number;
    onProcess?: OnProcess;
  }) {
    const { startIndex, safeRange, step = 1, maxCount, onProcess } = props;
    let count = 0;
    let _index = Math.max(startIndex, 0);
    while (count < maxCount && this._metaExtractor(_index)) {
      if (_index >= this._thresholdIndexValue) {
        const recyclerType = this._getType(_index);
        const buffer = this.ensureBuffer(recyclerType);
        buffer.getPosition(_index, safeRange);

        if (
          typeof onProcess !== 'function' ||
          onProcess(recyclerType, _index)
        ) {
          count += 1;
        }
      }
      _index += step;
    }
  }

  getMinValue() {
    let minValue = Number.MAX_SAFE_INTEGER;
    this._queue.forEach((buffer) => {
      const v = buffer.getMinValue();
      if (typeof v === 'number') minValue = Math.min(v, minValue);
    });
    return minValue;
  }

  getMaxValue() {
    let maxValue = 0;
    this._queue.forEach((buffer) => {
      const v = buffer.getMaxValue();
      if (typeof v === 'number') maxValue = Math.max(v, maxValue);
    });
    return maxValue;
  }
}

export default Recycler;
