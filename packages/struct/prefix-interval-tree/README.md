# @x-oasis/prefix-interval-tree

## Installation

```bash
$ npm i @x-oasis/prefix-interval-tree
```

## How to use

```typescript
import PrefixIntervalTree from '@x-oasis/prefix-interval-tree'
```

## How to run test

```bash
$ pnpm test
```

# API

## PrefixIntervalTree Constructor

```ts
const intervalTree = new PrefixIntervalTree([2,5,7])

const intervalTree = new PrefixIntervalTree(10)
```

Total interval tree array length is power of `2`, such as 8, 16, 32; and the input length value means the half size, which means `10` will result in `2^4 = 16` first, then patch on interval tree, it will be total `2 * 16 = 32`.

## getHeap

```ts
getHeap(): number[]
```

## getActualSize

Basically, interval tree's size is this._half, they all have default `0` value. when you want to get the actual size which has been set with value, then call this method.

## get(index: number)

```ts
get(index: number): number
```

get the index value

## set(index: number)

```ts
set (index: number): boolean
```

To update the index value in interval tree, its parent will be updated as accordingly.


## computeRange(minValue: number, maxValue: number) 

```ts
computeRange(minValue: number, maxValue: number): {
  startIndex: number
  endIndex: number
}
```

- `startIndex`: the biggest index less than or equal minValue;
- `endIndex`: the smallest index greater than maxValue;

when using the return value, endIndex item should not be included.

```ts
const arr = []
const intervalTree = new PrefixIntervalTree(arr)

const { startIndex, endIndex } = intervalTree.computeRange(100, 200);

const itemsInViewport = arr.slice(startIndex, endIndex)
```