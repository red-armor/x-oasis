// Preload-side entry point.
//
// Importing this sub-path (or any file under it) MUST NOT pull any value-level
// `electron` import into the bundle. Only `IpcRenderer`-style *types* are
// referenced from the `electron` module declaration, which TypeScript erases
// at compile time. This makes the sub-path safe to bundle into a renderer or
// Web worker without aliasing or stubbing the `electron` package.
//
// Companion sub-paths:
// - `browser`         → renderer (browser) channels (no Electron API dependency)
// - `electron-main`   → main + utility process channels (uses `electron`
//                       runtime APIs: `ipcMain`, `MessageChannelMain`,
//                       `utilityProcess`, etc.)
// - root barrel       → re-exports both for back-compat with consumers that
//                       don't care about renderer bundle size.
export { default as IPCRendererChannel } from './IPCRendererChannel';
export { registerOrchestratorHandler } from './registerOrchestratorHandler';
export { createPageBridge } from './createPageBridge';

// Re-export the shared types so preload code never has to dip into the root
// to grab `IPCRendererChannelProps` etc.
export type {
  IPCRendererChannelProps,
  IpcRenderer,
  IpcRendererEvent,
  ContextBridgeChannelProps,
  ContextBridgeAPI,
} from '../types';

export type { CreatePageBridgeOptions } from './createPageBridge';
