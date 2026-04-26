import { describe, it, expect } from 'vitest';
import {
  createAsyncIterableStream,
  convertAsyncIteratorToReadableStream,
  JsonToSseTransformStream,
  SseParserStream,
  parseJsonEventStream,
  StreamingToolCallTracker,
} from '../src';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Create a ReadableStream from an array of chunks. */
function fromArray<T>(items: T[]): ReadableStream<T> {
  return new ReadableStream<T>({
    start(controller) {
      for (const item of items) {
        controller.enqueue(item);
      }
      controller.close();
    },
  });
}

/** Collect all items from an AsyncIterable into an array. */
async function collect<T>(iterable: AsyncIterable<T>): Promise<T[]> {
  const result: T[] = [];
  for await (const item of iterable) {
    result.push(item);
  }
  return result;
}

/** Collect all items from a ReadableStream into an array. */
async function collectStream<T>(stream: ReadableStream<T>): Promise<T[]> {
  const reader = stream.getReader();
  const result: T[] = [];
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    result.push(value);
  }
  return result;
}

/** Encode a string to Uint8Array. */
function encode(s: string): Uint8Array {
  return new TextEncoder().encode(s);
}

// ===========================================================================
// createAsyncIterableStream
// ===========================================================================

describe('createAsyncIterableStream', () => {
  it('should allow consuming a ReadableStream with for-await-of', async () => {
    const source = fromArray([1, 2, 3]);
    const stream = createAsyncIterableStream(source);
    const items = await collect(stream);
    expect(items).toEqual([1, 2, 3]);
  });

  it('should handle empty streams', async () => {
    const source = fromArray<number>([]);
    const stream = createAsyncIterableStream(source);
    const items = await collect(stream);
    expect(items).toEqual([]);
  });

  it('should support early break (return)', async () => {
    const source = fromArray([1, 2, 3, 4, 5]);
    const stream = createAsyncIterableStream(source);
    const items: number[] = [];

    for await (const item of stream) {
      items.push(item);
      if (item === 2) break;
    }

    expect(items).toEqual([1, 2]);
  });
});

// ===========================================================================
// convertAsyncIteratorToReadableStream
// ===========================================================================

describe('convertAsyncIteratorToReadableStream', () => {
  it('should convert an async iterator to a readable stream', async () => {
    async function* gen() {
      yield 'a';
      yield 'b';
      yield 'c';
    }

    const stream = convertAsyncIteratorToReadableStream(gen());
    const items = await collectStream(stream);
    expect(items).toEqual(['a', 'b', 'c']);
  });

  it('should handle empty iterators', async () => {
    async function* gen() {
      // empty
    }

    const stream = convertAsyncIteratorToReadableStream(gen());
    const items = await collectStream(stream);
    expect(items).toEqual([]);
  });

  it('should propagate errors from the iterator', async () => {
    async function* gen() {
      yield 'ok';
      throw new Error('boom');
    }

    const stream = convertAsyncIteratorToReadableStream(gen());
    const reader = stream.getReader();

    const first = await reader.read();
    expect(first.value).toBe('ok');

    await expect(reader.read()).rejects.toThrow('boom');
  });

  it('should call iterator.return on cancel', async () => {
    let returnCalled = false;

    const iterator: AsyncIterator<string> = {
      next: () => Promise.resolve({ done: false, value: 'x' }),
      return: () => {
        returnCalled = true;
        return Promise.resolve({ done: true, value: undefined });
      },
    };

    const stream = convertAsyncIteratorToReadableStream(iterator);
    const reader = stream.getReader();
    await reader.read();
    await reader.cancel();
    expect(returnCalled).toBe(true);
  });
});

// ===========================================================================
// JsonToSseTransformStream
// ===========================================================================

describe('JsonToSseTransformStream', () => {
  it('should convert JSON objects to SSE format', async () => {
    const source = fromArray([
      { type: 'text', data: 'hello' },
      { type: 'done' },
    ]);
    const stream = source.pipeThrough(new JsonToSseTransformStream());
    const items = await collectStream(stream);

    expect(items).toEqual([
      'data: {"type":"text","data":"hello"}\n\n',
      'data: {"type":"done"}\n\n',
      'data: [DONE]\n\n',
    ]);
  });

  it('should handle primitives', async () => {
    const source = fromArray([42, 'hello', true]);
    const stream = source.pipeThrough(new JsonToSseTransformStream());
    const items = await collectStream(stream);

    expect(items).toEqual([
      'data: 42\n\n',
      'data: "hello"\n\n',
      'data: true\n\n',
      'data: [DONE]\n\n',
    ]);
  });
});

