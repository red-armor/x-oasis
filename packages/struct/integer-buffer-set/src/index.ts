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
  MetaToIndexMap,
  MetaToPositionMap,
  IndexToMetaMap,
  BufferIndicesItem,
} from './types';

const defaultMetaExtractor = (value) => value;
const defaultBufferSize = 10;
const thresholdNumber = Number.MAX_SAFE_INTEGER - 100000;
const assertThresholdNumber = (val: any) =>
  typeof val === 'number' && val > thresholdNumber;

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
  private _type: string;
  private _bufferSize: number;

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
      type = 'default_buffer',
      indexExtractor,
      bufferSize = defaultBufferSize,
      metaExtractor = defaultMetaExtractor,
    } = props;
    this._metaExtractor = metaExtractor;
    this._indexExtractor = indexExtractor;

    this._type = type;

    this.initialize();

    this._bufferSize = bufferSize;

    this.getNewPositionForIndex = this.getNewPositionForIndex.bind(this);
    this.getIndexPosition = this.getIndexPosition.bind(this);
    this.replaceFurthestIndexPosition =
      this.replaceFurthestIndexPosition.bind(this);
    this._isOnTheFlyFullReturnHook = returnHook(
      this.setIsOnTheFlyFull.bind(this)
    );

    this._loopMS = Date.now();
    this._lastUpdatedMS = this._loopMS;
  }

  initialize() {
    const { smallValues, largeValues } = this.createEmptyHeaps();
    this._smallValues = smallValues;
    this._largeValues = largeValues;
    this._positionToMetaList = [];
    /**
     * this._indexToMetaMap is used to find the prev meta when finding a position for index.
     */
    this._indexToMetaMap = new Map();
    this._metaToPositionMap = new Map();
    this._metaToIndexMap = new Map();
    this._onTheFlyIndices = [];
    this._isOnTheFlyFull = false;
  }

  getType() {
    return this._type;
  }

  get bufferSize() {
    return this._bufferSize;
  }

  reset() {
    this.initialize();
  }

  setIsOnTheFlyFull(val: any) {
    if (val != null) {
      const data = this._onTheFlyIndices.filter((v) => v != null);
      this._isOnTheFlyFull = data.length === this._bufferSize;
    }
  }

  resetOnTheFlies() {
    this._isOnTheFlyFull = false;
    this._onTheFlyIndices = [];
  }

  get isBufferFull() {
    return this._positionToMetaList.length >= this._bufferSize;
  }

  getOnTheFlyUncriticalPosition(safeRange: SafeRange) {
    const { startIndex, endIndex } = safeRange;
    for (let idx = 0; idx < this._onTheFlyIndices.length; idx++) {
      const meta = this._onTheFlyIndices[idx];
      const metaIndex = this.getMetaIndex(meta);
      if (!isClamped(startIndex, metaIndex, endIndex)) {
        return idx;
      }
    }
    return null;
  }

  createEmptyHeaps() {
    return {
      smallValues: new Heap([], this._smallerComparator),
      largeValues: new Heap([], this._greaterComparator),
    };
  }

  getIndexMeta(index: number) {
    try {
      if (index == null || index < 0) return null;
      return this._metaExtractor(index);
    } catch (err) {
      return null;
    }
  }

  getMetaIndex(meta: Meta) {
    try {
      if (meta == null) return -1;
      if (assertThresholdNumber(meta)) return -1;
      if (this._indexExtractor) return this._indexExtractor(meta);
      return this._metaToIndexMap.get(meta);
    } catch (err) {
      return -1;
    }
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

  _peek(heap: Heap) {
    return heap.peek();
  }

  _getMaxItem() {
    return this._peek(this._largeValues);
  }

  _getMinItem() {
    return this._peek(this._smallValues);
  }

  _getMinValue() {
    return this._peek(this._smallValues)?.value;
  }

  _getMaxValue() {
    return this._peek(this._largeValues)?.value;
  }

  // should omit thresholdNumber
  getMaxValue() {
    const stack = [];
    let item;

    while ((item = this._getMaxItem()) && assertThresholdNumber(item?.value)) {
      stack.push(item);
      this._largeValues.pop();
    }

    let stackItem;
    while ((stackItem = stack.pop())) {
      this._largeValues.push(stackItem);
    }

    return item?.value;
  }

  getMinValue() {
    const stack = [];
    let item;

    while ((item = this._getMinItem()) && assertThresholdNumber(item?.value)) {
      stack.push(item);
      this._smallValues.pop();
    }

    let stackItem;
    while ((stackItem = stack.pop())) {
      this._smallValues.push(stackItem);
    }

    return item?.value;
  }

  _push(heap: Heap, item: HeapItem) {
    heap.push(item);
  }

  getFliedPosition(newIndex: number, safeRange: SafeRange) {
    if (this._isOnTheFlyFull) {
      // newIndex is not critical index, do nothing
      if (
        safeRange &&
        isClamped(safeRange.startIndex, newIndex, safeRange.endIndex)
      ) {
        return this.getOnTheFlyUncriticalPosition(safeRange);
      }
      // if `newIndex` is critical index, replace an un-committed
      // index value from _onTheFlyIndices.
      // const pos = this.getOnTheFlyUncriticalPosition(safeRange);
      // if (pos != null) return pos;
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
    const metaPosition = this._metaToPositionMap.get(meta);
    let position, indexMeta;

    // if (this._type === 'normal_goods')
    //   console.log(
    //     'getPosition ',
    //     newIndex,
    //     !this.isBufferFull,
    //     this._isOnTheFlyFull,
    //     this._onTheFlyIndices.slice(),
    //     this._indexToMetaMap.get(newIndex),
    //     this._metaToPositionMap.get(this._indexToMetaMap.get(newIndex))
    //   );

    if (metaPosition !== undefined) {
      position = this.commitPosition({
        newIndex,
        meta,
        safeRange,
        position: metaPosition,
      });
    } else if (!this.isBufferFull) {
      /** placed on new buffered position */
      position = this.getNewPositionForIndex(newIndex);
    } else if (this._isOnTheFlyFull) {
      position = this.getFliedPosition(newIndex, safeRange);
    } else if (
      (indexMeta = this._indexToMetaMap.get(newIndex)) &&
      this._metaToPositionMap.get(indexMeta) != null
    ) {
      /**
      Index has already been stored, but we cant use its old position directly...
        1：index -> meta, meta may be reused later
        2: temp use index -> meta -> position, this issue should exist for follows...
     */
      position = this.commitPosition({
        newIndex,
        meta,
        safeRange,
        position: this._metaToPositionMap.get(indexMeta),
      });
    } else {
      this._cleanHeaps();
      position = this.commitPosition({
        newIndex,
        meta,
        safeRange,
        position: this._replaceFurthestIndexPosition(newIndex, safeRange),
      });
    }

    // console.log('position ', position)

    if (position != null) {
      this._onTheFlyIndices[position] = meta;
      this._setMetaIndex(meta, newIndex);
      this._metaToPositionMap.set(meta, position);

      // this._setMetaPosition(meta, position);
      // should not push to heap, pop only
      // this._pushToHeaps(position, newIndex)

      return this._isOnTheFlyFullReturnHook(position);
    }

    return null;
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

    let indexToReplace;

    const minValue = this._getMinValue();
    const maxValue = this._getMaxValue();

    if (assertThresholdNumber(maxValue)) {
      indexToReplace = maxValue;
      this._largeValues.pop();
      const replacedMeta = this._indexToMetaMap.get(indexToReplace);

      const position = this._metaToPositionMap.get(replacedMeta);
      return position;
    }

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

    // console.log('index ', indexToReplace, replacedMeta, position)

    return position;
  }

  shuffle(options: { retry: boolean; fallback: boolean }) {
    const indices = new Array(this.bufferSize);
    for (let idx = 0; idx < indices.length; idx++) {
      const meta = this._onTheFlyIndices[idx] || this._positionToMetaList[idx];
      // console.log('ix ', idx,this.getMetaIndex(meta) )
      const targetIndex = this.getMetaIndex(meta);
      indices[idx] = targetIndex;
    }

    // console.log(
    //   'indices ',
    //   this._positionToMetaList,
    //   this._onTheFlyIndices.slice(),
    //   indices
    // );

    const _arr = new Array(indices.length);
    const _available = [];
    const indexToMetaMap = new Map();
    const metaToIndexMap = new Map();

    for (let idx = 0; idx < indices.length; idx++) {
      const currentIndex = indices[idx];
      const currentMeta = this._metaExtractor(currentIndex);
      // console.log("current ", currentIndex, currentMeta)
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

    const positionToMetaList = [];
    this._indexToMetaMap = indexToMetaMap;
    this.replaceMetaToIndexMap(metaToIndexMap);

    for (let position = 0; position < indices.length; position++) {
      if (_arr[position] != null) {
        positionToMetaList[position] = _arr[position];
        continue;
      }
      const meta = _available.shift();
      if (meta != null) {
        positionToMetaList[position] = meta;
      }
    }

    this._positionToMetaList = positionToMetaList;

    return this.getIndices({
      ...options,
      retry: true,
    });
  }

  // key point: `meta` should be preserved..
  getIndices(
    options = {
      retry: false,
      fallback: false,
    }
  ): Array<BufferIndicesItem<Meta>> {
    try {
      const { retry, fallback } = options;
      const { smallValues, largeValues } = this.createEmptyHeaps();
      const indices = new Array(this._positionToMetaList.length) as Array<
        BufferIndicesItem<Meta>
      >;
      const metaToPositionMap = new Map();
      const indexToMetaMap = new Map();
      const metaToIndexMap = new Map();
      for (let idx = 0; idx < indices.length; idx++) {
        const meta = fallback
          ? this._onTheFlyIndices[idx]
          : this._onTheFlyIndices[idx] || this._positionToMetaList[idx];
        const targetIndex = this.getMetaIndex(meta);
        // which means source data has changed. such as one item has been deleted
        if (
          !assertThresholdNumber(meta) &&
          meta != this.getIndexMeta(targetIndex) &&
          !retry
        ) {
          return this.shuffle(options);
        }
        if (meta != null && !assertThresholdNumber(meta)) {
          const item = { position: idx, value: targetIndex };
          this._push(smallValues, item);
          this._push(largeValues, item);
          metaToPositionMap.set(meta, idx);
          indexToMetaMap.set(targetIndex, meta);
          metaToIndexMap.set(meta, targetIndex);
          indices[idx] = {
            meta,
            targetIndex,
            recyclerKey: `${this._type}_${idx}`,
          };
        }
      }
      this._smallValues = smallValues;
      this._largeValues = largeValues;
      this._metaToPositionMap = metaToPositionMap;
      this._positionToMetaList = indices.map((v) => v?.meta);
      this.resetOnTheFlies();
      this._indexToMetaMap = indexToMetaMap;
      this.replaceMetaToIndexMap(metaToIndexMap);

      return indices;
    } catch (err) {
      console.log('err ', err);
      return this.getIndices({
        ...options,
        fallback: true,
      });
    } finally {
      this.readyToStartNextLoop();
      // clear on the fly indices after return indices.
    }
  }

  _pushToHeaps(position: number, value: number) {
    const item = { position, value };
    // We can reuse the same object in both heaps, because we don't mutate them
    this._push(this._smallValues, item);
    this._push(this._largeValues, item);
  }

  _setMetaPosition(meta: Meta, position: number) {
    // do not delete meta2position; because getPosition will get by meta first...
    // const prevMetaOnPosition = this._positionToMetaList[position];
    // if (prevMetaOnPosition) this._metaToPositionMap.delete(prevMetaOnPosition);
    this._positionToMetaList[position] = meta;
    this._metaToPositionMap.set(meta, position);
  }

  commitPosition(props: {
    newIndex: number;
    position: number;
    meta: Meta;
    safeRange: SafeRange;
  }) {
    const { newIndex, safeRange, position, meta } = props;
    const onTheFlyPositionMeta = this._onTheFlyIndices[position];
    let positionToReplace = position;

    if (onTheFlyPositionMeta) {
      // such as place item 11 twice...
      if (onTheFlyPositionMeta === meta) return position;
      if (this._isOnTheFlyFull)
        return this.getFliedPosition(newIndex, safeRange);
      positionToReplace = this._replaceFurthestIndexPosition(
        newIndex,
        safeRange
      );

      while (this._onTheFlyIndices[positionToReplace]) {
        positionToReplace = this._replaceFurthestIndexPosition(
          newIndex,
          safeRange
        );
      }
    }
    return positionToReplace;
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
  }

  _cleanHeaps() {
    for (let idx = 0; idx < this._positionToMetaList.length; idx++) {
      if (this._positionToMetaList[idx] == null) {
        this._recreateHeaps();
        return;
      }
    }

    const minHeapSize = Math.min(
      this._smallValues.size(),
      this._largeValues.size()
    );
    const maxHeapSize = Math.max(
      this._smallValues.size(),
      this._largeValues.size()
    );
    // We not usually only remove object from one heap while moving value.
    // Here we make sure that there is no stale data on top of heaps.
    if (maxHeapSize > 10 * minHeapSize) {
      // There are many old values in one of heaps. We need to get rid of them
      // to not use too avoid memory leaks
      this._recreateHeaps();
    }
  }
  _recreateHeaps() {
    const { smallValues, largeValues } = this.createEmptyHeaps();
    for (
      let position = 0;
      position < this._positionToMetaList.length;
      position++
    ) {
      const meta = this._positionToMetaList[position];
      let value = this.getMetaIndex(meta);
      if (meta == null || value === -1 || value == null) {
        value = Number.MAX_SAFE_INTEGER - position;
      }

      const item = { position, value };
      this._push(smallValues, item);
      this._push(largeValues, item);
      if (value > thresholdNumber) {
        // @ts-ignore
        this._setMetaPosition(value, position);
        // @ts-ignore
        this._setMetaIndex(value, value);
      }
    }
    this._smallValues = smallValues;
    this._largeValues = largeValues;
  }

  _smallerComparator(lhs: HeapItem, rhs: HeapItem) {
    return lhs.value < rhs.value;
  }

  _greaterComparator(lhs: HeapItem, rhs: HeapItem) {
    return lhs.value > rhs.value;
  }
}

export default IntegerBufferSet;
