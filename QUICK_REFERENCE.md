# @x-oasis/async-call-rpc-electron - Quick Reference

## Where @x-oasis/async-call-rpc-web Is Used

**Single Location**: `src/electron-browser/createPageBridge.ts` (lines 26-34)

```typescript
let RPCMessageChannel: any;
try {
  RPCMessageChannel = require('@x-oasis/async-call-rpc-web').default;
} catch {
  throw new Error(
    '[createPageBridge] @x-oasis/async-call-rpc-web is required but not installed. ' +
      'Install it with: npm install @x-oasis/async-call-rpc-web'
  );
}
```

## Key Facts

| Aspect | Details |
|--------|---------|
| **Import Type** | Dynamic `require()` (not static import) |
| **When Loaded** | Only when `createPageBridge()` is called |
| **Why** | Optional feature, keeps bundles small |
| **Dependency** | NOT in package.json (neither dependencies nor peerDependencies) |
| **Build Config** | NOT in rollup external list (dynamic require) |
| **Test Setup** | vitest aliases to workspace source |
| **Error Handling** | Try-catch with helpful error message |

## What createPageBridge Does

```
createPageBridge({
  ipcRenderer,
  channelName,
  description?
})
  │
  ├─ Create IPCRendererChannel (control-plane)
  │
  ├─ Require RPCMessageChannel from async-call-rpc-web
  │   └─ This is where async-call-rpc-web enters!
  │
  ├─ Instantiate RPCMessageChannel
  │
  ├─ Register orchestrator handler
  │   └─ Listens for MessagePort from main process
  │
  ├─ Setup contextBridge
  │   └─ Exposes _send, _onMessage, _offMessage
  │
  └─ Return { channel, ipcChannel }
```

## Package Exports

### Root: `@x-oasis/async-call-rpc-electron`
Exports everything from both sub-paths (larger bundle)

### Renderer: `@x-oasis/async-call-rpc-electron/electron-browser`
```typescript
export { IPCRendererChannel }
export { createPageBridge }           // ← Uses async-call-rpc-web
export { createPageChannel }
export { ContextBridgeChannel }
export { registerOrchestratorHandler }
```

### Main: `@x-oasis/async-call-rpc-electron/electron-main`
```typescript
export { IPCMainChannel }
export { ElectronMessagePortMainChannel }
export { ElectronUtilityProcessChannel }
export { ElectronConnectionOrchestrator }
export { registerOrchestratorHandler }
```

## All 13 Source Files

### Renderer-Only (6 files)
1. `src/electron-browser/index.ts` - Entry point
2. `src/electron-browser/createPageBridge.ts` - **Uses async-call-rpc-web here**
3. `src/electron-browser/createPageChannel.ts` - Helper
4. `src/electron-browser/ContextBridgeChannel.ts` - Bridge API
5. `src/electron-browser/IPCRendererChannel.ts` - ipcRenderer channel
6. `src/electron-browser/registerOrchestratorHandler.ts` - Orchestrator handler

### Main-Only (5 files)
7. `src/electron-main/index.ts` - Entry point
8. `src/electron-main/IPCMainChannel.ts` - ipcMain channel
9. `src/electron-main/ElectronMessagePortMainChannel.ts` - MessagePortMain channel
10. `src/electron-main/ElectronUtilityProcessChannel.ts` - UtilityProcess channel
11. `src/electron-main/ElectronConnectionOrchestrator.ts` - Orchestrator

### Shared (2 files)
12. `src/index.ts` - Root barrel
13. `src/types.ts` - Type definitions

## Architecture Patterns

1. **Channel Protocol Pattern**
   - All channels extend `AbstractChannelProtocol`
   - Implement `on(listener)` and `send(data, transfer?)`

2. **Event Normalization**
   - Electron IPC: `(event, ...args)` format
   - Normalized to: `{data, ports, event}` (MessageEvent-like)

3. **Dynamic Imports**
   - Optional dependencies via `require()` at runtime
   - Better error messages when missing
   - Enables tree-shaking

4. **Sub-path Exports**
   - Renderer bundle uses `electron-browser` entry
   - Main bundle uses `electron-main` entry
   - Avoids pulling unnecessary dependencies

5. **Late Binding Pattern**
   - `ElectronMessagePortMainChannel` can bind port later
   - Useful for orchestrator scenarios

## Build Output

```
dist/
├── index.js                          (8.6 KB root barrel)
├── electron-browser/index.js         (renderer bundle)
└── electron-main/index.js            (main bundle)
```

## Dependencies

**Hard Dependencies**
- `@x-oasis/async-call-rpc` (workspace)

**Peer Dependencies (optional)**
- `electron` >= 20.0.0

**NOT Dependencies**
- `@x-oasis/async-call-rpc-web` (dynamic require only)

## Config Files

| File | Purpose |
|------|---------|
| `package.json` | Package metadata, dependencies |
| `rollup.config.js` | Build configuration (3 separate bundles) |
| `tsconfig.build.json` | TypeScript compilation |
| `vitest.config.ts` | Test configuration with aliases |

## How to Use

### For Renderer Process

```typescript
import { createPageBridge } from '@x-oasis/async-call-rpc-electron/electron-browser';
import { ipcRenderer } from 'electron';

// In preload.ts
const { channel, ipcChannel } = createPageBridge({
  ipcRenderer,
  channelName: 'my-rpc',
  description: 'renderer bridge',
});

// channel: RPCMessageChannel from async-call-rpc-web
// ipcChannel: IPCRendererChannel for control plane
```

### For Main Process

```typescript
import { IPCMainChannel } from '@x-oasis/async-call-rpc-electron/electron-main';
import { ipcMain } from 'electron';

const channel = new IPCMainChannel({
  channelName: 'my-rpc',
  webContents: window.webContents,
  description: 'main channel',
});
```

### For Orchestrator Setup

```typescript
import { ElectronConnectionOrchestrator } from '@x-oasis/async-call-rpc-electron/electron-main';

const orchestrator = new ElectronConnectionOrchestrator();
orchestrator.registerParticipant('renderer', ipcChannel, 'renderer');
orchestrator.registerParticipant('utility', utilityChannel, 'utility');

const info = await orchestrator.connect('renderer', 'utility');
// Now renderer and utility communicate directly via MessagePort
```

## Files You Need to Know

| Purpose | File |
|---------|------|
| Understanding architecture | ASYNC_CALL_RPC_ELECTRON_ANALYSIS.md (794 lines) |
| Quick lookup | SOURCE_FILES_SUMMARY.txt |
| Where async-call-rpc-web is used | src/electron-browser/createPageBridge.ts |
| How dynamic require works | src/electron-browser/createPageBridge.ts (lines 26-34) |
| Package configuration | package.json |
| Build configuration | rollup.config.js |
| Test setup | vitest.config.ts |

