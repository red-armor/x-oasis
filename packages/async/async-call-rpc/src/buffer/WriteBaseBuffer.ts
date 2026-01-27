/**
 * Base class for write buffer/serialization
 * Supports both string and binary (ArrayBuffer/Uint8Array) output
 */
abstract class WriteBaseBuffer {
  /**
   * Encode/serialize data
   * @param data - Data to encode
   * @returns Encoded data (string for text formats, ArrayBuffer/Uint8Array for binary formats)
   */
  abstract encode(data: any): string | ArrayBuffer | Uint8Array;

  /**
   * Get the format identifier for content negotiation
   * @returns Format name (e.g., 'json', 'msgpack', 'cbor')
   */
  abstract getFormat(): string;
}

export default WriteBaseBuffer;
