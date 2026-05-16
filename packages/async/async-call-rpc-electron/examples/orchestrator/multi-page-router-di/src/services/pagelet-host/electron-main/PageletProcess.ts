import { createId, inject, injectable } from '@x-oasis/di';
import {
  ElectronUtilityProcessChannel,
  type ChannelReadyInfo,
  type InspectorSnapshot,
  type SpawnInfo,
  type StateChangeEvent,
} from '@x-oasis/async-call-rpc-electron/electron-main/core';
import { UtilityProcessSupervisor } from '@x-oasis/async-call-rpc-electron/electron-main/orchestrator';
import { serviceHost } from '@x-oasis/async-call-rpc/core';
import { ExponentialBackoffPolicy } from '@x-oasis/async-call-rpc/orchestrator';
import { join } from 'path';

import {
  IMainCpServer,
  MainCpServerId,
} from '@/apps/main/application/electron-main/MainCpServer';
import { pidNameRegistry } from '@/services/main-metrics/electron-main/pidNameRegistry';

export interface IPageletProcess {
  spawn(pageletId: string, workerFileName: string): Promise<void>;
  kill(pageletId: string): void;
  getChannel(pageletId: string): ElectronUtilityProcessChannel | undefined;
  /** Snapshot per pagelet supervisor (G3 inspector). */
  getInspectorSnapshots(): InspectorSnapshot[];
}

export const PageletProcessId = createId('PageletProcess');

const PAGELET_NAMES: Record<string, string> = {
  connection: 'Connection',
  monitor: 'Monitor',
  setting: 'Setting',
};

@injectable()
export class PageletProcess implements IPageletProcess {
  private supervisors = new Map<string, UtilityProcessSupervisor>();
  private channels = new Map<string, ElectronUtilityProcessChannel>();
  private lastPids = new Map<string, number>();

  constructor(
    @inject(MainCpServerId) private readonly cpServer: IMainCpServer
  ) {}

  async spawn(pageletId: string, workerFileName: string): Promise<void> {
    if (this.supervisors.has(pageletId)) {
      throw new Error(
        `[PageletProcess] pagelet "${pageletId}" already spawned`
      );
    }

    const orchestrators =
      pageletId === 'setting'
        ? [
            this.cpServer.getOrchestrator(),
            this.cpServer.getSettingOrchestrator(),
          ]
        : this.cpServer.getOrchestrator();

    const supervisor = new UtilityProcessSupervisor({
      orchestrator: orchestrators,
      participantId: pageletId,
      entry: join(__dirname, `../preload/${workerFileName}`),
      role: 'utility',
      // Demo-friendly restart policy — without this the supervisor
      // transitions straight to `failed` on first crash (see
      // UtilityProcessSupervisor.ts:762-764), which makes
      // `kill -9 <pagelet-pid>` look like a permanent error in the
      // SupervisorsPanel instead of a recovery cycle.
      restartPolicy: new ExponentialBackoffPolicy({
        initialDelayMs: 500,
        maxDelayMs: 5_000,
        maxRetries: 10,
      }),
      onSpawn: ({ pid, isRestart }: SpawnInfo) => {
        const lastPid = this.lastPids.get(pageletId);
        if (isRestart && lastPid !== undefined) {
          pidNameRegistry.unregisterPid(lastPid);
        }
        pidNameRegistry.registerByPid(
          pid,
          PAGELET_NAMES[pageletId] || pageletId
        );
        this.lastPids.set(pageletId, pid);
      },
      onChannelReady: ({ channel }: ChannelReadyInfo) => {
        channel.setServiceHost(serviceHost);
        this.channels.set(pageletId, channel);
      },
      onStateChange: (event: StateChangeEvent) => {
        console.log(
          `[PageletProcess:${pageletId}:state] ${event.prev} → ${event.curr}${
            event.reason ? ` (${event.reason})` : ''
          }`
        );
      },
      logger: (level: string, msg: string) =>
        console.log(`[PageletProcess:${pageletId}:${level}] ${msg}`),
    });

    this.supervisors.set(pageletId, supervisor);
    await supervisor.start();
    console.log(`[PageletProcess] spawned ${pageletId}`);
  }

  kill(pageletId: string): void {
    const supervisor = this.supervisors.get(pageletId);
    if (!supervisor) return;
    void supervisor.stop();
    this.supervisors.delete(pageletId);
    this.channels.delete(pageletId);
    const lastPid = this.lastPids.get(pageletId);
    if (lastPid !== undefined) {
      pidNameRegistry.unregisterPid(lastPid);
      this.lastPids.delete(pageletId);
    }
  }

  getChannel(pageletId: string): ElectronUtilityProcessChannel | undefined {
    return this.channels.get(pageletId);
  }

  getInspectorSnapshots(): InspectorSnapshot[] {
    const out: InspectorSnapshot[] = [];
    for (const sup of this.supervisors.values()) {
      out.push(sup.getInspectorSnapshot());
    }
    return out;
  }
}
