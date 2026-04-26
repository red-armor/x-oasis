import { SseMessage } from './types';

/**
 * A TransformStream that parses raw SSE text into structured `SseMessage` objects.
 *
 * This is a zero-dependency replacement for `eventsource-parser/stream`'s
 * `EventSourceParserStream`. It implements the SSE parsing algorithm per the
 * WHATWG HTML spec (https://html.spec.whatwg.org/multipage/server-sent-events.html).
 *
 * Usage:
 * ```ts
 * response.body
 *   .pipeThrough(new TextDecoderStream())
 *   .pipeThrough(new SseParserStream())
 * ```
 */
export class SseParserStream extends TransformStream<string, SseMessage> {
  constructor() {
    let buffer = '';
    let event = '';
    let data = '';
    let id: string | undefined;
    let retry: number | undefined;

    function processLine(
      line: string,
      controller: TransformStreamDefaultController<SseMessage>
    ): void {
      // Empty line -> dispatch event
      if (line === '') {
        if (data !== '') {
          // Remove trailing newline from data (spec behavior)
          if (data.endsWith('\n')) {
            data = data.slice(0, -1);
          }

          const msg: SseMessage = { event: event || '', data };
          if (id !== undefined) msg.id = id;
          if (retry !== undefined) msg.retry = retry;

          controller.enqueue(msg);
        }

        // Reset per-event state
        event = '';
        data = '';
        id = undefined;
        retry = undefined;
        return;
      }

      // Comment line
      if (line.startsWith(':')) {
        return;
      }

      // Field parsing
      const colonIndex = line.indexOf(':');
      let field: string;
      let value: string;

      if (colonIndex === -1) {
        field = line;
        value = '';
      } else {
        field = line.slice(0, colonIndex);
        // Skip single leading space after colon (per spec)
        value =
          line[colonIndex + 1] === ' '
            ? line.slice(colonIndex + 2)
            : line.slice(colonIndex + 1);
      }

      switch (field) {
        case 'event':
          event = value;
          break;
        case 'data':
          data += `${value}\n`;
          break;
        case 'id':
          // Ignore IDs containing null
          if (!value.includes('\0')) {
            id = value;
          }
          break;
        case 'retry': {
          const n = parseInt(value, 10);
          if (!isNaN(n) && String(n) === value.trim()) {
            retry = n;
          }
          break;
        }
        default:
          // Unknown fields are ignored per spec
          break;
      }
    }

    super({
      transform(chunk, controller) {
        buffer += chunk;

        // Split on \r\n, \r, or \n
        const lines = buffer.split(/\r\n|\r|\n/);

        // The last element is an incomplete line — keep it in the buffer
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        buffer = lines.pop()!;

        for (const line of lines) {
          processLine(line, controller);
        }
      },

      flush(controller) {
        // Process any remaining data in the buffer
        if (buffer.length > 0) {
          processLine(buffer, controller);
        }
        // Final empty line to dispatch any pending event
        processLine('', controller);
      },
    });
  }
}
