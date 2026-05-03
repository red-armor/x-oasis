# @x-oasis/node-fetch-json

Tiny `get`/`post` helpers built on top of `node-fetch`. Each returns the
parsed JSON body with the original `Response` attached as `.raw`.

## Installation

```bash
$ npm i @x-oasis/node-fetch-json
```

## How to use

```typescript
import { get, post } from '@x-oasis/node-fetch-json'

const r = await post('https://api/endpoint', { foo: 'bar' })
console.log(r.someField)        // parsed JSON
console.log(r.raw.status)       // raw node-fetch Response

const g = await get('https://api/endpoint')
```

If the response body is not valid JSON, it is returned as `{ text }`. If it
parses to a non-object value (e.g. a number), it is wrapped as `{ value }`.
The original `Response` is always attached as `.raw`.
