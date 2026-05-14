import { createId, inject, injectable } from '@x-oasis/di';
import {
  ElectronUtilityProcessChannel,
  createParticipantProxy,
  ParticipantOrchestratorProxy,
} from '@x-oasis/async-call-rpc-electron';
import { clientHost } from '@x-oasis/async-call-rpc';

import {
  IMainRpcService,
  MAIN_RPC_SERVICE_PATH,
} from '@/services/pagelet-host/common';

export interface IPageletWorkerConfig {
  selfId: string;
  rendererParticipantId: string;
}

export const PageletWorkerConfigId = createId('PageletWorkerConfig');

export interface IPageletWorker {
  boot(): Promise<void>;
}

export const PageletWorkerId = createId('PageletWorker');

@injectable()
export class PageletWorker implements IPageletWorker {
  protected sharedClient: any = null;
  protected daemonClient: any = null;
  protected mainClient: IMainRpcService | null = null;
  /**
   * Held as a field so subclasses can reach pagelet ↔ pagelet (P↔P)
   * connections lazily via `connectToPeer(peerId)` after boot completes.
   * See A-008 §4.1 hub topology — once the orchestrator allocates the
   * MessagePort pair, traffic flows direct between pagelets and main no
   * longer relays.
   */
  protected proxy: ParticipantOrchestratorProxy | null = null;
  /**
   * Cache of RPC clients keyed by peer participant id. Avoids paying the
   * `proxy.connect(peerId)` round-trip on every call after the first.
   */
  protected peerClients = new Map<string, Record<string, any>>();

  constructor(
    @inject(PageletWorkerConfigId)
    protected readonly config: IPageletWorkerConfig
  ) {}

  async boot(): Promise<void> {
    if (!process.parentPort) {
      throw new Error('parentPort is not available');
    }

    const mainChannel = new ElectronUtilityProcessChannel({
      parentPort: process.parentPort as any,
      description: `${this.config.selfId}→main IPC channel`,
    });

    const proxy = createParticipantProxy({
      selfId: this.config.selfId,
      controlChannel: mainChannel,
      onConnection: (conn) => {
        console.log(
          `[${this.config.selfId}-worker] connection: ${conn.connectionId}, peer=${conn.peerId}, role=${conn.role}`
        );
        const ch = proxy.getChannelFor(conn.peerId);
        if (!ch) return;

        if (conn.peerId === this.config.rendererParticipantId) {
          this.onRendererConnection(ch);
          console.log(
            `[${this.config.selfId}-worker] service registered on ${conn.peerId} channel`
          );
        } else if (conn.peerId !== 'shared' && conn.peerId !== 'daemon') {
          // Pagelet ↔ pagelet (P↔P) inbound — A-008 §4.1.
          // Subclasses can override `onPeerConnection` to register a
          // peer-facing service on this direct channel. The role is
          // 'receiver' for the side being connected to and 'initiator'
          // for the side that called `proxy.connect(peerId)` — both
          // sides see this hook fire so each can register handlers.
          //
          // Excludes shared/daemon because their inbound clients are
          // wired in boot() above and don't need a per-connection hook.
          this.onPeerConnection(conn.peerId, ch);
        }
      },
    });
    this.proxy = proxy;

    this.mainClient = clientHost
      .registerClient(MAIN_RPC_SERVICE_PATH, { channel: mainChannel })
      .createProxy() as unknown as IMainRpcService;

    const sharedConn = await proxy.connect('shared');
    const daemonConn = await proxy.connect('daemon');

    this.sharedClient = clientHost
      .registerClient('shared-rpc', { channel: sharedConn.getChannel() })
      .createProxy();

    this.daemonClient = clientHost
      .registerClient('daemon-rpc', { channel: daemonConn.getChannel() })
      .createProxy();

    console.log(
      `[${this.config.selfId}-worker] connected to shared & daemon, waiting for ${this.config.rendererParticipantId} to connect`
    );
  }

  /**
   * Lazily establish a pagelet ↔ pagelet (P↔P) connection and return an
   * RPC proxy bound to the peer's service path. Cached per peerId so
   * subsequent calls are O(1).
   *
   * The peer pagelet must have registered the service at `peerServicePath`
   * via `serviceHost.registerService` on its side of the channel.
   *
   * Demonstrates D-006 Gap 1 / A-008 §4.1: the same `connect()` entry
   * point used for `connect('shared')` works for any registered peer,
   * including another pagelet. main allocates the MessagePort pair via
   * the control plane, then steps out of the data path.
   */
  protected async connectToPeer<T extends Record<string, any>>(
    peerId: string,
    peerServicePath: string
  ): Promise<T> {
    const cached = this.peerClients.get(peerId);
    if (cached) return cached as T;

    if (!this.proxy) {
      throw new Error(
        `[${this.config.selfId}-worker] connectToPeer called before boot()`
      );
    }

    const conn = await this.proxy.connect(peerId);
    const client = clientHost
      .registerClient(`${this.config.selfId}→${peerId}:${peerServicePath}`, {
        channel: conn.getChannel(),
      })
      .createProxy() as T;
    this.peerClients.set(peerId, client);
    return client;
  }

  protected onRendererConnection(
    _channel: ReturnType<
      ReturnType<typeof createParticipantProxy>['getChannelFor']
    >
  ): void {}

  /**
   * Override to handle inbound pagelet ↔ pagelet (P↔P) connections —
   * fires whenever another pagelet's `proxy.connect(thisPagelet)` lands,
   * AND when this pagelet's own `connectToPeer(peerId)` activates the
   * direct channel (both sides see it).
   *
   * Default: no-op. Subclasses that want to expose a peer-facing service
   * should `serviceHost.registerService(PEER_PATH, { channel, ... })`
   * here.
   *
   * Excludes shared / daemon / renderer (those are handled by their own
   * code paths during `boot()`).
   */
  protected onPeerConnection(
    _peerId: string,
    _channel: ReturnType<
      ReturnType<typeof createParticipantProxy>['getChannelFor']
    >
  ): void {}
}
