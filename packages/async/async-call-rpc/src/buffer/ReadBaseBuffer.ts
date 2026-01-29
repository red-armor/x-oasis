/**
 * Base class for read buffer/deserialization
 * Supports both string and binary (ArrayBuffer/Uint8Array) input
 */
abstract class ReadBaseBuffer {
  /**
   * Decode/deserialize data
   * @param data - Encoded data (string or binary)
   * @returns Decoded data
   */
  abstract decode(data: string | ArrayBuffer | Uint8Array): any;

  /**
   * Get the format identifier this decoder supports
   * @returns Format name (e.g., 'json', 'msgpack', 'cbor')
   */
  abstract getFormat(): string;
}

export default ReadBaseBuffer;
