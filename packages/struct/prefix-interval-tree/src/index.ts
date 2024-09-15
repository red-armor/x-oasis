const parent = (node: number) => Math.floor(node / 2);

const createArray = function (size: number) {
  const xs = [];
  for (let i = size - 1; i >= 0; --i) {
    xs[i] = 0;
  }
  return xs;
};

/**
 * Computes the next power of 2 after or equal to x.
 */
function ceilLog2(x: number) {
  let y = 1;
  while (y < x) {
    y *= 2;
  }

  return y;
}

type OperationType = 'set' | 'remove';

type Operation = {
  type: OperationType;
  value: any;
};

/**
 * A prefix interval tree stores an numeric array and the partial sums of that
 * array. It is optimized for updating the values of the array without
 * recomputing all of the partial sums.
 *
 *   - O(ln n) update
 *   - O(1) lookup
 *   - O(ln n) compute a partial sum
 *   - O(n) space
 *
 * Note that the sequence of partial sums is one longer than the array, so that
 * the first partial sum is always 0, and the last partial sum is the sum of the
 * entire array.
 */
class PrefixIntervalTree {
  private _size: number;
  /**
   * Half the size of the heap. It is also the number of non-leaf nodes, and the
   * index of the first element in the heap. Always a power of 2.
   */
  private _half: number;
  private _heap: number[];

  private _actualSize: number;

  private _onUpdateItemLayout: Function;
  private _onUpdateIntervalTree: Function;

  private _affectedIndicesMap: {
    [key: string]: Operation;
  } = {};
  private _affectedMinimalIndex: number = undefined;
  private _cachedSumUntilValues: {
    [key: string]: number;
  } = {};

  constructor(
    xs: number[] | number = 10,
    opts?: {
      onUpdateItemLayout?: Function;
      onUpdateIntervalTree?: Function;
    }
  ) {
    if (typeof xs === 'number') this.initWithNumber(xs);
    if (Array.isArray(xs)) this.initWithArray(xs);

    const { onUpdateItemLayout, onUpdateIntervalTree } = opts || {};
    this._onUpdateIntervalTree = onUpdateIntervalTree;
    this._onUpdateItemLayout = onUpdateItemLayout;
  }

  initWithNumber(length: number) {
    this._half = ceilLog2(length);
    this._size = this._half;
    this._heap = createArray(2 * this._half);
    this._actualSize = 0;
  }

  initWithArray(arr: number[]) {
    this._half = ceilLog2(arr.length);
    this._size = this._half;
    this._heap = createArray(2 * this._half);
    let i;
    for (i = 0; i < this._size; ++i) {
      this._heap[this._half + i] = arr[i];
    }

    for (i = this._half - 1; i > 0; --i) {
      this._heap[i] = this._heap[2 * i] + this._heap[2 * i + 1];
    }
    this._actualSize = arr.length;
  }

  static uniform(size: number, initialValue: number) {
    const xs = [];
    for (let i = size - 1; i >= 0; --i) {
      xs[i] = initialValue;
    }

    return new PrefixIntervalTree(xs);
  }

  static empty(size: number) {
    return PrefixIntervalTree.uniform(size, 0);
  }

  /**
   * the length should be 2
   * it will cause calculation of
   */
  stretch() {
    const nextHeap = createArray(2 * this._half * 2);
    const nextHeapHalf = this._half * 2;

    // copy old value to new one
    for (let i = 0; i < this._size; i++) {
      nextHeap[nextHeapHalf + i] = this._heap[this._half + i] || 0;
    }

    // sum old value to create new sum value
    for (let i = nextHeapHalf - 1; i > 0; i--) {
      nextHeap[i] = nextHeap[2 * i] + nextHeap[2 * i + 1];
    }

    this._half = nextHeapHalf;
    this._size = nextHeapHalf;
    this._heap = nextHeap;
  }

  indexKey(index: number) {
    return `${index}`;
  }

  resolveKeyIndex(key: string) {
    return parseInt(key, 10);
  }

  isValidIndex(index: number) {
    return typeof index === 'number' && index >= 0 && index < this._actualSize;
  }

  reflowDirectParent(index: number) {
    this.resetAffected();
    let node = this._half + index;

    node = parent(node);
    for (; node !== 0; node = parent(node)) {
      this._heap[node] = this._heap[2 * node] + this._heap[2 * node + 1];
    }
  }

