import {
  ORCHESTRATOR_SERVICE_PATH,
  RPCService,
  AbstractChannelProtocol,
} from '@x-oasis/async-call-rpc/core';
import {
  BaseConnectionOrchestrator,
  ConnectionOrchestratorConfig,
  PortPair,
  ActivationConfig,
  ParticipantInfo,
} from '@x-oasis/async-call-rpc/orchestrator';

/**
 * Web-platform Connection Orchestrator.
 *
 * Uses the browser's `MessageChannel` API to create an entangled `MessagePort`
 * pair, then delivers each port to the target participant by sending an
 * activation message over the participant's existing RPC channel.
 *
 * ## Topology
 *
 * ```
 * Main page / service-worker (orchestrator)
 *   ├── registerParticipant('worker-a', rpcChannelA, 'worker')
 *   ├── registerParticipant('iframe-b', rpcChannelB, 'renderer')
 *   └── connect('worker-a', 'iframe-b')
 *         → new MessageChannel()    (Web API)
 *         → transfer port1 → worker-a
 *         → transfer port2 → iframe-b
 *         → worker-a ↔ iframe-b communicate directly via MessagePort
 * ```
 *
 * ## Usage
 *
 * ```ts
 * import { RPCMessageChannel, WebConnectionOrchestrator } from '@x-oasis/async-call-rpc-web';
 *
 * const orchestrator = new WebConnectionOrchestrator();
 *
 * const channelA = new RPCMessageChannel({ port: workerPortA });
 * const channelB = new RPCMessageChannel({ port: iframePortB });
 *
 * orchestrator.registerParticipant('workerA', channelA, 'worker');
 * orchestrator.registerParticipant('iframeB', channelB, 'renderer');
 *
 * const info = await orchestrator.connect('workerA', 'iframeB');
 * console.log(info.state); // 'READY'
 * ```
 *
 * @remarks
 * Works in any environment that provides the `MessageChannel` global
 * (browsers, Service Workers, Deno). For Node.js worker threads, use
 * `NodeConnectionOrchestrator` from `@x-oasis/async-call-rpc-node` instead.
 *
 * @see https://developer.mozilla.org/en-US/docs/Web/API/MessageChannel
 */
export class WebConnectionOrchestrator extends BaseConnectionOrchestrator {
  constructor(config: ConnectionOrchestratorConfig = {}) {
    super(config);
  }

  /**
   * Create an entangled `MessagePort` pair using the browser's
   * `MessageChannel` API.
   */
  protected createPortPair(): PortPair {
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
