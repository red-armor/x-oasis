import {
  ElectronUtilityProcessChannel,
  createParticipantProxy,
} from '../../../src/index.js';
import { clientHost, serviceHost } from '@x-oasis/async-call-rpc/core';

if (!process.parentPort) {
  throw new Error('parentPort is not available');
}

const mainChannel = new ElectronUtilityProcessChannel({
  parentPort: process.parentPort as any,
  description: 'main-pagelet→main IPC channel',
});

const proxy = createParticipantProxy({
  selfId: 'main-pagelet',
  controlChannel: mainChannel,
});

async function boot() {
  const rendererConn = await proxy.connect('renderer');
  const sharedConn = await proxy.connect('shared');
  const daemonConn = await proxy.connect('daemon');

  console.log(
    `[main-pagelet-worker] connected: renderer=${rendererConn.connectionId}, shared=${sharedConn.connectionId}, daemon=${daemonConn.connectionId}`
  );

  const rendererChannel = rendererConn.getChannel();
  const sharedChannel = sharedConn.getChannel();
  const daemonChannel = daemonConn.getChannel();

  const mainClient = clientHost
    .registerClient('main-rpc', { channel: mainChannel })
    .createProxy();

  const sharedClient = clientHost
    .registerClient('shared-rpc', { channel: sharedChannel })
    .createProxy<{
      echo(msg: string): Promise<string>;
      getConfig(key: string): Promise<string>;
      setConfig(key: string, value: string): Promise<string>;
      onConfigChange(callback: (event: any) => void): {
        unsubscribe: () => void;
      };
    }>();

  const daemonClient = clientHost
    .registerClient('daemon-rpc', { channel: daemonChannel })
    .createProxy<{
      echo(msg: string): Promise<string>;
      systemStatus(): Promise<string>;
      onSystemStatusChange(callback: (status: any) => void): {
        unsubscribe: () => void;
      };
      onLogEvent(callback: (log: any) => void): { unsubscribe: () => void };
      watchCpuUsage(): any;
    }>();

  const daemonSubscriptionClient = clientHost.registerClient('daemon-rpc', {
    channel: daemonChannel,
  });

  serviceHost.registerService('pagelet-api', {
    channel: rendererChannel,
    serviceHost,
    handlers: {
      info(): string {
        return `main-pagelet ready (pid=${process.pid})`;
      },
      async callSharedEcho(msg: string): Promise<string> {
        return sharedClient.echo(msg);
      },
      async callSharedGetConfig(key: string): Promise<string> {
        return sharedClient.getConfig(key);
      },
      async callSharedSetConfig(key: string, value: string): Promise<string> {
        return sharedClient.setConfig(key, value);
      },
      async callDaemonEcho(msg: string): Promise<string> {
        return daemonClient.echo(msg);
      },
      async callDaemonSystemStatus(): Promise<string> {
        return daemonClient.systemStatus();
      },
      async callMainPing(msg: string): Promise<string> {
        return mainClient.mainPing(msg);
      },
      onDaemonStatusChange(callback: (status: any) => void) {
        return daemonClient.onSystemStatusChange(callback);
      },
      onDaemonLog(callback: (log: any) => void) {
        return daemonClient.onLogEvent(callback);
      },
      onSharedConfigChange(callback: (event: any) => void) {
        return sharedClient.onConfigChange(callback);
      },
      onDaemonCpuUsage(callback: (data: any) => void) {
        const sub = daemonSubscriptionClient.subscribe('watchCpuUsage', [], {
          onData: (value: any) => callback(value),
          onError: (err: Error) => {
            console.error('[main-pagelet-worker] watchCpuUsage error:', err);
          },
          onComplete: () => {
            console.log('[main-pagelet-worker] watchCpuUsage completed');
          },
        });
        return { unsubscribe: () => sub.unsubscribe() };
      },
    },
  });

  console.log('[main-pagelet-worker] initialized with subscription support');
}

boot().catch((err) => {
  console.error('[main-pagelet-worker] boot failed:', err);
});
