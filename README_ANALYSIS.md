# @x-oasis/async-call-rpc-electron - Complete Analysis & Documentation

This folder contains comprehensive analysis and documentation of the `@x-oasis/async-call-rpc-electron` package.

## Quick Start - Choose Your Entry Point

### For a 5-minute overview
→ Read: **QUICK_REFERENCE.md** (single page)

### For understanding the full architecture
→ Read: **ASYNC_CALL_RPC_ELECTRON_ANALYSIS.md** (comprehensive, 794 lines)

### For quick file lookups
→ Read: **FILE_MANIFEST.md** (absolute paths, quick navigation)

### For critical findings
→ Read: **SOURCE_FILES_SUMMARY.txt** (highlights key insights)

## Analysis Documents

| Document | Size | Purpose |
|----------|------|---------|
| **ASYNC_CALL_RPC_ELECTRON_ANALYSIS.md** | 24 KB | Complete architectural documentation with all source code |
| **QUICK_REFERENCE.md** | 6.1 KB | Single-page cheat sheet with key facts and examples |
| **FILE_MANIFEST.md** | 8.3 KB | Complete file listing with absolute paths |
| **SOURCE_FILES_SUMMARY.txt** | 6.1 KB | Quick reference with critical findings |
| **README_ANALYSIS.md** | This file | Index and navigation guide |

## Key Findings Summary

### Where @x-oasis/async-call-rpc-web Is Used

**Single Location**: `src/electron-browser/createPageBridge.ts` (lines 26-34)

```typescript
let RPCMessageChannel: any;
try {
  RPCMessageChannel = require('@x-oasis/async-call-rpc-web').default;
} catch {
  throw new Error('[createPageBridge] @x-oasis/async-call-rpc-web is required but not installed...');
}
```

### Import Pattern: Dynamic Require (NOT Static)

- Uses `require()` instead of `import`
- Only loaded when `createPageBridge()` is called
- NOT declared in package.json dependencies
- Enables optional usage and smaller bundles

### Why This Design?

1. **Optional Feature** - Only used in specific scenarios
2. **Smaller Bundles** - Other use cases don't need it
3. **Better Errors** - Helpful message if missing
4. **Testable** - Works with vitest alias (no npm install needed)
5. **Tree-shakeable** - Unused code can be eliminated

## Architecture Overview

### 13 Source Files (~1,200 lines)

**Shared (2 files)**
- `src/index.ts` - Root barrel re-export
- `src/types.ts` - Type definitions

**Renderer-Only (6 files)**
- `src/electron-browser/index.ts` - Entry point
- `src/electron-browser/createPageBridge.ts` - **Uses async-call-rpc-web**
- `src/electron-browser/createPageChannel.ts` - Helper
- `src/electron-browser/ContextBridgeChannel.ts` - Bridge API
- `src/electron-browser/IPCRendererChannel.ts` - ipcRenderer channel
- `src/electron-browser/registerOrchestratorHandler.ts` - Orchestrator handler

**Main/Utility (5 files)**
- `src/electron-main/index.ts` - Entry point
- `src/electron-main/IPCMainChannel.ts` - ipcMain channel
- `src/electron-main/ElectronMessagePortMainChannel.ts` - MessagePort channel
- `src/electron-main/ElectronUtilityProcessChannel.ts` - UtilityProcess channel
- `src/electron-main/ElectronConnectionOrchestrator.ts` - Orchestrator

### 3 Export Entry Points

- `@x-oasis/async-call-rpc-electron` - Root barrel (includes everything)
- `@x-oasis/async-call-rpc-electron/electron-browser` - Renderer-safe
- `@x-oasis/async-call-rpc-electron/electron-main` - Node.js-safe

## How createPageBridge Works

