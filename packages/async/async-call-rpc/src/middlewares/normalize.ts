import { NormalizedRawMessageOutput } from '../types';

export const normalizeMessageChannelRawMessage =
  () =>
  (event: MessageEvent): NormalizedRawMessageOutput => {
    return {
      event,
      data: event.data,
      ports: event.ports || [],
    };
  };

export const normalizeIPCChannelRawMessage =
  () => (event: MessageEvent, data: string) => {
    return {
      event,
      data,
      ports: event.ports || [],
    };
  };

export const processClientRawMessage = () => (data: string) => {
  return {
    event: null,
    data,
    ports: [],
  };
};

/**
 * Helper function to check if Buffer is available (Node.js environment)
 */
function isBufferAvailable(): boolean {
  return typeof Buffer !== 'undefined' && Buffer.isBuffer !== undefined;
}

/**
 * Helper function to check if value is a Buffer (works in both browser and Node.js)
 */
function isBuffer(value: any): boolean {
  if (!isBufferAvailable()) {
    return false;
  }
  return Buffer.isBuffer(value);
}

/**
 * Helper function to convert ArrayBuffer to string (works in both browser and Node.js)
 */
function arrayBufferToString(buffer: ArrayBuffer): string {
  if (isBufferAvailable()) {
    return Buffer.from(buffer).toString('utf8');
  } else {
    // Browser environment: use TextDecoder
    try {
      return new TextDecoder('utf-8').decode(buffer);
    } catch (e) {
      // Fallback: convert Uint8Array to string
      const uint8Array = new Uint8Array(buffer);
      return String.fromCharCode.apply(null, Array.from(uint8Array));
    }
  }
}

/**
 * Helper function to convert Buffer to string (Node.js only)
 */
function bufferToString(buffer: any): string {
  if (isBufferAvailable() && Buffer.isBuffer(buffer)) {
    return buffer.toString('utf8');
  }
  return String(buffer);
}

/**
 * Normalize WebSocket raw message
 * Handles both browser MessageEvent and Node.js ws library format
 */
export const normalizeWebSocketRawMessage =
  () =>
  (
    eventOrData: MessageEvent | Buffer | string | any,
    ...args: any[]
  ): NormalizedRawMessageOutput => {
    // Handle undefined or null
    if (eventOrData === undefined || eventOrData === null) {
      console.warn(
        '[normalizeWebSocketRawMessage] Received undefined or null data'
      );
      return {
        event: null,
        data: '',
        ports: [],
      };
    }

    let normalizedData = '';
    let event: MessageEvent | null = null;
    let ports: MessagePort[] = [];

    // Check if this is a MessageEvent (browser or ws library with EventTarget)
    if (
      eventOrData &&
      typeof eventOrData === 'object' &&
      'data' in eventOrData
    ) {
      event = eventOrData as MessageEvent;
      const data = event.data;
      // Create a new array to avoid readonly type issues
      ports = event.ports ? [...event.ports] : [];

      // Handle different data types in MessageEvent
      if (data === undefined || data === null) {
        normalizedData = '';
      } else if (typeof data === 'string') {
        normalizedData = data;
      } else if (isBuffer(data)) {
        normalizedData = bufferToString(data);
      } else if (data instanceof ArrayBuffer) {
        normalizedData = arrayBufferToString(data);
      } else if (data instanceof Blob) {
        // For Blob, we'd need async handling, but for now return empty
        // In practice, WebSocket text frames should be strings
        normalizedData = '';
      } else {
        normalizedData = String(data);
      }
    } else {
      // Node.js ws library: direct data (Buffer or string)
      // The ws library may pass data directly, or as (data, isBinary) tuple
      // If args[0] exists and eventOrData is not an object with 'data',
      // then args might contain the actual data
      let actualData = eventOrData;

      // Check if this might be a tuple (data, isBinary) from ws library
      if (
        args.length > 0 &&
        (typeof eventOrData === 'string' || isBuffer(eventOrData))
      ) {
        // This is likely (data, isBinary) format, use eventOrData as data
        actualData = eventOrData;
      }

      // Convert Buffer to string if needed
      if (isBuffer(actualData)) {
        normalizedData = bufferToString(actualData);
      } else if (typeof actualData === 'string') {
        normalizedData = actualData;
      } else if (actualData instanceof ArrayBuffer) {
        normalizedData = arrayBufferToString(actualData);
      } else {
        // Fallback: try to stringify
        normalizedData = String(actualData);
      }
    }

    // Ensure normalizedData is never undefined or null
    if (normalizedData === undefined || normalizedData === null) {
      normalizedData = '';
    }

    return {
      event,
      data: normalizedData,
      ports,
    };
  };
