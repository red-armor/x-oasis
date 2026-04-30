---
name: stream-processing
description: 使用 web-stream、push-stream 和 event-stream 工具处理流式数据。处理异步迭代、SSE 解析和实时数据流。
---

# 流处理技能

## 何时使用此技能

当你需要以下操作时使用此技能：
- **处理流式数据**（文件、网络响应、实时事件）
- **处理大型数据集** 而无需将所有数据加载到内存中
- **解析服务器发送事件 (SSE)** 来自 API
- **在不同异步模式之间转换**（迭代器、可读、可观察）
- **使用实时数据构建应用程序**

## 快速入门

```typescript
import { toAsyncIterable } from '@x-oasis/web-stream';
import { PushStream } from '@x-oasis/push-stream';
import { EventStream } from '@x-oasis/event-stream';

// 将 ReadableStream 转换为异步可迭代
const response = await fetch('/api/data');
for await (const chunk of toAsyncIterable(response.body!)) {
  console.log('块：', chunk);
}

// 为手动控制创建推送流
const stream = new PushStream<string>();
stream.enqueue('data1');
stream.enqueue('data2');
stream.done();

for await (const item of stream) {
  console.log('项目：', item);
}

// 带聚合的事件流
const eventStream = new EventStream<number>();
eventStream.push(1);
eventStream.push(2);
const result = await eventStream.result();
console.log('最终结果：', result);
```

## 可用工具

| 类/函数 | 目的 | 用例 |
|---|---|---|
| `toAsyncIterable(readableStream)` | 转换为异步迭代器 | 像迭代器一样处理流 |
| `PushStream<T>` | 手动控制流 | 以程序方式生成数据 |
| `EventStream<T>` | 推拉桥 | 聚合最终结果 |
| `parseJsonEventStream()` | 解析 SSE JSON | 处理流式 API |
| `SSEParser()` | 解析原始 SSE | 处理服务器发送事件 |

## 模式 1：转换 ReadableStream

```typescript
import { toAsyncIterable } from '@x-oasis/web-stream';

// 使用 fetch 响应
const response = await fetch('/api/stream');
const iterator = toAsyncIterable(response.body!);

for await (const chunk of iterator) {
  // 处理每个块
  const text = new TextDecoder().decode(chunk);
  console.log('接收：', text);
}
```

**真实例子：处理大文件上传**

```typescript
async function processLargeFile(file: File) {
  const stream = file.stream();
  const iterator = toAsyncIterable(stream);

  let totalSize = 0;
  for await (const chunk of iterator) {
    totalSize += (chunk as Uint8Array).byteLength;
    updateProgressBar(totalSize, file.size);
    
    // 处理块
    await processChunk(chunk);
  }
}
```

## 模式 2：用于生成器的 PushStream

```typescript
import { PushStream } from '@x-oasis/push-stream';

// 创建你控制的流
async function* dataGenerator() {
  const stream = new PushStream<string>();

  // 异步生成数据
  setTimeout(() => stream.enqueue('data1'), 100);
  setTimeout(() => stream.enqueue('data2'), 200);
  setTimeout(() => stream.enqueue('data3'), 300);
  setTimeout(() => stream.done(), 400);

  yield* stream;
}

// 消费流
for await (const data of dataGenerator()) {
  console.log('得到：', data);
}
```

**真实例子：轮询 API**

```typescript
import { PushStream } from '@x-oasis/push-stream';

async function* pollAPI(url: string, interval: number) {
  const stream = new PushStream<any>();

  const id = setInterval(async () => {
    try {
      const response = await fetch(url);
      const data = await response.json();
      stream.enqueue(data);
    } catch (error) {
      stream.error(error);
    }
  }, interval);

  try {
    yield* stream;
  } finally {
    clearInterval(id);
  }
}

// 使用
for await (const data of pollAPI('/api/status', 1000)) {
  console.log('状态：', data);
}
```

## 模式 3：用于聚合的 EventStream

