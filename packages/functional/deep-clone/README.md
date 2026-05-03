# @x-oasis/deep-clone

## Installation

```bash
$ npm i @x-oasis/deep-clone
```

## How to use

```typescript
import deepClone from '@x-oasis/deep-clone'

const cloned = deepClone({ a: { b: 1 } })
```

`RegExp` instances are preserved by reference (not cloned).

## How to run test

```bash
$ pnpm test
```
