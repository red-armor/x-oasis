import Heap from '@x-oasis/heap';
import isClamped from '@x-oasis/is-clamped';
import invariant from '@x-oasis/invariant';
import returnHook, { ReturnHook } from '@x-oasis/return-hook';
import {
  HeapItem,
  SafeRange,
  MetaExtractor,
  IndexExtractor,
  IntegerBufferSetProps,
  // ValueToPositionObject,
  MetaToIndexMap,
  MetaToPositionMap,
  IndexToMetaMap,
} from './types';

const defaultMetaExtractor = (value) => value;
export const defaultBufferSize = 10;
const isNumber = (v) => typeof v === 'number';
const isUndefined = (val: any) => val === undefined;

// !!!!! should do meta validation...meta should has an index...
// value: original data `index` value
// value(index) => meta => position
// `index to getIndices, meta to find index`

// Data structure that allows to store values and assign positions to them
// in a way to minimize changing positions of stored values when new ones are
// added or when some values are replaced. Stored elements are alwasy assigned
// a consecutive set of positoins startin from 0 up to count of elements less 1
// Following actions can be executed
// * get position assigned to given value (null if value is not stored)
// * create new entry for new value and get assigned position back
// * replace value that is furthest from specified value range with new value
//   and get it's position back
// All operations take amortized log(n) time where n is number of elements in
// the set.
// feature: add / delete / update item will also in consider..
class IntegerBufferSet<Meta = any> {
  private _size: number;
  private _name: string;
  private _bufferSize: number;
  // private _positionToValueObject: ValueToPositionObject;

  private _indexToMetaMap: IndexToMetaMap<Meta>;
  private _metaToPositionMap: MetaToPositionMap<Meta>;
  private _positionToMetaList: Array<Meta>;
  private _metaToIndexMap: MetaToIndexMap<Meta>;

  private _smallValues: Heap<HeapItem>;
  private _largeValues: Heap<HeapItem>;
  private _metaExtractor: MetaExtractor<Meta>;
  private _indexExtractor: IndexExtractor<Meta>;

  private _onTheFlyIndices: Array<Meta>;

  private _isOnTheFlyFull: boolean;
  private _isOnTheFlyFullReturnHook: ReturnHook;

  private _loopMS: number;
  private _lastUpdatedMS: number;

  constructor(props: IntegerBufferSetProps<Meta> = {}) {
    const {
      name = 'default_buffer',
      indexExtractor,
      bufferSize = defaultBufferSize,
      metaExtractor = defaultMetaExtractor,
    } = props;
    this._metaExtractor = metaExtractor;
    this._indexExtractor = indexExtractor;

    this._name = name;
    // this._positionToValueObject = {};

    /**
     * this._indexToMetaMap is used to find the prev meta when finding a position for index.
     */
    this._indexToMetaMap = new Map();
    this._metaToPositionMap = new Map();
    this._positionToMetaList = [];
    this._metaToIndexMap = new Map();
    this._onTheFlyIndices = [];

    this._size = 0;
    this._bufferSize = bufferSize;

    this._smallValues = new Heap([], this._smallerComparator);
    this._largeValues = new Heap([], this._greaterComparator);

    this.getNewPositionForIndex = this.getNewPositionForIndex.bind(this);
    this.getIndexPosition = this.getIndexPosition.bind(this);
    this.getSize = this.getSize.bind(this);
    this.replacePositionInFliedIndices =
      this.replacePositionInFliedIndices.bind(this);
    this.replaceFurthestIndexPosition =
      this.replaceFurthestIndexPosition.bind(this);
    this._isOnTheFlyFullReturnHook = returnHook(
      this.setIsOnTheFlyFull.bind(this)
    );

    this._loopMS = Date.now();
    this._lastUpdatedMS = this._loopMS;
  }

  getSize() {
    return this._size;
  }

  get bufferSize() {
    return this._bufferSize;
  }

  setIsOnTheFlyFull(val: any) {
    if (val != null) {
      const data = this._onTheFlyIndices.filter((v) => v);
      this._isOnTheFlyFull = data.length === this._bufferSize;
    }
  }

  get isBufferFull() {
    return this._positionToMetaList.length >= this._bufferSize;
  }

