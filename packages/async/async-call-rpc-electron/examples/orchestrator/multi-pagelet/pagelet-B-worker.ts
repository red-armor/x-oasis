import {
  ElectronUtilityProcessChannel,
  createParticipantProxy,
} from '../../../src/index.js';
import { clientHost, serviceHost } from '@x-oasis/async-call-rpc';

const SELF_ID = 'pagelet-B';
const PAGE_ID = 'pageB';

if (!process.parentPort) {
  throw new Error('parentPort is not available');
}

const mainChannel = new ElectronUtilityProcessChannel({
  parentPort: process.parentPort as any,
  description: `${SELF_ID}→main IPC channel`,
});

let sharedClient: any = null;
let daemonClient: any = null;
let mainClient: any = null;

const proxy = createParticipantProxy({
  selfId: SELF_ID,
  controlChannel: mainChannel,
  onConnection: (conn) => {
    console.log(
      `[${SELF_ID}-worker] connection: ${conn.connectionId}, peer=${conn.peerId}, role=${conn.role}`
    );
    const ch = proxy.getChannelFor(conn.peerId);
    if (ch && conn.peerId === PAGE_ID) {
      serviceHost.registerService('pagelet-api', {
        channel: ch,
        serviceHost,
        handlers: {
          info(): string {
            return `${SELF_ID} ready (pid=${process.pid})`;
          },
          async callSharedEcho(msg: string): Promise<string> {
            return sharedClient?.echo(msg) ?? 'shared not ready';
          },
          async callSharedGetConfig(key: string): Promise<string> {
            return sharedClient?.getConfig(key) ?? 'shared not ready';
          },
          async callSharedSetConfig(
            key: string,
            value: string
          ): Promise<string> {
            return sharedClient?.setConfig(key, value) ?? 'shared not ready';
          },
          async callDaemonEcho(msg: string): Promise<string> {
            return daemonClient?.echo(msg) ?? 'daemon not ready';
          },
          async callDaemonSystemStatus(): Promise<string> {
            return daemonClient?.systemStatus() ?? 'daemon not ready';
          },
          async callMainPing(msg: string): Promise<string> {
            return mainClient?.mainPing(msg) ?? 'main not ready';
          },
        },
      });
      console.log(
        `[${SELF_ID}-worker] pagelet-api registered on ${conn.peerId} channel`
      );
    }
  },
});

async function boot() {
  mainClient = clientHost
    .registerClient('main-rpc', { channel: mainChannel })
    .createProxy();

  const sharedConn = await proxy.connect('shared');
  const daemonConn = await proxy.connect('daemon');

  sharedClient = clientHost
    .registerClient('shared-rpc', { channel: sharedConn.getChannel() })
    .createProxy<{
      echo(msg: string): Promise<string>;
      getConfig(key: string): Promise<string>;
      setConfig(key: string, value: string): Promise<string>;
    }>();

  daemonClient = clientHost
    .registerClient('daemon-rpc', { channel: daemonConn.getChannel() })
    .createProxy<{
      echo(msg: string): Promise<string>;
      systemStatus(): Promise<string>;
    }>();

  console.log(
    `[${SELF_ID}-worker] connected to shared & daemon, waiting for ${PAGE_ID} to connect`
  );
}

boot().catch((err) => {
  console.error(`[${SELF_ID}-worker] boot failed:`, err);
});
