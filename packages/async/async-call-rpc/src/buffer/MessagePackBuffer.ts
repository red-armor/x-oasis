import ReadBaseBuffer from './ReadBaseBuffer';
import WriteBaseBuffer from './WriteBaseBuffer';
import { SerializationFormat } from './SerializationFormat';

/**
 * MessagePack Read Buffer Implementation
 *
 * Note: This is a reference implementation. To use it, you need to install:
 * npm install @msgpack/msgpack
 *
 * Usage:
 * ```typescript
 * import { encode, decode } from '@msgpack/msgpack';
 *
 * class MessagePackReadBuffer extends ReadBaseBuffer {
 *   decode(data: string | ArrayBuffer | Uint8Array): any {
 *     if (typeof data === 'string') {
 *       // Convert string to Uint8Array if needed
 *       const encoder = new TextEncoder();
 *       const uint8Array = encoder.encode(data);
 *       return decode(uint8Array);
 *     }
 *     return decode(data as Uint8Array);
 *   }
 *
 *   getFormat(): string {
 *     return SerializationFormat.MESSAGEPACK;
 *   }
 * }
 * ```
 */
export class MessagePackReadBuffer extends ReadBaseBuffer {
  decode(_data: string | ArrayBuffer | Uint8Array): any {
    // This is a placeholder implementation
    // In production, use: import { decode } from '@msgpack/msgpack';
    throw new Error(
      'MessagePack decoder not implemented. Please install @msgpack/msgpack and implement decode logic.'
    );
  }

  getFormat(): string {
    return SerializationFormat.MESSAGEPACK;
  }
}

/**
 * MessagePack Write Buffer Implementation
 *
 * Note: This is a reference implementation. To use it, you need to install:
 * npm install @msgpack/msgpack
 *
 * Usage:
 * ```typescript
 * import { encode } from '@msgpack/msgpack';
 *
 * class MessagePackWriteBuffer extends WriteBaseBuffer {
 *   encode(data: any): Uint8Array {
 *     return encode(data);
 *   }
 *
 *   getFormat(): string {
 *     return SerializationFormat.MESSAGEPACK;
 *   }
 * }
 * ```
 */
export class MessagePackWriteBuffer extends WriteBaseBuffer {
  encode(_data: any): Uint8Array {
    // This is a placeholder implementation
    // In production, use: import { encode } from '@msgpack/msgpack';
    throw new Error(
      'MessagePack encoder not implemented. Please install @msgpack/msgpack and implement encode logic.'
    );
  }

  getFormat(): string {
    return SerializationFormat.MESSAGEPACK;
  }
}
