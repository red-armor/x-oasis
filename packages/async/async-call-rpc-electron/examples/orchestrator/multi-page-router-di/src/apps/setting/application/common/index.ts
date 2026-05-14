export const SETTING_PARTICIPANT_ID = 'setting';

export const SETTING_PAGELET_SERVICE_PATH = 'setting-pagelet-api';

export interface ISettingPageletService {
  info(): Promise<string>;
  callSharedEcho(msg: string): Promise<string>;
  callSharedGetConfig(key: string): Promise<string>;
  callSharedSetConfig(key: string, value: string): Promise<string>;
  callDaemonEcho(msg: string): Promise<string>;
  callDaemonSystemStatus(): Promise<string>;
  callMainPing(msg: string): Promise<string>;
}

// ─── P↔P peer surface ────────────────────────────────────────────────────────
//
// Exposed by setting pagelet over its direct channel to other pagelets
// (e.g. connection pagelet). Distinct from `ISettingPageletService` which
// is bound to the renderer-facing channel.
//
// Demonstrates D-006 Gap 1 / A-008 §4.1 hub topology: any pagelet that
// has a `ParticipantOrchestratorProxy` can `proxy.connect(SETTING_PARTICIPANT_ID)`
// and reach this surface — main is never on the data path once the
// MessagePort pair is allocated.
export const SETTING_PAGELET_PEER_SERVICE_PATH = 'setting-pagelet-peer-api';

export interface ISettingPageletPeerService {
  /**
   * Returns a string that identifies the setting pagelet and the caller.
   * The caller-supplied `fromId` is echoed back so the response proves the
   * call actually crossed the P↔P direct channel.
   */
  peerInfo(fromId: string): Promise<string>;
}
