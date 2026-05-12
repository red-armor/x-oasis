import { createId, injectable } from '@x-oasis/di';
import {
  ElectronUtilityProcessChannel,
  createParticipantProxy,
} from '@x-oasis/async-call-rpc-electron';
import { clientHost, RPCServiceHost } from '@x-oasis/async-call-rpc';

import { MONITOR_PAGELET_SERVICE_PATH } from '@/services/pagelet-host/common';
import {
  DIAGNOSTICS_SERVICE_PATH,
  IDiagnosticsService,
} from '@/apps/daemon/diagnostics/common';

export const MonitorPageletWorkerId = createId('MonitorPageletWorker');

@injectable()
export class MonitorPageletWorker {
  async boot(): Promise<void> {
    if (!process.parentPort) {
      throw new Error('parentPort is not available');
    }

    const mainChannel = new ElectronUtilityProcessChannel({
      parentPort: process.parentPort as any,
      description: 'monitor→main IPC channel',
    });

    const proxy = createParticipantProxy({
      selfId: 'monitor',
      controlChannel: mainChannel,
    });

    const daemonConn = await proxy.connect('daemon');

    const diagnosticsClient = clientHost
      .registerClient(DIAGNOSTICS_SERVICE_PATH, {
        channel: daemonConn.getChannel(),
      })
      .createProxy() as unknown as IDiagnosticsService;

    const mainServiceHost = new RPCServiceHost();

    const orchestratorService = mainChannel.service;
    if (orchestratorService) {
      mainServiceHost.serviceMap.set(
        orchestratorService.servicePath,
        orchestratorService
      );
    }

    mainServiceHost.registerServiceHandler(MONITOR_PAGELET_SERVICE_PATH, {
      info: (): string => `monitor-pagelet ready (pid=${process.pid})`,
      getSnapshot: (): any => diagnosticsClient.getPerformanceSnapshot(),
      onPerformanceUpdate: (callback: (snapshot: any) => void) =>
        diagnosticsClient.onPerformanceUpdate(callback),
    });

    mainChannel.setServiceHost(mainServiceHost);

    console.log(
      `[monitor-worker] ${MONITOR_PAGELET_SERVICE_PATH} registered on main control channel, connected to daemon`
    );
  }
}
