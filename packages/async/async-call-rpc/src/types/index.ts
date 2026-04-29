import AbstractChannelProtocol from '../protocol/AbstractChannelProtocol';

export * from './channel';
export * from './rpc';
export * from './proxyChannel';
export * from './proxyService';
export * from './middleware';

/**
 * A middleware factory for processing incoming messages.
 * Called with the protocol instance, returns the actual middleware function.
 *
 * The message type transforms through the pipeline:
 *   raw → NormalizedRawMessageOutput → DeserializedMessageOutput → ...
 * We use `any` at the pipeline level because each stage outputs a different shape.
 */
export type ClientMiddleware = (
  protocol: AbstractChannelProtocol
) => (message: any) => any;

/**
 * A middleware factory for processing outgoing requests.
 * Called with the protocol instance, returns the actual middleware function.
 *
 * Supports lifecycle ordering via `.lifecycle` property.
 */
export type SenderMiddleware = (protocol: AbstractChannelProtocol) => ((
  ...args: any[]
) => any) & {
  lifecycle?: number;
  displayName?: string;
};
