# @x-oasis/async-call-rpc-electron - Complete File Manifest

## Documentation Files Created For You

1. **ASYNC_CALL_RPC_ELECTRON_ANALYSIS.md** (794 lines)
   - Complete architectural documentation
   - All source code contents
   - Detailed analysis of each component
   - Build and distribution details
   - Patterns and best practices

2. **SOURCE_FILES_SUMMARY.txt**
   - Quick reference with absolute paths
   - One-line descriptions
   - Critical findings

3. **QUICK_REFERENCE.md**
   - Single-page cheat sheet
   - Key facts table
   - Where async-call-rpc-web is used
   - Usage examples
   - All 13 source files listed

4. **FILE_MANIFEST.md** (this file)
   - Complete absolute path listing
   - File purposes and sizes

## All Source Files - Absolute Paths

### Root Package Files

```
/Users/ryuyutyo/Documents/code/red/x-oasis/packages/async/async-call-rpc-electron/package.json
/Users/ryuyutyo/Documents/code/red/x-oasis/packages/async/async-call-rpc-electron/README.md
/Users/ryuyutyo/Documents/code/red/x-oasis/packages/async/async-call-rpc-electron/CHANGELOG.md
/Users/ryuyutyo/Documents/code/red/x-oasis/packages/async/async-call-rpc-electron/rollup.config.js
/Users/ryuyutyo/Documents/code/red/x-oasis/packages/async/async-call-rpc-electron/tsconfig.json
/Users/ryuyutyo/Documents/code/red/x-oasis/packages/async/async-call-rpc-electron/tsconfig.build.json
/Users/ryuyutyo/Documents/code/red/x-oasis/packages/async/async-call-rpc-electron/tsconfig.rollup.json
/Users/ryuyutyo/Documents/code/red/x-oasis/packages/async/async-call-rpc-electron/vitest.config.ts
```

### Source Code (13 files)

#### Shared

1. `/Users/ryuyutyo/Documents/code/red/x-oasis/packages/async/async-call-rpc-electron/src/index.ts` (13 lines)
   - Root barrel re-export
   - Exports from both electron-browser and electron-main
   - Includes bundle size warning

2. `/Users/ryuyutyo/Documents/code/red/x-oasis/packages/async/async-call-rpc-electron/src/types.ts` (115 lines)
   - MainPort interface
   - ParentPort interface
   - Channel props types
   - Re-exports Electron types

#### Electron Browser (6 files)

3. `/Users/ryuyutyo/Documents/code/red/x-oasis/packages/async/async-call-rpc-electron/src/electron-browser/index.ts` (34 lines)
   - Renderer entry point
   - Exports: IPCRendererChannel, createPageBridge, ContextBridgeChannel, etc.

4. **`/Users/ryuyutyo/Documents/code/red/x-oasis/packages/async/async-call-rpc-electron/src/electron-browser/createPageBridge.ts`** (82 lines)
   - **PRIMARY LOCATION FOR @x-oasis/async-call-rpc-web**
   - Lines 26-34: Dynamic require of async-call-rpc-web
   - Creates bridge for page-to-preload communication

5. `/Users/ryuyutyo/Documents/code/red/x-oasis/packages/async/async-call-rpc-electron/src/electron-browser/createPageChannel.ts` (9 lines)
   - Helper to create ContextBridgeChannel

6. `/Users/ryuyutyo/Documents/code/red/x-oasis/packages/async/async-call-rpc-electron/src/electron-browser/ContextBridgeChannel.ts` (74 lines)
   - Bridge between preload and renderer
   - Communicates via global __rpc_bridge__

7. `/Users/ryuyutyo/Documents/code/red/x-oasis/packages/async/async-call-rpc-electron/src/electron-browser/IPCRendererChannel.ts` (156 lines)
   - ipcRenderer RPC channel
   - Normalizes Electron IPC to MessageEvent format
   - Handles port transfers

8. `/Users/ryuyutyo/Documents/code/red/x-oasis/packages/async/async-call-rpc-electron/src/electron-browser/registerOrchestratorHandler.ts` (51 lines)
   - Orchestrator handler registration
   - Used by both renderers and utility processes

#### Electron Main (5 files)

9. `/Users/ryuyutyo/Documents/code/red/x-oasis/packages/async/async-call-rpc-electron/src/electron-main/index.ts` (39 lines)
   - Main/utility entry point
   - Exports main process channels and orchestrator

10. `/Users/ryuyutyo/Documents/code/red/x-oasis/packages/async/async-call-rpc-electron/src/electron-main/IPCMainChannel.ts` (189 lines)
    - ipcMain RPC channel
    - Bound mode (specific WebContents) or broadcast mode
    - Auto-disconnect on WebContents destroyed

