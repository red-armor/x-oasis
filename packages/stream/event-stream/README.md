# @x-oasis/event-stream

Push-pull bridged async event stream with final result aggregation.

EventStream 将 **推模型**（Producer 主动推送事件）与 **拉模型**（Consumer 按需拉取事件）桥接在一起，通过一个内部互斥缓冲区自动平衡两端速度差异。它是处理异步事件序列的基础原语 -- 比 callback 更可组合，比 Observable 更轻量，比 ReadableStream 更贴合"有终止语义的事件序列"场景。

## Installation

```bash
$ npm i @x-oasis/event-stream
```

## Why EventStream

### 核心问题

在异步系统中，事件的**生产**和**消费**往往处于不同的速率和时机：

| 情况 | 表现 | 传统方案的问题 |
|------|------|---------------|
| 生产快于消费 | 消费者还没准备好，事件已经产出 | Callback 会丢失事件；Promise 只能表达单值 |
| 消费快于生产 | 消费者在等待，生产者还没产出 | 轮询浪费资源；手动管理 Promise 链繁琐 |
| 需要最终结果 | 有时只关心所有事件结束后的聚合值 | 需要额外维护状态和完成信号 |
| 需要错误传播 | 生产端出错，消费端需要感知 | Callback 链的错误传播容易遗漏 |

### EventStream 的解法

一个 EventStream 实例同时扮演两个角色：

- **对 Producer（生产者）**: 它是一个事件收集器 -- 调用 `push()` 推入事件，调用 `end()` 或 `error()` 终止
- **对 Consumer（消费者）**: 它是一个 `AsyncIterable` -- 用 `for await...of` 逐个拉取事件，或用 `await result()` 直接获取最终聚合值

两端通过内部的 queue/waiting 互斥缓冲区自动协调，无需手动同步。

## How It Works

### 内部结构

```
Producer                   EventStream                   Consumer
                    ┌─────────────────────────┐
  push(event) ────> │  queue: [e1, e2, ...]   │ ───> for await...of
                    │  waiting: [resolve, ...] │
  end(result) ────> │  done: boolean           │ ───> await result()
  error(reason) ──> │  finalResultPromise      │
                    └─────────────────────────┘
```

### 推拉平衡

`queue`（缓冲队列）和 `waiting`（消费者等待队列）构成互斥关系 -- 同一时刻只有其中一个持有元素：

```
场景 A: Producer 先于 Consumer（生产快于消费）

  push(1)  →  queue: [1]       waiting: []
  push(2)  →  queue: [1, 2]    waiting: []
  push(3)  →  queue: [1, 2, 3] waiting: []
  next()   →  queue: [2, 3]    waiting: []      ← 立即返回 1
  next()   →  queue: [3]       waiting: []      ← 立即返回 2
```

```
场景 B: Consumer 先于 Producer（消费快于生产）

  next()   →  queue: []  waiting: [resolve1]     ← 挂起等待
  next()   →  queue: []  waiting: [resolve1, resolve2]
  push(1)  →  queue: []  waiting: [resolve2]     ← 直接投递给 resolve1
  push(2)  →  queue: []  waiting: []             ← 直接投递给 resolve2
```

### 双泛型设计

```typescript
class EventStream<T, R = T> implements AsyncIterable<T>
```

- **`T`** -- 流中每个事件的类型（逐个消费）
- **`R`** -- 最终聚合结果的类型（通过 `result()` 获取）

分离这两个类型，使得同一个流既支持"逐事件处理"又支持"只取最终结果"，两种消费模式互不干扰。

### 三种终止路径

| 方式 | 触发 | result() 行为 | 适用场景 |
|------|------|--------------|---------|
| `push(terminalEvent)` | 事件满足 `isComplete` | resolve（extractResult 提取值） | 协议内终止：事件本身包含结束信号 |
| `end(result?)` | 外部调用 | resolve（传入值） | 协议外终止：Promise resolve、abort 等 |
| `error(reason)` | 外部调用 | reject（传入 reason） | 异常终止：网络错误、超时等 |

三种路径都会立即停止迭代，唤醒所有等待中的消费者。

## API

### Constructor

```typescript
import { EventStream } from '@x-oasis/event-stream';

const stream = new EventStream<T, R>({
  isComplete: (event: T) => boolean,   // 判断是否为终止事件
  extractResult: (event: T) => R,      // 从终止事件提取最终结果
});
```

### Producer API

