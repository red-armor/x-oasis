import {
  clientHost,
  serviceHost,
  RPCServiceHost,
  ORCHESTRATOR_SERVICE_PATH,
} from '@x-oasis/async-call-rpc';
import ElectronUtilityProcessChannel from './ElectronUtilityProcessChannel';
import ElectronMessagePortMainChannel from './ElectronMessagePortMainChannel';
import {
  ParentPort,
  MessagePortMain,
  ActivationConnectionContext,
} from '../types';

type ServiceProxy = Record<string, (...args: unknown[]) => unknown>;

export interface UtilityParticipantOptions {
  parentPort: ParentPort;
  mainChannelDescription?: string;
  directChannelDescription?: string;
  rebind?: boolean;
}

export class UtilityOrchestratorParticipant {
  private _mainChannel: ElectronUtilityProcessChannel;
  private _directChannel: ElectronMessagePortMainChannel;
  private _mainServiceHost: RPCServiceHost;
  private _serviceProxies = new Map<string, ServiceProxy>();
  private _rebind: boolean;

  constructor(options: UtilityParticipantOptions) {
    const {
      parentPort,
      mainChannelDescription,
      directChannelDescription,
      rebind = true,
    } = options;

    this._rebind = rebind;

    this._mainChannel = new ElectronUtilityProcessChannel({
      parentPort,
      description: mainChannelDescription,
    });

    this._directChannel = new ElectronMessagePortMainChannel({
      description: directChannelDescription,
    });

    this._mainServiceHost = new RPCServiceHost();
    this._mainChannel.setServiceHost(this._mainServiceHost);

    this._mainServiceHost.registerServiceHandler(ORCHESTRATOR_SERVICE_PATH, {
      activateConnection: (port: MessagePortMain) => {
        this._directChannel.bindPort(port, { rebind: this._rebind });
      },
      activateConnectionContext: (_ctx: ActivationConnectionContext) => {},
      ping: () => 'pong',
    });
  }

  get mainChannel(): ElectronUtilityProcessChannel {
    return this._mainChannel;
  }

  get directChannel(): ElectronMessagePortMainChannel {
    return this._directChannel;
  }

  getService<T extends ServiceProxy>(servicePath: string): T {
    if (this._serviceProxies.has(servicePath)) {
      return this._serviceProxies.get(servicePath) as T;
    }

    const proxy = clientHost
      .registerClient(servicePath, {
        channel: this._directChannel,
      })
      .createProxy<T>();

    this._serviceProxies.set(servicePath, proxy);
    return proxy;
  }

  registerService(serviceId: string, handlers: ServiceProxy): void {
    serviceHost.registerService(serviceId, {
      channel: this._directChannel,
      serviceHost,
      handlers,
    });
  }

  registerControlService(serviceId: string, handlers: ServiceProxy): void {
    this._mainServiceHost.registerServiceHandler(serviceId, handlers);
  }
}

export function createUtilityParticipant(
  options: UtilityParticipantOptions
): UtilityOrchestratorParticipant {
  return new UtilityOrchestratorParticipant(options);
}
