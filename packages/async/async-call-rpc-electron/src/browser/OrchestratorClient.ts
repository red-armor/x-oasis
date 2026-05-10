import { clientHost, serviceHost } from '@x-oasis/async-call-rpc';
import ContextBridgeChannel from './ContextBridgeChannel';
import { createPageChannel, createIpcPageChannel } from './createPageChannel';

export interface OrchestratorClientOptions {
  directChannelDescription?: string;
  ipcChannelDescription?: string;
  autoConnect?: boolean;
}

export interface GetServiceOptions {
  autoConnect?: boolean;
}

export class OrchestratorClient {
  private _directChannel: ContextBridgeChannel;
  private _ipcChannel: ContextBridgeChannel;
  private _orchestratorProxy: Record<string, (...args: any[]) => any>;
  private _serviceProxies = new Map<
    string,
    Record<string, (...args: any[]) => any>
  >();
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
      .registerClient('__orchestrator_client__', {
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

  getService<T extends Record<string, (...args: any[]) => any>>(
    participantId: string,
    options: GetServiceOptions = {}
  ): T {
    const { autoConnect = this._defaultAutoConnect } = options;

    if (this._serviceProxies.has(participantId)) {
      return this._serviceProxies.get(participantId) as T;
    }

    const proxy = clientHost
      .registerClient(`__svc_${participantId}__`, {
        channel: this._directChannel,
      })
      .createProxy<T>();

    this._serviceProxies.set(participantId, proxy);

    if (autoConnect) {
      this.connect().catch(() => {});
    }

    return proxy;
  }

  registerService(
    serviceId: string,
    handlers: Record<string, (...args: any[]) => any>
  ): void {
    serviceHost.registerService(serviceId, {
      channel: this._directChannel,
      serviceHost,
      handlers,
    });
  }

  async connect(...args: any[]): Promise<any> {
    return this._orchestratorProxy.connect(...args);
  }

  async disconnect(...args: any[]): Promise<any> {
    return this._orchestratorProxy.disconnect(...args);
  }

  async getStatus(...args: any[]): Promise<any> {
    return this._orchestratorProxy.getStatus(...args);
  }

  simulateLost(...args: any[]): any {
    return this._orchestratorProxy.simulateLost(...args);
  }

  killUtility(...args: any[]): any {
    return this._orchestratorProxy.killUtility(...args);
  }

  onStateChange(callback: (event: any) => void): { unsubscribe: () => void } {
    return this._orchestratorProxy.onStateChange(callback);
  }

  onReady(callback: (event: any) => void): { unsubscribe: () => void } {
    return this._orchestratorProxy.onReady(callback);
  }

  onDisconnected(callback: (event: any) => void): { unsubscribe: () => void } {
    return this._orchestratorProxy.onDisconnected(callback);
  }

  onReconnecting(callback: (event: any) => void): { unsubscribe: () => void } {
    return this._orchestratorProxy.onReconnecting(callback);
  }

  onReconnected(callback: (event: any) => void): { unsubscribe: () => void } {
    return this._orchestratorProxy.onReconnected(callback);
  }

  onReconnectFailed(callback: (event: any) => void): {
    unsubscribe: () => void;
  } {
    return this._orchestratorProxy.onReconnectFailed(callback);
  }

  onClosed(callback: (event: any) => void): { unsubscribe: () => void } {
    return this._orchestratorProxy.onClosed(callback);
  }
}

export function createOrchestratorClient(
  options?: OrchestratorClientOptions
): OrchestratorClient {
  return new OrchestratorClient(options);
}
