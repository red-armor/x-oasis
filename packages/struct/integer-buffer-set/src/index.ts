// import invariant from 'invariant';
import Heap from '@x-oasis/heap';
import isClamped from '@x-oasis/is-clamped';
import {
  HeapItem,
  MetaExtractor,
  IntegerBufferSetProps,
  ValueToPositionObject,
  ValueToMetaObject,
  MetaToValueMap,
} from './types';

const defaultUseMinValueFn = (options: {
  safeRange: {
    lowValue: number;
    highValue: number;
  };
  bufferSetRange: {
    maxValue: number;
    minValue: number;
  };
  currentIndex: number;
}) => {
  const { safeRange, bufferSetRange } = options;
  const { lowValue, highValue } = safeRange;
  const { maxValue, minValue } = bufferSetRange;
  return lowValue - minValue > maxValue - highValue;
};

const defaultMetaExtractor = (value) => value;
const defaultBufferSize = 10;
const isNumber = (v) => typeof v === 'number';

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
  private _bufferSize: number;
  private _valueToPositionObject: ValueToPositionObject;
  private _positionToValueObject: ValueToPositionObject;
  private _valueToMetaObject: ValueToMetaObject<Meta>;
  private _metaToValueMap: MetaToValueMap<Meta>;
  private _smallValues: Heap<HeapItem>;
  private _largeValues: Heap<HeapItem>;
  private _vacantPositions: Array<number>;
  private _metaExtractor: MetaExtractor;

  constructor(props?: IntegerBufferSetProps) {
    const {
      bufferSize = defaultBufferSize,
      metaExtractor = defaultMetaExtractor,
    } = props;
    this._metaExtractor = metaExtractor;

    this._valueToPositionObject = {};
    this._positionToValueObject = {};

    this._valueToMetaObject = {};
    this._metaToValueMap = new Map();

    this._size = 0;
    this._bufferSize = bufferSize;
    this._smallValues = new Heap([], this._smallerComparator);
    this._largeValues = new Heap([], this._greaterComparator);

    this.getNewPositionForValue = this.getNewPositionForValue.bind(this);
    this.getValuePosition = this.getValuePosition.bind(this);
    this.getSize = this.getSize.bind(this);
    this.replaceFurthestValuePosition =
      this.replaceFurthestValuePosition.bind(this);
  }

  getSize() {
    return this._size;
  }

  get indices() {
    const indices = [];
    for (const key in this._valueToPositionObject) {
      const value = this._valueToPositionObject[key];
      indices[value] = key;
    }
    return indices;
  }

  getValuePosition(value: number): null | number {
    if (this._valueToPositionObject[value] === undefined) {
      return null;
    }
    return this._valueToPositionObject[value];
  }

  getNewPositionForValue(value: number) {
    if (this._valueToPositionObject[value] !== undefined) {
      console.warn(
        "Shouldn't try to find new position for value already stored in BufferSet"
      );
    }
    // invariant(
    //   this._valueToPositionObject[value] === undefined,
    //   "Shouldn't try to find new position for value already stored in BufferSet"
    // );
    const newPosition = this._size;
    this._size++;
    this._pushToHeaps(newPosition, value);
    this._valueToPositionObject[value] = newPosition;
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

  setPositionValue(position: number, value: number) {
    const originalPosition = this._valueToPositionObject[value];
    if (originalPosition !== undefined) {
      // console.log(
      //   'before ===== ',
      //   position,
      //   value,
      //   this._valueToPositionObject[value]
      // );
      delete this._valueToPositionObject[value];
      this._valueToPositionObject[value] = position;

      // console.log('set ======= ', position, value, {
      //   ...this._valueToPositionObject,
      // });
      this._pushToHeaps(position, value);
    }
  }

  getMetaPosition(meta: Meta) {
    const value = this._metaToValueMap.get(meta);
    return this._valueToPositionObject[value];
  }

  performRangeUpdate(
    startIndex: number,
    endIndex: number,
    safeRange: {
      startIndex: number;
      endIndex: number;
    }
  ) {
    const _start = Math.max(startIndex, safeRange.startIndex);
    const _end = Math.min(endIndex, safeRange.endIndex);
    const metaList = [];
    const primaryMetaList = [];
    const secondaryMetaList = [];
    const locationStartIndex = startIndex;
    const targetIndices = new Array(this._bufferSize);

    const _valueToPositionObject = {};
    const _positionToValueObject = {};

    const _valueToMetaObject = {};
    const _metaToValueMap = new Map();

    for (let value = startIndex; value <= endIndex; value++) {
      const meta = this._metaExtractor(value);
      if (meta) {
        const _i = value - locationStartIndex;
        if (isClamped(value, safeRange.startIndex, safeRange.endIndex)) {
          primaryMetaList[_i] = meta;
          const targetIndex = this.getMetaPosition(meta);
          if (isNumber(targetIndex)) {
            targetIndices[targetIndex] = value;
            _valueToPositionObject[value] = targetIndex;
            _valueToMetaObject[value] = meta;
            _metaToValueMap.set(meta, value);
            _positionToValueObject[targetIndex] = value;
          }
        } else {
          secondaryMetaList[_i] = meta;
        }
      }
    }

    for (let idx = _start; idx <= _end; idx++) {
      const meta = this._metaExtractor(idx);
      if (_metaToValueMap.get(meta) !== undefined) continue;
      let p;
      while (
        (p =
          targetIndices[
            this.resolvePosition(safeRange.startIndex, safeRange.endIndex, idx)
          ]) === undefined
      ) {
        targetIndices[p] = idx;
      }
    }
  }

  getPosition(
    newValue: number,
    safeRange: {
      minValue: number;
      maxValue: number;
    }
  ) {
    const meta = this._metaExtractor(newValue);
    const _meta = this._valueToMetaObject[newValue];
    let position = this._valueToPositionObject[newValue];

    /**
     * has meta && meta matched
     */
    if (meta && meta === _meta && isNumber(position)) {
      console.warn(
        "Shouldn't try to replace values with value already stored value in " +
          'BufferSet'
      );
      return position;
    }

    // has position, but not matched.
    if (_meta) {
      const candidateValue = this._metaToValueMap.get(meta);
      const candidatePosition = this._valueToPositionObject[candidateValue];

      // meta has a position
      if (candidatePosition !== undefined) {
        const originalValue = this._positionToValueObject[candidatePosition];
        position = candidatePosition;
        delete this._valueToPositionObject[originalValue];
        this._valueToPositionObject[newValue] = position;
        this._positionToValueObject[position] = newValue;
        this._valueToMetaObject[newValue] = meta;
        this._metaToValueMap.set(meta, newValue);
        this.rebuildHeaps();
        return position;
      }
    }

    // newValue has no position..
    return this.replaceFurthestValuePosition(
      newValue,
      safeRange.maxValue,
      safeRange.minValue
    );
  }

  resolvePosition(
    lowValue: number,
    highValue: number,
    newValue: number,
    useMinValueFn: (options: {
      safeRange: {
        lowValue: number;
        highValue: number;
      };
      bufferSetRange: {
        maxValue: number;
        minValue: number;
      };
      currentIndex: number;
    }) => boolean = defaultUseMinValueFn
  ): null | number {
    this._cleanHeaps();

    if (this._smallValues.empty() || this._largeValues.empty()) {
      // There are currently no values stored. We will have to create new
      // position for this value.
      return null;
    }

    const minValue = this._smallValues.peek()!.value;
    const maxValue = this._largeValues.peek()!.value;
    if (minValue >= lowValue && maxValue <= highValue) {
      // All values currently stored are necessary, we can't reuse any of them.
      return null;
    }

    let valueToReplace;
    if (
      useMinValueFn({
        safeRange: {
          lowValue,
          highValue,
        },
        bufferSetRange: {
          minValue,
          maxValue,
        },
        currentIndex: newValue,
      })
    ) {
      // if (lowValue - minValue > maxValue - highValue) {
      // minValue is further from provided range. We will reuse it's position.
      valueToReplace = minValue;
      this._smallValues.pop();
    } else {
      valueToReplace = maxValue;
      this._largeValues.pop();
    }

    let position = this._valueToPositionObject[valueToReplace];
    delete this._valueToPositionObject[valueToReplace];

    while (!isNumber(position)) {
      if (
        useMinValueFn({
          safeRange: {
            lowValue,
            highValue,
          },
          bufferSetRange: {
            minValue,
            maxValue,
          },
          currentIndex: newValue,
        })
      ) {
        // if (lowValue - minValue > maxValue - highValue) {
        // minValue is further from provided range. We will reuse it's position.
        valueToReplace = minValue;
        this._smallValues.pop();
      } else {
        valueToReplace = maxValue;
        this._largeValues.pop();
      }

      position = this._valueToPositionObject[valueToReplace];
      delete this._valueToPositionObject[valueToReplace];
    }

    return position;
  }

  replaceFurthestValuePosition(
    lowValue: number,
    highValue: number,
    newValue: number,
    useMinValueFn: (options: {
      safeRange: {
        lowValue: number;
        highValue: number;
      };
      bufferSetRange: {
        maxValue: number;
        minValue: number;
      };
      currentIndex: number;
    }) => boolean = defaultUseMinValueFn
  ): null | number {
    const position = this.resolvePosition(
      lowValue,
      highValue,
      newValue,
      useMinValueFn
    );

    if (position !== undefined) {
      this._valueToPositionObject[newValue] = position;
      this._pushToHeaps(position, newValue);
    }
    return position;
  }

  _pushToHeaps(position: number, value: number) {
    const element = {
      position,
      value,
    };
    // We can reuse the same object in both heaps, because we don't mutate them
    this._smallValues.push(element);
    this._largeValues.push(element);
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
    const newSmallValues = new Heap<HeapItem>(
      [], // Initial data in the heap
      this._smallerComparator
    );
    const newLargeValues = new Heap<HeapItem>(
      [], // Initial datat in the heap
      this._greaterComparator
    );

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
    this._smallValues = newSmallValues;
    this._largeValues = newLargeValues;
    this._valueToPositionObject = valueToPositionObject;
  }

  rebuildHeaps() {
    const newSmallValues = new Heap<HeapItem>(
      [], // Initial data in the heap
      this._smallerComparator
    );
    const newLargeValues = new Heap<HeapItem>(
      [], // Initial datat in the heap
      this._greaterComparator
    );
    const valueToPositionObject = {};

    const keys = Object.keys(this._positionToValueObject);
    for (let position = 0; position < keys.length; position++) {
      const value = this._positionToValueObject[position];
      if (value !== undefined) {
        const element = {
          position,
          value,
        };
        valueToPositionObject[value] = position;
        newSmallValues.push(element);
        newLargeValues.push(element);
      }
    }

    this._smallValues = newSmallValues;
    this._largeValues = newLargeValues;
    this._valueToPositionObject = valueToPositionObject;
  }

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
      // Push all stil valid elements to new heaps
      if (this._valueToPositionObject[element.value] !== undefined) {
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
      this._valueToPositionObject[heap.peek()!.value] === undefined
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
