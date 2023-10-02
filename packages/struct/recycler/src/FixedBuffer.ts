import IntegerBufferSet from '@x-oasis/integer-buffer-set';
import { SafeRange, FixedBufferProps, ItemMeta } from './types';
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

  private _owner: any;

  private _startIndex: number;
  private _recyclerType: string;
  private _indices: Array<number> = [];
  private _recyclerReservedBufferSize: number;

  private _indicesCopy = [];
  private _itemMetaIndices = [];
  private _positionToItemMetaMap = [];

  constructor(props?: FixedBufferProps) {
    const {
      bufferSize = RECYCLER_BUFFER_SIZE,
      thresholdIndexValue = 0,
      recyclerReservedBufferSize = RECYCLER_BUFFER_SIZE,
      recyclerType = DEFAULT_RECYCLER_TYPE,
      // owner,
      startIndex,
      metaExtractor,
      indexExtractor,
    } = props;
    // this._size = size;
    // this._owner = owner;
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

  // get size() {
  //   return this._size;
  // }

  get thresholdIndexValue() {
    return this._thresholdIndexValue;
  }

  get recyclerType() {
    return this._recyclerType;
  }

  // getPosition(
  //   rowIndex: number,
  //   startIndex: number,
  //   endIndex: number,
  //   itemMeta: ItemMeta
  // ) {
  //   if (rowIndex < 0) return null;
  //   // 初始化的item不参与absolute替换
  //   if (rowIndex < this._thresholdIndexValue) return null;
  //   let position = this._bufferSet.getValuePosition(rowIndex);

  //   // 当通过rowIndex找到了对应的position以后不能够直接用。这个时候还要做一次
  //   // itemMeta验证；因为item才是第一等级。确保的是item不变的情况下，能够复用。
  //   // if (isValidPosition(position)) {
  //   //   const originalItemMeta = this._itemMetaIndices[position];
  //   //   console.log('origin ', originalItemMeta)
  //   //   if (originalItemMeta && originalItemMeta !== itemMeta) position = null;
  //   // }

  //   console.log(
  //     'position ',
  //     position,
  //     position === null,
  //     this._bufferSet.getSize(),
  //     this.size,
  //     this._bufferSet.getSize() >= this.size
  //   );
  //   if (position === null && this._bufferSet.getSize() >= this.size) {
  //     console.log('repalce =====');
  //     position = this._bufferSet.replaceFurthestValuePosition(
  //       startIndex,
  //       endIndex,
  //       rowIndex
  //     );
  //   }

  //   if (position === null) {
  //     position = this._bufferSet.getNewPositionForValue(rowIndex);
  //   }

  //   return position;
  // }

  place(index: number, itemMeta: ItemMeta, safeRange: SafeRange) {
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
