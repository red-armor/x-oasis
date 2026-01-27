/**
 * Supported serialization formats for RPC communication
 *
 * Based on JSON-RPC community practices:
 * - JSON: Default, human-readable, good for debugging
 * - MessagePack: Binary format, 2-3x faster, smaller size
 * - CBOR: Standard binary format (RFC 7049)
 * - Protobuf: High performance, requires schema
 */
export enum SerializationFormat {
  /** JSON - Default text format, human-readable */
  JSON = 'json',
  /** MessagePack - Binary format, high performance */
  MESSAGEPACK = 'msgpack',
  /** CBOR - Concise Binary Object Representation (RFC 7049) */
  CBOR = 'cbor',
  /** Protocol Buffers - High performance, schema-based */
  PROTOBUF = 'protobuf',
  /** Custom format - User-defined serialization */
  CUSTOM = 'custom',
}

/**
 * Serialization format metadata
 */
export interface SerializationFormatInfo {
  format: SerializationFormat;
  name: string;
  description: string;
  mimeType: string;
  isBinary: boolean;
  isText: boolean;
}

/**
 * Format metadata registry
 */
export const FORMAT_INFO: Record<SerializationFormat, SerializationFormatInfo> =
  {
    [SerializationFormat.JSON]: {
      format: SerializationFormat.JSON,
      name: 'JSON',
      description: 'JavaScript Object Notation - Human-readable text format',
      mimeType: 'application/json',
      isBinary: false,
      isText: true,
    },
    [SerializationFormat.MESSAGEPACK]: {
      format: SerializationFormat.MESSAGEPACK,
      name: 'MessagePack',
      description:
        'Binary serialization format - High performance, compact size',
      mimeType: 'application/x-msgpack',
      isBinary: true,
      isText: false,
    },
    [SerializationFormat.CBOR]: {
      format: SerializationFormat.CBOR,
      name: 'CBOR',
      description: 'Concise Binary Object Representation (RFC 7049)',
      mimeType: 'application/cbor',
      isBinary: true,
      isText: false,
    },
    [SerializationFormat.PROTOBUF]: {
      format: SerializationFormat.PROTOBUF,
      name: 'Protocol Buffers',
      description: 'Google Protocol Buffers - Schema-based binary format',
      mimeType: 'application/x-protobuf',
      isBinary: true,
      isText: false,
    },
    [SerializationFormat.CUSTOM]: {
      format: SerializationFormat.CUSTOM,
      name: 'Custom',
      description: 'User-defined custom serialization format',
      mimeType: 'application/octet-stream',
      isBinary: true,
      isText: false,
    },
  };