// ===========================================================================
// SseParserStream
// ===========================================================================

describe('SseParserStream', () => {
  it('should parse basic SSE messages', async () => {
    const raw = 'data: hello\n\ndata: world\n\n';
    const source = fromArray([raw]);
    const stream = source.pipeThrough(new SseParserStream());
    const items = await collectStream(stream);

    expect(items).toEqual([
      { event: '', data: 'hello' },
      { event: '', data: 'world' },
    ]);
  });

  it('should handle named events', async () => {
    const raw = 'event: update\ndata: payload\n\n';
    const source = fromArray([raw]);
    const stream = source.pipeThrough(new SseParserStream());
    const items = await collectStream(stream);

    expect(items).toEqual([{ event: 'update', data: 'payload' }]);
  });

  it('should handle multi-line data', async () => {
    const raw = 'data: line1\ndata: line2\n\n';
    const source = fromArray([raw]);
    const stream = source.pipeThrough(new SseParserStream());
    const items = await collectStream(stream);

    expect(items).toEqual([{ event: '', data: 'line1\nline2' }]);
  });

  it('should skip comment lines', async () => {
    const raw = ': this is a comment\ndata: value\n\n';
    const source = fromArray([raw]);
    const stream = source.pipeThrough(new SseParserStream());
    const items = await collectStream(stream);

    expect(items).toEqual([{ event: '', data: 'value' }]);
  });

  it('should handle id and retry fields', async () => {
    const raw = 'id: 42\nretry: 5000\ndata: msg\n\n';
    const source = fromArray([raw]);
    const stream = source.pipeThrough(new SseParserStream());
    const items = await collectStream(stream);

    expect(items).toEqual([{ event: '', data: 'msg', id: '42', retry: 5000 }]);
  });

  it('should handle chunked input across multiple chunks', async () => {
    const source = fromArray(['data: hel', 'lo\n\ndata: world\n\n']);
    const stream = source.pipeThrough(new SseParserStream());
    const items = await collectStream(stream);

    expect(items).toEqual([
      { event: '', data: 'hello' },
      { event: '', data: 'world' },
    ]);
  });

  it('should ignore empty events (no data field)', async () => {
    const raw = 'event: noop\n\ndata: real\n\n';
    const source = fromArray([raw]);
    const stream = source.pipeThrough(new SseParserStream());
    const items = await collectStream(stream);

    // Only the event with data is emitted
    expect(items).toEqual([{ event: '', data: 'real' }]);
  });
});

// ===========================================================================
// parseJsonEventStream
// ===========================================================================

describe('parseJsonEventStream', () => {
  it('should parse SSE byte stream into JSON objects', async () => {
    const raw =
      'data: {"type":"text","value":"hi"}\n\ndata: {"type":"done"}\n\n';
    const byteStream = fromArray([encode(raw)]);

    const stream = parseJsonEventStream<{ type: string; value?: string }>({
      stream: byteStream,
    });

    const items = await collectStream(stream);

    expect(items).toEqual([
      {
        success: true,
        value: { type: 'text', value: 'hi' },
        rawValue: { type: 'text', value: 'hi' },
      },
      { success: true, value: { type: 'done' }, rawValue: { type: 'done' } },
    ]);
  });

  it('should skip [DONE] events', async () => {
    const raw = 'data: {"x":1}\n\ndata: [DONE]\n\n';
    const byteStream = fromArray([encode(raw)]);

    const stream = parseJsonEventStream({ stream: byteStream });
    const items = await collectStream(stream);

    expect(items).toHaveLength(1);
    expect(items[0].success).toBe(true);
  });

  it('should return parse errors for invalid JSON', async () => {
    const raw = 'data: not-json\n\n';
    const byteStream = fromArray([encode(raw)]);

    const stream = parseJsonEventStream({ stream: byteStream });
    const items = await collectStream(stream);

    expect(items).toHaveLength(1);
    expect(items[0].success).toBe(false);
  });

  it('should validate with schema when provided', async () => {
    const raw = 'data: {"type":"ok"}\n\ndata: {"type":123}\n\n';
    const byteStream = fromArray([encode(raw)]);

    const schema = {
      parse(value: unknown) {
        if (
          typeof value === 'object' &&
          value !== null &&
          typeof (value as Record<string, unknown>).type === 'string'
        ) {
          return value as { type: string };
        }
        throw new Error('validation failed');
      },
    };

    const stream = parseJsonEventStream({ stream: byteStream, schema });
    const items = await collectStream(stream);

    expect(items[0].success).toBe(true);
    expect(items[1].success).toBe(false);
  });
});