  // recalculate parent value from startIndex to endIndex
  reflowHeap(_startIndex: number, endIndex = this._half * 2 - 2) {
    this.resetAffected();
    const depth = Math.log2(this._size);
    const startIndex = _startIndex + this._half;

    Array.from({ length: depth }, (v, i) => i).reduce(
      (acc) => {
        const { startIndex, endIndex } = acc;
        const _nextStart = parent(startIndex);
        const _nextEnd = parent(endIndex);

        for (let idx = _nextStart; idx <= _nextEnd; idx++) {
          this._heap[idx] = this._heap[2 * idx] + this._heap[2 * idx + 1];
        }

        return {
          startIndex: _nextStart,
          endIndex: _nextEnd,
        };
      },
      {
        startIndex,
        endIndex,
      }
    );
  }

  /**
   *
   * @param index index to remove
   * @returns
   *
   * update heap only, but not recalculate interval tree value
   */
  dryRemove(index: number) {
    if (!this.isValidIndex(index)) return;
    if (isNaN(index)) {
      console.warn('Passing a NaN value as interval tree index');
      return;
    }

    this._heap.splice(this._half + index, 1);
    this._heap.push(0);
    this._actualSize = this._actualSize - 1;

    this.updateAffectedIndices(index, 'remove');
  }

  remove(index: number) {
    // if typeof index === 'undefined', then it will go into looooooooop

    this.removeIndices([index]);
  }

  removeIndices(indices: number[]) {
    indices.sort((a, b) => a - b);

    indices.forEach((index) => this.dryRemove(index));

    this.reflowHeap(indices[0]);
    this.onUpdateIntervalTree();

    if (typeof this._onUpdateItemLayout === 'function') {
      for (let idx = indices[0]; idx < this._half; idx++) {
        this._onUpdateItemLayout(idx, this.get(idx));
      }
    }
  }

  removeV0(index: number) {
    // if typeof index === 'undefined', then it will go into looooooooop
    if (!this.isValidIndex(index)) return;
    if (isNaN(index)) {
      console.warn('Passing a NaN value as interval tree index');
      return;
    }

    const nextHeap = createArray(this._half * 2);
    const copy = this._heap.slice(this._half);
    copy.splice(index, 1);

    for (let index = this._half; index < this._half * 2; index++) {
      nextHeap[index] = copy[index - this._half] || 0;
    }

    for (let index = this._half - 1; index > 0; index--) {
      nextHeap[index] = nextHeap[2 * index] + nextHeap[2 * index + 1];
    }

    this._actualSize = this._actualSize - 1;
    this._heap = nextHeap;
  }

  resetAffected() {
    this._affectedIndicesMap = {};
    this._affectedMinimalIndex = undefined;
  }

  updateAffectedIndices(index: number, type: OperationType, value?: number) {
    if (typeof index === 'number') {
      this._affectedMinimalIndex =
        typeof this._affectedMinimalIndex === 'number'
          ? Math.min(this._affectedMinimalIndex, index)
          : index;
      this._affectedIndicesMap[this.indexKey(index)] = {
        value,
        type,
      };
    }
  }

  onUpdateIntervalTree() {
    // reset cached value
    this._cachedSumUntilValues = {};

    if (typeof this._onUpdateIntervalTree === 'function') {
      this._onUpdateIntervalTree(this._heap);
    }
  }

  drySet(index: number, value: number) {
    if (typeof index !== 'number' || index < 0) return false;
    if (isNaN(index)) {
      console.warn('Passing a NaN value as interval tree index');
      return false;
    }

    while (index >= this._half) {
      this.stretch();
    }

    const node = this._half + index;
    this._heap[node] = value;

    this.updateAffectedIndices(index, 'set', value);

    if (index + 1 > this._actualSize) {
      this._actualSize = index + 1;
    }
    return true;
  }

  set(index: number, value: number) {
    this.drySet(index, value);
    this.reflowDirectParent(index);
    this.onUpdateIntervalTree();
    if (typeof this._onUpdateItemLayout === 'function') {
      this._onUpdateItemLayout(index, value);
    }
    return true;
  }

  applyUpdate() {
    if (typeof this._affectedMinimalIndex === 'number') {
      const index = this._affectedMinimalIndex;

      const keys = Object.keys(this._affectedIndicesMap);
      const hasRemoveItem = keys.some(
        (key) => this._affectedIndicesMap[key].type === 'remove'
      );

      if (hasRemoveItem) {
        return this.reflowHeap(index);
      }

      const depth = Math.log2(this._size);
      const itemLength = keys.length;

      const reflowTimes = this._half - index - 1;

      if (depth * itemLength > reflowTimes) {
        return this.reflowHeap(index);
      }

      keys.forEach((key) => this.reflowDirectParent(this.resolveKeyIndex(key)));

      this.onUpdateIntervalTree();

      this.resetAffected();
    }
  }

