import { createId, inject, injectable } from '@x-oasis/di';
import { serviceHost } from '@x-oasis/async-call-rpc/core';
import {
  PageletWorker,
  PageletWorkerConfigId,
  IPageletWorkerConfig,
} from '@/services/pagelet-host/node/PageletWorker';
import {
  SETTING_PAGELET_SERVICE_PATH,
  SETTING_PAGELET_PEER_SERVICE_PATH,
} from '@/apps/setting/application/common';
import { ISharedService } from '@/apps/shared/application/common';
import { IDaemonService } from '@/apps/daemon/application/common';
import { IMainRpcService } from '@/services/pagelet-host/common';

export const SettingWorkerId = createId('SettingWorker');

@injectable()
export class SettingWorker extends PageletWorker {
  constructor(@inject(PageletWorkerConfigId) config: IPageletWorkerConfig) {
    super(config);
  }

  protected override onRendererConnection(channel: any): void {
    serviceHost.registerService(SETTING_PAGELET_SERVICE_PATH, {
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
      },
    });
  }

  /**
   * Receives an inbound P↔P connection from another pagelet (e.g.
   * connection pagelet calling `proxy.connect(SETTING_PARTICIPANT_ID)`).
   * Registers `ISettingPageletPeerService` on the direct channel so the
   * caller can reach it without main relaying any RPC.
   *
   * Demonstrates D-006 Gap 1 / A-008 §4.1.
   */
  protected override onPeerConnection(peerId: string, channel: any): void {
    serviceHost.registerService(SETTING_PAGELET_PEER_SERVICE_PATH, {
      channel,
      serviceHost,
      handlers: {
        peerInfo: (fromId: string): string =>
          `${this.config.selfId} (pid=${process.pid}) ← P↔P from "${fromId}", channel from peer "${peerId}"`,
      },
    });
    console.log(
      `[${this.config.selfId}-worker] P↔P peer service registered for "${peerId}"`
    );
  }
}
