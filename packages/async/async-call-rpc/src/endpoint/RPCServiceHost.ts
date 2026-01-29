import { ServiceHandlers } from '../types/proxyService';
import RPCService from './RPCService';

class RPCServiceHost {
  protected readonly hostPath: string;

  private hostMap = new Map<string, RPCService>();

  // handlersMap = new Map<ServiceHandlerPath, IService>();

  registerService(servicePath: string, serviceHandlers: ServiceHandlers) {
    const service = new RPCService(servicePath, { handlers: serviceHandlers });
    this.hostMap.set(servicePath, service);
    return service;
  }
}
export { RPCServiceHost };
export default new RPCServiceHost();
