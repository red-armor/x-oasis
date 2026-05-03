import RPCService from './RPCService';
import { RPCServiceOptions, ServiceHandlerPath, ServicePath } from '../types';

/**
 * `RPCServiceHost` is a routing table from `servicePath` to `RPCService`.
 *
 * Two registration modes are supported:
 *
 * - **`registerService(servicePath, options)`** — 1-channel-1-service mode.
 *   The service binds to its own channel via `options.channel`.
 *
 * - **`registerServiceHandler(servicePath, instanceOrHandlers)`** —
 *   multi-service-per-channel mode. The service is *not* bound to a channel;
 *   instead, one or more channels share this host via
 *   `channel.setServiceHost(host)`. Routing is performed in the
 *   `handleRequest` middleware by calling `host.getHandler(requestPath, methodName)`.
 */
class RPCServiceHost {
  serviceMap = new Map<ServiceHandlerPath, RPCService>();

  registerService(servicePath: ServicePath, serviceOptions: RPCServiceOptions) {
    const service = new RPCService(servicePath, {
      ...serviceOptions,
      serviceHost: this,
    });
    this.serviceMap.set(servicePath, service);
    return service;
  }

  /**
   * Register a service whose handlers come from an instance (any object whose
   * methods we expose) or from an explicit handler map. No channel binding.
   *
   * The instance form is the common case for class-based services where you'd
   * otherwise have to enumerate methods by hand:
   *
   * ```ts
   * host.registerServiceHandler('/foo', this);
   * ```
   *
   * Then attach a transport via `channel.setServiceHost(host)` (see
   * `AbstractChannelProtocol`). One channel can serve multiple service paths.
   */
  registerServiceHandler(servicePath: ServicePath, instanceOrHandlers: object) {
    const isHandlerMap = Object.values(instanceOrHandlers).every(
      (v) => typeof v === 'function'
    );
    const service = new RPCService(servicePath, {
      serviceHost: this,
      ...(isHandlerMap
        ? {
            handlers: instanceOrHandlers as Record<
              string,
              (...args: any[]) => any
            >,
          }
        : { instance: instanceOrHandlers }),
    });
    // Always also expose the value as an instance fallback so prototype
    // methods on a class instance resolve even when the own-property check
    // above happened to be all-functions (rare: a plain object literal of
    // functions is still treated correctly because handler lookup checks
    // handlersMap first).
    if (!isHandlerMap) service.setInstance(instanceOrHandlers);
    this.serviceMap.set(servicePath, service);
    return service;
  }

  getService(servicePath: ServicePath) {
    return this.serviceMap.get(servicePath);
  }

  getHandler(servicePath: ServicePath, handlerName: string) {
    const service = this.getService(servicePath);
    if (service) return service.getHandler(handlerName);
    return undefined;
  }
}

export default RPCServiceHost;
