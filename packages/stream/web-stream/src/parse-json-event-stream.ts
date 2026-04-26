import { SseParserStream } from './sse-parser-stream';
import { JsonParseResult, SseMessage } from './types';

/**
 * Schema interface for JSON validation. Compatible with Zod, @ai-sdk/provider
 * schemas, and any object providing a `parse` method.
 *
 * If no schema is provided to `parseJsonEventStream`, the raw parsed JSON
 * value is returned without validation.
 */
export interface JsonSchema<T> {
  parse(value: unknown): T;
}

/**
 * Options for `parseJsonEventStream`.
 */
export interface ParseJsonEventStreamOptions<T> {
  /** The raw SSE byte stream (typically `response.body`). */
  stream: ReadableStream<Uint8Array>;
  /**
   * Optional schema for validating each parsed JSON event.
   * If omitted, the raw `JSON.parse` result is used as-is.
   */
  schema?: JsonSchema<T>;
}

/**
 * Parses a Server-Sent Events byte stream into a stream of typed JSON objects.
 *
 * Pipeline: `Uint8Array -> TextDecoder -> SSE lines -> JSON parse [-> schema validate]`
 *
 * Events with `data: [DONE]` are silently filtered (OpenAI convention).
 *
 * @template T The expected type of each parsed event.
 */
export function parseJsonEventStream<T>({
  stream,
  schema,
}: ParseJsonEventStreamOptions<T>): ReadableStream<JsonParseResult<T>> {
  return stream
    .pipeThrough(new TextDecoderStream())
    .pipeThrough(new SseParserStream())
    .pipeThrough(
      new TransformStream<SseMessage, JsonParseResult<T>>({
        transform({ data }, controller) {
          // Skip the OpenAI-style [DONE] sentinel
          if (data === '[DONE]') {
            return;
          }

          try {
            const rawValue = JSON.parse(data);

            if (schema) {
              try {
                const value = schema.parse(rawValue);
                controller.enqueue({ success: true, value, rawValue });
              } catch (err) {
                controller.enqueue({
                  success: false,
                  error: err instanceof Error ? err : new Error(String(err)),
                  rawValue,
                });
              }
            } else {
              controller.enqueue({
                success: true,
                value: rawValue as T,
                rawValue,
              });
            }
          } catch (err) {
            controller.enqueue({
              success: false,
              error: err instanceof Error ? err : new Error(String(err)),
              rawValue: data,
            });
          }
        },
      })
    );
}