  getOnTheFlyUncriticalPosition(safeRange: SafeRange) {
    const { startIndex, endIndex } = safeRange;
    for (let idx = 0; idx < this._onTheFlyIndices.length; idx++) {
      const meta = this._onTheFlyIndices[idx];
      const metaIndex = this._metaToIndexMap.get(meta);
      if (!isClamped(startIndex, metaIndex, endIndex)) {
        return idx;
      }
    }
    return null;
  }

  initialize() {
    return {
      smallValues: new Heap([], this._smallerComparator),
      largeValues: new Heap([], this._greaterComparator),
      valueToPositionObject: {},
    };
  }

  getIndexMeta(index: number) {
    return this._metaExtractor(index);
  }

  getMetaIndex(meta: Meta) {
    if (this._indexExtractor) return this._indexExtractor(meta);
    return this._metaToIndexMap.get(meta);
  }

  setMetaIndex(meta: Meta, index: number) {
    if (!this._indexExtractor) {
      return this._metaToIndexMap.set(meta, index);
    }
    return false;
  }

  deleteMetaIndex(meta: Meta) {
    return this._metaToIndexMap.delete(meta);
  }

  replaceMetaToIndexMap(newMetaToIndexMap: MetaToIndexMap<Meta>) {
    if (!this._indexExtractor) {
      return (this._metaToIndexMap = newMetaToIndexMap);
    }
    return false;
  }

  getIndexPosition(index: number): undefined | number {
    return this.getMetaIndex(this.getIndexMeta(index));
  }

  getNewPositionForIndex(index: number) {
    const meta = this.getIndexMeta(index);
    invariant(
      this._metaToPositionMap.get(meta) === undefined,
      "Shouldn't try to find new position for value already stored in BufferSet"
    );
    const newPosition = this._positionToMetaList.length;

    this._pushToHeaps(newPosition, index);
    this._setMetaIndex(meta, index);
    this._setMetaPosition(meta, newPosition);

    return newPosition;
  }

  getMinValue() {
    return this._smallValues.peek()?.value;
  }

  getMaxValue() {
    return this._largeValues.peek()?.value;
  }

  /**
   * values actually is the position of original data.
   */
  setValuePosition(value: number, position: number) {}

  findPositionMeta(position: number) {
    for (const [meta, pos] of this._metaToPositionMap) {
      if (pos === position) return meta;
    }
    return null;
  }

  rebuildHeapsWithMeta(metaToPositionMap: MetaToPositionMap<Meta>) {
    const { smallValues, largeValues } = this.initialize();

    for (const [meta, position] of metaToPositionMap) {
      const index = this.getMetaIndex(meta);
      const token = { index, position };
      smallValues.push(token);
      largeValues.push(token);
    }

    this._smallValues = smallValues;
    this._largeValues = largeValues;
  }

  /**
   *
   * @param position
   * @param value
   *
   *
   */
  setPositionIndex(position: number, index: number) {
    const meta = this._metaExtractor(index);
    const originalPosition = this._metaToPositionMap.get(meta);

    // current index has a position
    if (originalPosition !== undefined) {
      if (originalPosition === position) return true;
      this.deleteMetaIndex(meta);
    }

    const metaToReplace = this.findPositionMeta(position);
    if (metaToReplace) this._metaToPositionMap.delete(metaToReplace);
    this._metaToPositionMap.set(meta, position);

    this.rebuildHeapsWithMeta(this._metaToPositionMap);
    return true;
  }

  getMetaPosition(meta: Meta) {
    return this._metaToPositionMap.get(meta);
  }

  // performRangeUpdate(
  //   startIndex: number,
  //   endIndex: number,
  //   safeRange: {
  //     startIndex: number;
  //     endIndex: number;
  //   }
  // ) {
  //   const _start = Math.max(startIndex, safeRange.startIndex);
  //   const _end = Math.min(endIndex, safeRange.endIndex);
  //   const primaryMetaList = [];
  //   const secondaryMetaList = [];
  //   const locationStartIndex = startIndex;
  //   const targetIndices = new Array(this._bufferSize);

  //   const _valueToPositionObject = {};
  //   const _positionToValueObject = {};

