import {
  WorkerChannel,
  RPCMessageChannel,
  registerOrchestratorHandler,
} from '@x-oasis/async-call-rpc-web';
import { serviceHost, ActivationContext } from '@x-oasis/async-call-rpc';

const controlChannel = new WorkerChannel(self, {
  name: 'shared-control',
});

let configVersion = 0;

const sharedHandlers = {
  getConfig(key: string): string {
    configVersion++;
    return `config[${key}] = value-v${configVersion}`;
  },
  getSharedState(): { configVersion: number } {
    return { configVersion };
  },
  echo(msg: string): string {
    return `shared echo: ${msg}`;
  },
};

serviceHost.registerServiceHandler('shared-rpc', sharedHandlers);

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
      description: `shared↔${peerId} direct`,
    });
    directChannels.set(peerId, channel);
  }
  channel.bindPort(port, { rebind: true });

  serviceHost.registerService('shared-rpc', {
    channel,
    serviceHost,
    handlers: sharedHandlers,
  });
});

console.log('[shared-worker] initialized');
