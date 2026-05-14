# @x-oasis/async-call-rpc

## 0.14.0

### Minor Changes

- 25c7918: fix(ProxyRPCClient): filter thenable / symbol probes in `createProxy()`

  The proxy returned by `ProxyRPCClient.createProxy()` previously synthesized
  a method for **any** property access, including:

  - `then` / `catch` / `finally` — read by the JS engine whenever the proxy
    flowed through `await` (legitimate when a factory returns the proxy
    through an async function);
  - `Symbol.toPrimitive` / `Symbol.iterator` / `Symbol.asyncIterator` /
    `Symbol.toStringTag` — read during string coercion, iteration, and
    `console.log` inspection;
  - `constructor` / `toJSON` — read by various inspector / serialization
    paths.

  Each such probe was dispatched as a real RPC request. The remote service
  of course had no `then` handler, replied with `-32601 Method not found`,
  and the rejection surfaced at the original `await` site as a confusing
  `UnhandledPromiseRejection` — making the proxy effectively impossible to
  return from any `async` factory.

  The trap now returns `undefined` for symbols and for the small fixed set
  of well-known thenable / inspector property names listed above; only
  genuine method calls are forwarded to `channel.makeRequest()`.

  Discovered while wiring the pagelet ↔ pagelet (P↔P) demo in
  `examples/orchestrator/multi-page-router-di`, where
  `await pageletWorker.connectToPeer(...)` triggered the thenable probe
  path on every call.

### Patch Changes

- 8145f6b: fix: p2p
- Updated dependencies [8145f6b]
  - @x-oasis/is-ascii@0.13.3
  - @x-oasis/is-function@0.13.3
  - @x-oasis/is-object@0.13.3
  - @x-oasis/is-promise@0.13.3
  - @x-oasis/disposable@0.13.3
  - @x-oasis/emitter@0.13.3
  - @x-oasis/id@0.13.3
  - @x-oasis/deferred@0.13.3

## 0.13.2

### Patch Changes

- f819527: feat: trace
- Updated dependencies [f819527]
  - @x-oasis/is-ascii@0.13.2
  - @x-oasis/is-function@0.13.2
  - @x-oasis/is-object@0.13.2
  - @x-oasis/is-promise@0.13.2
  - @x-oasis/disposable@0.13.2
  - @x-oasis/emitter@0.13.2
  - @x-oasis/id@0.13.2
  - @x-oasis/deferred@0.13.2

## 0.13.1

### Patch Changes

- 566278f: feat: add supervisor in utility process
- Updated dependencies [566278f]
  - @x-oasis/is-ascii@0.13.1
  - @x-oasis/is-function@0.13.1
  - @x-oasis/is-object@0.13.1
  - @x-oasis/is-promise@0.13.1
  - @x-oasis/disposable@0.13.1
  - @x-oasis/emitter@0.13.1
  - @x-oasis/id@0.13.1
  - @x-oasis/deferred@0.13.1

## 0.13.0

### Minor Changes

- b7e4240: fix: build issue

### Patch Changes

- Updated dependencies [b7e4240]
  - @x-oasis/is-ascii@0.13.0
  - @x-oasis/is-function@0.13.0
  - @x-oasis/is-object@0.13.0
  - @x-oasis/is-promise@0.13.0
  - @x-oasis/disposable@0.13.0
  - @x-oasis/emitter@0.13.0
  - @x-oasis/id@0.13.0
  - @x-oasis/deferred@0.13.0

## 0.12.0

### Minor Changes

- b0af3cc: feat: make di fit to orchestrator'

### Patch Changes

- Updated dependencies [b0af3cc]
  - @x-oasis/is-ascii@0.12.0
  - @x-oasis/is-function@0.12.0
  - @x-oasis/is-object@0.12.0
  - @x-oasis/is-promise@0.12.0
  - @x-oasis/disposable@0.12.0
  - @x-oasis/emitter@0.12.0
  - @x-oasis/id@0.12.0
  - @x-oasis/deferred@0.12.0

## 0.11.0

### Minor Changes

- 021c2ec: feat: electron pagelet connection

### Patch Changes

- Updated dependencies [021c2ec]
  - @x-oasis/is-ascii@0.11.0
  - @x-oasis/is-function@0.11.0
  - @x-oasis/is-object@0.11.0
  - @x-oasis/is-promise@0.11.0
  - @x-oasis/disposable@0.11.0
  - @x-oasis/emitter@0.11.0
  - @x-oasis/id@0.11.0
  - @x-oasis/deferred@0.11.0

## 0.10.0

### Minor Changes

- 86816b6: feat: update lock
- b29baa0: feat: more readable async call rpc client

### Patch Changes