  //   const _valueToMetaObject = {};
  //   const _metaToIndexMap = new Map();

  //   for (let value = startIndex; value <= endIndex; value++) {
  //     const meta = this._metaExtractor(value);
  //     if (meta) {
  //       const _i = value - locationStartIndex;
  //       if (isClamped(value, safeRange.startIndex, safeRange.endIndex)) {
  //         primaryMetaList[_i] = meta;
  //         const targetIndex = this.getMetaPosition(meta);
  //         if (isNumber(targetIndex)) {
  //           targetIndices[targetIndex] = value;
  //           _valueToPositionObject[value] = targetIndex;
  //           _valueToMetaObject[value] = meta;
  //           _metaToIndexMap.set(meta, value);
  //           _positionToValueObject[targetIndex] = value;
  //         }
  //       } else {
  //         secondaryMetaList[_i] = meta;
  //       }
  //     }
  //   }

  // for (let idx = _start; idx <= _end; idx++) {
  //   const meta = this._metaExtractor(idx);
  //   if (_metaToIndexMap.get(meta) !== undefined) continue;
  //   let p;
  //   while (
  //     (p =
  //       targetIndices[
  //         this.resolvePosition(safeRange.startIndex, safeRange.endIndex, idx)
  //       ]) === undefined
  //   ) {
  //     targetIndices[p] = idx;
  //   }
  // }
  // }

  replacePositionInFliedIndices(newIndex: number, safeRange: SafeRange) {
    const { startIndex, endIndex } = safeRange;

    if (this._isOnTheFlyFull) {
      // newIndex is not critical index, do nothing
      if (!isClamped(startIndex, newIndex, endIndex)) {
        return null;
      }
      // if `newIndex` is critical index, replace an un-committed
      // index value from _onTheFlyIndices.
      const pos = this.getOnTheFlyUncriticalPosition(safeRange);
      if (pos != null) return pos;
    }
    return null;
  }

  getFliedPosition(newIndex: number, safeRange: SafeRange) {
    const pos = this.replacePositionInFliedIndices(newIndex, safeRange);
    if (pos != null) {
      const meta = this.getIndexMeta(newIndex);
      this._onTheFlyIndices[pos] = meta;
      this._setMetaIndex(meta, newIndex);
      return this._isOnTheFlyFullReturnHook(pos);
    }
    return null;
  }

  /**
   *
   * @param newIndex
   * @param safeRange
   * @returns
   *
   *
   * _positionToMetaList maybe undefined on next loop
   */
  getPosition(newIndex: number, safeRange?: SafeRange) {
    this.prepare();
    const meta = this.getIndexMeta(newIndex);
    const prevMetaPosition = this._metaToPositionMap.get(meta);

    if (prevMetaPosition !== undefined) {
      const onTheFlyPositionMeta = this._onTheFlyIndices[prevMetaPosition];
      // the occupied meta should change position
      if (onTheFlyPositionMeta) {
        // such as place item 11 twice...
        if (onTheFlyPositionMeta === meta) {
          return prevMetaPosition;
        }
        let positionToReplace = this._replaceFurthestIndexPosition(
          newIndex,
          safeRange
        );
        if (this._isOnTheFlyFull)
          return this.getFliedPosition(newIndex, safeRange);

        while (this._onTheFlyIndices[positionToReplace]) {
          positionToReplace = this._replaceFurthestIndexPosition(
            newIndex,
            safeRange
          );
        }

        if (positionToReplace != null) {
          this._setMetaIndex(meta, newIndex);
          this._onTheFlyIndices[positionToReplace] = onTheFlyPositionMeta;
          return this._isOnTheFlyFullReturnHook(positionToReplace);
        }
      }
      this._onTheFlyIndices[prevMetaPosition] = meta;
      return this._isOnTheFlyFullReturnHook(prevMetaPosition);
    }

    // placed on new buffered position
    if (!this.isBufferFull)
      return this._isOnTheFlyFullReturnHook(
        this.getNewPositionForIndex(newIndex)
      );

    // console.log('this. fly ', this._isOnTheFlyFull)
    if (this._isOnTheFlyFull) return this.getFliedPosition(newIndex, safeRange);

    let positionToReplace;
    const prevIndexMeta = this._indexToMetaMap.get(newIndex);
    // console.log('this. is ', this.isBufferFull, prevIndexMeta);

    // Index has already been stored, but we cant use its old position directly...
    // 1：index -> meta, meta may be reused later

    // 2: temp use index -> meta -> position, this issue should exist for follows...
    if (!prevIndexMeta) {
      this._cleanHeaps();
      positionToReplace = this._replaceFurthestIndexPosition(
        newIndex,
        safeRange
      );
    } else {
      positionToReplace = this._metaToPositionMap.get(prevIndexMeta);
    }

    this._onTheFlyIndices[positionToReplace] = meta;
    this._setMetaIndex(meta, newIndex);
    this._setMetaPosition(meta, positionToReplace);
    // should not push to heap, pop only
    // this._pushToHeaps(positionToReplace, newIndex)

    // console.log('on the x fly ', positionToReplace, this._onTheFlyIndices);

    return this._isOnTheFlyFullReturnHook(positionToReplace);
  }

