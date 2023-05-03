# @x-oasis/unique-array-object

keep the last on default

## Installation

```bash
$ npm i @x-oasis/unique-array-object
```

## How to use

```typescript
import uniqueArrayObject from '@x-oasis/unique-array-object'
const state = [
  { name: 'viewable', value: 7 },
  { name: 'imageViewable', value: 9 }, 
  { name: 'viewable', value: 8 }
]

uniqueArrayObject(state, 'name')

// output
// [
//   { name: 'imageViewable', value: 9 }, 
//   { name: 'viewable', value: 8 },
// ]
```

## How to run test

```bash
$ pnpm test
```