import RPCServiceHost from './RPCServiceHost';
import AbstractChannelProtocol from '../protocol/AbstractChannelProtocol';
import { ServiceHandlers, RPCServiceOptions } from '../types';

class RPCService {
  private channel?: AbstractChannelProtocol;
  readonly serviceHost?: RPCServiceHost;
  readonly servicePath: string;
  readonly handlersMap = new Map<string, (...args: any[]) => any>();
  private _instance?: object;

  constructor(servicePath: string, options: RPCServiceOptions = {}) {
    const { channel, handlers, serviceHost, instance } = options;
    this.servicePath = servicePath;
    this.serviceHost = serviceHost;
    this._instance = instance;

    if (channel) this.setChannel(channel);
    if (handlers) this.registerHandlers(handlers);
  }

  setChannel(channel: AbstractChannelProtocol) {
    this.channel = channel;
    this.channel.setService(this);
    this.channel.ensureListenerAttached();
  }

  setInstance(instance: object) {
    this._instance = instance;
  }

  registerHandlers(handlers?: ServiceHandlers) {
    if (!handlers) return;
    for (const [methodName, handler] of Object.entries(handlers)) {
      this.registerHandler(methodName, handler);
    }
  }

  registerHandler(methodName: string, handler: (...args: any[]) => any) {
    this.handlersMap.set(methodName, handler);
  }

  getHandler(methodName: string) {
    const explicit = this.handlersMap.get(methodName);
    if (explicit) return explicit;
    if (this._instance) {
      const fn = (this._instance as any)[methodName];
      if (typeof fn === 'function') return fn.bind(this._instance);
    }
    return undefined;
  }

  merge(_service: RPCService) {}
}

export default RPCService;
