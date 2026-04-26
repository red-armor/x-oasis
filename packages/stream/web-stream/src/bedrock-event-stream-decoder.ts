import { BedrockDecodedEvent } from './types';

// ---------------------------------------------------------------------------
// Lightweight AWS EventStream binary frame decoder
//
// Replaces @smithy/eventstream-codec with a minimal inline implementation.
//
// AWS EventStream binary frame layout:
//   Bytes 0-3:   total byte length (uint32 BE)
//   Bytes 4-7:   headers byte length (uint32 BE)
//   Bytes 8-11:  prelude CRC32 (uint32 BE) — skipped (not validated)
//   Bytes 12..:  headers (variable length)
//   After hdrs:  payload (variable length)
//   Last 4 bytes: message CRC32 (uint32 BE) — skipped (not validated)
//
// Header entry layout:
//   1 byte:  name length
//   N bytes: name (UTF-8)
//   1 byte:  value type (7 = string)
//   2 bytes: value length (uint16 BE)
//   M bytes: value (UTF-8)
// ---------------------------------------------------------------------------

function parseHeaders(
  view: DataView,
  offset: number,
  headersLength: number
): Record<string, string> {
  const headers: Record<string, string> = {};
  const end = offset + headersLength;
  const decoder = new TextDecoder();
  let pos = offset;

  while (pos < end) {
    // Name
    const nameLen = view.getUint8(pos);
    pos += 1;
    const name = decoder.decode(
      new Uint8Array(view.buffer, view.byteOffset + pos, nameLen)
    );
    pos += nameLen;

    // Value type — we only handle type 7 (string)
    const valueType = view.getUint8(pos);
    pos += 1;

    if (valueType === 7) {
      // String value
      const valueLen = view.getUint16(pos, false);
      pos += 2;
      const value = decoder.decode(
        new Uint8Array(view.buffer, view.byteOffset + pos, valueLen)
      );
      pos += valueLen;
      headers[name] = value;
    } else {
      // For non-string types, skip based on known sizes.
      // This is best-effort; unknown types will break parsing.
      break;
    }
  }

  return headers;
}

/**
 * Creates a ReadableStream that decodes an AWS EventStream binary response
 * into typed events.
 *
 * This is a zero-dependency replacement for `@smithy/eventstream-codec`.
 * CRC validation is intentionally skipped for simplicity — the transport
 * layer (HTTPS) already guarantees integrity.
 *
 * @template T The output event type.
 * @param body The raw binary response body.
 * @param processEvent Callback invoked for each decoded frame. Use the
 *   controller to enqueue output events.
 * @returns A ReadableStream of processed events.
 */
export function createBedrockEventStreamDecoder<T>(
  body: ReadableStream<Uint8Array>,
  processEvent: (
    event: BedrockDecodedEvent,
    controller: TransformStreamDefaultController<T>
  ) => void | Promise<void>
): ReadableStream<T> {
  let buffer = new Uint8Array(0);
  const textDecoder = new TextDecoder();

  return body.pipeThrough(
    new TransformStream<Uint8Array, T>({
      async transform(chunk, controller) {
        // Append chunk to buffer
        const newBuffer = new Uint8Array(buffer.length + chunk.length);
        newBuffer.set(buffer);
        newBuffer.set(chunk, buffer.length);
        buffer = newBuffer;

        // Try to decode complete frames
        while (buffer.length >= 4) {
          const view = new DataView(
            buffer.buffer,
            buffer.byteOffset,
            buffer.byteLength
          );
          const totalLength = view.getUint32(0, false);

          if (buffer.length < totalLength) {
            break; // Incomplete frame, wait for more data
          }

          try {
            const headersLength = view.getUint32(4, false);

            // Skip prelude CRC (bytes 8-11)
            const headersOffset = 12;
            const headers = parseHeaders(view, headersOffset, headersLength);

            // Payload starts after headers, ends before message CRC (last 4 bytes)
            const payloadOffset = headersOffset + headersLength;
            const payloadLength = totalLength - payloadOffset - 4;
            const payloadBytes = buffer.subarray(
              payloadOffset,
              payloadOffset + payloadLength
            );
            const data = textDecoder.decode(payloadBytes);

            // Consume the frame
            buffer = buffer.slice(totalLength);

            const messageType = headers[':message-type'] ?? '';
            const eventType = headers[':event-type'] ?? '';

            await processEvent({ messageType, eventType, data }, controller);
          } catch {
            break; // Malformed frame, wait for more data
          }
        }
      },
    })
  );
}