- Updated dependencies [86816b6]
- Updated dependencies [b29baa0]
  - @x-oasis/is-ascii@0.10.0
  - @x-oasis/is-function@0.10.0
  - @x-oasis/is-object@0.10.0
  - @x-oasis/is-promise@0.10.0
  - @x-oasis/disposable@0.10.0
  - @x-oasis/emitter@0.10.0
  - @x-oasis/id@0.10.0
  - @x-oasis/deferred@0.10.0

## 0.9.0

### Minor Changes

- f7ae61f: feat: add page / renderer channel

### Patch Changes

- 7385260: feat: update lock file
- Updated dependencies [f7ae61f]
- Updated dependencies [7385260]
  - @x-oasis/is-ascii@0.9.0
  - @x-oasis/is-function@0.9.0
  - @x-oasis/is-object@0.9.0
  - @x-oasis/is-promise@0.9.0
  - @x-oasis/disposable@0.9.0
  - @x-oasis/emitter@0.9.0
  - @x-oasis/id@0.9.0
  - @x-oasis/deferred@0.9.0

## 0.8.1

### Patch Changes

- ec92705: feat: finish rpc electron gap
- Updated dependencies [ec92705]
  - @x-oasis/is-ascii@0.8.1
  - @x-oasis/is-function@0.8.1
  - @x-oasis/is-object@0.8.1
  - @x-oasis/is-promise@0.8.1
  - @x-oasis/disposable@0.8.1
  - @x-oasis/emitter@0.8.1
  - @x-oasis/id@0.8.1
  - @x-oasis/deferred@0.8.1

## 0.8.0

### Minor Changes

- d9de1de: fix: types dist issue

### Patch Changes

- 05cc74a: feat: rename to is-proxy-supported
- Updated dependencies [05cc74a]
- Updated dependencies [d9de1de]
  - @x-oasis/is-ascii@0.8.0
  - @x-oasis/is-function@0.8.0
  - @x-oasis/is-object@0.8.0
  - @x-oasis/is-promise@0.8.0
  - @x-oasis/disposable@0.8.0
  - @x-oasis/emitter@0.8.0
  - @x-oasis/id@0.8.0
  - @x-oasis/deferred@0.8.0

## 0.7.0

### Minor Changes

- be6411b: fix: build issue

### Patch Changes

- Updated dependencies [be6411b]
  - @x-oasis/is-ascii@0.7.0
  - @x-oasis/is-function@0.7.0
  - @x-oasis/is-object@0.7.0
  - @x-oasis/is-promise@0.7.0
  - @x-oasis/disposable@0.7.0
  - @x-oasis/emitter@0.7.0
  - @x-oasis/id@0.7.0
  - @x-oasis/deferred@0.7.0

## 0.6.0

### Minor Changes

- 2f8a0f2: feat: revert package.json
- 103b0fe: feat: update resume

### Patch Changes

- Updated dependencies [2f8a0f2]
- Updated dependencies [103b0fe]
  - @x-oasis/is-ascii@0.6.0
  - @x-oasis/is-function@0.6.0
  - @x-oasis/is-object@0.6.0
  - @x-oasis/is-promise@0.6.0
  - @x-oasis/disposable@0.6.0
  - @x-oasis/emitter@0.6.0
  - @x-oasis/id@0.6.0
  - @x-oasis/deferred@0.6.0

## 0.5.0

### Minor Changes

- 4c3dccd: feat: manage async call rpc port

### Patch Changes

- Updated dependencies [4c3dccd]
  - @x-oasis/is-ascii@0.5.0
  - @x-oasis/is-function@0.5.0
  - @x-oasis/is-object@0.5.0
  - @x-oasis/is-promise@0.5.0
  - @x-oasis/disposable@0.5.0
  - @x-oasis/emitter@0.5.0
  - @x-oasis/id@0.5.0
  - @x-oasis/deferred@0.5.0

## 0.4.0

### Minor Changes

- 6d79ee1: feat: bump version

### Patch Changes

- Updated dependencies [6d79ee1]
  - @x-oasis/is-ascii@0.4.0
  - @x-oasis/is-function@0.4.0
  - @x-oasis/is-object@0.4.0
  - @x-oasis/is-promise@0.4.0
  - @x-oasis/disposable@0.4.0
  - @x-oasis/emitter@0.4.0
  - @x-oasis/id@0.4.0
  - @x-oasis/deferred@0.4.0

## 0.3.0

### Minor Changes

- 2f68e5c: feat: bump version
- 71159c0: feat: bump version
- 6784c72: feat: bump
- 04f5045: feat: bump version
- 208592f: feat: bump version

### Patch Changes

- Updated dependencies [2f68e5c]
- Updated dependencies [71159c0]
- Updated dependencies [6784c72]
- Updated dependencies [04f5045]
- Updated dependencies [208592f]
  - @x-oasis/is-ascii@0.3.0
  - @x-oasis/is-promise@0.3.0
  - @x-oasis/disposable@0.3.0
  - @x-oasis/emitter@0.3.0
  - @x-oasis/id@0.3.0
  - @x-oasis/deferred@0.3.0

