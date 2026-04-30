import clientHost from './endpoint/RPCClientHost';
import ProxyRPCClient from './endpoint/ProxyRPCClient';
import RPCService from './endpoint/RPCService';
import serviceHost from './endpoint/RPCServiceHost';
import rpcServiceProvider from './endpoint/RPCServiceProvider';

export { default as MessageChannel } from './protocol/MessageChannel';
export { default as WorkerChannel } from './protocol/WorkerChannel';
export { default as WebSocketChannel } from './protocol/WebSocketChannel';

export {
  ProxyRPCClient,
  RPCService,
  clientHost,
  serviceHost,
  rpcServiceProvider,
};

// Export subscription types
export type { SubscriptionObserver } from './endpoint/ProxyRPCClient';

// Export JSONRPC utilities and types
export * from './utils';
export type { ErrorResponse, ErrorResponseDetail, ID } from './error';
export { JSONRPCErrorCode, RPCError } from './error';
