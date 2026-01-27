/**
 * Examples of using different serialization formats
 *
 * This file demonstrates how to use various serialization formats
 * with the async-call-rpc buffer system.
 */

import { BufferFactory, SerializationFormat } from './index';
import ReadBaseBuffer from './ReadBaseBuffer';
import WriteBaseBuffer from './WriteBaseBuffer';

// ============================================================================
// Example 1: Using MessagePack (requires @msgpack/msgpack)
// ============================================================================

/**
 * To use MessagePack, first install the dependency:
 * npm install @msgpack/msgpack
 *
 * Then implement the buffers:
 */
export function registerMessagePack() {
  // Dynamic import to avoid requiring the dependency if not used
  // In production, you might want to use a static import
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { encode, decode } = require('@msgpack/msgpack');

    class MessagePackReadBuffer extends ReadBaseBuffer {
      decode(data: string | ArrayBuffer | Uint8Array): any {
        if (typeof data === 'string') {
          // Convert string to Uint8Array
          const encoder = new TextEncoder();
          return decode(encoder.encode(data));
        }
        // Handle ArrayBuffer or Uint8Array
        const uint8Array =
          data instanceof ArrayBuffer ? new Uint8Array(data) : data;
        return decode(uint8Array);
      }

      getFormat(): string {
        return SerializationFormat.MESSAGEPACK;
      }
    }

    class MessagePackWriteBuffer extends WriteBaseBuffer {
      encode(data: any): Uint8Array {
        return encode(data);
      }

      getFormat(): string {
        return SerializationFormat.MESSAGEPACK;
      }
    }

    // Register with the factory
    BufferFactory.registerReadBuffer(
      SerializationFormat.MESSAGEPACK,
      () => new MessagePackReadBuffer()
    );
    BufferFactory.registerWriteBuffer(
      SerializationFormat.MESSAGEPACK,
      () => new MessagePackWriteBuffer()
    );

    return true;
  } catch (e) {
    console.warn(
      'MessagePack not available. Install @msgpack/msgpack to use it.'
    );
    return false;
  }
}

// ============================================================================
// Example 2: Using CBOR (requires cbor or cbor-web)
// ============================================================================

/**
 * To use CBOR, install one of:
 * npm install cbor
 * npm install cbor-web
 */
export function registerCBOR() {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const cbor = require('cbor');

    class CBORReadBuffer extends ReadBaseBuffer {
      decode(data: string | ArrayBuffer | Uint8Array): any {
        if (typeof data === 'string') {
          const encoder = new TextEncoder();
          const uint8Array = encoder.encode(data);
          return cbor.decode(uint8Array);
        }
        const uint8Array =
          data instanceof ArrayBuffer ? new Uint8Array(data) : data;
        return cbor.decode(uint8Array);
      }

      getFormat(): string {
        return SerializationFormat.CBOR;
      }
    }

    class CBORWriteBuffer extends WriteBaseBuffer {
      encode(data: any): Uint8Array {
        return cbor.encode(data);
      }

      getFormat(): string {
        return SerializationFormat.CBOR;
      }
    }

    BufferFactory.registerReadBuffer(
      SerializationFormat.CBOR,
      () => new CBORReadBuffer()
    );
    BufferFactory.registerWriteBuffer(
      SerializationFormat.CBOR,
      () => new CBORWriteBuffer()
    );

    return true;
  } catch (e) {
    console.warn('CBOR not available. Install cbor or cbor-web to use it.');
    return false;
  }
}

// ============================================================================
// Example 3: Custom serialization format
// ============================================================================

/**
 * Example of a custom compression + JSON serialization
 */
export function registerCompressedJSON() {
  class CompressedJSONReadBuffer extends ReadBaseBuffer {
    decode(data: string | ArrayBuffer | Uint8Array): any {
      // In a real implementation, you would decompress first
      // This is just a placeholder
      if (typeof data === 'string') {
        return JSON.parse(data);
      }
      const decoder = new TextDecoder();
      const text = decoder.decode(data);
      return JSON.parse(text);
    }

    getFormat(): string {
      return 'compressed-json';
    }
  }

  class CompressedJSONWriteBuffer extends WriteBaseBuffer {
    encode(data: any): string {
      // In a real implementation, you would compress the JSON
      // This is just a placeholder
      return JSON.stringify(data);
    }

    getFormat(): string {
      return 'compressed-json';
    }
  }

  BufferFactory.registerReadBuffer(
    'compressed-json',
    () => new CompressedJSONReadBuffer()
  );
  BufferFactory.registerWriteBuffer(
    'compressed-json',
    () => new CompressedJSONWriteBuffer()
  );
}

// ============================================================================
// Example 4: Using in a Channel
// ============================================================================

/**
 * Example of using a custom format in a channel implementation
 */
export function createChannelWithMessagePack() {
  // First register MessagePack
  if (!registerMessagePack()) {
    throw new Error('MessagePack not available');
  }

  // Then use it in your channel
  // This would be in your channel class:
  /*
  class MyChannel extends AbstractChannelProtocol {
    get readBuffer() {
      return BufferFactory.createReadBuffer(SerializationFormat.MESSAGEPACK);
    }
    
    get writeBuffer() {
      return BufferFactory.createWriteBuffer(SerializationFormat.MESSAGEPACK);
    }
  }
  */
}

// ============================================================================
// Example 5: Format negotiation
// ============================================================================

/**
 * Example of format negotiation between client and server
 * This would typically happen during connection handshake
 */
export interface FormatNegotiation {
  clientFormats: string[];
  serverFormats: string[];
  selectedFormat?: string;
}

export function negotiateFormat(
  clientFormats: string[],
  serverFormats: string[]
): string | null {
  // Find the first format that both support
  for (const format of clientFormats) {
    if (serverFormats.includes(format)) {
      return format;
    }
  }

  // Fallback to JSON if available
  if (
    clientFormats.includes(SerializationFormat.JSON) &&
    serverFormats.includes(SerializationFormat.JSON)
  ) {
    return SerializationFormat.JSON;
  }

  return null;
}
