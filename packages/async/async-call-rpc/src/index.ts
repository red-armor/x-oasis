import clientHost from './endpoint/RPCClientHost';
import ProxyRPCClient from './endpoint/ProxyRPCClient';
import RPCService from './endpoint/RPCService';
import RPCServiceHost from './endpoint/RPCServiceHost';

// Core protocol base class
export { default as AbstractChannelProtocol } from './protocol/AbstractChannelProtocol';
export type { CreateContextFn } from './protocol/AbstractChannelProtocol';

// Core types for adapter packages
export type {
  IMessageChannel,
  AbstractChannelProtocolProps,
  SendingProps,
} from './types/protocol';
export type { ClientMiddleware, SenderMiddleware } from './types';

// Export subscription types
export type { SubscriptionObserver } from './endpoint/ProxyRPCClient';

// Normalize middlewares (for adapter packages to swap the default normalizer)
export {
  normalizeMessageChannelRawMessage,
  normalizeWebSocketRawMessage,
  normalizeIPCChannelRawMessage,
  processClientRawMessage,
} from './middlewares/normalize';

// Export JSONRPC utilities and types
export * from './utils';
export type { ErrorResponse, ErrorResponseDetail, ID } from './error';
export { JSONRPCErrorCode, RPCError } from './error';

const serviceHost = new RPCServiceHost();

export { ProxyRPCClient, RPCService, RPCServiceHost, clientHost, serviceHost };

// Connection Orchestrator (Layer 2)
export * from './orchestrator';
