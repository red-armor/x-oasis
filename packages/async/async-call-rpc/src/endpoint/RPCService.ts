import AbstractChannelProtocol from '../protocol/AbstractChannelProtocol';
import { RPCServiceHost } from './RPCServiceHost';
import { ServiceHandlers } from '../types/proxyService';

class RPCService {
  private channel: AbstractChannelProtocol;
  readonly serviceHost: RPCServiceHost;
  readonly servicePath: string;
  readonly handlersMap = new Map<string, (...args: any[]) => any>();

  constructor(
    servicePath: string,
    options?: {
      channel?: AbstractChannelProtocol;
      handlers: ServiceHandlers;
      serviceHost?: RPCServiceHost;
    }
  ) {
    const { channel, handlers, serviceHost } = options || {};
    this.servicePath = servicePath;
    this.serviceHost = serviceHost;
    if (channel) {
      this.setChannel(channel);
    }
    this.registerHandlers(handlers);
  }

  setChannel(channel: AbstractChannelProtocol) {
    this.channel = channel;
    this.channel.setService(this);
    this.channel.on(this.handleMessage.bind(this));
  }

  registerHandlers(handlers: Record<string, (...args: any[]) => any>) {
    if (!handlers) return;
    for (const [methodName, handler] of Object.entries(handlers)) {
      this.registerHandler(methodName, handler);
    }
  }

  handleMessage(...args: any[]) {
    this.channel.onMessage(...args);
  }

  registerHandler(methodName: string, handler: (...args: any[]) => any) {
    this.handlersMap.set(methodName, handler);
  }

  getHandler(methodName: string) {
    return this.handlersMap.get(methodName);
  }
}

export default RPCService;
