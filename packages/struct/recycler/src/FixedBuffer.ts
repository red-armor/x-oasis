import IntegerBufferSet from '../../integer-buffer-set';
import {
  SafeRange,
  FixedBufferProps,
  ItemMeta,
  FixedBufferState,
} from './types';
import { DEFAULT_RECYCLER_TYPE, RECYCLER_BUFFER_SIZE } from './common';

const isValidPosition = (val: any) => typeof val === 'number';

class FixedBuffer {
  private _bufferSet: IntegerBufferSet;
  /**
   * buffer size, the oversize node will run into recycle strategy
   */
  private _size;
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
      size = 10,
      thresholdIndexValue = 0,
      recyclerReservedBufferSize = RECYCLER_BUFFER_SIZE,
      recyclerType = DEFAULT_RECYCLER_TYPE,
      owner,
      startIndex,
    } = props;
    this._size = size;
    this._owner = owner;
    this._startIndex = startIndex;
    this._bufferSet = new IntegerBufferSet({
      bufferSize: 12,
    });
    this._recyclerType = recyclerType;
    this._thresholdIndexValue = thresholdIndexValue;
    this._recyclerReservedBufferSize = recyclerReservedBufferSize;
  }

  get size() {
    return this._size;
  }

  get thresholdIndexValue() {
    return this._thresholdIndexValue;
  }

  get recyclerType() {
    return this._recyclerType;
  }

  getPosition(
    rowIndex: number,
    startIndex: number,
    endIndex: number,
    itemMeta: ItemMeta
  ) {
    if (rowIndex < 0) return null;
    // 初始化的item不参与absolute替换
    if (rowIndex < this._thresholdIndexValue) return null;
    let position = this._bufferSet.getValuePosition(rowIndex);

    // 当通过rowIndex找到了对应的position以后不能够直接用。这个时候还要做一次
    // itemMeta验证；因为item才是第一等级。确保的是item不变的情况下，能够复用。
    // if (isValidPosition(position)) {
    //   const originalItemMeta = this._itemMetaIndices[position];
    //   console.log('origin ', originalItemMeta)
    //   if (originalItemMeta && originalItemMeta !== itemMeta) position = null;
    // }

    console.log(
      'position ',
      position,
      position === null,
      this._bufferSet.getSize(),
      this.size,
      this._bufferSet.getSize() >= this.size
    );
    if (position === null && this._bufferSet.getSize() >= this.size) {
      console.log('repalce =====');
      position = this._bufferSet.replaceFurthestValuePosition(
        startIndex,
        endIndex,
        rowIndex
      );
    }

    if (position === null) {
      position = this._bufferSet.getNewPositionForValue(rowIndex);
    }

    return position;
  }

  place(index: number, itemMeta: ItemMeta, safeRange: SafeRange) {
    let position = this._itemMetaIndices.findIndex((meta) => meta === itemMeta);

    // console.log('place ', index, position)

    if (position !== -1) {
      this._positionToItemMetaMap[position] = itemMeta;

      this._indices[position] = index;

      const _index = this._indicesCopy.findIndex((d) => d === index);

      if (_index !== -1 && _index !== position) {
        this._bufferSet.setPositionValue(position, index);
        this._indicesCopy.splice(_index, 1, this._indicesCopy[position]);
      }
      return position;
    }
    position = this.getPosition(
      index,
      safeRange.startIndex,
      safeRange.endIndex,
      itemMeta
    );
    // console.log('position ======', position);
    if (typeof position === 'number') {
      this._indices[position] = index;
      this._positionToItemMetaMap[position] = itemMeta;
    }
    return position;
  }

  getMaxValue() {
    return this._bufferSet.getMaxValue();
  }

  getMinValue() {
    return this._bufferSet.getMinValue();
  }

  getIndices() {
    return this._bufferSet.indices;
  }

  getState(): FixedBufferState {
    const arr = new Array(this._recyclerReservedBufferSize);
    const nextItemMetaIndices = new Array(this._recyclerReservedBufferSize);

    console.log('getState position ', this._positionToItemMetaMap.slice());
    console.log('_indicesCopy ', this._indicesCopy.slice());

    const group = [];

    for (let idx = 0; idx < this._recyclerReservedBufferSize; idx++) {
      if (this._positionToItemMetaMap[idx]) {
        const targetIndex = this._indices[idx];
        const itemMeta = this._positionToItemMetaMap[idx];
        arr[idx] = {
          itemMeta,
          targetIndex,
          recycleKey: `recycle_${this._startIndex + idx}`,
        };
        nextItemMetaIndices[idx] = itemMeta;
        group.push({
          position: idx,
          value: targetIndex,
        });
        console.log('x');
      } else if (typeof this._indicesCopy[idx] === 'number') {
        const targetIndex = this._indicesCopy[idx];
        const data = this._owner.getData() || [];
        const item = data[targetIndex];
        console.log('xxxx=======', idx, item);
        if (item) {
          const itemMeta = this._owner.getFinalItemMeta(item);

          const position = this._itemMetaIndices.findIndex(
            (meta) => meta === itemMeta
          );

          // console.log(
          //   'itemm meta ',
          //   idx,
          //   position,
          //   targetIndex,
          //   itemMeta,
          //   this.recyclerType
          // );
          if (position !== -1) {
            arr[position] = {
              itemMeta,
              targetIndex,
              recycleKey: `recycle_${this._startIndex + idx}`,
            };
            nextItemMetaIndices[position] = itemMeta;
            group.push({
              position,
              value: targetIndex,
            });
          }
        }
      }
    }

    console.log('group == ', group);

    this._bufferSet.rebuildHeapsWithValues(group);

    this._itemMetaIndices = nextItemMetaIndices;
    this._positionToItemMetaMap = [];
    this._indicesCopy = this._bufferSet.indices.map((i) => parseInt(i));
    console.log(
      'nextItemMetaIndices ',
      nextItemMetaIndices.slice(),
      this._indicesCopy.slice()
    );

    return arr;
  }
}

export default FixedBuffer;
