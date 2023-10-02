# @x-oasis/integer-buffer-set

## Installation

```bash
$ npm i @x-oasis/integer-buffer-set
```

## How to use

```typescript
import IntegerBufferSet from '@x-oasis/integer-buffer-set'
```

## How to run test

```bash
$ pnpm test
```

## Usage

## Philosophy

Basically, we only compare index value, such as 

create a `onTheFlyIndices` as a slave buffer. theoretically, at most buffer size's new 
item could occupy a position.

`IndexExtractor` is the key point of design.
if you do not delete/reorder an an array, `indexExtractor` is useless.

## bad case 

when getIndices.. 

`positionToMetaIndices` may used as a supplement. but when has multiple buffer. index refer to meta may changed to other buffer..

const data = [0, 1, 2, 3, 4, 5] only reuse `m % 3 === 0`, but when an item is deleted.. 
all these index after delete index value will be invalid, because `m % 2 === 0` could not be reused.

