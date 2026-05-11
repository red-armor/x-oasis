import {
  ElectronUtilityProcessChannel,
  createParticipantProxy,
} from '../../../src/index.js';
import { clientHost, serviceHost } from '@x-oasis/async-call-rpc';

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
    }>();

  const daemonClient = clientHost
    .registerClient('daemon-rpc', { channel: daemonChannel })
    .createProxy<{
      echo(msg: string): Promise<string>;
      systemStatus(): Promise<string>;
    }>();

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
      async callDaemonEcho(msg: string): Promise<string> {
        return daemonClient.echo(msg);
      },
      async callDaemonSystemStatus(): Promise<string> {
        return daemonClient.systemStatus();
      },
      async callMainPing(msg: string): Promise<string> {
        return mainClient.mainPing(msg);
      },
    },
  });

  console.log('[main-pagelet-worker] initialized');
}

boot().catch((err) => {
  console.error('[main-pagelet-worker] boot failed:', err);
});
