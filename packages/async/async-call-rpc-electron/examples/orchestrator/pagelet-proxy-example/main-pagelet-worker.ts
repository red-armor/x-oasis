import {
  ElectronUtilityProcessChannel,
  ElectronMessagePortMainChannel,
  registerOrchestratorHandler,
} from '../../../src/index.js';
import { clientHost, serviceHost } from '@x-oasis/async-call-rpc';

if (!process.parentPort) {
  throw new Error('parentPort is not available');
}

const mainChannel = new ElectronUtilityProcessChannel({
  parentPort: process.parentPort as any,
  description: 'main-pagelet→main IPC channel',
});

const rendererDirectChannel = new ElectronMessagePortMainChannel({
  description: 'main-pagelet↔renderer direct port',
});

const sharedDirectChannel = new ElectronMessagePortMainChannel({
  description: 'main-pagelet↔shared direct port',
});

const daemonDirectChannel = new ElectronMessagePortMainChannel({
  description: 'main-pagelet↔daemon direct port',
});

let activationRound = 0;
const directChannelOrder: Array<{
  channel: ElectronMessagePortMainChannel;
  name: string;
}> = [
  { channel: rendererDirectChannel, name: 'renderer' },
  { channel: sharedDirectChannel, name: 'shared' },
  { channel: daemonDirectChannel, name: 'daemon' },
];

registerOrchestratorHandler(mainChannel, (port: any) => {
  const target = directChannelOrder.find(
    (entry) => !entry.channel.isConnected()
  );
  if (target) {
    target.channel.bindPort(port, { rebind: true });
  } else {
    rendererDirectChannel.bindPort(port, { rebind: true });
  }
  activationRound++;
});

const mainClient = clientHost
  .registerClient('main-rpc', { channel: mainChannel })
  .createProxy();

const sharedClient = clientHost
  .registerClient('shared-rpc', { channel: sharedDirectChannel })
  .createProxy<{
    echo(msg: string): Promise<string>;
    getConfig(key: string): Promise<string>;
  }>();

const daemonClient = clientHost
  .registerClient('daemon-rpc', { channel: daemonDirectChannel })
  .createProxy<{
    echo(msg: string): Promise<string>;
    systemStatus(): Promise<string>;
  }>();

serviceHost.registerService('pagelet-api', {
  channel: rendererDirectChannel,
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
