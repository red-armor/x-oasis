import {
  BaseConnectionOrchestrator,
  ConnectionOrchestratorConfig,
  PortPair,
  ActivationConfig,
  ParticipantInfo,
  ORCHESTRATOR_SERVICE_PATH,
  RPCService,
  AbstractChannelProtocol,
} from '@x-oasis/async-call-rpc';

/**
 * Node.js-specific Connection Orchestrator.
 *
 * Uses `worker_threads.MessageChannel` to create an entangled `MessagePort`
 * pair, then delivers each port to the target participant by calling the
 * `activateConnection` handler over the participant's existing RPC channel.
 *
 * ## Topology
 *
 * ```
 * Main thread (orchestrator)
 *   ├── registerParticipant('worker-a', nodePortChannelA, 'worker')
 *   ├── registerParticipant('worker-b', nodePortChannelB, 'worker')
 *   └── connect('worker-a', 'worker-b')
 *         → new MessageChannel()          (worker_threads)
 *         → transfer port1 → worker-a
 *         → transfer port2 → worker-b
 *         → worker-a ↔ worker-b communicate directly
 * ```
 *
 * ## Usage
 *
 * ```ts
 * import { Worker } from 'worker_threads';
 * import { NodeConnectionOrchestrator, NodeMessagePortChannel } from '@x-oasis/async-call-rpc-node';
 *
 * const orchestrator = new NodeConnectionOrchestrator();
 *
 * const channelA = new NodeMessagePortChannel({ description: 'main→workerA' });
 * const channelB = new NodeMessagePortChannel({ description: 'main→workerB' });
 *
 * orchestrator.registerParticipant('workerA', channelA, 'worker');
 * orchestrator.registerParticipant('workerB', channelB, 'worker');
 *
 * const info = await orchestrator.connect('workerA', 'workerB');
 * console.log(info.state); // 'READY'
 * ```
 */
export class NodeConnectionOrchestrator extends BaseConnectionOrchestrator {
  constructor(config: ConnectionOrchestratorConfig = {}) {
    super(config);
  }

  /**
   * Create an entangled `MessagePort` pair using Node.js `worker_threads`.
   */
  protected createPortPair(): PortPair {
    // Use dynamic require so this can be imported without errors in
    // environments where worker_threads isn't available (e.g., old Node).
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { MessageChannel } =
      require('worker_threads') as typeof import('worker_threads');
    const { port1, port2 } = new MessageChannel();
    return { port1, port2 };
  }

  /**
   * Deliver a port to a participant by invoking its `activateConnection` RPC
   * handler over the participant's existing control-plane channel.
   *
   * The port travels as a `Transferable` via the framework's standard
   * `TransferableArgsRequest` path.  The service path is the internal
   * `ORCHESTRATOR_SERVICE_PATH` constant — never exposed to user code.
   * Participants register their handler via `registerOrchestratorHandler`.
   */
  protected async activateParticipant(
    info: ParticipantInfo,
    config: ActivationConfig
  ): Promise<void> {
    const { port, connectionId, role } = config;

    const metaDeferred = info.channel.makeRequest(
      ORCHESTRATOR_SERVICE_PATH,
      'activateConnectionContext',
      { connectionId, role }
    );

    if (metaDeferred && typeof (metaDeferred as any).promise === 'object') {
      await (metaDeferred as any).promise;
    }

    const portDeferred = info.channel.makeRequest(
      ORCHESTRATOR_SERVICE_PATH,
      'activateConnection',
      port
    );

    if (portDeferred && typeof (portDeferred as any).promise === 'object') {
      await (portDeferred as any).promise;
    }
  }
}

export function registerOrchestratorHandler(
  channel: AbstractChannelProtocol,
  onPort:
    | ((port: any) => void)
    | ((ctx: import('@x-oasis/async-call-rpc').ActivationContext) => void)
): void {
  let lastContext: {
    connectionId: string;
    role: 'initiator' | 'receiver';
  } | null = null;

  const service = new RPCService(ORCHESTRATOR_SERVICE_PATH, {
    handlers: {
      activateConnection: (port: any) => {
        if (lastContext) {
          (onPort as (ctx: any) => void)({
            port,
            connectionId: lastContext.connectionId,
            role: lastContext.role,
          });
          lastContext = null;
        } else {
          (onPort as (port: any) => void)(port);
        }
      },
      activateConnectionContext: (ctx: {
        connectionId: string;
        role: 'initiator' | 'receiver';
      }) => {
        lastContext = ctx;
      },
    },
  });
  service.setChannel(channel);
}
