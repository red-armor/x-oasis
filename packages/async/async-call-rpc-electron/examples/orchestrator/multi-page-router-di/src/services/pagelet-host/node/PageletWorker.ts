import { createId, inject, injectable } from '@x-oasis/di';
import {
  ElectronUtilityProcessChannel,
  createParticipantProxy,
} from '@x-oasis/async-call-rpc-electron';
import { clientHost, serviceHost } from '@x-oasis/async-call-rpc';

import {
  IMainRpcService,
  PAGELET_SERVICE_PATH,
  MAIN_RPC_SERVICE_PATH,
} from '@/services/pagelet-host/common';
import {
  ISharedService,
  SHARED_SERVICE_PATH,
} from '@/apps/shared/application/common';
import {
  IDaemonService,
  DAEMON_SERVICE_PATH,
} from '@/apps/daemon/application/common';
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
  private sharedClient: ISharedService | null = null;
  private daemonClient: IDaemonService | null = null;
  private mainClient: IMainRpcService | null = null;

  constructor(
    @inject(PageletWorkerConfigId) private readonly config: IPageletWorkerConfig
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
        if (ch && conn.peerId === this.config.rendererParticipantId) {
          serviceHost.registerService(PAGELET_SERVICE_PATH, {
            channel: ch,
            serviceHost,
            handlers: {
              info: (): string =>
                `${this.config.selfId} ready (pid=${process.pid})`,
              callSharedEcho: (msg: string): Promise<string> =>
                this.sharedClient?.echo(msg) ??
                Promise.resolve('shared not ready'),
              callSharedGetConfig: (key: string): Promise<string> =>
                this.sharedClient?.getConfig(key) ??
                Promise.resolve('shared not ready'),
              callSharedSetConfig: (
                key: string,
                value: string
              ): Promise<string> =>
                this.sharedClient?.setConfig(key, value) ??
                Promise.resolve('shared not ready'),
              callDaemonEcho: (msg: string): Promise<string> =>
                this.daemonClient?.echo(msg) ??
                Promise.resolve('daemon not ready'),
              callDaemonSystemStatus: (): Promise<string> =>
                this.daemonClient?.systemStatus() ??
                Promise.resolve('daemon not ready'),
              callMainPing: (msg: string): Promise<string> =>
                this.mainClient?.mainPing(msg) ??
                Promise.resolve('main not ready'),
            },
          });
          console.log(
            `[${this.config.selfId}-worker] ${PAGELET_SERVICE_PATH} registered on ${conn.peerId} channel`
          );
        }
      },
    });

    this.mainClient = clientHost
      .registerClient(MAIN_RPC_SERVICE_PATH, { channel: mainChannel })
      .createProxy() as unknown as IMainRpcService;

    const sharedConn = await proxy.connect('shared');
    const daemonConn = await proxy.connect('daemon');

    this.sharedClient = clientHost
      .registerClient(SHARED_SERVICE_PATH, { channel: sharedConn.getChannel() })
      .createProxy() as unknown as ISharedService;

    this.daemonClient = clientHost
      .registerClient(DAEMON_SERVICE_PATH, { channel: daemonConn.getChannel() })
      .createProxy() as unknown as IDaemonService;

    console.log(
      `[${this.config.selfId}-worker] connected to shared & daemon, waiting for ${this.config.rendererParticipantId} to connect`
    );
  }
}
