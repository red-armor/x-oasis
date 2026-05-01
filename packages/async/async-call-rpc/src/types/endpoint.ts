import AbstractChannelProtocol from '../protocol/AbstractChannelProtocol';
import RPCServiceHost from '../endpoint/RPCServiceHost';

// export type IService = {
//   [key: string]: Function
// }
export type IService = any;

export type ServicePath = string;

export type ServiceHandlerPath = string;
export type ProxyRPCClientChannel =
  | AbstractChannelProtocol
  | { (): AbstractChannelProtocol };

export type ProxyRPCClientProps = {
  requestPath: string;
  channel: ProxyRPCClientChannel;
};

export type ServiceHandlers = Record<string, (...args: any[]) => any>;

export type RPCServiceOptions = {
  channel: AbstractChannelProtocol;
  handlers: ServiceHandlers;
  serviceHost: RPCServiceHost;
};