## 0.2.5

### Patch Changes

- 680fc8f: fix lint issue
- 56f3afd: fix lint
- 0d5e07c: update di
- Updated dependencies [680fc8f]
- Updated dependencies [56f3afd]
- Updated dependencies [0d5e07c]
  - @x-oasis/is-ascii@0.2.5
  - @x-oasis/is-promise@0.2.5
  - @x-oasis/disposable@0.2.5
  - @x-oasis/emitter@0.2.5
  - @x-oasis/id@0.2.5
  - @x-oasis/deferred@0.2.5

## 0.2.4

### Patch Changes

- 9280368: fix [...newSet(list)] issue
- Updated dependencies [9280368]
  - @x-oasis/is-ascii@0.2.4
  - @x-oasis/is-promise@0.2.4
  - @x-oasis/disposable@0.2.4
  - @x-oasis/emitter@0.2.4
  - @x-oasis/id@0.2.4
  - @x-oasis/deferred@0.2.4

## 0.2.3

### Patch Changes

- ef364cf: fix html diff
- Updated dependencies [ef364cf]
  - @x-oasis/is-ascii@0.2.3
  - @x-oasis/is-promise@0.2.3
  - @x-oasis/disposable@0.2.3
  - @x-oasis/emitter@0.2.3
  - @x-oasis/id@0.2.3
  - @x-oasis/deferred@0.2.3

## 0.2.2

### Patch Changes

- fbf782d: fix html diff
- Updated dependencies [fbf782d]
  - @x-oasis/is-ascii@0.2.2
  - @x-oasis/is-promise@0.2.2
  - @x-oasis/disposable@0.2.2
  - @x-oasis/emitter@0.2.2
  - @x-oasis/id@0.2.2
  - @x-oasis/deferred@0.2.2

## 0.2.1

### Patch Changes

- cfaacab: bump version diff html
- Updated dependencies [cfaacab]
  - @x-oasis/is-ascii@0.2.1
  - @x-oasis/is-promise@0.2.1
  - @x-oasis/disposable@0.2.1
  - @x-oasis/emitter@0.2.1
  - @x-oasis/id@0.2.1
  - @x-oasis/deferred@0.2.1

## 0.2.0

### Minor Changes

- c16e063: bump version

### Patch Changes

- f7a393b: bump diff range
- b666c87: bump next
- a33ef8e: bump version
- 8256c76: bump version
- 33888cc: permission
- Updated dependencies [f7a393b]
- Updated dependencies [b666c87]
- Updated dependencies [a33ef8e]
- Updated dependencies [8256c76]
- Updated dependencies [33888cc]
- Updated dependencies [c16e063]
  - @x-oasis/is-ascii@0.2.0
  - @x-oasis/is-promise@0.2.0
  - @x-oasis/disposable@0.2.0
  - @x-oasis/emitter@0.2.0
  - @x-oasis/id@0.2.0
  - @x-oasis/deferred@0.2.0

## 0.1.41

### Patch Changes

- 0ddda70: fix: diff example
- Updated dependencies [0ddda70]
  - @x-oasis/is-ascii@0.1.41
  - @x-oasis/is-promise@0.1.41
  - @x-oasis/disposable@0.1.41
  - @x-oasis/emitter@0.1.41
  - @x-oasis/id@0.1.41
  - @x-oasis/deferred@0.1.41

## 0.1.40

### Patch Changes

- bf3f705: bump
- 1cd9ae3: bump
- 0699388: bump
- 9ef6a8f: fix: log package.json
- Updated dependencies [bf3f705]
- Updated dependencies [1cd9ae3]
- Updated dependencies [0699388]
- Updated dependencies [9ef6a8f]
  - @x-oasis/is-ascii@0.1.40
  - @x-oasis/is-promise@0.1.40
  - @x-oasis/disposable@0.1.40
  - @x-oasis/emitter@0.1.40
  - @x-oasis/id@0.1.40
  - @x-oasis/deferred@0.1.40

## 0.1.39

### Patch Changes

- f7326fb: bump diff
- Updated dependencies [f7326fb]
  - @x-oasis/is-ascii@0.1.39
  - @x-oasis/is-promise@0.1.39
  - @x-oasis/disposable@0.1.39
  - @x-oasis/emitter@0.1.39
  - @x-oasis/id@0.1.39
  - @x-oasis/deferred@0.1.39

## 0.1.38

### Patch Changes

- f1aae14: bump version
- Updated dependencies [f1aae14]
  - @x-oasis/is-ascii@0.1.38
  - @x-oasis/is-promise@0.1.38
  - @x-oasis/disposable@0.1.38
  - @x-oasis/emitter@0.1.38
  - @x-oasis/id@0.1.38
  - @x-oasis/deferred@0.1.38

## 0.1.37

### Patch Changes

- 8cb524c: trigger next

## 0.1.36

### Patch Changes

- 7c2a0ba: git add .
