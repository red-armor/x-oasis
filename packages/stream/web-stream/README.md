# @x-oasis/web-stream

Web Streams API utilities: async-iterable bridging, SSE encoding/decoding, binary event stream decoding, and streaming tool call tracking.

基于 Web 标准 (`ReadableStream`, `TransformStream`) 的流式处理工具集。与 `@x-oasis/event-stream`（自定义推拉缓冲）和 `@x-oasis/push-stream`（单消费者管道）不同，本包遵循 **管道组合范式** -- 通过 `pipeThrough()` 将多个 TransformStream 链式组合，构建从原始字节到业务对象的完整解析管道。

零外部依赖。SSE 解析和 AWS EventStream 二进制解码均为内联实现。

## Install

```bash
npm install @x-oasis/web-stream
```

## Modules

| 模块 | 用途 | 对应 ide/ai 原始位置 |
|------|------|---------------------|
| `createAsyncIterableStream` | ReadableStream -> AsyncIterable 桥接 | `packages/ai/src/util/async-iterable-stream.ts` |
| `convertAsyncIteratorToReadableStream` | AsyncIterator -> ReadableStream 转换 | `packages/provider-utils/src/convert-async-iterator-to-readable-stream.ts` |
| `JsonToSseTransformStream` | JSON 对象 -> SSE 格式编码 | `packages/ai/src/ui-message-stream/json-to-sse-transform-stream.ts` |
| `SseParserStream` | SSE 文本 -> 结构化消息解析 | 替代 `eventsource-parser/stream` |
| `parseJsonEventStream` | SSE 字节流 -> 类型化 JSON 对象管道 | `packages/provider-utils/src/parse-json-event-stream.ts` |
| `createBedrockEventStreamDecoder` | AWS EventStream 二进制帧解码 | `packages/amazon-bedrock/src/bedrock-event-stream-decoder.ts` |
| `StreamingToolCallTracker` | 流式工具调用状态机 | `packages/provider-utils/src/streaming-tool-call-tracker.ts` |

## Core Concept: Pipeline Composition

与 `EventStream`/`PushStream` 的"单个对象包装全部逻辑"不同，`web-stream` 的设计哲学是 **小而可组合的 TransformStream**：

```
ReadableStream<Uint8Array>          ← HTTP response body
  .pipeThrough(TextDecoderStream)   ← 字节 -> 文本
  .pipeThrough(SseParserStream)     ← 文本 -> SSE 消息
  .pipeThrough(TransformStream)     ← SSE -> JSON 对象
  .pipeThrough(TransformStream)     ← JSON -> 业务类型
```

每一层只做一件事，通过 `pipeThrough()` 串联。新增处理逻辑只需插入新的 TransformStream，无需修改已有层。

## API

### createAsyncIterableStream

将 ReadableStream 包装为同时支持 `for await...of` 和 ReadableStream API 的对象。

```ts
import { createAsyncIterableStream } from '@x-oasis/web-stream';

const response = await fetch('/api/stream');
const stream = createAsyncIterableStream(response.body!);

// 两种消费方式均可
for await (const chunk of stream) {
  console.log(chunk);
}

// 或
const reader = stream.getReader();
const { value } = await reader.read();
```

特性：
- 通过 identity TransformStream 确保返回的流有独立的 reader lock
- `return()` / `throw()` 自动 cancel 底层 reader 并释放 lock
- `next()` 在流结束后返回 `{ done: true }`，安全可重入

### convertAsyncIteratorToReadableStream

反向转换：将 AsyncIterator 包装为 ReadableStream。

```ts
import { convertAsyncIteratorToReadableStream } from '@x-oasis/web-stream';

async function* generateTokens() {
  yield 'Hello';
  yield ' ';
  yield 'World';
}

const stream = convertAsyncIteratorToReadableStream(generateTokens());
// stream 现在是一个标准 ReadableStream，可以 pipe 到其他 TransformStream
```

特性：
- Pull-based：消费者请求时才调用 `iterator.next()`
- `cancel()` 传播到 `iterator.return()`，支持资源清理
- 异常自动通过 `controller.error()` 传播

### JsonToSseTransformStream

将 JSON 对象编码为 SSE 格式。用于服务端向客户端推送 SSE 响应。

```ts
import { JsonToSseTransformStream } from '@x-oasis/web-stream';

const events = new ReadableStream({
  start(controller) {
    controller.enqueue({ type: 'text', content: 'hello' });
    controller.enqueue({ type: 'done' });
    controller.close();
  },
});

const sseStream = events.pipeThrough(new JsonToSseTransformStream());
// 输出:
//   data: {"type":"text","content":"hello"}\n\n
//   data: {"type":"done"}\n\n
//   data: [DONE]\n\n
```

### SseParserStream

将 SSE 文本解析为结构化 `SseMessage` 对象。零依赖，按 WHATWG HTML 规范实现。