```typescript
import { EventStream } from '@x-oasis/event-stream';

// 收集和聚合结果的流
const results = new EventStream<number>();

// 推送值
results.push(10);
results.push(20);
results.push(30);
results.done();

// 获取最终结果
const sum = await results.result();
console.log('总计：', sum); // 可以是所有值的总和
```

**真实例子：收集多个更新**

```typescript
import { EventStream } from '@x-oasis/event-stream';

class DataCollector {
  private stream = new EventStream<Data>();

  addData(data: Data) {
    this.stream.push(data);
  }

  complete() {
    this.stream.done();
  }

  async getAggregated() {
    return this.stream.result();
  }
}

// 使用
const collector = new DataCollector();
collector.addData({ id: 1, value: 100 });
collector.addData({ id: 2, value: 200 });
collector.complete();

const total = await collector.getAggregated();
```

## 模式 4：解析服务器发送事件

```typescript
import { parseJsonEventStream, SSEParser } from '@x-oasis/web-stream';

// 从 SSE 流解析 JSON
async function* handleSSE(url: string) {
  const response = await fetch(url);
  const stream = parseJsonEventStream(response.body!);

  for await (const event of stream) {
    console.log('事件：', event);
    yield event;
  }
}

// 使用
for await (const data of handleSSE('/api/events')) {
  console.log('数据：', data);
}
```

**真实例子：实时聊天消息**

```typescript
import { parseJsonEventStream } from '@x-oasis/web-stream';

async function streamMessages(chatId: string) {
  const response = await fetch(`/api/chat/${chatId}/stream`);
  const events = parseJsonEventStream(response.body!);

  for await (const message of events) {
    displayMessage({
      id: message.id,
      author: message.author,
      text: message.text,
      timestamp: new Date(message.timestamp),
    });
  }
}

// 在组件中
useEffect(() => {
  streamMessages(chatId).catch(console.error);
}, [chatId]);
```

## 模式 5：转换流

```typescript
import { toAsyncIterable } from '@x-oasis/web-stream';

// 创建转换管道
async function* transformStream<T, U>(
  source: AsyncIterable<T>,
  transform: (item: T) => U
): AsyncGenerator<U> {
  for await (const item of source) {
    yield transform(item);
  }
}

// 使用：解析和转换
const response = await fetch('/api/data');
const lines = toAsyncIterable(response.body!);

const parsed = transformStream(lines, (chunk) => {
  const text = new TextDecoder().decode(chunk as Uint8Array);
  return JSON.parse(text);
});

for await (const data of parsed) {
  console.log('已解析：', data);
}
```

## 模式 6：流中的错误处理

```typescript
import { PushStream } from '@x-oasis/push-stream';

async function* safeStream<T>(
  generator: AsyncGenerator<T>
): AsyncGenerator<T | Error> {
  try {
    for await (const item of generator) {
      yield item;
    }
  } catch (error) {
    yield error as Error;
  }
}

// 使用
const stream = new PushStream<number>();
stream.enqueue(1);
stream.enqueue(2);
stream.error(new Error('流错误'));

for await (const item of safeStream(stream)) {
  if (item instanceof Error) {
    console.error('流错误：', item.message);
  } else {
    console.log('值：', item);
  }
}
```

## 模式 7：速率限制流

```typescript
import { PushStream } from '@x-oasis/push-stream';

async function* rateLimitedStream<T>(
  source: AsyncIterable<T>,
  delayMs: number
): AsyncGenerator<T> {
  for await (const item of source) {
    yield item;
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }
}

// 使用：最多每秒处理 1 项
const response = await fetch('/api/items');
const items = toAsyncIterable(response.body!);
const limited = rateLimitedStream(items, 1000);

for await (const item of limited) {
  console.log('正在处理：', item);
}
```

## 模式 8：缓冲流项目

