import clientHost from './endpoint/RPCClientHost';
import ProxyRPCClient from './endpoint/ProxyRPCClient';
import RPCService from './endpoint/RPCService';
import RPCServiceHost from './endpoint/RPCServiceHost';

export { default as AbstractChannelProtocol } from './protocol/AbstractChannelProtocol';
export type { CreateContextFn } from './protocol/AbstractChannelProtocol';
export type {
  IMessageChannel,
  AbstractChannelProtocolProps,
  SendingProps,
} from './types/protocol';
export type { ClientMiddleware, SenderMiddleware } from './types';
export type { SubscriptionObserver } from './endpoint/ProxyRPCClient';
export {
  normalizeMessageChannelRawMessage,
  normalizeWebSocketRawMessage,
  normalizeIPCChannelRawMessage,
  processClientRawMessage,
} from './middlewares/normalize';
export * from './utils';
export type { ErrorResponse, ErrorResponseDetail, ID } from './error';
export { JSONRPCErrorCode, RPCError } from './error';
export * from './buffer';

const serviceHost = new RPCServiceHost();
export { ProxyRPCClient, RPCService, RPCServiceHost, clientHost, serviceHost };

export {
  ORCHESTRATOR_SERVICE_PATH,
  ORCHESTRATOR_PROXY_SERVICE_PATH,
} from './orchestrator/types';
export type { ActivationContext } from './orchestrator/types';