11. `/Users/ryuyutyo/Documents/code/red/x-oasis/packages/async/async-call-rpc-electron/src/electron-main/ElectronMessagePortMainChannel.ts` (176 lines)
    - MessagePortMain channel
    - Supports late binding via bindPort()
    - Can dynamically rebind ports

12. `/Users/ryuyutyo/Documents/code/red/x-oasis/packages/async/async-call-rpc-electron/src/electron-main/ElectronUtilityProcessChannel.ts` (150 lines)
    - UtilityProcess/ParentPort channel
    - Handles both main-side and utility-side
    - Optional kill-on-disconnect

13. `/Users/ryuyutyo/Documents/code/red/x-oasis/packages/async/async-call-rpc-electron/src/electron-main/ElectronConnectionOrchestrator.ts` (186 lines)
    - Multi-process orchestrator
    - Creates MessageChannelMain port pairs
    - Activates participants with heartbeat

## Test Files

```
/Users/ryuyutyo/Documents/code/red/x-oasis/packages/async/async-call-rpc-electron/test/
├── __mocks__/
│   └── electron.ts                    (Mock Electron module for tests)
├── ContextBridgeChannel.spec.ts
├── IPCMainChannel.spec.ts
├── IPCRendererChannel.spec.ts
├── ElectronMessagePortMainChannel.spec.ts
├── ElectronUtilityProcessChannel.spec.ts
└── ElectronConnectionOrchestrator.spec.ts
```

## Documentation Files

```
/Users/ryuyutyo/Documents/code/red/x-oasis/packages/async/async-call-rpc-electron/docs/
├── index.md                           (Package overview)
├── context-bridge-channel.md          (ContextBridgeChannel guide)
├── orchestrator.md                    (Orchestrator documentation)
└── scenario-orchestration.md          (Orchestration scenarios)
```

## Examples

```
/Users/ryuyutyo/Documents/code/red/x-oasis/packages/async/async-call-rpc-electron/examples/
├── renderer-acquire-main-port-example/
├── renderer-acquire-utility-port-example/
├── renderer-acquire-main-port-orchestrator-example/
├── renderer-acquire-utility-port-orchestrator-example/
└── page-acquire-renderer-port-orchestrator-example/
```

## Build Output

```
/Users/ryuyutyo/Documents/code/red/x-oasis/packages/async/async-call-rpc-electron/dist/
├── index.js                           (Root barrel, 8.6 KB)
├── index.d.ts
├── electron-browser/
│   ├── index.js                       (Renderer bundle)
│   └── index.d.ts
├── electron-main/
│   ├── index.js                       (Main bundle)
│   └── index.d.ts
└── src/
    ├── *.d.ts                         (Type definitions)
    ├── electron-browser/
    │   ├── *.d.ts
    │   └── *.js.map
    └── electron-main/
        ├── *.d.ts
        └── *.js.map
```

## Quick Navigation

**Most Important Files to Understand**:
1. `src/electron-browser/createPageBridge.ts` - Where async-call-rpc-web is used
2. `src/types.ts` - Type definitions
3. `package.json` - Dependencies
4. `rollup.config.js` - Build configuration

**For Renderer Development**:
- Import from: `@x-oasis/async-call-rpc-electron/electron-browser`
- Key files: `IPCRendererChannel.ts`, `createPageBridge.ts`, `ContextBridgeChannel.ts`

**For Main Process Development**:
- Import from: `@x-oasis/async-call-rpc-electron/electron-main`
- Key files: `IPCMainChannel.ts`, `ElectronConnectionOrchestrator.ts`

**For Testing**:
- Config: `vitest.config.ts`
- Mocks: `test/__mocks__/electron.ts`
- Tests: `test/*.spec.ts`

## File Size Reference

| File | Lines | Purpose |
|------|-------|---------|
| createPageBridge.ts | 82 | **Uses async-call-rpc-web** |
| ElectronConnectionOrchestrator.ts | 186 | Orchestrator |
| IPCMainChannel.ts | 189 | Main IPC |
| types.ts | 115 | Types |
| ElectronMessagePortMainChannel.ts | 176 | MessagePort |
| IPCRendererChannel.ts | 156 | Renderer IPC |
| ElectronUtilityProcessChannel.ts | 150 | Utility process |
| registerOrchestratorHandler.ts | 51 | Handler registration |
| electron-browser/index.ts | 34 | Renderer entry |
| electron-main/index.ts | 39 | Main entry |
| index.ts (root) | 13 | Root barrel |
| createPageChannel.ts | 9 | Helper |

**Total Source Code**: ~1,200 lines of TypeScript

## Related Packages

These files may reference or be referenced by:
- `/Users/ryuyutyo/Documents/code/red/x-oasis/packages/async/async-call-rpc/` - Base RPC framework
- `/Users/ryuyutyo/Documents/code/red/x-oasis/packages/async/async-call-rpc-web/` - Web MessagePort support

