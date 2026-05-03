# @x-oasis/url-search-params

## Installation

```bash
$ npm i @x-oasis/url-search-params
```

## How to use

```typescript
import { flatten, setSearchParams } from '@x-oasis/url-search-params'

flatten({ a: '1', b: '2' })            // 'a=1&b=2'
setSearchParams('https://x', { a: 1 }) // 'https://x?a=1'
```

## How to run test

```bash
$ pnpm test
```
