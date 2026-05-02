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
  /** Bind this service to a channel (1-channel-1-service mode). Optional. */
  channel?: AbstractChannelProtocol;
  /** Explicit handler map. Optional when `instance` is provided. */
  handlers?: ServiceHandlers;
  /** Owning service host (for back-reference). Optional. */
  serviceHost?: RPCServiceHost;
  /**
   * A class instance used as a fallback bag of methods. When set,
   * `getHandler(methodName)` falls back to `instance[methodName].bind(instance)`
   * if no entry exists in `handlers`.
   */
  instance?: object;
};