  replaceFurthestIndexPosition(
    newIndex: number,
    safeRange?: {
      startIndex: number;
      endIndex: number;
    }
  ) {
    if (!this.isBufferFull) {
      return this._isOnTheFlyFullReturnHook(
        this.getNewPositionForIndex(newIndex)
      );
    }

    return this._replaceFurthestIndexPosition(newIndex, safeRange);
  }

  _replaceFurthestIndexPosition(
    newIndex: number,
    safeRange?: {
      startIndex: number;
      endIndex: number;
    }
  ) {
    if (this._largeValues.empty() || this._smallValues.empty()) {
      return this._isOnTheFlyFullReturnHook(
        this.getNewPositionForIndex(newIndex)
      );
    }

    const minValue = this._smallValues.peek()!.value;
    const maxValue = this._largeValues.peek()!.value;

    // console.log('mxa ', maxValue, minValue);
    let indexToReplace;

    if (!safeRange) {
      // far from min
      if (Math.abs(newIndex - minValue) > Math.abs(newIndex - maxValue)) {
        indexToReplace = minValue;
        this._smallValues.pop();
      } else {
        indexToReplace = maxValue;
        this._largeValues.pop();
      }
      const replacedMeta = this._indexToMetaMap.get(indexToReplace);
      const position = this._metaToPositionMap.get(replacedMeta);

      return position;
    }

    const { startIndex: lowValue, endIndex: highValue } = safeRange;

    // All values currently stored are necessary, we can't reuse any of them.
    if (
      isClamped(lowValue, minValue, highValue) &&
      isClamped(lowValue, maxValue, highValue)
    ) {
      return null;
    } else if (
      isClamped(lowValue, minValue, highValue) &&
      !isClamped(lowValue, maxValue, highValue)
    ) {
      indexToReplace = maxValue;
      this._largeValues.pop();
    } else if (
      !isClamped(lowValue, minValue, highValue) &&
      isClamped(lowValue, maxValue, highValue)
    ) {
      indexToReplace = minValue;
      this._smallValues.pop();
    } else if (lowValue - minValue > maxValue - highValue) {
      // minValue is further from provided range. We will reuse it's position.
      indexToReplace = minValue;
      this._smallValues.pop();
    } else {
      indexToReplace = maxValue;
      this._largeValues.pop();
    }

    const replacedMeta = this._indexToMetaMap.get(indexToReplace);
    const position = this._metaToPositionMap.get(replacedMeta);

    return position;
  }

