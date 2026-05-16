import {
  clientHost,
  serviceHost as globalServiceHost,
  RPCServiceHost,
  ORCHESTRATOR_SERVICE_PATH,
  ORCHESTRATOR_PROXY_SERVICE_PATH,
  AbstractChannelProtocol,
} from '@x-oasis/async-call-rpc/core';
import type {
  ListParticipantEntry,
  ListConnectionEntry,
} from '@x-oasis/async-call-rpc/orchestrator';
import { NodeMessagePortChannel } from './NodeMessagePortChannel';
import { MessagePort } from 'worker_threads';

export interface NodeParticipantConnection {
  readonly connectionId: string;
  readonly peerId: string;
  readonly role: 'initiator' | 'receiver';
  getChannel(): NodeMessagePortChannel;
}

export interface NodeParticipantProxyOptions {
  selfId: string;
  controlChannel: AbstractChannelProtocol;
  channelFactory?: (description: string) => NodeMessagePortChannel;
}

export class NodeParticipantOrchestratorProxy {
  private _selfId: string;
  private _controlChannel: AbstractChannelProtocol;
  private _channelFactory: (description: string) => NodeMessagePortChannel;
  private _peerChannels = new Map<string, NodeMessagePortChannel>();
  private _pendingConnects = new Map<
    string,
    {
      peerId: string;
      resolve: (conn: NodeParticipantConnection) => void;
      reject: (err: Error) => void;
    }
  >();
  private _orchestratorClient: any;
  private _lastContext: {
    connectionId: string;
    role: 'initiator' | 'receiver';
  } | null = null;

  constructor(options: NodeParticipantProxyOptions) {
    this._selfId = options.selfId;
    this._controlChannel = options.controlChannel;
    this._channelFactory =
      options.channelFactory ??
      ((desc: string) => new NodeMessagePortChannel({ description: desc }));

    this._orchestratorClient = clientHost
      .registerClient(ORCHESTRATOR_PROXY_SERVICE_PATH, {
        channel: this._controlChannel,
      })
      .createProxy();

    this._setupOrchestratorHandler();
  }

  private _setupOrchestratorHandler(): void {
    const handlers = {
      activateConnection: (port: MessagePort) => {
        const ctx = this._lastContext;
        this._lastContext = null;

        if (!ctx) return;

        const { connectionId, role } = ctx;
        const parts = connectionId.split('--');
        const peerId = parts[0] === this._selfId ? parts[1] : parts[0];

        let channel = this._peerChannels.get(peerId);
        if (!channel) {
          channel = this._channelFactory(`↔${peerId} direct port`);
          this._peerChannels.set(peerId, channel);
        }
        channel.bindPort(port);

        const pending = this._pendingConnects.get(connectionId);
        if (pending) {
          this._pendingConnects.delete(connectionId);
          pending.resolve({
            connectionId,
            peerId,
            role,
            getChannel: () => this._peerChannels.get(peerId)!,
          });
        }
      },
      activateConnectionContext: (ctx: {
        connectionId: string;
        role: 'initiator' | 'receiver';
      }) => {
        this._lastContext = ctx;
      },
      ping: () => 'pong',
    };

    let serviceHost = this._controlChannel.serviceHost;
    if (!serviceHost) {
      serviceHost = new RPCServiceHost();
      this._controlChannel.setServiceHost(serviceHost);
    }
    serviceHost.registerServiceHandler(ORCHESTRATOR_SERVICE_PATH, handlers);
  }

  async connect(
    toId: string,
    config?: Record<string, any>,
    options?: Record<string, any>
  ): Promise<NodeParticipantConnection> {
    const connectionId = this._canonicalConnectionId(this._selfId, toId);

    const existingChannel = this._peerChannels.get(toId);
    if (existingChannel && existingChannel.isConnected()) {
      return {
        connectionId,
        peerId: toId,
        role: 'initiator',
        getChannel: () => existingChannel,
      };
    }

    return new Promise<NodeParticipantConnection>((resolve, reject) => {
      this._pendingConnects.set(connectionId, {
        peerId: toId,
        resolve,
        reject,
      });

      this._orchestratorClient
        .requestConnect(this._selfId, toId, config, options)
        .catch((err: Error) => {
          this._pendingConnects.delete(connectionId);
          reject(err);
        });
    });
  }

  async disconnect(connectionId: string): Promise<void> {
    return this._orchestratorClient.requestDisconnect(connectionId);
  }

  async listParticipants(): Promise<ListParticipantEntry[]> {
    return this._orchestratorClient.listParticipants();
  }

  async listConnections(): Promise<ListConnectionEntry[]> {
    return this._orchestratorClient.listConnections();
  }

  getChannelFor(peerId: string): NodeMessagePortChannel | undefined {
    return this._peerChannels.get(peerId);
  }

  private _canonicalConnectionId(fromId: string, toId: string): string {
    return fromId < toId ? `${fromId}--${toId}` : `${toId}--${fromId}`;
  }
}

export function createParticipantProxy(
  options: NodeParticipantProxyOptions
): NodeParticipantOrchestratorProxy {
  return new NodeParticipantOrchestratorProxy(options);
}

export interface NodeWorkerParticipantOptions {
  mainChannel: AbstractChannelProtocol;
  directChannelDescription?: string;
  rebind?: boolean;
}

export class NodeWorkerParticipant {
  private _mainChannel: AbstractChannelProtocol;
  private _directChannel: NodeMessagePortChannel;
  private _mainServiceHost: RPCServiceHost;
  private _serviceProxies = new Map<
    string,
    Record<string, (...args: any[]) => any>
  >();
  private _rebind: boolean;

  constructor(options: NodeWorkerParticipantOptions) {
    const { mainChannel, directChannelDescription, rebind = true } = options;

    this._rebind = rebind;
    this._mainChannel = mainChannel;
    this._directChannel = new NodeMessagePortChannel({
      description: directChannelDescription,
    });

    this._mainServiceHost = new RPCServiceHost();
    this._mainChannel.setServiceHost(this._mainServiceHost);

    this._mainServiceHost.registerServiceHandler(ORCHESTRATOR_SERVICE_PATH, {
      activateConnection: (port: MessagePort) => {
        this._directChannel.bindPort(port);
      },
      activateConnectionContext: (_ctx: any) => {},
      ping: () => 'pong',
    });
  }

  get mainChannel(): AbstractChannelProtocol {
    return this._mainChannel;
  }

  get directChannel(): NodeMessagePortChannel {
    return this._directChannel;
  }

  getService<T extends Record<string, (...args: any[]) => any>>(
    servicePath: string
  ): T {
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

  registerService(
    serviceId: string,
    handlers: Record<string, (...args: any[]) => any>
  ): void {
    globalServiceHost.registerService(serviceId, {
      channel: this._directChannel,
      serviceHost: globalServiceHost,
      handlers,
    });
  }

  registerControlService(
    serviceId: string,
    handlers: Record<string, (...args: any[]) => any>
  ): void {
    this._mainServiceHost.registerServiceHandler(serviceId, handlers);
  }
}

export function createWorkerParticipant(
  options: NodeWorkerParticipantOptions
): NodeWorkerParticipant {
  return new NodeWorkerParticipant(options);
}
