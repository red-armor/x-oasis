import ReadBaseBuffer from './ReadBaseBuffer';
import WriteBaseBuffer from './WriteBaseBuffer';
import ReadBuffer from './ReadBuffer';
import WriteBuffer from './WriteBuffer';
import { SerializationFormat } from './SerializationFormat';

/**
 * Factory for creating buffer instances based on serialization format
 *
 * This factory allows easy switching between different serialization formats
 * and supports custom implementations.
 */
export class BufferFactory {
  private static readBufferRegistry = new Map<string, () => ReadBaseBuffer>();
  private static writeBufferRegistry = new Map<string, () => WriteBaseBuffer>();

  /**
   * Register a custom read buffer implementation
   */
  static registerReadBuffer(
    format: string,
    factory: () => ReadBaseBuffer
  ): void {
    this.readBufferRegistry.set(format, factory);
  }

  /**
   * Register a custom write buffer implementation
   */
  static registerWriteBuffer(
    format: string,
    factory: () => WriteBaseBuffer
  ): void {
    this.writeBufferRegistry.set(format, factory);
  }

  /**
   * Create a read buffer for the specified format
   */
  static createReadBuffer(
    format: SerializationFormat | string = SerializationFormat.JSON
  ): ReadBaseBuffer {
    const factory = this.readBufferRegistry.get(format);
    if (factory) {
      return factory();
    }

    // Default to JSON
    switch (format) {
      case SerializationFormat.JSON:
        return new ReadBuffer();
      case SerializationFormat.MESSAGEPACK:
        // Try to load MessagePack if available
        try {
          // Dynamic import example (would need actual implementation)
          // const { MessagePackReadBuffer } = require('./MessagePackBuffer');
          // return new MessagePackReadBuffer();
          throw new Error(
            'MessagePack not available. Install @msgpack/msgpack and register it.'
          );
        } catch (e) {
          throw new Error(
            `Unsupported read buffer format: ${format}. Register a custom implementation.`
          );
        }
      default:
        throw new Error(`Unsupported read buffer format: ${format}`);
    }
  }

  /**
   * Create a write buffer for the specified format
   */
  static createWriteBuffer(
    format: SerializationFormat | string = SerializationFormat.JSON
  ): WriteBaseBuffer {
    const factory = this.writeBufferRegistry.get(format);
    if (factory) {
      return factory();
    }

    // Default to JSON
    switch (format) {
      case SerializationFormat.JSON:
        return new WriteBuffer();
      case SerializationFormat.MESSAGEPACK:
        // Try to load MessagePack if available
        try {
          // Dynamic import example (would need actual implementation)
          // const { MessagePackWriteBuffer } = require('./MessagePackBuffer');
          // return new MessagePackWriteBuffer();
          throw new Error(
            'MessagePack not available. Install @msgpack/msgpack and register it.'
          );
        } catch (e) {
          throw new Error(
            `Unsupported write buffer format: ${format}. Register a custom implementation.`
          );
        }
      default:
        throw new Error(`Unsupported write buffer format: ${format}`);
    }
  }

  /**
   * Get list of registered formats
   */
  static getRegisteredFormats(): string[] {
    const formats = new Set<string>();
    this.readBufferRegistry.forEach((_, format) => formats.add(format));
    this.writeBufferRegistry.forEach((_, format) => formats.add(format));
    return Array.from(formats);
  }
}

// Register default JSON format
BufferFactory.registerReadBuffer(
  SerializationFormat.JSON,
  () => new ReadBuffer()
);
BufferFactory.registerWriteBuffer(
  SerializationFormat.JSON,
  () => new WriteBuffer()
);
