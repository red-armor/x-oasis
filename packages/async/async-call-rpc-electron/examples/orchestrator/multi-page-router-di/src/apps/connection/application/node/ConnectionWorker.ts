import { createId, inject, injectable } from '@x-oasis/di';
import { serviceHost } from '@x-oasis/async-call-rpc';
import {
  PageletWorker,
  PageletWorkerConfigId,
  IPageletWorkerConfig,
} from '@/services/pagelet-host/node/PageletWorker';
import { CONNECTION_PAGELET_SERVICE_PATH } from '@/apps/connection/application/common';
import {
  SETTING_PARTICIPANT_ID,
  SETTING_PAGELET_PEER_SERVICE_PATH,
  ISettingPageletPeerService,
} from '@/apps/setting/application/common';
import { ISharedService } from '@/apps/shared/application/common';
import { IDaemonService } from '@/apps/daemon/application/common';
import { IMainRpcService } from '@/services/pagelet-host/common';

export const ConnectionWorkerId = createId('ConnectionWorker');

@injectable()
export class ConnectionWorker extends PageletWorker {
  constructor(@inject(PageletWorkerConfigId) config: IPageletWorkerConfig) {
    super(config);
  }
  protected override onRendererConnection(channel: any): void {
    serviceHost.registerService(CONNECTION_PAGELET_SERVICE_PATH, {
      channel,
      serviceHost,
      handlers: {
        info: (): string => `${this.config.selfId} ready (pid=${process.pid})`,
        callSharedEcho: (msg: string): Promise<string> =>
          (this.sharedClient as ISharedService)?.echo(msg) ??
          Promise.resolve('shared not ready'),
        callSharedGetConfig: (key: string): Promise<string> =>
          (this.sharedClient as ISharedService)?.getConfig(key) ??
          Promise.resolve('shared not ready'),
        callSharedSetConfig: (key: string, value: string): Promise<string> =>
          (this.sharedClient as ISharedService)?.setConfig(key, value) ??
          Promise.resolve('shared not ready'),
        callDaemonEcho: (msg: string): Promise<string> =>
          (this.daemonClient as IDaemonService)?.echo(msg) ??
          Promise.resolve('daemon not ready'),
        callDaemonSystemStatus: (): Promise<string> =>
          (this.daemonClient as IDaemonService)?.systemStatus() ??
          Promise.resolve('daemon not ready'),
        callMainPing: (msg: string): Promise<string> =>
          (this.mainClient as IMainRpcService)?.mainPing(msg) ??
          Promise.resolve('main not ready'),
        // ─── Pagelet ↔ pagelet (P↔P) demo ─────────────────────────────────
        //
        // Lazily establishes a direct channel from this connection pagelet
        // to the setting pagelet via `proxy.connect(SETTING_PARTICIPANT_ID)`,
        // then calls a peer-to-peer RPC. main only allocates the
        // MessagePort pair; the actual `peerInfo()` request travels A↔B
        // direct without main relaying.
        callSettingPeerInfo: async (): Promise<string> => {
          try {
            const settingClient =
              await this.connectToPeer<ISettingPageletPeerService>(
                SETTING_PARTICIPANT_ID,
                SETTING_PAGELET_PEER_SERVICE_PATH
              );
            return await settingClient.peerInfo(this.config.selfId);
          } catch (err) {
            return `setting P↔P failed: ${(err as Error).message}`;
          }
        },
      },
    });
  }
}
