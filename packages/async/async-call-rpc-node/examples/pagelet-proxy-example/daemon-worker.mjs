import { parentPort, MessagePort } from 'worker_threads';
import {
  NodeMessagePortChannel,
  createWorkerParticipant,
} from '@x-oasis/async-call-rpc-node';

parentPort?.on('message', (msg) => {
  if (msg.type === 'rpc-init' && msg.port) {
    setup(msg.port);
  }
});

function setup(controlPort) {
  const mainChannel = new NodeMessagePortChannel({
    port: controlPort,
    description: 'daemon→host control channel',
  });

  const participant = createWorkerParticipant({
    mainChannel,
    directChannelDescription: 'daemon↔pagelet direct port',
  });

  let monitorCount = 0;

  const daemonHandlers = {
    systemStatus() {
      monitorCount++;
      return `system OK (#${monitorCount}), uptime=${Math.floor(process.uptime())}s`;
    },
    echo(msg) {
      return `daemon echo: ${msg}`;
    },
  };

  participant.registerControlService('daemon-rpc', daemonHandlers);
  participant.registerService('daemon-rpc', daemonHandlers);

  console.log('[daemon-worker] Initialized');
}