```typescript
stream.push(event: T): void       // 推入一个事件
stream.end(result?: R): void      // 从外部终止流（正常）
stream.error(reason: unknown): void  // 从外部终止流（异常）
```

### Consumer API

```typescript
// 逐事件消费
for await (const event of stream) {
  // 处理每个事件
}

// 只取最终结果
const result: R = await stream.result();
```

### Introspection

```typescript
stream.state: 'idle' | 'flowing' | 'done'  // 当前状态
stream.isDone: boolean                       // 是否已终止
stream.bufferedCount: number                 // 缓冲区中未消费的事件数
stream.waitingCount: number                  // 等待中的消费者数
```

## Producer Scenarios

### Scenario 1: LLM Streaming Response

最典型的场景。LLM 通过 SSE 逐个推送 token，消费者实时渲染。

```typescript
import { EventStream } from '@x-oasis/event-stream';

type LLMEvent =
  | { type: 'token'; text: string }
  | { type: 'done'; fullText: string };

function streamFromLLM(prompt: string): EventStream<LLMEvent, string> {
  const stream = new EventStream<LLMEvent, string>({
    isComplete: (e) => e.type === 'done',
    extractResult: (e) => (e as { type: 'done'; fullText: string }).fullText,
  });

  // Producer: fetch SSE and push events
  fetch('/api/chat', {
    method: 'POST',
    body: JSON.stringify({ prompt }),
  }).then(async (response) => {
    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    let fullText = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const token = decoder.decode(value);
      fullText += token;
      stream.push({ type: 'token', text: token });
    }

    stream.push({ type: 'done', fullText });
  }).catch((err) => {
    stream.error(err);
  });

  return stream;
}
```

**Producer 的价值**: SSE/fetch 是推模型，数据到达时必须立即处理。EventStream 将这些推送缓冲起来，下游消费者可以按自己的节奏处理，不会丢失任何 token。

### Scenario 2: Multi-stage Data Pipeline

每个处理阶段是一个独立的 EventStream，上游的输出喂入下游的输入。

```typescript
import { EventStream } from '@x-oasis/event-stream';

type FetchEvent =
  | { type: 'row'; data: string }
  | { type: 'done'; rows: string[] };

type ParseEvent =
  | { type: 'record'; record: Record<string, unknown> }
  | { type: 'done'; records: Record<string, unknown>[] };

function fetchStage(url: string): EventStream<FetchEvent, string[]> {
  const stream = new EventStream<FetchEvent, string[]>({
    isComplete: (e) => e.type === 'done',
    extractResult: (e) => (e as { type: 'done'; rows: string[] }).rows,
  });

  // Producer: fetch rows from API
  fetchRows(url).then((rows) => {
    for (const row of rows) {
      stream.push({ type: 'row', data: row });
    }
    stream.push({ type: 'done', rows });
  });

  return stream;
}

function parseStage(upstream: EventStream<FetchEvent, string[]>): EventStream<ParseEvent, Record<string, unknown>[]> {
  const stream = new EventStream<ParseEvent, Record<string, unknown>[]>({
    isComplete: (e) => e.type === 'done',
    extractResult: (e) => (e as { type: 'done'; records: Record<string, unknown>[] }).records,
  });

  // Producer: consume upstream, transform, push downstream
  (async () => {
    const records: Record<string, unknown>[] = [];
    for await (const event of upstream) {
      if (event.type === 'row') {
        const record = JSON.parse(event.data);
        records.push(record);
        stream.push({ type: 'record', record });
      }
    }
    stream.push({ type: 'done', records });
  })();

  return stream;
}

// Usage: chain stages
const fetched = fetchStage('/api/data');
const parsed = parseStage(fetched);

for await (const event of parsed) {
  if (event.type === 'record') {
    renderRow(event.record);
  }
}
```

**Producer 的价值**: 每个阶段只关心自己的输入和输出，通过 EventStream 接口解耦。新增阶段只需实现"消费上游 + 推送下游"的模式，无需修改已有代码。

### Scenario 3: Wrapping Callback-based APIs

将回调式 API（WebSocket、EventSource、Worker 等）包装为可迭代的流。

