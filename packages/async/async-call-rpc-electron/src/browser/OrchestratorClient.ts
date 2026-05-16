import { clientHost, serviceHost } from '@x-oasis/async-call-rpc/core';
import type {
  StateChangeEvent,
  ReadyEvent,
  DisconnectedEvent,
  ReconnectingEvent,
  ReconnectedEvent,
  ReconnectFailedEvent,
  ClosedEvent,
} from '@x-oasis/async-call-rpc/orchestrator';
import ContextBridgeChannel from './ContextBridgeChannel';
import { createPageChannel, createIpcPageChannel } from './createPageChannel';

type ServiceProxy = Record<string, (...args: unknown[]) => unknown>;

export interface OrchestratorClientOptions {
  directChannelDescription?: string;
  ipcChannelDescription?: string;
  autoConnect?: boolean;
}

export interface GetProxyOptions {
  autoConnect?: boolean;
}

export class OrchestratorClient {
  private _directChannel: ContextBridgeChannel;
  private _ipcChannel: ContextBridgeChannel;
  private _orchestratorProxy: ServiceProxy;
  private _serviceProxies = new Map<string, ServiceProxy>();
  private _defaultAutoConnect: boolean;

  constructor(options: OrchestratorClientOptions = {}) {
    const {
      directChannelDescription,
      ipcChannelDescription,
      autoConnect = false,
    } = options;

    this._defaultAutoConnect = autoConnect;
    this._directChannel = createPageChannel(directChannelDescription);
    this._ipcChannel = createIpcPageChannel(ipcChannelDescription);

    this._orchestratorProxy = clientHost
      .registerClient('orchestrator', {
        channel: this._ipcChannel,
      })
      .createProxy();
  }

  get directChannel(): ContextBridgeChannel {
    return this._directChannel;
  }

  get ipcChannel(): ContextBridgeChannel {
    return this._ipcChannel;
  }

  /**
   * Get a remote service proxy by service path.
   *
   * Returns a typed proxy object whose methods forward calls to the
   * corresponding RPC service over the direct channel. Proxies are cached —
   * requesting the same `servicePath` twice returns the same proxy instance.
   *
   * @param servicePath - The unique path that identifies the target RPC service.
   * @param options - Optional configuration.
   * @param options.autoConnect - Whether to automatically call `connect()` after
   *   creating the proxy. Defaults to the `autoConnect` value passed to the
   *   `OrchestratorClient` constructor.
   * @returns A typed proxy whose methods map 1-to-1 to the remote service handlers.
   *
   * @example
   * ```ts
   * const myService = client.getProxy<IMyService>('my-service');
   * await myService.doSomething(arg1, arg2);
   * ```
   */
  getProxy<T extends ServiceProxy>(
    servicePath: string,
    options: GetProxyOptions = {}
  ): T {
    const { autoConnect = this._defaultAutoConnect } = options;

    if (this._serviceProxies.has(servicePath)) {
      return this._serviceProxies.get(servicePath) as T;
    }

    const proxy = clientHost
      .registerClient(servicePath, {
        channel: this._directChannel,
      })
      .createProxy<T>();

    this._serviceProxies.set(servicePath, proxy);

    if (autoConnect) {
      this.connect().catch(() => {});
    }

    return proxy;
  }

  registerService(serviceId: string, handlers: ServiceProxy): void {
    serviceHost.registerService(serviceId, {
      channel: this._directChannel,
      serviceHost,
      handlers,
    });
  }

  async connect(...args: unknown[]): Promise<unknown> {
    return this._orchestratorProxy.connect(...args);
  }

  async disconnect(...args: unknown[]): Promise<unknown> {
    return this._orchestratorProxy.disconnect(...args);
  }

  async getStatus(...args: unknown[]): Promise<unknown> {
    return this._orchestratorProxy.getStatus(...args);
  }

  simulateLost(...args: unknown[]): unknown {
    return this._orchestratorProxy.simulateLost(...args);
  }

  killUtility(...args: unknown[]): unknown {
    return this._orchestratorProxy.killUtility(...args);
  }

  switchPage(...args: unknown[]): unknown {
    return this._orchestratorProxy.switchPage(...args);
  }

  async sendRpc(...args: unknown[]): Promise<unknown> {
    return this._orchestratorProxy.sendRpc(...args);
  }

  onStateChange(callback: (event: StateChangeEvent) => void): {
    unsubscribe: () => void;
  } {
    return this._orchestratorProxy.onStateChange(callback) as {
      unsubscribe: () => void;
    };
  }

  onReady(callback: (event: ReadyEvent) => void): { unsubscribe: () => void } {
    return this._orchestratorProxy.onReady(callback) as {
      unsubscribe: () => void;
    };
  }

  onDisconnected(callback: (event: DisconnectedEvent) => void): {
    unsubscribe: () => void;
  } {
    return this._orchestratorProxy.onDisconnected(callback) as {
      unsubscribe: () => void;
    };
  }

  onReconnecting(callback: (event: ReconnectingEvent) => void): {
    unsubscribe: () => void;
  } {
    return this._orchestratorProxy.onReconnecting(callback) as {
      unsubscribe: () => void;
    };
  }

  onReconnected(callback: (event: ReconnectedEvent) => void): {
    unsubscribe: () => void;
  } {
    return this._orchestratorProxy.onReconnected(callback) as {
      unsubscribe: () => void;
    };
  }

  onReconnectFailed(callback: (event: ReconnectFailedEvent) => void): {
    unsubscribe: () => void;
  } {
    return this._orchestratorProxy.onReconnectFailed(callback) as {
      unsubscribe: () => void;
    };
  }

  onClosed(callback: (event: ClosedEvent) => void): {
    unsubscribe: () => void;
  } {
    return this._orchestratorProxy.onClosed(callback) as {
      unsubscribe: () => void;
    };
  }
}

export function createOrchestratorClient(
  options?: OrchestratorClientOptions
): OrchestratorClient {
  return new OrchestratorClient(options);
}
