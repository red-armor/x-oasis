import { IService, ServiceHandlerPath } from '../types';
import { ServiceHandlers } from '../types/proxyService';
import RPCService from './RPCService';

class RPCServiceHost {
  protected readonly hostPath: string;

  private hostMap = new Map<string, RPCService>();

  handlersMap = new Map<ServiceHandlerPath, IService>();

  registerService(servicePath: string, serviceHandlers: ServiceHandlers) {
    const service = new RPCService(servicePath, { handlers: serviceHandlers });
    this.hostMap.set(servicePath, service);
    return service;
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

  // merge(serviceHost: RPCServiceHost) {
  //   for (const [key, value] of serviceHost.handlersMap) {
  //     this.registerServiceHandler(key, value);
  //   }
  // }
}
export { RPCServiceHost };
export default new RPCServiceHost();
