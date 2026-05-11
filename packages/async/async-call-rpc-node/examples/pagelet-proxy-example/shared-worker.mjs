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
    description: 'shared→host control channel',
  });

  const participant = createWorkerParticipant({
    mainChannel,
    directChannelDescription: 'shared↔pagelet direct port',
  });

  let configVersion = 0;

  const sharedHandlers = {
    getConfig(key) {
      configVersion++;
      return `config[${key}] = value-v${configVersion}`;
    },
    echo(msg) {
      return `shared echo: ${msg}`;
    },
  };

  participant.registerControlService('shared-rpc', sharedHandlers);
  participant.registerService('shared-rpc', sharedHandlers);

  console.log('[shared-worker] Initialized');
}