  getMaxUsefulLength() {
    return this.getActualSize();
  }

  getActualSize() {
    return this._actualSize;
  }

  get(index: number) {
    // invariant(index >= 0 && index < this._size, 'Index out of range %s', index);
    const node = this._half + index;
    return this._heap[node];
  }

  getSize() {
    return this._size;
  }

  getHalf() {
    return this._half;
  }

  getHeap() {
    return this._heap;
  }

  getMaxValue() {
    return this._heap[1];
  }

  /**
   * Returns the sum get(0) + get(1) + ... + get(end - 1).
   * End is not included. if end less than 0, then return 0
   */
  sumUntil(end: number) {
    // invariant(end >= 0 && end < this._size + 1, 'Index out of range %s', end);

    if (this._cachedSumUntilValues[`${end}`] != null)
      return this._cachedSumUntilValues[`${end}`];
    if (end <= 0) {
      return 0;
    }

    let node = this._half + end - 1;
    let sum = this._heap[node];

    for (; node !== 1; node = parent(node)) {
      if (node % 2 === 1) {
        sum += this._heap[node - 1];
      }
    }

    return sum;
  }

  /**
   * Returns the sum get(0) + get(1) + ... + get(inclusiveEnd).
   */
  sumTo(inclusiveEnd: number) {
    // invariant(
    //   inclusiveEnd >= 0 && inclusiveEnd < this._size,
    //   'Index out of range %s',
    //   inclusiveEnd
    // );
    return this.sumUntil(inclusiveEnd + 1);
  }

  /**
   * Returns the sum get(begin) + get(begin + 1) + ... + get(end - 1).
   * end length is not included
   */
  sum(begin: number, end: number) {
    // invariant(begin <= end, 'Begin must precede end');
    return this.sumUntil(end) - this.sumUntil(begin);
  }

  /**
   * return the biggest i, sumUntil(i) === t
   * return the biggest i, subUntil(i) < t
   */
  greatestLowerBound(t: number) {
    if (t < 0 || !this._actualSize) {
      return -1;
    }

    let node = 1;
    if (this._heap[node] < t) {
      // not use this._size；this._size always be a big value
      return this._actualSize;
    }

    while (node < this._half) {
      const leftSum = this._heap[2 * node];
      if (t < leftSum) {
        node = 2 * node;
      } else {
        node = 2 * node + 1;
        t -= leftSum;
      }
    }

    return Math.min(node - this._half, this._actualSize);
  }

  /**
   * Return the biggest i, subUntil(i) < t
   * or -1 if no such i exists.
   */
  greatestStrictLowerBound(t: number) {
    if (t <= 0 || !this._actualSize) {
      return -1;
    }

    let node = 1;
    if (this._heap[node] < t) {
      return this._actualSize;
    }

    while (node < this._half) {
      const leftSum = this._heap[2 * node];
      if (t <= leftSum) {
        node = 2 * node;
      } else {
        node = 2 * node + 1;
        t -= leftSum;
      }
    }

    return Math.min(node - this._half, this._actualSize);
  }

  /**
   *
   * @param minOffset
   * @param maxOffset
   * @returns
   *
   * pending issue:
   * when item with length list [100, 0, 100, 0, 0, 100].
   * then computeRange(100, 200) => { startIndex: 2, endIndex: 6 }
   *
   * item index in viewport will be [2, 3, 4, 5], index 6 is not
   * included just like Array.slice(start, end)
   *
   */
  computeRange(minOffset: number, maxOffset: number) {
    if (this.getHeap()[1] < minOffset) {
      return {
        startIndex: this._actualSize,
        endIndex: this._actualSize,
      };
    }

    return {
      // the biggest item, value <= minOffset
      startIndex: this.greatestLowerBound(minOffset),

      // the smallest item, value > maxOffset
      endIndex: this.leastStrictUpperBound(maxOffset),
    };
  }

  /**
   * Returns the smallest i such that 0 <= i <= size and t <= sumUntil(i), or
   * size + 1 if no such i exists.
   */
  leastUpperBound(t: number) {
    return Math.min(this.greatestStrictLowerBound(t) + 1, this._actualSize);
  }

  /**
   * Returns the smallest i, t < sumUntil(i), it should be used as range end
   * size + 1 if no such i exists.
   */
  leastStrictUpperBound(t: number) {
    return Math.min(this.greatestLowerBound(t) + 1, this._actualSize);
  }
}

export default PrefixIntervalTree;
