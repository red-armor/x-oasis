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
    const { port } = config;

    const deferred = info.channel.makeRequest(
      ORCHESTRATOR_SERVICE_PATH,
      'activateConnection',
      port
    );

    if (deferred && typeof (deferred as any).promise === 'object') {
      await (deferred as any).promise;
    }
  }
}

/**
 * Register a handler on `channel` that receives the direct `MessagePort`
 * delivered by the orchestrator when `connect()` is called.
 *
 * This is the **only** thing participants need to do to integrate with the
 * orchestrator — no magic strings, no raw message listeners.
 *
 * ```ts
 * // worker.ts
 * registerOrchestratorHandler(mainChannel, (port) => {
 *   directChannel.bindPort(port);
 * });
 * ```
 *
 * @param channel  The control-plane channel already connected to the orchestrator.
 * @param onPort   Called with the transferred `MessagePort` once the
 *                 orchestrator activates this participant.
 */
export function registerOrchestratorHandler(
  channel: AbstractChannelProtocol,
  onPort: (port: any) => void
): void {
  const service = new RPCService(ORCHESTRATOR_SERVICE_PATH, {
    handlers: {
      activateConnection: onPort,
    },
  });
  service.setChannel(channel);
}
