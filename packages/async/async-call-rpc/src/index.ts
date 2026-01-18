import clientHost from './endpoint/RPCClientHost';
import ProxyRPCClient from './endpoint/ProxyRPCClient';
import RPCService from './endpoint/RPCService';
import serviceHost from './endpoint/RPCServiceHost';

export { default as MessageChannel } from './protocol/MessageChannel';
export { default as WorkerChannel } from './protocol/WorkerChannel';

export { ProxyRPCClient, RPCService, clientHost, serviceHost };

// Export JSONRPC utilities and types
export * from './utils';
// Export error types but not makeErrorResponse to avoid conflict (it's in utils/jsonrpc.ts)
export type { ErrorResponse, ErrorResponseDetail, ID } from './error';
export { JSONRPCErrorCode } from './error';
