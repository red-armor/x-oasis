# @x-oasis/push-stream

A single-consumer, push-pull bridged async stream. Modeled after [claude-code](https://github.com/anthropics/claude-code)'s `Stream<T>` — a low-level transport pipe for producer-consumer event delivery.

## Install

```bash
npm install @x-oasis/push-stream
```

## Quick Start

```ts
import { PushStream } from '@x-oasis/push-stream';

const stream = new PushStream<string>();

// Producer side
stream.enqueue('hello');
stream.enqueue('world');
stream.done();

// Consumer side
for await (const value of stream) {
  console.log(value); // 'hello', 'world'
}
```

## API

### `new PushStream<T>(options?)`

Create a new stream.

| Option | Type | Description |
|--------|------|-------------|
| `onReturn` | `() => void` | Called when the consumer breaks out of iteration early. Use for cleanup (abort fetch, close socket, etc.). |

### Producer API

| Method | Description |
|--------|-------------|
| `enqueue(value: T)` | Push a value. Delivered directly to a waiting consumer or buffered. Silently discarded after `done()` / `error()`. |
| `done()` | Mark stream as completed. Pending and subsequent `next()` calls return `{ done: true }`. |
| `error(err: unknown)` | Terminate with error. Pending `next()` is rejected. Subsequent `next()` calls also reject with the stored error. |

### Consumer API

| Method | Description |
|--------|-------------|
| `[Symbol.asyncIterator]()` | Returns `AsyncIterableIterator<T>`. Throws if called twice (single-consumer). |
| `next()` | Pull next value. Resolves immediately if buffered, otherwise suspends. |
| `return()` | Called on early break. Marks done and invokes `onReturn`. |

### Introspection

| Property | Type | Description |
|----------|------|-------------|
| `state` | `'idle' \| 'flowing' \| 'error' \| 'done'` | Current stream state. |
| `isDone` | `boolean` | Whether terminated (by `done()`, `error()`, or `return()`). |
| `bufferedCount` | `number` | Number of buffered values not yet consumed. |
| `hasWaiting` | `boolean` | Whether a consumer is currently waiting for `next()`. |

## Comparison with `@x-oasis/event-stream`

| Feature | `PushStream` | `EventStream` |
|---------|-------------|--------------|
| Completion | Explicit via `done()` | Event-driven via `isComplete` predicate |
| Final result | None (pure transport) | `result(): Promise<R>` with `extractResult` |
| Error handling | `error()` rejects pending + future `next()` | `error()` rejects `result()` promise |
| Consumer enforcement | Strict single-consumer (throws) | Soft single-consumer (second gets empty) |
| `onReturn` callback | Supported | Not supported |
| Use case | Low-level pipe, resource cleanup | Structured event protocol with aggregation |

## License

ISC
