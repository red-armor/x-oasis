import {
  WorkerChannel,
  RPCMessageChannel,
  registerOrchestratorHandler,
} from '@x-oasis/async-call-rpc-web';
import { serviceHost, ActivationContext } from '@x-oasis/async-call-rpc';

const controlChannel = new WorkerChannel(self, {
  name: 'daemon-control',
});

let monitorCount = 0;

const daemonHandlers = {
  systemStatus(): string {
    monitorCount++;
    return `system OK (#${monitorCount}), uptime=${Math.floor(
      performance.now() / 1000
    )}s`;
  },
  echo(msg: string): string {
    return `daemon echo: ${msg}`;
  },
};

serviceHost.registerServiceHandler('daemon-rpc', daemonHandlers);

const directChannels = new Map<string, RPCMessageChannel>();

registerOrchestratorHandler(controlChannel, (ctx: ActivationContext) => {
  const { port, connectionId, role } = ctx;
  const idx = connectionId.indexOf('--');
  const from = connectionId.substring(0, idx);
  const to = connectionId.substring(idx + 2);
  const peerId = role === 'initiator' ? to : from;

  let channel = directChannels.get(peerId);
  if (!channel) {
    channel = new RPCMessageChannel({
      description: `daemon↔${peerId} direct`,
    });
    directChannels.set(peerId, channel);
  }
  channel.bindPort(port, { rebind: true });

  serviceHost.registerService('daemon-rpc', {
    channel,
    serviceHost,
    handlers: daemonHandlers,
  });
});

console.log('[daemon-worker] initialized');
