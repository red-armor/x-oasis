import {
  BaseConnectionOrchestrator,
  ConnectionOrchestratorConfig,
  PortPair,
  ActivationConfig,
  ParticipantInfo,
  ORCHESTRATOR_SERVICE_PATH,
  HeartbeatConfig,
} from '@x-oasis/async-call-rpc';

/**
 * Factory type for creating a `MessageChannelMain` port pair.
 * Can be overridden in tests or subclasses.
 */
export type MessageChannelMainFactory = () => PortPair;

/**
 * Electron-specific Connection Orchestrator.
 *
 * Uses `MessageChannelMain` to create an entangled port pair in the main
 * process, then delivers each port to the target participant over its
 * existing RPC channel via a `activateConnection` call.
 *
 * ## Topology
 *
 * ```
 * Main process (orchestrator)
 *   ├── registerParticipant('renderer-a', ipcMainChannel)
 *   ├── registerParticipant('utility',    utilityChannel)
 *   └── connect('renderer-a', 'utility')
 *         → new MessageChannelMain()
 *         → send port1 → renderer-a  (via postMessage transfer)
 *         → send port2 → utility     (via postMessage transfer)
 *         → renderer-a ↔ utility communicate directly via MessagePort
 * ```
 *
 * ## Usage
 *
 * ```ts
 * import { ElectronConnectionOrchestrator } from '@x-oasis/async-call-rpc-electron';
 *
 * const orchestrator = new ElectronConnectionOrchestrator();
 *
 * orchestrator.registerParticipant('renderer', ipcMainChannel, 'renderer');
 * orchestrator.registerParticipant('utility',  utilityChannel,  'utility');
 *
 * const info = await orchestrator.connect('renderer', 'utility');
 * console.log(info.state); // 'READY'
 * ```
 *
 * @remarks
 * - Must be instantiated **only in the main process** (where
 *   `MessageChannelMain` is available).
 * - Each participant must have a pre-established RPC channel that has been
 *   set up with `registerOrchestratorHandler` to receive the port.
 * - An optional `portFactory` can be supplied to override port creation,
 *   which is useful for testing without a real Electron runtime.
 *
 * @see https://www.electronjs.org/docs/latest/api/message-channel-main
 */
export class ElectronConnectionOrchestrator extends BaseConnectionOrchestrator {
  private readonly _portFactory: MessageChannelMainFactory;

  constructor(
    config: ConnectionOrchestratorConfig = {},
    portFactory?: MessageChannelMainFactory
  ) {
    super(config);
    this._portFactory =
      portFactory ?? ElectronConnectionOrchestrator._defaultFactory;
  }

  /** Default factory: uses Electron's `MessageChannelMain` at runtime. */
  private static _defaultFactory(): PortPair {
    // Use dynamic require so this file can be imported without compile errors
    // in environments where Electron isn't installed (e.g. unit test VMs).
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { MessageChannelMain } = require('electron');
    return new MessageChannelMain();
  }

  /**
   * Create an entangled `MessagePortMain` pair.
   * Delegates to the factory supplied at construction, or `MessageChannelMain`.
   */
  protected createPortPair(): PortPair {
    return this._portFactory();
  }

  /**
   * Deliver a port to a participant by invoking its `activateConnection` RPC
   * handler over the participant's existing control-plane channel.
   *
   * The port travels as a `Transferable` via the framework's standard
   * `TransferableArgsRequest` path.  The service path is the internal
   * `ORCHESTRATOR_SERVICE_PATH` constant — never exposed to user code.
   * Participants register their handler via `registerOrchestratorHandler`.
   *
   * Awaiting the returned `Deferred` ensures the orchestrator only transitions
   * to `READY` after the participant has acknowledged the port.
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

  /**
   * Concrete heartbeat: send a ping via the control plane and schedule a
   * timeout check. If the participant's channel does not deliver a pong
   * within `hbConfig.timeoutMs`, the connection is treated as lost.
   */
  protected _sendHeartbeat(mc: any, hbConfig: HeartbeatConfig): void {
    if (mc.state !== 'READY') {
      this._stopHeartbeat(mc);
      return;
    }

    const fromInfo = this.participants.get(mc.fromId);
    const toInfo = this.participants.get(mc.toId);
    if (!fromInfo || !toInfo) {
      this._stopHeartbeat(mc);
      return;
    }

    const participants = [fromInfo, toInfo];
    let pendingCount = participants.length;
    let failed = false;

    const timeoutTimer = setTimeout(() => {
      if (!failed && pendingCount > 0) {
        failed = true;
        this._handleHeartbeatTimeout(mc);
      }
    }, hbConfig.timeoutMs);

    for (const info of participants) {
      try {
        const deferred = info.channel.makeRequest(
          ORCHESTRATOR_SERVICE_PATH,
          'ping'
        );

        if (deferred && typeof (deferred as any).promise === 'object') {
          (deferred as any).promise.then(
            () => {
              pendingCount--;
              if (pendingCount === 0 && !failed) {
                clearTimeout(timeoutTimer);
              }
            },
            () => {
              if (!failed) {
                failed = true;
                clearTimeout(timeoutTimer);
                this._handleHeartbeatTimeout(mc);
              }
            }
          );
        } else {
          pendingCount--;
          if (pendingCount === 0 && !failed) {
            clearTimeout(timeoutTimer);
          }
        }
      } catch {
        if (!failed) {
          failed = true;
          clearTimeout(timeoutTimer);
          this._handleHeartbeatTimeout(mc);
        }
      }
    }
  }
}
