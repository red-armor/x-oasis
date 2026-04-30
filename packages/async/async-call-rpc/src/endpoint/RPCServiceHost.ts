import RPCService from './RPCService';
import { ServiceHandlerPath } from '../types';

class RPCServiceHost {
  handlersMap = new Map<ServiceHandlerPath, RPCService>();
  registerServiceHandler(handlerPath: ServiceHandlerPath, service: RPCService) {
    this.handlersMap.set(handlerPath, service);
  }

  getHandlers(handlerPath: ServiceHandlerPath) {
    const handlers = this.handlersMap.get(handlerPath);
    return handlers;
  }

  getHandler(handlerPath: ServiceHandlerPath, fnName: string) {
    const handlers = this.handlersMap.get(handlerPath);
    // should bind to current service object
    if (handlers && handlers[fnName]) return handlers[fnName].bind(handlers);
    return null;
  }

  merge(serviceHost: RPCServiceHost) {
    for (const [key, value] of serviceHost.handlersMap) {
      this.registerServiceHandler(key, value);
    }
  }
}

export default RPCServiceHost;
