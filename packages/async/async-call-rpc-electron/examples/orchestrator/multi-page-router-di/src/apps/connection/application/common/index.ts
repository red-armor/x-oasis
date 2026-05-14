export const CONNECTION_PAGELET_SERVICE_PATH = 'pagelet-api';

export interface IConnectionPageletService {
  info(): Promise<string>;
  callSharedEcho(msg: string): Promise<string>;
  callSharedGetConfig(key: string): Promise<string>;
  callSharedSetConfig(key: string, value: string): Promise<string>;
  callDaemonEcho(msg: string): Promise<string>;
  callDaemonSystemStatus(): Promise<string>;
  callMainPing(msg: string): Promise<string>;
  /**
   * Trigger a P↔P direct RPC: connection pagelet asks setting pagelet
   * for its `peerInfo`. Internally:
   *  - First call: ParticipantOrchestratorProxy.connect('setting') →
   *    main hub entangles a MessageChannelMain pair → onPeerConnection
   *    binds a service host on each side → proxy is cached.
   *  - Subsequent calls reuse the cached direct channel; main is NOT
   *    on the RPC path.
   * Result: a string from setting describing who called and setting's pid.
   */
  callSettingPeerInfo(): Promise<string>;
}