  shuffle() {
    const indices = new Array(this.bufferSize);
    for (let idx = 0; idx < indices.length; idx++) {
      const meta = this._onTheFlyIndices[idx] || this._positionToMetaList[idx];
      const targetIndex = this.getMetaIndex(meta);
      indices[idx] = targetIndex;
    }

    // console.log(
    //   'position xxx ',
    //   this._positionToMetaList,
    //   this._onTheFlyIndices
    // );

    const _arr = new Array(indices.length);
    const _available = [];
    const indexToMetaMap = new Map();
    const metaToIndexMap = new Map();
    const metaToPositionMap = new Map();
    for (let idx = 0; idx < indices.length; idx++) {
      const currentIndex = indices[idx];
      const currentMeta = this._metaExtractor(currentIndex);
      if (currentMeta == null) continue;

      indexToMetaMap.set(currentIndex, currentMeta);
      metaToIndexMap.set(currentMeta, currentIndex);

      if (currentMeta === this._positionToMetaList[idx]) {
        _arr[idx] = currentMeta;
        continue;
      }
      const _i = this._positionToMetaList.findIndex((v) => v === currentMeta);
      if (_i !== -1) {
        _arr[_i] = currentMeta;
        continue;
      }

      _available.push(currentMeta);
    }

    // console.log('available ', _available);

    const { smallValues, largeValues } = this.initialize();
    const positionToMetaList = [];

    for (let position = 0; position < indices.length; position++) {
      const value = indices[position];
      if (_arr[position] != null) {
        positionToMetaList[position] = _arr[position];
        metaToPositionMap.set(_arr[position], position);
        const element = { position, value };
        smallValues.push(element);
        largeValues.push(element);
        continue;
      }
      const meta = _available.shift();
      if (meta != null) {
        positionToMetaList[position] = meta;
        metaToPositionMap.set(meta, position);

        const element = { position, value };
        smallValues.push(element);
        largeValues.push(element);
      }
    }

    // console.log('position ', positionToMetaList, largeValues.peek().value);

    this._positionToMetaList = positionToMetaList;
    this._smallValues = smallValues;
    this._largeValues = largeValues;
    this._indexToMetaMap = indexToMetaMap;
    this.replaceMetaToIndexMap(metaToIndexMap);
    this._metaToPositionMap = metaToPositionMap;
    this._onTheFlyIndices = [];

    try {
      const indices = new Array(this.bufferSize);
      for (let idx = 0; idx < indices.length; idx++) {
        const meta =
          this._onTheFlyIndices[idx] || this._positionToMetaList[idx];
        const targetIndex = this.getMetaIndex(meta);
        if (meta != null) {
          indices[idx] = {
            meta,
            targetIndex,
            recyclerKey: `${this._name}_${idx}`,
          };
        }
      }
      return indices;
    } catch (err) {
      this.readyToStartNextLoop();
      return this._positionToMetaList;
    }
  }

  // key point: `meta` should be preserved..
  getIndices() {
    try {
      const indices = new Array(this.bufferSize);
      for (let idx = 0; idx < indices.length; idx++) {
        const meta =
          this._onTheFlyIndices[idx] || this._positionToMetaList[idx];
        const targetIndex = this.getMetaIndex(meta);
        // which means source data has changed. such as one element has been deleted
        if (meta !== this.getIndexMeta(targetIndex)) {
          return this.shuffle();
        }
        if (meta != null) {
          indices[idx] = {
            meta,
            targetIndex,
            recyclerKey: `${this._name}_${idx}`,
          };
        }
      }
      // clear on the fly indices after return indices.
      this._onTheFlyIndices = [];

      return indices;
    } catch (err) {
      this.readyToStartNextLoop();
      return this._positionToMetaList;
    }
  }

  _pushToHeaps(position: number, value: number) {
    const element = { position, value };
    // We can reuse the same object in both heaps, because we don't mutate them
    this._smallValues.push(element);
    this._largeValues.push(element);
  }

  _setMetaPosition(meta: Meta, position: number) {
    const prevMetaOnPosition = this._positionToMetaList[position];
    if (prevMetaOnPosition) this._metaToPositionMap.delete(prevMetaOnPosition);
    this._positionToMetaList[position] = meta;
    this._metaToPositionMap.set(meta, position);
  }

  /**
   *
   * @param meta
   * @param index
   * @returns true means index not changed
   */
  _setMetaIndex(meta: Meta, index: number) {
    const prevMetaIndex = this.getMetaIndex(meta);
    if (prevMetaIndex !== undefined) {
      // no need to set
      // if (prevMetaIndex === index) return true;
      this._indexToMetaMap.delete(prevMetaIndex);
    }
    this.setMetaIndex(meta, index);
    this._indexToMetaMap.set(index, meta);
    return false;
  }

  readyToStartNextLoop() {
    this._lastUpdatedMS = Date.now();
  }

