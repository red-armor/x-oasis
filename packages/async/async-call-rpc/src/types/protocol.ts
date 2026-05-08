export type IMessageChannelOnClose = () => void;
export type IMessageChannelOnError = () => void;
export type IMessageChannelOnMessage = (message: any) => void;
export type IMessageChannelSend = (options: any) => void;
export type IMessageChannelDisconnect = () => void;

/**
 * A channel is a bidirectional communications channel
 */
export type IMessageChannel = {
  onClose?: IMessageChannelOnClose;

  onError?: IMessageChannelOnError;

  onMessage: IMessageChannelOnMessage;

  send: IMessageChannelSend;

  disconnect: IMessageChannelDisconnect;
};

export type SendingProps = {
  requestPath: string;
  methodName: string;
  args?: any[];
  isOptionsRequest?: boolean;
  /**
   * List of Transferable objects to transfer ownership across realm boundaries.
   *
   * Supported Transferable types:
   * - MessagePort: bidirectional communication channels
   * - ArrayBuffer: binary data buffers
   * - ImageBitmap: image data (browser only)
   * - OffscreenCanvas: GPU-backed canvas (browser only)
   * - ReadableStream, WritableStream, TransformStream: streams (browser only)
   *
   * Note: This field is usually populated automatically by the prepareNormalData middleware,
   * but you can specify transfers manually here if needed.
   *
   * Example with explicit transfer:
   *
   * await endpoint.service.methodName({
   *   requestPath: 'Service',
   *   methodName: 'processPort',
   *   args: [{port: myMessagePort}],
   *   transfer: [myMessagePort], // explicitly specify
   * });
   *
   * Example with auto-detection (preferred):
   *
   * // No need to specify transfer, prepareNormalData middleware handles it
   * await endpoint.service.methodName({port: myMessagePort});
   */
  transfer?: any[];
  /**
   * Override the request type (default: `PromiseRequest`).
   * Set to `SubscriptionRequest` or `SubscriptionStop` for streaming subscriptions.
   */
  requestType?: string;
};

/**
 * Channel protocol configuration options
 */
export type AbstractChannelProtocolProps = {
  description?: string;
  /**
   * Identifier for the channel (e.g., process name, port, connection ID).
   * Used for logging and debugging purposes.
   */
  identifier?: string;
  /**
   * Extensible metadata object for storing arbitrary channel context.
   * Can be used by middleware and logging utilities.
   * @example
   * ```ts
   * metadata: {
   *   processName: 'main',
   *   environment: 'production',
   *   version: '1.0.0',
   * }
   * ```
   */
  metadata?: Record<string, any>;
  connected?: boolean;
  /**
   * Serialization format for buffer encoding/decoding
   * @default 'json'
   */
  serializationFormat?: string;
  /**
   * Custom read buffer instance (overrides serializationFormat)
   */
  readBuffer?: any;
  /**
   * Custom write buffer instance (overrides serializationFormat)
   */
  writeBuffer?: any;
  /**
   * Context factory for injecting per-request data into handlers.
   * Called on each incoming request, similar to tRPC's `createContext`.
   *
   * @example
   * ```ts
   * createContext: ({ event, requestPath, methodName }) => ({
   *   sender: event?.sender,
   *   timestamp: Date.now(),
   * })
   * ```
   */
  createContext?: (opts: {
    event: any;
    requestPath: string;
    methodName: string;
  }) => any;
};
