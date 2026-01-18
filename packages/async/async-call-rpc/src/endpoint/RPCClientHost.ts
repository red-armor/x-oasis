import ProxyRPCClient from './ProxyRPCClient';
import AbstractChannelProtocol from '../protocol/AbstractChannelProtocol';

class RPCClientHost {
  protected readonly hostPath: string;

  private hostMap = new Map<string, ProxyRPCClient>();

  // handlersMap = new Map<ServiceHandlerPath, IService>();

  registerClient(
    requestPath: string,
    options?: {
      channel?: AbstractChannelProtocol;
    }
  ) {
    const client = new ProxyRPCClient(requestPath, options);
    this.hostMap.set(requestPath, client);
    return client;
  }

  // registerServiceHandler(handlerPath: ServiceHandlerPath, service: IService) {
  //   this.handlersMap.set(handlerPath, service);
  // }

  // getHandlers(handlerPath: ServiceHandlerPath) {
  //   const handlers = this.handlersMap.get(handlerPath);
  //   return handlers;
  // }

  // getHandler(handlerPath: ServiceHandlerPath, fnName: string) {
  //   const handlers = this.handlersMap.get(handlerPath);
  //   // should bind to current service object
  //   if (handlers && handlers[fnName]) return handlers[fnName].bind(handlers);
  //   return null;
  // }

  // merge(serviceHost: RPCClientHost) {
  //   for (const [key, value] of serviceHost.handlersMap) {
  //     this.registerServiceHandler(key, value);
  //   }
  // }
}
export { RPCClientHost };
export default new RPCClientHost();
