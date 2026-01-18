import AbstractChannelProtocol from '../protocol/AbstractChannelProtocol';

// export type IService = {
//   [key: string]: Function
// }
export type IService = any;

export type ServiceHandlerPath = string;
export type ProxyRPCClientChannel =
  | AbstractChannelProtocol
  | { (): AbstractChannelProtocol };

export type ProxyRPCClientProps = {
  requestPath: string;
  channel: ProxyRPCClientChannel;
};

export type ServiceHandlers = Record<string, (...args: any[]) => any>;
