import {
  WorkerChannel,
  RPCMessageChannel,
} from '@x-oasis/async-call-rpc-web/core';
import {
  clientHost,
  serviceHost,
  ORCHESTRATOR_PROXY_SERVICE_PATH,
  ORCHESTRATOR_SERVICE_PATH,
  AbstractChannelProtocol,
} from '@x-oasis/async-call-rpc/core';

interface ParticipantConnection {
  readonly connectionId: string;
  readonly peerId: string;
  readonly role: 'initiator' | 'receiver';
  getChannel(): RPCMessageChannel;
}

class WebParticipantOrchestratorProxy {
  private _selfId: string;
  private _controlChannel: AbstractChannelProtocol;
  private _channelFactory: (desc: string) => RPCMessageChannel;
  private _peerChannels = new Map<string, RPCMessageChannel>();
  private _pendingConnects = new Map<
    string,
    {
      peerId: string;
      resolve: (conn: ParticipantConnection) => void;
      reject: (err: Error) => void;
    }
  >();
  private _orchestratorClient: any;
  private _lastContext: {
    connectionId: string;
    role: 'initiator' | 'receiver';
  } | null = null;

  constructor(options: {
    selfId: string;
    controlChannel: AbstractChannelProtocol;
    channelFactory?: (desc: string) => RPCMessageChannel;
  }) {
    this._selfId = options.selfId;
    this._controlChannel = options.controlChannel;
    this._channelFactory =
      options.channelFactory ??
      ((desc: string) => new RPCMessageChannel({ description: desc }));

    this._orchestratorClient = clientHost
      .registerClient(ORCHESTRATOR_PROXY_SERVICE_PATH, {
        channel: this._controlChannel,
      })
      .createProxy();
  }

  get lastContext() {
    return this._lastContext;
  }

  set lastContext(
    ctx: { connectionId: string; role: 'initiator' | 'receiver' } | null
  ) {
    this._lastContext = ctx;
  }

  async connect(toId: string): Promise<ParticipantConnection> {
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
        .requestConnect(this._selfId, toId)
        .catch((err: Error) => {
          this._pendingConnects.delete(connectionId);
          reject(err);
        });
    });
  }

  getChannelFor(peerId: string): RPCMessageChannel | undefined {
    return this._peerChannels.get(peerId);
  }

  handleActivateConnection(port: any): void {
    const ctx = this._lastContext;
    this._lastContext = null;

    if (!ctx) return;

    const { connectionId, role } = ctx;
    const idx = connectionId.indexOf('--');
    const from = connectionId.substring(0, idx);
    const to = connectionId.substring(idx + 2);
    const peerId = role === 'initiator' ? to : from;

    let channel = this._peerChannels.get(peerId);
    if (!channel) {
      channel = this._channelFactory(`↔${peerId} direct port`);
      this._peerChannels.set(peerId, channel);
    }
    channel.bindPort(port, { rebind: true });

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
  }

  handleActivateConnectionContext(ctx: {
    connectionId: string;
    role: 'initiator' | 'receiver';
  }): void {
    this._lastContext = ctx;
  }

  private _canonicalConnectionId(fromId: string, toId: string): string {
    return fromId < toId ? `${fromId}--${toId}` : `${toId}--${fromId}`;
  }
}

const controlChannel = new WorkerChannel(self, {
  name: 'pagelet-control',
});

const proxy = new WebParticipantOrchestratorProxy({
  selfId: 'pagelet',
  controlChannel,
});

serviceHost.registerServiceHandler(ORCHESTRATOR_SERVICE_PATH, {
  activateConnection: (port: any) => proxy.handleActivateConnection(port),
  activateConnectionContext: (ctx: any) =>
    proxy.handleActivateConnectionContext(ctx),
});

controlChannel.setServiceHost(serviceHost);

async function boot() {
  const sharedConn = await proxy.connect('shared');
  const daemonConn = await proxy.connect('daemon');

  console.log(
    `[pagelet-worker] connected: shared=${sharedConn.connectionId}, daemon=${daemonConn.connectionId}`
  );

  const sharedChannel = sharedConn.getChannel();
  const daemonChannel = daemonConn.getChannel();

  const sharedClient = clientHost
    .registerClient('shared-rpc', { channel: sharedChannel })
    .createProxy<{
      echo(msg: string): Promise<string>;
      getConfig(key: string): Promise<string>;
    }>();

  const daemonClient = clientHost
    .registerClient('daemon-rpc', { channel: daemonChannel })
    .createProxy<{
      echo(msg: string): Promise<string>;
      systemStatus(): Promise<string>;
    }>();

  serviceHost.registerServiceHandler('pagelet-api', {
    info(): string {
      return `pagelet ready (web worker)`;
    },
    async callSharedEcho(msg: string): Promise<string> {
      return sharedClient.echo(msg);
    },
    async callSharedGetConfig(key: string): Promise<string> {
      return sharedClient.getConfig(key);
    },
    async callDaemonEcho(msg: string): Promise<string> {
      return daemonClient.echo(msg);
    },
    async callDaemonSystemStatus(): Promise<string> {
      return daemonClient.systemStatus();
    },
  });

  console.log('[pagelet-worker] initialized');
}

boot().catch((err) => {
  console.error('[pagelet-worker] boot failed:', err);
});
