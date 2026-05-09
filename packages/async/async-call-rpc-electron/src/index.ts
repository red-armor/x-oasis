// Root barrel — re-exports everything from all sub-paths for back-compat.
//
// PREFER the sub-path entries when bundle size matters:
// - `@x-oasis/async-call-rpc-electron/browser`          for renderer code
// - `@x-oasis/async-call-rpc-electron/electron-browser` for preload code
// - `@x-oasis/async-call-rpc-electron/electron-main`    for main + utility code
//
// Importing this root barrel from a renderer bundle will pull in the entire
// dependency graph including `ipcMain`, `MessageChannelMain`, `utilityProcess`,
// etc. — bundlers may then try to resolve `electron` (a CommonJS Node module)
// in a browser/ESM environment and fail at runtime. Use the sub-paths to
// guarantee tree-shake-friendly boundaries.
export * from './browser';
export * from './electron-browser';
export * from './electron-main';
