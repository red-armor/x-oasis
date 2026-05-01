import clientHost from './endpoint/RPCClientHost';
import ProxyRPCClient from './endpoint/ProxyRPCClient';
import RPCService from './endpoint/RPCService';
import RPCServiceHost from './endpoint/RPCServiceHost';

export { default as MessageChannel } from './protocol/MessageChannel';
export { default as WorkerChannel } from './protocol/WorkerChannel';
export { default as WebSocketChannel } from './protocol/WebSocketChannel';

// Export subscription types
export type { SubscriptionObserver } from './endpoint/ProxyRPCClient';

// Export JSONRPC utilities and types
export * from './utils';
export type { ErrorResponse, ErrorResponseDetail, ID } from './error';
export { JSONRPCErrorCode, RPCError } from './error';

const serviceHost = new RPCServiceHost();

export { ProxyRPCClient, RPCService, clientHost, serviceHost };