// ===========================================================================
// StreamingToolCallTracker
// ===========================================================================

describe('StreamingToolCallTracker', () => {
  it('should track a complete tool call in one chunk', () => {
    const tracker = new StreamingToolCallTracker();
    const parts: Array<{ type: string }> = [];

    tracker.processDelta(
      {
        index: 0,
        id: 'call_1',
        type: 'function',
        function: { name: 'get_weather', arguments: '{"city":"NYC"}' },
      },
      (part) => parts.push(part)
    );

    expect(parts).toEqual([
      { type: 'tool-input-start', id: 'call_1', toolName: 'get_weather' },
      { type: 'tool-input-delta', id: 'call_1', delta: '{"city":"NYC"}' },
      { type: 'tool-input-end', id: 'call_1' },
      {
        type: 'tool-call',
        toolCallId: 'call_1',
        toolName: 'get_weather',
        input: '{"city":"NYC"}',
      },
    ]);
  });

  it('should accumulate arguments across multiple deltas', () => {
    const tracker = new StreamingToolCallTracker();
    const parts: Array<{ type: string }> = [];
    const enqueue = (part: { type: string }) => parts.push(part);

    tracker.processDelta(
      {
        index: 0,
        id: 'call_1',
        type: 'function',
        function: { name: 'search', arguments: '{"q' },
      },
      enqueue
    );

    tracker.processDelta(
      {
        index: 0,
        id: 'call_1',
        function: { arguments: '":"hello"}' },
      },
      enqueue
    );

    const types = parts.map((p) => p.type);
    expect(types).toContain('tool-input-start');
    expect(types).toContain('tool-input-delta');
    expect(types).toContain('tool-input-end');
    expect(types).toContain('tool-call');
  });

  it('should finalize unfinished tool calls on flush', () => {
    const tracker = new StreamingToolCallTracker();
    const parts: Array<{ type: string }> = [];
    const enqueue = (part: { type: string }) => parts.push(part);

    tracker.processDelta(
      {
        index: 0,
        id: 'call_1',
        type: 'function',
        function: { name: 'test', arguments: '{"partial": true' },
      },
      enqueue
    );

    // Not complete JSON yet, so no tool-call event
    expect(parts.map((p) => p.type)).not.toContain('tool-call');

    tracker.flush(enqueue);

    // After flush, it should be finalized
    expect(parts.map((p) => p.type)).toContain('tool-input-end');
    expect(parts.map((p) => p.type)).toContain('tool-call');
  });

  it('should throw on missing id', () => {
    const tracker = new StreamingToolCallTracker();

    expect(() =>
      tracker.processDelta(
        { index: 0, type: 'function', function: { name: 'test' } },
        () => {}
      )
    ).toThrow("expected 'id'");
  });

  it('should throw on missing function.name', () => {
    const tracker = new StreamingToolCallTracker();

    expect(() =>
      tracker.processDelta(
        { index: 0, id: 'call_1', type: 'function', function: {} },
        () => {}
      )
    ).toThrow("expected 'function.name'");
  });

  it('should enforce type validation when required', () => {
    const tracker = new StreamingToolCallTracker({
      typeValidation: 'required',
    });

    expect(() =>
      tracker.processDelta(
        {
          index: 0,
          id: 'call_1',
          type: 'not_function',
          function: { name: 'test' },
        },
        () => {}
      )
    ).toThrow("expected type 'function'");
  });

  it('should skip finished tool calls', () => {
    const tracker = new StreamingToolCallTracker();
    const parts: Array<{ type: string }> = [];
    const enqueue = (part: { type: string }) => parts.push(part);

    // Complete tool call
    tracker.processDelta(
      {
        index: 0,
        id: 'call_1',
        type: 'function',
        function: { name: 'test', arguments: '{}' },
      },
      enqueue
    );

    const countBefore = parts.length;

    // Another delta for the same index — should be ignored
    tracker.processDelta(
      {
        index: 0,
        id: 'call_1',
        function: { arguments: 'extra' },
      },
      enqueue
    );

    expect(parts.length).toBe(countBefore);
  });
});
