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
  description: 'setting-pagelet→main IPC channel',
});

let sharedClient: any;
let daemonClient: any;
let mainClient: any;
let settingApiRegistered = false;

function registerSettingApi(rendererChannel: any) {
  if (settingApiRegistered) return;
  settingApiRegistered = true;

  serviceHost.registerService('setting-api', {
    channel: rendererChannel,
    serviceHost,
    handlers: {
      info(): string {
        return `setting-pagelet ready (pid=${process.pid})`;
      },
      async getTheme(): Promise<string> {
        return sharedClient.getTheme();
      },
      async setTheme(theme: string): Promise<string> {
        await sharedClient.setTheme(theme);
        return mainClient.changeMainWindowTheme(theme);
      },
      async getSharedConfig(key: string): Promise<string> {
        return sharedClient.getConfig(key);
      },
      async getSharedState(): Promise<any> {
        return sharedClient.getSharedState();
      },
      async getSystemStatus(): Promise<string> {
        return daemonClient.systemStatus();
      },
      async getDaemonInfo(): Promise<any> {
        return daemonClient.getDaemonInfo();
      },
      async echoShared(msg: string): Promise<string> {
        return sharedClient.echo(msg);
      },
      async echoDaemon(msg: string): Promise<string> {
        return daemonClient.echo(msg);
      },
      async changeMainWindowTheme(theme: string): Promise<string> {
        return mainClient.changeMainWindowTheme(theme);
      },
      async getCurrentTheme(): Promise<string> {
        return mainClient.getCurrentTheme();
      },
    },
  });

  console.log(
    '[setting-pagelet-worker] setting-api registered on renderer channel'
  );
}

const proxy = createParticipantProxy({
  selfId: 'setting-pagelet',
  controlChannel: mainChannel,
  onConnection: (conn) => {
    console.log(
      `[setting-pagelet-worker] incoming connection from ${conn.peerId} (${conn.connectionId})`
    );
    if (conn.peerId === 'setting-renderer') {
      registerSettingApi(conn.getChannel());
    }
  },
});

async function boot() {
  const sharedConn = await proxy.connect('shared');
  const daemonConn = await proxy.connect('daemon');

  console.log(
    `[setting-pagelet-worker] connected: shared=${sharedConn.connectionId}, daemon=${daemonConn.connectionId}`
  );

  mainClient = clientHost
    .registerClient('main-rpc', { channel: mainChannel })
    .createProxy();

  sharedClient = clientHost
    .registerClient('shared-rpc', { channel: sharedConn.getChannel() })
    .createProxy<{
      getTheme(): Promise<string>;
      setTheme(theme: string): Promise<string>;
      getConfig(key: string): Promise<string>;
      getSharedState(): Promise<any>;
      echo(msg: string): Promise<string>;
    }>();

  daemonClient = clientHost
    .registerClient('daemon-rpc', { channel: daemonConn.getChannel() })
    .createProxy<{
      systemStatus(): Promise<string>;
      getDaemonInfo(): Promise<any>;
      echo(msg: string): Promise<string>;
    }>();

  console.log(
    '[setting-pagelet-worker] initialized, waiting for renderer connection'
  );
}

boot().catch((err) => {
  console.error('[setting-pagelet-worker] boot failed:', err);
});
