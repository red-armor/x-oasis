import RPCService from './RPCService';
import { RPCServiceOptions, ServiceHandlerPath, ServicePath } from '../types';

/**
 * const service = serviceHost.registerService(servicePath, service)
 * const handler = service.getHandler(handlerName)
 */
class RPCServiceHost {
  serviceMap = new Map<ServiceHandlerPath, RPCService>();

  registerService(servicePath: ServicePath, serviceOptions: RPCServiceOptions) {
    const service = new RPCService(servicePath, serviceOptions);
    this.serviceMap.set(servicePath, service);
  }

  getService(servicePath: ServicePath) {
    return this.serviceMap.get(servicePath);
  }

  getHandler(servicePath: ServicePath, handlerName: string) {
    const service = this.getService(servicePath);
    if (service) return service.getHandler(handlerName);
    return null;
  }
}

export default RPCServiceHost;
