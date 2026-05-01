import RPCServiceHost from './RPCServiceHost';
import AbstractChannelProtocol from '../protocol/AbstractChannelProtocol';
import { ServiceHandlers, RPCServiceOptions } from '../types';

class RPCService {
  private channel: AbstractChannelProtocol;
  readonly serviceHost: RPCServiceHost;
  readonly servicePath: string;
  readonly handlersMap = new Map<string, (...args: any[]) => any>();

  constructor(servicePath: string, options: RPCServiceOptions) {
    const { channel, handlers, serviceHost } = options;
    this.servicePath = servicePath;
    this.serviceHost = serviceHost;
    this.setChannel(channel);

    this.registerHandlers(handlers);
  }

  setChannel(channel: AbstractChannelProtocol) {
    this.channel = channel;
    this.channel.setService(this);
    this.channel.on(this.handleMessage.bind(this));
  }

  registerHandlers(handlers?: ServiceHandlers) {
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

  merge(service: RPCService) {}
}

export default RPCService;
