import { createId, inject, injectable } from '@x-oasis/di';
import { RPCServiceHost } from '@x-oasis/async-call-rpc';

import {
  IMainCpServer,
  MainCpServerId,
} from '../../../main/application/electron-main/MainCpServer';
import { IPageletProcess, PageletProcessId } from './PageletProcess';
import { ORCHESTRATOR_SERVICE_PATH } from '../../../main/application/common/types';
import { RENDERER_PARTICIPANT_ID } from '../common';

export interface IOrchestratorService {
  connect(pageId: string): Promise<any>;
  disconnect(pageId: string): Promise<void>;
  simulateLost(pageId: string): void;
  getStatus(pageId: string): Promise<any>;
  killUtility(pageId: string): void;
  onStateChange(callback: (event: any) => void): void;
  onReady(callback: (event: any) => void): void;
  onDisconnected(callback: (event: any) => void): void;
  onReconnecting(callback: (event: any) => void): void;
  onReconnected(callback: (event: any) => void): void;
  onReconnectFailed(callback: (event: any) => void): void;
  onClosed(callback: (event: any) => void): void;
}

export type IAppOrchestrator = IOrchestratorService;

export const AppOrchestratorId = createId('AppOrchestrator');

@injectable()
export class AppOrchestrator implements IAppOrchestrator {
  private pageServiceHost = new RPCServiceHost();

  constructor(
    @inject(MainCpServerId) private readonly cpServer: IMainCpServer,
    @inject(PageletProcessId) private readonly pageletProcess: IPageletProcess
  ) {}

  registerOrchestratorService(): void {
    const rendererIpcChannel = this.cpServer.getRendererIpcChannel();
    rendererIpcChannel.setServiceHost(this.pageServiceHost);

    const orchestrator = this.cpServer.getOrchestrator();

    this.pageServiceHost.registerService(ORCHESTRATOR_SERVICE_PATH, {
      channel: rendererIpcChannel,
      serviceHost: this.pageServiceHost,
      handlers: {
        async connect(pageId: string): Promise<any> {
          const pageletId = getPageletId(pageId);
          try {
            const info = await orchestrator.connect(
              RENDERER_PARTICIPANT_ID,
              pageletId
            );
            return {
              connectionId: info.connectionId,
              fromId: info.fromId,
              toId: info.toId,
              state: info.state,
              lastStateChangedAt: info.lastStateChangedAt,
              error: info.error?.message,
            };
          } catch (err: any) {
            return { error: err.message };
          }
        },
        async disconnect(pageId: string): Promise<void> {
          const pageletId = getPageletId(pageId);
          const info = orchestrator.getConnectionInfo(
            RENDERER_PARTICIPANT_ID,
            pageletId
          );
          if (info) {
            await orchestrator.disconnect(info.connectionId);
          }
        },
        simulateLost(pageId: string): void {
          const pageletId = getPageletId(pageId);
          orchestrator.handleParticipantLost(
            pageletId,
            'simulated process exit'
          );
        },
        async getStatus(pageId: string): Promise<any> {
          const pageletId = getPageletId(pageId);
          const info = orchestrator.getConnectionInfo(
            RENDERER_PARTICIPANT_ID,
            pageletId
          );
          if (!info) return null;
          const stats = orchestrator.getConnectionStats(info.connectionId);
          return {
            connectionId: info.connectionId,
            fromId: info.fromId,
            toId: info.toId,
            state: info.state,
            lastStateChangedAt: info.lastStateChangedAt,
            error: info.error?.message,
            isReady: info.isReady,
            stats: stats
              ? {
                  totalRpcCalls: stats.totalRpcCalls,
                  successfulCalls: stats.successfulCalls,
                  failedCalls: stats.failedCalls,
                  avgLatencyMs: stats.avgLatencyMs,
                  totalReconnects: stats.totalReconnects,
                }
              : null,
          };
        },
        killUtility: (pageId: string): void => {
          const pageletId = getPageletId(pageId);
          this.pageletProcess.kill(pageletId);
        },
        onStateChange(remoteCallback: (event: any) => void) {
          orchestrator.onStateChange((event) => remoteCallback(event));
        },
        onReady(remoteCallback: (event: any) => void) {
          orchestrator.onReady((event) => remoteCallback(event));
        },
        onDisconnected(remoteCallback: (event: any) => void) {
          orchestrator.onDisconnected((event) => remoteCallback(event));
        },
        onReconnecting(remoteCallback: (event: any) => void) {
          orchestrator.onReconnecting((event) => remoteCallback(event));
        },
        onReconnected(remoteCallback: (event: any) => void) {
          orchestrator.onReconnected((event) => remoteCallback(event));
        },
        onReconnectFailed(remoteCallback: (event: any) => void) {
          orchestrator.onReconnectFailed((event) => remoteCallback(event));
        },
        onClosed(remoteCallback: (event: any) => void) {
          orchestrator.onClosed((event) => remoteCallback(event));
        },
      },
    });
  }
}

function getPageletId(pageId: string): string {
  return `pagelet-${pageId.replace('page', '').toUpperCase()}`;
}
