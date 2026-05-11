import { Worker, MessageChannel } from 'worker_threads';
import { resolve } from 'path';
import {
  NodeMessagePortChannel,
  NodeConnectionOrchestrator,
} from '../../src/index';
import { serviceHost } from '@x-oasis/async-call-rpc';

const workers: Worker[] = [];

function spawnWorker(name: string): {
  worker: Worker;
  channel: NodeMessagePortChannel;
} {
  const workerPath = resolve(__dirname, `${name}.mjs`);

  const worker = new Worker(workerPath);
  workers.push(worker);

  const { port1, port2 } = new MessageChannel();
  worker.postMessage({ type: 'rpc-init', port: port2 }, [port2]);

  const channel = new NodeMessagePortChannel({
    port: port1,
    description: `host→${name}`,
  });

  return { worker, channel };
}

async function main() {
  console.log('[host] Starting pagelet-proxy example...\n');

  const { channel: sharedChannel } = spawnWorker('shared-worker');
  const { channel: daemonChannel } = spawnWorker('daemon-worker');
  const { channel: pageletChannel } = spawnWorker('pagelet-worker');
  const { worker: clientWorker, channel: clientChannel } =
    spawnWorker('client');

  let hostCallCount = 0;
  serviceHost.registerServiceHandler('host-rpc', {
    hostPing(msg: string): string {
      hostCallCount++;
      return `pong from host (#${hostCallCount}): ${msg}`;
    },
  });
  pageletChannel.setServiceHost(serviceHost);

  const orchestrator = new NodeConnectionOrchestrator({
    logger: (level: string, msg: string) =>
      console.log(`[orchestrator:${level}] ${msg}`),
    enableStats: true,
    heartbeat: {
      enabled: true,
      intervalMs: 10_000,
      timeoutMs: 5_000,
    },
  });

  orchestrator.registerParticipant('client', clientChannel, 'node');
  orchestrator.registerParticipant('pagelet', pageletChannel, 'worker');
  orchestrator.registerParticipant('shared', sharedChannel, 'worker');
  orchestrator.registerParticipant('daemon', daemonChannel, 'worker');

  orchestrator.registerProxyService(serviceHost);

  serviceHost.registerService('orchestrator-api', {
    channel: clientChannel,
    serviceHost,
    handlers: {
      async connect(fromId: string, toId: string): Promise<any> {
        try {
          const info = await orchestrator.connect(fromId, toId);
          return {
            connectionId: info.connectionId,
            fromId: info.fromId,
            toId: info.toId,
            state: info.state,
          };
        } catch (err: any) {
          return { error: err.message };
        }
      },
      async getStatus(fromId: string, toId: string): Promise<any> {
        const info = orchestrator.getConnectionInfo(fromId, toId);
        if (!info) return null;
        return {
          connectionId: info.connectionId,
          fromId: info.fromId,
          toId: info.toId,
          state: info.state,
          isReady: info.isReady,
        };
      },
    },
  });

  console.log('[host] Orchestrator ready. Pagelet will self-connect...\n');

  const cleanup = () => {
    console.log('\n[host] Cleaning up...');
    workers.forEach((w) => w.terminate());
    process.exit(0);
  };

  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);

  clientWorker.on('exit', () => {
    cleanup();
  });
}

main().catch((err) => {
  console.error('[host] Fatal:', err);
  process.exit(1);
});
