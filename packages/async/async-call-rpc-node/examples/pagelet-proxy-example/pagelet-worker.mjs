import { parentPort, MessagePort } from 'worker_threads';
import {
  NodeMessagePortChannel,
  createParticipantProxy,
} from '@x-oasis/async-call-rpc-node';
import { clientHost, serviceHost } from '@x-oasis/async-call-rpc';

parentPort?.on('message', (msg) => {
  if (msg.type === 'rpc-init' && msg.port) {
    setup(msg.port);
  }
});

function setup(controlPort) {
  const mainChannel = new NodeMessagePortChannel({
    port: controlPort,
    description: 'pagelet→host control channel',
  });

  const proxy = createParticipantProxy({
    selfId: 'pagelet',
    controlChannel: mainChannel,
  });

  async function boot() {
    const clientConn = await proxy.connect('client');
    const sharedConn = await proxy.connect('shared');
    const daemonConn = await proxy.connect('daemon');

    console.log(
      `[pagelet-worker] connected: client=${clientConn.connectionId}, shared=${sharedConn.connectionId}, daemon=${daemonConn.connectionId}`
    );

    const clientChannel = clientConn.getChannel();
    const sharedChannel = sharedConn.getChannel();
    const daemonChannel = daemonConn.getChannel();

    const hostClient = clientHost
      .registerClient('host-rpc', { channel: mainChannel })
      .createProxy();

    const sharedClient = clientHost
      .registerClient('shared-rpc', { channel: sharedChannel })
      .createProxy();

    const daemonClient = clientHost
      .registerClient('daemon-rpc', { channel: daemonChannel })
      .createProxy();

    serviceHost.registerService('pagelet-api', {
      channel: clientChannel,
      serviceHost,
      handlers: {
        info() {
          return `pagelet ready (pid=${process.pid})`;
        },
        async callSharedEcho(msg) {
          return sharedClient.echo(msg);
        },
        async callSharedGetConfig(key) {
          return sharedClient.getConfig(key);
        },
        async callDaemonEcho(msg) {
          return daemonClient.echo(msg);
        },
        async callDaemonSystemStatus() {
          return daemonClient.systemStatus();
        },
        async callHostPing(msg) {
          return hostClient.hostPing(msg);
        },
      },
    });

    console.log('[pagelet-worker] Initialized');
  }

  boot().catch((err) => {
    console.error('[pagelet-worker] Boot failed:', err);
  });
}
