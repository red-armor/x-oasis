// Renderer (browser) entry point.
//
// This sub-path contains only code that runs in the renderer process,
// with NO dependency on `electron` runtime APIs. It communicates with
// the preload script via `globalThis.__rpc_bridge__` injected by
// `createPageBridge()` (from the `electron-browser` sub-path).
//
// Companion sub-paths:
// - `electron-browser` → preload-side channels (uses `ipcRenderer`,
//                        `contextBridge`)
// - `electron-main`    → main + utility process channels (uses `ipcMain`,
//                        `MessageChannelMain`, `utilityProcess`, etc.)
// - root barrel        → re-exports all for back-compat
export { default as ContextBridgeChannel } from './ContextBridgeChannel';
export {
  createPageChannel,
  createIpcPageChannel,
  IPC_BRIDGE_KEY,
} from './createPageChannel';

export type {
  ContextBridgeChannelProps,
  ContextBridgeAPI,
  ContextBridgeIPCAPI,
} from '../types';