  prepare() {
    if (this._loopMS === this._lastUpdatedMS) return;
    this._loopMS = this._lastUpdatedMS;

    this._onTheFlyIndices = [];
    this._isOnTheFlyFull = false;
    const len = this._positionToMetaList.length;

    for (let index = 0; index < len; index++) {}
  }

  _cleanHeaps() {
    // We not usually only remove object from one heap while moving value.
    // Here we make sure that there is no stale data on top of heaps.
    this._cleanHeap(this._smallValues);
    this._cleanHeap(this._largeValues);
    const minHeapSize = Math.min(
      this._smallValues.size(),
      this._largeValues.size()
    );
    const maxHeapSize = Math.max(
      this._smallValues.size(),
      this._largeValues.size()
    );
    if (maxHeapSize > 10 * minHeapSize) {
      // There are many old values in one of heaps. We need to get rid of them
      // to not use too avoid memory leaks
      this._recreateHeaps();
    }
  }

  rebuildHeapsWithValues(
    arr: Array<{
      position: number;
      value: number;
    }>
  ) {
    const valueToPositionObject = {};
    const newSmallValues = new Heap<HeapItem>([], this._smallerComparator);
    const newLargeValues = new Heap<HeapItem>([], this._greaterComparator);

    arr.forEach((element) => {
      const { position, value } = element;
      if (value !== undefined) {
        const element = {
          position,
          value,
        };
        newSmallValues.push(element);
        newLargeValues.push(element);
        valueToPositionObject[value] = position;
      }
    });
    const _arr = new Array(this._bufferSize).fill(2);
    Object.keys(valueToPositionObject).map(
      (key) => (_arr[valueToPositionObject[key]] = 1)
    );
    _arr.forEach((_i, position) => {
      if (_i === 2) {
        const value = Number.MAX_SAFE_INTEGER - position;
        const element = {
          position,
          value,
        };

        newSmallValues.push(element);
        newLargeValues.push(element);
        valueToPositionObject[value] = position;
      }
    });
    this._smallValues = newSmallValues;
    this._largeValues = newLargeValues;
  }

  // rebuildHeaps() {
  //   const valueToPositionObject = {};
  //   const newSmallValues = new Heap<HeapItem>([], this._smallerComparator);
  //   const newLargeValues = new Heap<HeapItem>([], this._greaterComparator);

  //   const keys = Object.keys(this._positionToValueObject);
  //   for (let position = 0; position < keys.length; position++) {
  //     const value = this._positionToValueObject[position];
  //     if (value !== undefined) {
  //       const element = {
  //         position,
  //         value,
  //       };
  //       valueToPositionObject[value] = position;
  //       newSmallValues.push(element);
  //       newLargeValues.push(element);
  //     }
  //   }

  //   this._smallValues = newSmallValues;
  //   this._largeValues = newLargeValues;
  // }

  _recreateHeaps() {
    const sourceHeap =
      this._smallValues.size() < this._largeValues.size()
        ? this._smallValues
        : this._largeValues;
    const newSmallValues = new Heap<HeapItem>(
      [], // Initial data in the heap
      this._smallerComparator
    );
    const newLargeValues = new Heap<HeapItem>(
      [], // Initial datat in the heap
      this._greaterComparator
    );
    while (!sourceHeap.empty()) {
      const element = sourceHeap.pop()!;
      // Push all still valid elements to new heaps
      if (
        this._metaToPositionMap.get(this._indexToMetaMap.get(element.value)) !=
        null
      ) {
        newSmallValues.push(element);
        newLargeValues.push(element);
      }
    }
    this._smallValues = newSmallValues;
    this._largeValues = newLargeValues;
  }

  _cleanHeap(heap: Heap<HeapItem>) {
    while (
      !heap.empty() &&
      this._metaToPositionMap.get(
        this._indexToMetaMap.get(heap.peek()!.value)
      ) == null
    ) {
      heap.pop();
    }
  }

  _smallerComparator(lhs: HeapItem, rhs: HeapItem) {
    return lhs.value < rhs.value;
  }

  _greaterComparator(lhs: HeapItem, rhs: HeapItem) {
    return lhs.value > rhs.value;
  }
}

export default IntegerBufferSet;