```typescript
import { PushStream } from '@x-oasis/push-stream';

async function* bufferedStream<T>(
  source: AsyncIterable<T>,
  bufferSize: number
): AsyncGenerator<T[]> {
  let buffer: T[] = [];

  for await (const item of source) {
    buffer.push(item);

    if (buffer.length >= bufferSize) {
      yield [...buffer];
      buffer = [];
    }
  }

  if (buffer.length > 0) {
    yield buffer;
  }
}

// 使用：按批处理
const response = await fetch('/api/data');
const items = toAsyncIterable(response.body!);
const batches = bufferedStream(items, 10);

for await (const batch of batches) {
  console.log('正在处理批次：', batch.length);
  await processBatch(batch);
}
```

## 最佳实践

### ✅ 做法

```typescript
// 始终清理流
for await (const chunk of stream) {
  // 如果需要早期中断
  if (done) break; // 将触发清理
}

// 处理错误
try {
  for await (const item of stream) {
    process(item);
  }
} catch (error) {
  console.error('流错误：', error);
}

// 使用缓冲以提高效率
const batches = bufferedStream(items, 100);
for await (const batch of batches) {
  await processBatch(batch); // 更少的往返
}
```

### ❌ 不做法

```typescript
// 不要忽视流错误
for await (const item of stream) {
  // 如果流在迭代中出错呢？
  process(item);
}

// 不要将整个流加载到内存中
const allItems = [];
for await (const item of stream) {
  allItems.push(item); // 可能是数百万！
}

// 不要在异步流中使用非异步迭代
const items = await Promise.all(stream); // 错！
```

## 常见陷阱

### 陷阱 1：不关闭资源

```typescript
// ❌ 文件句柄可能泄漏
async function readFile(path: string) {
  const file = await open(path);
  for await (const line of file) {
    processLine(line);
  }
  // 缺少：file.close()
}

// ✅ 使用 try-finally 或 for-await
async function readFile(path: string) {
  const file = await open(path);
  try {
    for await (const line of file) {
      processLine(line);
    }
  } finally {
    await file.close();
  }
}
```

### 陷阱 2：缓冲区大小太大

```typescript
// ❌ 一次加载所有块违反了流的目的
const allChunks = [];
for await (const chunk of stream) {
  allChunks.push(chunk);
}
const result = processAll(allChunks); // 现在我们加载了所有内容！

// ✅ 随时处理
for await (const chunk of stream) {
  processChunk(chunk);
  // 无论流大小如何，内存恒定
}
```

### 陷阱 3：忽视背压

```typescript
// ❌ 源生产速度快于消费
for await (const item of fastSource) {
  await slowProcess(item); // 项目堆积！
}

// ✅ 实现适当的背压
const limited = rateLimitedStream(fastSource, 100);
for await (const item of limited) {
  await slowProcess(item); // 控制步调
}
```

## 集成示例

### 使用 React

```typescript
import { useEffect, useState } from 'react';
import { parseJsonEventStream } from '@x-oasis/web-stream';

function LiveData() {
  const [data, setData] = useState([]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const response = await fetch('/api/stream');
      const stream = parseJsonEventStream(response.body!);

      for await (const item of stream) {
        if (cancelled) break;
        setData((prev) => [...prev, item]);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return <div>{data.map((item) => <div key={item.id}>{item}</div>)}</div>;
}
```

### 使用 Node.js

```typescript
import fs from 'fs';
import { toAsyncIterable } from '@x-oasis/web-stream';

async function processLargeLog(filePath: string) {
  const stream = fs.createReadStream(filePath);
  const iter = toAsyncIterable(stream as any);

  for await (const chunk of iter) {
    const lines = chunk.toString().split('\n');
    lines.forEach((line) => processLogLine(line));
  }
}
```

## 参考资料

- [Web Stream API 集成](../../references/web-stream-reference.md)
- [PushStream 内部](../../references/push-stream-details.md)
- [SSE 解析指南](../../references/sse-parsing.md)
- [异步迭代模式](../../references/async-iteration.md)