```
createPageBridge(options)
├─ Create IPCRendererChannel
├─ Require RPCMessageChannel from async-call-rpc-web
├─ Instantiate RPCMessageChannel
├─ Register orchestrator handler
│  └─ Waits for MessagePort from main
├─ Setup contextBridge
│  └─ Exposes _send, _onMessage, _offMessage
└─ Return {channel, ipcChannel}
```

## Three RPC Topologies Supported

1. **ipcRenderer ↔ ipcMain** - Named channel IPC
2. **MessagePort ↔ MessagePort** - Direct high-performance
3. **UtilityProcess ↔ ParentPort** - Process-based

## Design Patterns Used

- **Channel Protocol Pattern** - Extends AbstractChannelProtocol
- **Event Normalization** - Electron IPC → MessageEvent-like
- **Orchestrator Pattern** - Multi-process coordination
- **Dynamic Imports** - Optional dependencies
- **Sub-path Exports** - Bundle size optimization
- **Late Binding** - Deferred port attachment

## Dependencies

| Type | Package | Version | Status |
|------|---------|---------|--------|
| Hard | @x-oasis/async-call-rpc | workspace | Required |
| Peer | electron | >= 20.0.0 | Optional |
| Dynamic | @x-oasis/async-call-rpc-web | - | Not declared |

## Build Configuration

- **Tool**: Rollup
- **Format**: CommonJS
- **Builds**: 3 (root, electron-browser, electron-main)
- **External**: ['electron', '@x-oasis/async-call-rpc']
- **Output**: dist/ (3 bundles + TypeScript declarations)

## Package Details

- **Name**: @x-oasis/async-call-rpc-electron
- **Version**: 0.6.1
- **Location**: `/Users/ryuyutyo/Documents/code/red/x-oasis/packages/async/async-call-rpc-electron/`

## Related Packages

- `@x-oasis/async-call-rpc` - Base RPC framework
- `@x-oasis/async-call-rpc-web` - Web MessagePort support (used by createPageBridge)

## Document Reading Order

### For Different Audiences

**Developers using the package:**
1. Start: QUICK_REFERENCE.md
2. Deep dive: ASYNC_CALL_RPC_ELECTRON_ANALYSIS.md (sections 3-9)

**Package maintainers:**
1. Overview: FILE_MANIFEST.md
2. Details: ASYNC_CALL_RPC_ELECTRON_ANALYSIS.md
3. Reference: SOURCE_FILES_SUMMARY.txt

**Architects reviewing code:**
1. Start: QUICK_REFERENCE.md (architecture patterns section)
2. Deep dive: ASYNC_CALL_RPC_ELECTRON_ANALYSIS.md (section 1-5)

**Troubleshooting missing async-call-rpc-web:**
1. Check: SOURCE_FILES_SUMMARY.txt (critical findings)
2. Reference: QUICK_REFERENCE.md (key facts table)
3. Details: ASYNC_CALL_RPC_ELECTRON_ANALYSIS.md (section 4)

## All Source Files Read

✓ 13 source files (complete contents)
✓ package.json (dependencies)
✓ rollup.config.js (build configuration)
✓ tsconfig.build.json (TypeScript configuration)
✓ vitest.config.ts (test configuration)
✓ Compiled distribution files

## Critical Code Location

**@x-oasis/async-call-rpc-web Usage:**
```
File: /Users/ryuyutyo/Documents/code/red/x-oasis/packages/async/
      async-call-rpc-electron/src/electron-browser/
      createPageBridge.ts

Lines: 26-34
```

## Additional Context

This analysis was created through complete exploration of:
- All source TypeScript files
- Package configuration
- Build system setup
- Test configuration
- Type definitions
- Distribution output

The package provides comprehensive Electron transport adapters for the x-oasis RPC framework, enabling robust multi-process communication with MessagePort support.

---

**Last Updated**: May 9, 2026
**Total Documentation**: 44.5 KB across 4 files
**Source Code Analyzed**: ~1,200 lines
**Files Examined**: 18 (13 source + 5 config)

