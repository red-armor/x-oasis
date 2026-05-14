// Main + utility process entry point.
//
// All modules under this sub-path use Electron runtime APIs (`ipcMain`,
// `MessageChannelMain`, `MessagePortMain`, `utilityProcess`, `parentPort`)
// and therefore must NOT be imported by renderer-process bundles. Renderers
// should use the `electron-browser` sub-path instead, which keeps Electron
// runtime imports out of the renderer bundle.
//
// Companion sub-path:
// - `electron-browser` → `IPCRendererChannel` + `registerOrchestratorHandler`,
//                        the only two pieces a renderer/utility *participant*
//                        needs.
export { default as IPCMainChannel } from './IPCMainChannel';
export { default as ElectronMessagePortMainChannel } from './ElectronMessagePortMainChannel';
export { default as ElectronUtilityProcessChannel } from './ElectronUtilityProcessChannel';
export { ElectronConnectionOrchestrator } from './ElectronConnectionOrchestrator';
export type { MessageChannelMainFactory } from './ElectronConnectionOrchestrator';
export {
  ParticipantOrchestratorProxy,
  createParticipantProxy,
} from './ParticipantOrchestratorProxy';
export type {
  ParticipantConnection,
  ParticipantOrchestratorProxyOptions,
} from './ParticipantOrchestratorProxy';
export {
  UtilityOrchestratorParticipant,
  createUtilityParticipant,
} from './UtilityOrchestratorParticipant';
export type { UtilityParticipantOptions } from './UtilityOrchestratorParticipant';
export { setupMainOrchestrator } from './MainOrchestratorSetup';
export type {
  MainOrchestratorSetupOptions,
  MainOrchestratorSetupResult,
} from './MainOrchestratorSetup';
export { UtilityProcessSupervisor } from './UtilityProcessSupervisor';
export type {
  UtilityProcessSupervisorOptions,
  SupervisorState,
  ForkFn,
  ForkOptions,
} from './UtilityProcessSupervisor';

// Utility processes (node runtime) participating in the orchestrator topology
// also need `registerOrchestratorHandler` to receive `MessagePortMain`s on
// their cp channel. The helper itself contains no electron runtime imports
// (only RPC plumbing), so re-exporting it from the main sub-path lets utility
// code use a single sub-path for *all* its connection-orchestrator needs
// without dipping into `electron-browser` (which is semantically renderer-only).
export { registerOrchestratorHandler } from '../electron-browser/registerOrchestratorHandler';

// Re-export the shared types so main-side code never has to dip into the root.
export type {
  MainPort,
  ParentPort,
  IPCMainChannelProps,
  MessagePortMainChannelProps,
  UtilityProcessChannelProps,
  UtilityProcessParentPortChannelProps,
  IpcMain,
  IpcMainEvent,
  UtilityProcess,
  WebContents,
} from '../types';
