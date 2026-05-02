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
  transfer?: MessagePort[];
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