```typescript
import { EventStream } from '@x-oasis/event-stream';

function fromWebSocket<T>(url: string): EventStream<T, void> {
  const stream = new EventStream<T, void>({
    isComplete: () => false,
    extractResult: () => undefined,
  });

  const ws = new WebSocket(url);
  ws.onmessage = (e) => stream.push(JSON.parse(e.data));
  ws.onerror = (e) => stream.error(new Error('WebSocket error'));
  ws.onclose = () => stream.end();

  return stream;
}

// Consumer: clean async iteration over WebSocket messages
const messages = fromWebSocket<{ user: string; text: string }>('wss://chat.example.com');

for await (const msg of messages) {
  console.log(`${msg.user}: ${msg.text}`);
}
```

**Producer 的价值**: WebSocket/EventSource 的 `onmessage` 是纯推模型，没有背压概念。EventStream 在中间缓冲，消费者可以用 `await` 控制处理节奏，不会被推送淹没。

## Consumer Scenarios

### Scenario 1: Incremental Rendering (for await...of)

逐个处理事件，适合实时 UI 更新。

```typescript
const stream = streamFromLLM('Explain EventStream');

const container = document.getElementById('output')!;

for await (const event of stream) {
  if (event.type === 'token') {
    container.textContent += event.text; // 逐字渲染
  }
}
```

**Consumer 的价值**: `for await...of` 天然提供背压 -- 消费者处理完一个事件后才会拉取下一个。如果渲染很慢，producer 端的事件会自动在 buffer 中排队，不会丢失。

### Scenario 2: Result-only (await result())

只关心最终聚合值，跳过所有中间事件。

```typescript
// 只要最终的完整文本，不关心中间 token
const fullText = await streamFromLLM('Summarize this article').result();
console.log(fullText);
```

**Consumer 的价值**: 不需要写任何迭代逻辑。EventStream 内部的 `extractResult` 在收到终止事件时自动提取结果，consumer 只需一个 `await`。适合批处理、测试、脚本等不需要实时反馈的场景。

### Scenario 3: Selective Consumption

只消费部分事件，然后提前退出。

```typescript
const stream = createDataStream();

for await (const event of stream) {
  if (event.type === 'data' && event.value > threshold) {
    // 找到目标值，提前退出迭代
    processResult(event.value);
    break;
  }
}

// 迭代退出后，stream 中剩余的缓冲事件不会被消费
// 但 stream 的生命周期由 producer 控制，不受 break 影响
```

### Scenario 4: Error Recovery

消费端处理生产端的异常。

```typescript
const stream = fromWebSocket('wss://api.example.com');

// 迭代在 stream.error() 被调用时自动终止
for await (const msg of stream) {
  handleMessage(msg);
}

// 迭代结束后检查结果
try {
  await stream.result();
  console.log('Stream closed normally');
} catch (err) {
  console.error('Stream failed:', err.message);
  // 可以创建新的 stream 重试
}
```

**Consumer 的价值**: 错误不会在迭代中抛出（迭代只是安静地结束），而是通过 `result()` 的 rejection 传播。消费者可以先完成清理工作，再统一处理错误。

## Design Decisions

| 决策 | 理由 |
|------|------|
| 单消费者 | `asyncIterator` 每次 `shift()` 队列，多消费者会丢事件。这是有意的简化 -- 绝大多数场景只有一个消费者 |
| 无背压控制 | 不限制 buffer 大小。对 LLM token 流等有限事件量的场景足够，高吞吐场景应使用 ReadableStream |
| 终止事件也投递 | `push(terminalEvent)` 会将终止事件也交给消费者，消费者可以看到"done"事件并据此做清理 |
| `end()` 不投递 | `end()` 只终止流，不推入事件。适合完成信号来自协议外部的场景 |
| unhandled rejection 防护 | 构造时即 `.catch(() => {})` 防止 Node.js 警告，rejection 仍可通过 `result()` 观察 |
| options 对象构造 | 比位置参数更清晰，避免 `isComplete` 和 `extractResult` 的参数顺序混淆 |

## Visual Examples

打开 `examples/index.html` 可在浏览器中运行 5 个可视化 demo：

1. **Push / Pull** -- 三栏流转动画，观察事件从 Producer 经 Buffer 到 Consumer 的流转
2. **LLM Streaming** -- 模拟 LLM token 流，打字机效果逐字渲染
3. **Pipeline** -- 多阶段管道处理，阶段灯 + 进度条展示数据流转
4. **Error Recovery** -- 对比正常终止和异常终止的行为差异
5. **Result Only** -- 跳过迭代，只等待最终聚合结果

```bash
# 直接打开即可，无需构建
open examples/index.html
```