```ts
import { SseParserStream } from '@x-oasis/web-stream';

const textStream = response.body!.pipeThrough(new TextDecoderStream());
const messages = textStream.pipeThrough(new SseParserStream());

const reader = messages.getReader();
const { value } = await reader.read();
// value: { event: '', data: '{"type":"token","text":"hi"}', id: undefined, retry: undefined }
```

支持的 SSE 特性：
- `data:` / `event:` / `id:` / `retry:` 字段
- 多行 `data:` 合并
- 注释行（`:` 开头）过滤
- `\r\n` / `\r` / `\n` 行分隔符
- 跨 chunk 的不完整行缓冲

### parseJsonEventStream

端到端管道：SSE 字节流 -> 类型化 JSON 对象。组合了 `TextDecoderStream` + `SseParserStream` + JSON 解析 + 可选 schema 校验。

```ts
import { parseJsonEventStream } from '@x-oasis/web-stream';

const response = await fetch('/api/chat');
const stream = parseJsonEventStream<{ type: string; text?: string }>({
  stream: response.body!,
  // schema 可选，省略时直接返回 JSON.parse 结果
  schema: {
    parse(value) {
      // 自定义校验逻辑
      return value as { type: string; text?: string };
    },
  },
});

for await (const result of createAsyncIterableStream(stream)) {
  if (result.success) {
    console.log(result.value);
  } else {
    console.error('Parse error:', result.error);
  }
}
```

特性：
- `data: [DONE]` 事件自动过滤（OpenAI 约定）
- JSON 解析错误不会中断流，而是作为 `{ success: false }` 传递
- schema 校验错误同理

### createBedrockEventStreamDecoder

解码 AWS Bedrock 的二进制 EventStream 响应。零依赖，替代 `@smithy/eventstream-codec`。

```ts
import { createBedrockEventStreamDecoder } from '@x-oasis/web-stream';

interface BedrockChunk {
  bytes: string;
}

const stream = createBedrockEventStreamDecoder<BedrockChunk>(
  response.body!,
  (event, controller) => {
    if (event.messageType === 'event' && event.eventType === 'chunk') {
      controller.enqueue(JSON.parse(event.data));
    }
    if (event.messageType === 'exception') {
      controller.error(new Error(event.data));
    }
  },
);
```

帧格式（AWS EventStream binary protocol）：

```
Bytes 0-3:   total length (uint32 BE)
Bytes 4-7:   headers length (uint32 BE)
Bytes 8-11:  prelude CRC (skipped)
Bytes 12..:  headers (name-value pairs)
After hdrs:  payload
Last 4:      message CRC (skipped)
```

CRC 校验有意跳过 -- HTTPS 传输层已保证完整性。

### StreamingToolCallTracker

追踪 OpenAI 兼容的流式工具调用状态。将多个 delta chunk 累积为完整的 tool call，并在参数 JSON 完整时自动发出完成事件。

```ts
import { StreamingToolCallTracker } from '@x-oasis/web-stream';

const tracker = new StreamingToolCallTracker({
  typeValidation: 'if-present',
  generateId: () => `call_${Date.now()}`,
});

// 在 TransformStream 内使用
const transform = new TransformStream({
  transform(chunk, controller) {
    for (const toolCallDelta of chunk.choices[0].delta.tool_calls ?? []) {
      tracker.processDelta(toolCallDelta, (part) => controller.enqueue(part));
    }
  },
  flush(controller) {
    tracker.flush((part) => controller.enqueue(part));
  },
});
```

发出的事件序列：

```
tool-input-start  →  { id, toolName }           首次看到某个 tool call
tool-input-delta  →  { id, delta }              每次收到参数增量
tool-input-end    →  { id }                     参数 JSON 完整
tool-call         →  { toolCallId, toolName, input, metadata? }  最终完整调用
```

## Comparison with sibling packages

| 维度 | `web-stream` | `event-stream` | `push-stream` |
|------|-------------|---------------|--------------|
| 范式 | 管道组合（TransformStream 链） | 单对象推拉缓冲 | 单对象推拉管道 |
| 背压 | 有（ReadableStream 内建） | 无 | 无 |
| 最终结果 | 无 | `result(): Promise<R>` | 无 |
| 消费者约束 | ReadableStream 锁定 reader | 软约束 | 严格单消费者 |
| 资源清理 | cancel + releaseLock | 无 | `onReturn` 回调 |
| 适用场景 | 多层协议解析、HTTP 流 | 有终止语义的事件序列 | 低层传输管道 |

## Visual Examples

打开 `examples/index.html` 可在浏览器中运行 5 个可视化 demo：

1. **AsyncIterable Bridge** -- ReadableStream 与 for-await-of 的双向桥接
2. **SSE Roundtrip** -- JSON 编码为 SSE，再解析回 JSON 的往返验证
3. **LLM SSE Streaming** -- 模拟 LLM SSE 响应的端到端解析管道
4. **Tool Call Tracking** -- 流式工具调用的 delta 累积与事件发射
5. **Pipeline Composition** -- 多层 TransformStream 管道的数据流转可视化

```bash
# 直接打开即可，无需构建
open examples/index.html
```

## License

ISC
