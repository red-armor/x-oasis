# @x-oasis/recycler

## Installation

```bash
$ npm i @x-oasis/recycler
```

## How to use

```typescript
import IntegerBufferSet from '@x-oasis/recycler'
```

## How to run test

```bash
$ pnpm test
```

## Philosophy

Basically, give an List index then get a placed position(recycler list index); In order to reuse more elements, object ref should be considered..

For Example, remove / delete / add an element, they all cause index change of original source data. but

## API

### updateIndices

```js
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
  
  /**
   * return boolean value, true means the current processing index should be counted in.
   */
  onProcess?: (type?: string, index?: number) => boolean
})
```