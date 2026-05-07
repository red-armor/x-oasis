import { NormalizedRawMessageOutput } from '../types';

/**
 * Normalize middleware for MessageChannel (WebSocket/Worker) raw messages.
 *
 * This middleware extracts event.data and event.ports from MessageEvent,
 * providing a normalized interface for the rest of the middleware chain.
 *
 * ## The ports field:
 *
 * When sender calls channel.send(data, transfer),
 * Transferable objects are moved to receiver side and appear in event.ports.
 *
 * This middleware MUST extract event.ports and include it in output:
 * - event.ports becomes message.ports for downstream middleware
 * - deserialize middleware keeps ports unchanged
 * - handleResponse middleware uses ports[0] for PortSuccess
 *
 * If event.ports is not extracted here, it will be lost forever!
 */
export const normalizeMessageChannelRawMessage =
  () =>
  (event: MessageEvent): NormalizedRawMessageOutput => {
    // STEP 1: Extract data and ports from MessageEvent
    // MessageEvent has both data (the main message) and ports (transferred objects)
    const data = event.data;

    // STEP 2: Extract ports from MessageEvent
    // event.ports contains Transferable objects that were transferred via transfer list
    // If no ports were transferred, event.ports is undefined or empty array
    const ports = event.ports ? [...event.ports] : [];

    // STEP 3: Return normalized message with both data and ports
    // ⭐ CRITICAL: ports must be included in output for handleResponse to work!
    return {
      event,
      data,
      ports, // ← Do NOT forget this! handleResponse needs it
    };
  };

/**
 * Normalize middleware for Electron IPC raw messages.
 *
 * For Electron's ipcRenderer/ipcMain, messages come as (event, ...data) arguments.
 * This middleware reconstructs a MessageEvent-like structure.
 *
 * ## Electron IPC specifics:
 *
 * ipcRenderer.on/ipcMain.on callbacks receive: (event, ...data)
 * - event.ports contains transferred MessagePorts
 * - data is the actual message content
 *
 * This must be normalized to match MessageEvent structure
 * so downstream middleware can access event.ports consistently.
 */
export const normalizeIPCChannelRawMessage =
  () => (event: MessageEvent, data: string) => {
    // STEP 1: Extract ports from Electron IPC event
    // Just like MessageChannel, Electron's event.ports contains transferred objects
    const ports = event.ports ? [...event.ports] : [];

    // STEP 2: Return normalized structure
    // data parameter contains the main message
    // ports extracted from event for downstream middleware
    return {
      event,
      data,
      ports, // ← Include ports from Electron IPC event
    };
  };

/**
 * Normalize middleware for pure data messages (no MessageEvent).
 *
 * Used when messages are received as plain data (e.g., from client-side-only RPC).
 * No event or ports are available in this context.
 */
export const processClientRawMessage = () => (data: string) => {
  return {
    event: null,
    data,
    ports: [], // ← No Transferables in client-only mode
  };
};

/**
 * Utility functions for data normalization across browser and Node.js environments
 */
const isBufferAvailable = (): boolean =>
  typeof Buffer !== 'undefined' && Buffer.isBuffer !== undefined;

const isBuffer = (value: any): boolean =>
  isBufferAvailable() && Buffer.isBuffer(value);

const normalizeDataToString = (data: any): string => {
  // Null or undefined
  if (data == null) return '';

  // Already a string
  if (typeof data === 'string') return data;

  // Buffer (Node.js)
  if (isBuffer(data)) {
    return data.toString('utf8');
  }

  // ArrayBuffer
  if (data instanceof ArrayBuffer) {
    return isBufferAvailable()
      ? Buffer.from(data).toString('utf8')
      : new TextDecoder('utf-8').decode(data);
  }

  // Fallback: stringify
  return String(data);
};

/**
 * Normalize WebSocket raw message
 * Handles both browser MessageEvent and Node.js ws library format
 *
 * ## WebSocket ports handling:
 *
 * WebSocket doesn't natively support Transferables like MessageChannel does.
 * However, if the server sends a message with MessagePort info,
 * it would need custom serialization/deserialization logic.
 *
 * For now, WebSocket normalizer always returns empty ports array
 * since the protocol doesn't support native Transferable transfer.
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
        ports: [], // ← No Transferables for WebSocket
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
      if (data instanceof Blob) {
        // For Blob, we'd need async handling, but for now return empty
        // In practice, WebSocket text frames should be strings
        normalizedData = '';
      } else {
        normalizedData = normalizeDataToString(data);
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

      // Convert different data types to string
      normalizedData = normalizeDataToString(actualData);
    }

    // Ensure normalizedData is never undefined or null
    if (normalizedData === undefined || normalizedData === null) {
      normalizedData = '';
    }

    return {
      event,
      data: normalizedData,
      ports, // ← Extract ports from MessageEvent if available
    };
  };
