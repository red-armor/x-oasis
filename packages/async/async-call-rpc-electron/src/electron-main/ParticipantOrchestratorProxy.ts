import {
  clientHost,
  RPCService,
  ORCHESTRATOR_SERVICE_PATH,
  ORCHESTRATOR_PROXY_SERVICE_PATH,
  AbstractChannelProtocol,
  ListParticipantEntry,
  ListConnectionEntry,
} from '@x-oasis/async-call-rpc';
import ElectronMessagePortMainChannel from './ElectronMessagePortMainChannel';

export interface ParticipantConnection {
  readonly connectionId: string;
  readonly peerId: string;
  readonly role: 'initiator' | 'receiver';
  getChannel(): ElectronMessagePortMainChannel;
}

export interface ParticipantOrchestratorProxyOptions {
  selfId: string;
  controlChannel: AbstractChannelProtocol;
  channelFactory?: (description: string) => ElectronMessagePortMainChannel;
  onConnection?: (conn: ParticipantConnection) => void;
}

export class ParticipantOrchestratorProxy {
  private _selfId: string;
  private _controlChannel: AbstractChannelProtocol;
  private _channelFactory: (
    description: string
  ) => ElectronMessagePortMainChannel;
  private _peerChannels = new Map<string, ElectronMessagePortMainChannel>();
  private _pendingConnects = new Map<
    string,
    {
      peerId: string;
      resolve: (conn: ParticipantConnection) => void;
      reject: (err: Error) => void;
    }
  >();
  private _orchestratorClient: any;
  private _onConnection?: (conn: ParticipantConnection) => void;

  constructor(options: ParticipantOrchestratorProxyOptions) {
    this._selfId = options.selfId;
    this._controlChannel = options.controlChannel;
    this._channelFactory =
      options.channelFactory ??
      ((desc: string) =>
        new ElectronMessagePortMainChannel({ description: desc }));
    this._onConnection = options.onConnection;

    this._orchestratorClient = clientHost
      .registerClient(ORCHESTRATOR_PROXY_SERVICE_PATH, {
        channel: this._controlChannel,
      })
      .createProxy();

    this._setupOrchestratorHandler();
  }

  private _lastContext: {
    connectionId: string;
    role: 'initiator' | 'receiver';
  } | null = null;

  private _pendingContexts = new Map<
    string,
    { connectionId: string; role: 'initiator' | 'receiver' }
  >();

  private _contextQueue: {
    connectionId: string;
    role: 'initiator' | 'receiver';
  }[] = [];

  private _setupOrchestratorHandler(): void {
    const service = new RPCService(ORCHESTRATOR_SERVICE_PATH, {
      handlers: {
        activateConnection: (port: any, connectionId?: string) => {
          let ctx: {
            connectionId: string;
            role: 'initiator' | 'receiver';
          } | null = null;

          if (connectionId) {
            ctx = this._pendingContexts.get(connectionId) ?? null;
            this._pendingContexts.delete(connectionId);
            const qIdx = this._contextQueue.findIndex(
              (c) => c.connectionId === connectionId
            );
            if (qIdx !== -1) this._contextQueue.splice(qIdx, 1);
          } else if (this._contextQueue.length > 0) {
            ctx = this._contextQueue.shift()!;
            this._pendingContexts.delete(ctx.connectionId);
          } else {
            ctx = this._lastContext;
            this._lastContext = null;
          }

          if (!ctx) return;

          const { connectionId: cid, role } = ctx;
          const idx = cid.indexOf('--');
          const from = cid.substring(0, idx);
          const to = cid.substring(idx + 2);
          const peerId = from === this._selfId ? to : from;

          let channel = this._peerChannels.get(peerId);
          if (!channel) {
            channel = this._channelFactory(`↔${peerId} direct port`);
            this._peerChannels.set(peerId, channel);
          }
          channel.bindPort(port, { rebind: true });

          const pending = this._pendingConnects.get(cid);
          if (pending) {
            this._pendingConnects.delete(cid);
            pending.resolve({
              connectionId: cid,
              peerId,
              role,
              getChannel: () => this._peerChannels.get(peerId)!,
            });
          } else if (this._onConnection) {
            this._onConnection({
              connectionId: cid,
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
          this._pendingContexts.set(ctx.connectionId, ctx);
          this._contextQueue.push(ctx);
          this._lastContext = ctx;
        },
        ping: () => 'pong',
      },
    });
    service.setChannel(this._controlChannel);
  }

  async connect(
    toId: string,
    config?: Record<string, any>,
    options?: Record<string, any>
  ): Promise<ParticipantConnection> {
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

    return new Promise<ParticipantConnection>((resolve, reject) => {
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

  getChannelFor(peerId: string): ElectronMessagePortMainChannel | undefined {
    return this._peerChannels.get(peerId);
  }

  private _canonicalConnectionId(fromId: string, toId: string): string {
    return fromId < toId ? `${fromId}--${toId}` : `${toId}--${fromId}`;
  }
}

export function createParticipantProxy(
  options: ParticipantOrchestratorProxyOptions
): ParticipantOrchestratorProxy {
  return new ParticipantOrchestratorProxy(options);
}
