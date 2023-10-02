import IntegerBufferSet from '@x-oasis/integer-buffer-set';
import { SafeRange, FixedBufferProps } from './types';
import { DEFAULT_RECYCLER_TYPE, RECYCLER_BUFFER_SIZE } from './common';

class FixedBuffer {
  private _bufferSet: IntegerBufferSet;
  /**
   * buffer size, the oversize node will run into recycle strategy
   */
  // private _size;
  /**
   * start index
   */
  private _thresholdIndexValue = 0;

  private _startIndex: number;
  private _recyclerType: string;
  private _indices: Array<number> = [];
  private _recyclerReservedBufferSize: number;

  private _indicesCopy = [];
  private _itemMetaIndices = [];
  private _positionToItemMetaMap = [];

  constructor(props: FixedBufferProps) {
    const {
      bufferSize = RECYCLER_BUFFER_SIZE,
      thresholdIndexValue = 0,
      recyclerReservedBufferSize = RECYCLER_BUFFER_SIZE,
      recyclerType = DEFAULT_RECYCLER_TYPE,
      startIndex,
      metaExtractor,
      indexExtractor,
    } = props;
    this._startIndex = startIndex;
    this._bufferSet = new IntegerBufferSet({
      bufferSize,
      metaExtractor,
      indexExtractor,
      name: recyclerType,
    });
    this._recyclerType = recyclerType;
    this._thresholdIndexValue = thresholdIndexValue;
    this._recyclerReservedBufferSize = recyclerReservedBufferSize;
  }

  get thresholdIndexValue() {
    return this._thresholdIndexValue;
  }

  get recyclerType() {
    return this._recyclerType;
  }

  place(index: number, safeRange: SafeRange) {
    if (this._recyclerType === 'mod5') console.log('index ', index, safeRange);
    this._bufferSet.getPosition(index, safeRange);
  }

  getMaxValue() {
    return this._bufferSet.getMaxValue();
  }

  getMinValue() {
    return this._bufferSet.getMinValue();
  }

  getIndices() {
    return this._bufferSet.getIndices();
  }
}

export default FixedBuffer;
