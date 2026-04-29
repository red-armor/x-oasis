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
};

/**
 * Channel protocol configuration options
 */
export type AbstractChannelProtocolProps = {
  description?: string;
  masterProcessName?: string;
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
