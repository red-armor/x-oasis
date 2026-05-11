import { parentPort, MessagePort } from 'worker_threads';
import {
  NodeMessagePortChannel,
  registerOrchestratorHandler,
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
    description: 'client→host control channel',
  });

  const peerChannels = new Map();
  const selfId = 'client';

  registerOrchestratorHandler(mainChannel, (ctx) => {
    const { port, connectionId, role } = ctx;
    const parts = connectionId.split('--');
    const peerId = parts[0] === selfId ? parts[1] : parts[0];

    let channel = peerChannels.get(peerId);
    if (!channel) {
      channel = new NodeMessagePortChannel({
        description: `client↔${peerId} direct port`,
      });
      peerChannels.set(peerId, channel);
    }
    channel.bindPort(port);
    console.log(
      `[client] Bound port for peer "${peerId}" (connectionId=${connectionId}, role=${role})`
    );
  });

  const orchestratorClient = clientHost
    .registerClient('orchestrator-api', { channel: mainChannel })
    .createProxy();

  serviceHost.registerService('client-direct', {
    channel: mainChannel,
    serviceHost,
    handlers: {
      greet(msg) {
        return `greeting from client: ${msg}`;
      },
    },
  });

  async function run() {
    console.log('[client] Waiting for system to initialize...');
    await new Promise((r) => setTimeout(r, 1500));

    console.log(
      '[client] Requesting orchestrator to connect pagelet→client...'
    );
    const connResult = await orchestratorClient.connect('pagelet', 'client');
    console.log(
      '[client] Connect result:',
      JSON.stringify(connResult, null, 2)
    );

    await new Promise((r) => setTimeout(r, 1000));

    const pageletChannel = peerChannels.get('pagelet');
    if (!pageletChannel) {
      console.error(
        '[client] No direct channel to pagelet. Falling back to IPC...'
      );
      process.exit(1);
    }

    const pageletClient = clientHost
      .registerClient('pagelet-api', { channel: pageletChannel })
      .createProxy();

    console.log('\n[client] === RPC Calls via pagelet proxy ===\n');

    try {
      const info = await pageletClient.info();
      console.log(`[client] pagelet.info()                    = "${info}"`);

      const sharedEcho =
        await pageletClient.callSharedEcho('hello from client');
      console.log(
        `[client] pagelet.callSharedEcho(...)       = "${sharedEcho}"`
      );

      const config = await pageletClient.callSharedGetConfig('theme');
      console.log(`[client] pagelet.callSharedGetConfig(...)  = "${config}"`);

      const daemonEcho = await pageletClient.callDaemonEcho('ping daemon');
      console.log(
        `[client] pagelet.callDaemonEcho(...)       = "${daemonEcho}"`
      );

      const status = await pageletClient.callDaemonSystemStatus();
      console.log(`[client] pagelet.callDaemonSystemStatus()  = "${status}"`);

      const hostPong = await pageletClient.callHostPing('hello host');
      console.log(`[client] pagelet.callHostPing(...)         = "${hostPong}"`);

      console.log('\n[client] === All RPC calls completed ===');
    } catch (err) {
      console.error('[client] RPC error:', err.message);
    }

    console.log('[client] Done. Exiting in 1s...');
    await new Promise((r) => setTimeout(r, 1000));
    process.exit(0);
  }

  run().catch((err) => {
    console.error('[client] Fatal:', err);
    process.exit(1);
  });
}
