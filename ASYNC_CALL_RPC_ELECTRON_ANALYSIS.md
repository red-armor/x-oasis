# @x-oasis/async-call-rpc-electron - Comprehensive Package Analysis

## Overview

`@x-oasis/async-call-rpc-electron` is an Electron transport adapter package that provides RPC channel protocols for Electron's IPC and MessagePort communication mechanisms. It enables bidirectional asynchronous communication between the main process, renderer processes, and utility processes.

**Location**: `/Users/ryuyutyo/Documents/code/red/x-oasis/packages/async/async-call-rpc-electron/`

---

## 1. Package.json - Dependencies & Configuration

### File: `package.json`

```json
{
  "name": "@x-oasis/async-call-rpc-electron",
  "version": "0.6.1",
  "type": "module",
  "description": "Electron transport adapters (ipcMain, ipcRenderer, MessagePortMain, UtilityProcess) for @x-oasis/async-call-rpc",
  "main": "dist/index.js",
  "typings": "dist/index.d.ts",
  
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js",
      "require": "./dist/index.js"
    },
    "./electron-browser": {
      "types": "./dist/electron-browser/index.d.ts",
      "import": "./dist/electron-browser/index.js",
      "require": "./dist/electron-browser/index.js"
    },
    "./electron-main": {
      "types": "./dist/electron-main/index.d.ts",
      "import": "./dist/electron-main/index.js",
      "require": "./dist/electron-main/index.js"
    }
  },

  "dependencies": {
    "@x-oasis/async-call-rpc": "workspace:*"
  },

  "peerDependencies": {
    "electron": ">=20.0.0"
  },

  "peerDependenciesMeta": {
    "electron": {
      "optional": true
    }
  }
}
```

### Key Observations:

1. **Three Export Entry Points**:
   - `"."` - Root barrel (re-exports everything from both sub-paths)
   - `"./electron-browser"` - Renderer-specific entry point
   - `"./electron-main"` - Main and utility process entry point

2. **Dependencies**:
   - **Only dependency**: `@x-oasis/async-call-rpc` (workspace dependency)
   - `electron` is a **peer dependency** marked as optional
   - This allows the package to be imported in non-Electron environments for testing

3. **No @x-oasis/async-call-rpc-web dependency declared** - but it is dynamically required at runtime in specific functions

---

## 2. Source Directory Structure

### Directory Layout:

```
src/
├── index.ts                          # Root barrel re-export
├── types.ts                          # Shared type definitions
├── electron-browser/
│   ├── index.ts                      # Renderer entry point
│   ├── createPageBridge.ts           # Creates bridge with @x-oasis/async-call-rpc-web
│   ├── createPageChannel.ts          # Creates ContextBridgeChannel
│   ├── ContextBridgeChannel.ts       # contextBridge communication channel
│   ├── IPCRendererChannel.ts         # ipcRenderer RPC channel
│   └── registerOrchestratorHandler.ts# Orchestrator handler for participants
└── electron-main/
    ├── index.ts                      # Main/utility entry point
    ├── IPCMainChannel.ts             # ipcMain RPC channel
    ├── ElectronMessagePortMainChannel.ts  # MessagePortMain channel
    ├── ElectronUtilityProcessChannel.ts   # UtilityProcess channel
    └── ElectronConnectionOrchestrator.ts  # Orchestrator for multi-process setup
```

---

## 3. Critical: createPageBridge Function

### File: `src/electron-browser/createPageBridge.ts`

This is the **primary entry point for using @x-oasis/async-call-rpc-web**:

```typescript
export function createPageBridge(options: CreatePageBridgeOptions): {
  channel: any;
  ipcChannel: IPCRendererChannel;
}
```

### How It Uses @x-oasis/async-call-rpc-web:

```typescript
// Line 26-34: CRITICAL - Dynamic require of @x-oasis/async-call-rpc-web
let RPCMessageChannel: any;
try {
  RPCMessageChannel = require('@x-oasis/async-call-rpc-web').default;
} catch {
  throw new Error(
    '[createPageBridge] @x-oasis/async-call-rpc-web is required but not installed. ' +
      'Install it with: npm install @x-oasis/async-call-rpc-web'
  );
}

// Line 36-38: Instantiate the channel from async-call-rpc-web
const realChannel = new RPCMessageChannel({
  description: description ?? `page-bridge:${channelName}`,
});
```

### What It Does:

1. **Creates Two Channels**:
   - `ipcChannel` - IPCRendererChannel for control-plane communication
   - `realChannel` - RPCMessageChannel from async-call-rpc-web for direct MessagePort communication

2. **Registers Orchestrator Handler**:
   ```typescript
   registerOrchestratorHandler(ipcChannel, (port: any) => {
     realChannel.bindPort(port, { rebind: true });
   });
   ```
   - Listens for MessagePort from main process via orchestrator
   - Binds the port to the RPCMessageChannel when received

3. **Exposes Bridge API**:
   ```typescript
   const bridge: ContextBridgeAPI = {
     _send: (data: unknown) => realChannel.send(data),
     _onMessage: (cb: (data: unknown) => void) => messageHandlers.add(cb),
     _offMessage: () => messageHandlers.clear(),
   };
   ```
   - Sends messages through the RPCMessageChannel
   - Manages message handlers

4. **Uses contextBridge**:
   ```typescript
   const { contextBridge } = require('electron');
   contextBridge.exposeInMainWorld(BRIDGE_KEY, {
     _send: bridge._send,
     _onMessage: bridge._onMessage,
     _offMessage: bridge._offMessage,
   });
   ```
   - Exposes the bridge API to the renderer process safely

### Return Value:

```typescript
return { channel: realChannel, ipcChannel };
```

Returns both the underlying channels so caller can:
- Use `realChannel` for the direct MessagePort connection
- Use `ipcChannel` for control-plane communication to main process

---

## 4. How @x-oasis/async-call-rpc-web Is Required

### Dynamic Require Pattern:

The package uses **dynamic `require()`** instead of static import:

```typescript
// In createPageBridge.ts
let RPCMessageChannel: any;
try {
  RPCMessageChannel = require('@x-oasis/async-call-rpc-web').default;
} catch {
  throw new Error('[createPageBridge] @x-oasis/async-call-rpc-web is required but not installed...');
}
```

### Why Dynamic Require?

1. **Avoids Bundling Electron code in renderer**:
   - The root barrel (`dist/index.js`) imports both electron-main and electron-browser
   - If async-call-rpc-web were a static dependency, it would be bundled alongside electron APIs
   - Dynamic require keeps the dependency optional and deferred to usage time

2. **Only loaded when createPageBridge() is called**:
   - The error is only thrown if the function is actually used
   - Allows conditional usage and better error messages

3. **Declared as peer dependency in examples**:
   - Examples that use `createPageBridge` explicitly depend on `@x-oasis/async-call-rpc-web`
   - Main package.json does NOT declare it as a dependency or peerDependency

### Test Configuration:

**File**: `vitest.config.ts`

```typescript
resolve: {
  alias: {
    '@x-oasis/async-call-rpc-web': path.resolve(
      __dirname,
      '../async-call-rpc-web/src/index.ts'
    ),
    // Mock electron module so tests run outside Electron
    electron: path.resolve(__dirname, 'test/__mocks__/electron.ts'),
  },
}
```

- Tests alias the package to the workspace source
- This allows tests to run without installing it as an npm package

---

## 5. All Source Files Content

### src/index.ts

```typescript
// Root barrel — re-exports everything from both sub-paths for back-compat.
//
// PREFER the sub-path entries when bundle size matters:
// - `@x-oasis/async-call-rpc-electron/electron-browser` for renderer code
// - `@x-oasis/async-call-rpc-electron/electron-main`    for main + utility code
//
// Importing this root barrel from a renderer bundle will pull in the entire
// dependency graph including `ipcMain`, `MessageChannelMain`, `utilityProcess`,
// etc. — bundlers may then try to resolve `electron` (a CommonJS Node module)
// in a browser/ESM environment and fail at runtime. Use the sub-paths to
// guarantee tree-shake-friendly boundaries.
export * from './electron-browser';
export * from './electron-main';
```

### src/types.ts

```typescript
import { AbstractChannelProtocolProps } from '@x-oasis/async-call-rpc';
import {
  IpcRenderer,
  IpcMain,
  IpcMainEvent,
  IpcRendererEvent,
  UtilityProcess,
  WebContents,
} from 'electron';

// ─── MessagePortMain interfaces ──────────────────────────────────────────────

/**
 * Represents Electron's `MessagePortMain`.
 *
 * Uses Node.js `EventEmitter`-style API (`on`/`off`/`once`)
 * instead of the Web `addEventListener`.
 */
export interface MainPort extends NodeJS.EventEmitter {
  on(event: 'close', listener: Function): this;
  on(event: 'message', listener: (messageEvent: MessageEvent) => void): this;
  // ... other event methods
  close(): void;
  postMessage(message: any, transfer?: MainPort[]): void;
  start(): void;
}

/**
 * Represents Electron's `parentPort` in a UtilityProcess.
 */
export interface ParentPort extends NodeJS.EventEmitter {
  on(event: 'message', listener: (messageEvent: MessageEvent) => void): this;
  // ... other methods
  postMessage(message: any): void;
}

// ─── Props types ─────────────────────────────────────────────────────────────

export type MessagePortMainChannelProps = {
  port?: MainPort;
} & AbstractChannelProtocolProps;

export type UtilityProcessChannelProps = {
  process: UtilityProcess;
} & AbstractChannelProtocolProps;

export type UtilityProcessParentPortChannelProps = {
  parentPort: ParentPort;
} & AbstractChannelProtocolProps;

export type IPCMainChannelProps = {
  channelName: string;
  webContents?: WebContents;
  acceptAllSenders?: boolean;
} & AbstractChannelProtocolProps;

export type IPCRendererChannelProps = {
  channelName: string;
  ipcRenderer: IpcRenderer;
  projectName: string;
} & AbstractChannelProtocolProps;

// ─── Re-exports for convenience ──────────────────────────────────────────────

export type {
  IpcRenderer,
  IpcMain,
  IpcMainEvent,
  IpcRendererEvent,
  UtilityProcess,
  WebContents,
};
```

### src/electron-browser/createPageBridge.ts

```typescript
import IPCRendererChannel from './IPCRendererChannel';
import { registerOrchestratorHandler } from './registerOrchestratorHandler';
import { ContextBridgeAPI } from './ContextBridgeChannel';
import { IpcRenderer } from '../types';

const BRIDGE_KEY = '__rpc_bridge__' as const;

export interface CreatePageBridgeOptions {
  ipcRenderer: IpcRenderer;
  channelName: string;
  description?: string;
}

export function createPageBridge(options: CreatePageBridgeOptions): {
  channel: any;
  ipcChannel: IPCRendererChannel;
} {
  const { ipcRenderer, channelName, description } = options;

  const ipcChannel = new IPCRendererChannel({
    channelName,
    ipcRenderer,
    projectName: channelName,
  });

  // *** CRITICAL: Dynamic require of @x-oasis/async-call-rpc-web ***
  let RPCMessageChannel: any;
  try {
    RPCMessageChannel = require('@x-oasis/async-call-rpc-web').default;
  } catch {
    throw new Error(
      '[createPageBridge] @x-oasis/async-call-rpc-web is required but not installed. ' +
        'Install it with: npm install @x-oasis/async-call-rpc-web'
    );
  }

  // Create the RPCMessageChannel from async-call-rpc-web
  const realChannel = new RPCMessageChannel({
    description: description ?? `page-bridge:${channelName}`,
  });

  // Register handler to receive MessagePort from orchestrator
  registerOrchestratorHandler(ipcChannel, (port: any) => {
    realChannel.bindPort(port, { rebind: true });
  });

  const messageHandlers = new Set<(data: unknown) => void>();

  const bridge: ContextBridgeAPI = {
    _send: (data: unknown) => {
      realChannel.send(data);
    },
    _onMessage: (cb: (data: unknown) => void) => {
      messageHandlers.add(cb);
    },
    _offMessage: () => {
      messageHandlers.clear();
    },
  };

  // Expose bridge via contextBridge
  try {
    const { contextBridge } = require('electron');
    contextBridge.exposeInMainWorld(BRIDGE_KEY, {
      _send: bridge._send,
      _onMessage: bridge._onMessage,
      _offMessage: bridge._offMessage,
    });
  } catch {
    console.warn(
      '[createPageBridge] contextBridge not available. ' +
        'Falling back to globalThis. This should only happen in tests.'
    );
    (globalThis as any)[BRIDGE_KEY] = {
      _send: bridge._send,
      _onMessage: bridge._onMessage,
      _offMessage: bridge._offMessage,
    };
  }

  // Forward messages from realChannel to all handlers
  realChannel.on((data: unknown) => {
    messageHandlers.forEach((cb) => cb(data));
  });

  return { channel: realChannel, ipcChannel };
}
```

### src/electron-browser/index.ts

```typescript
// Renderer-side entry point.
export { default as IPCRendererChannel } from './IPCRendererChannel';
export { registerOrchestratorHandler } from './registerOrchestratorHandler';
export { default as ContextBridgeChannel } from './ContextBridgeChannel';
export { createPageBridge } from './createPageBridge';
export { createPageChannel } from './createPageChannel';

// Re-export the shared types
export type {
  IPCRendererChannelProps,
  IpcRenderer,
  IpcRendererEvent,
} from '../types';

export type {
  ContextBridgeChannelProps,
  ContextBridgeAPI,
} from './ContextBridgeChannel';

export type { CreatePageBridgeOptions } from './createPageBridge';
```

### src/electron-browser/IPCRendererChannel.ts

A 156-line class that extends `AbstractChannelProtocol`:

- **Constructor**: Takes `IPCRendererChannelProps` (channelName, ipcRenderer, projectName)
- **on()**: Registers listener on ipcRenderer, normalizes Electron's event format to MessageEvent-like
  - Extracts data from args
  - Extracts ports from event.ports
  - Returns cleanup function
- **send()**: Sends data via ipcRenderer
  - Uses `postMessage()` if transfer list provided
  - Uses `send()` for simple messages
- **disconnect()**: Removes all listeners

### src/electron-browser/ContextBridgeChannel.ts

A 74-line class that extends `AbstractChannelProtocol`:

- **Purpose**: Bridge between preload script and renderer process via contextBridge
- **activate()**: Looks for `__rpc_bridge__` on globalThis, sets up message listener
- **send()**: Sends data through the bridge's `_send` method
- **on()**: Adds message handlers to a Set
- **disconnect()**: Cleans up handlers and bridge reference

### src/electron-browser/registerOrchestratorHandler.ts

A 51-line helper function:

```typescript
export function registerOrchestratorHandler(
  channel: AbstractChannelProtocol,
  onPort: (port: any) => void
): void {
  const service = new RPCService(ORCHESTRATOR_SERVICE_PATH, {
    handlers: {
      activateConnection: onPort,
    },
  });
  service.setChannel(channel);
}
```

- Creates RPCService for orchestrator communication
- Registers handler to receive MessagePort when orchestrator activates connection

### src/electron-browser/createPageChannel.ts

A 9-line helper:

```typescript
import ContextBridgeChannel from './ContextBridgeChannel';

export function createPageChannel(description?: string): ContextBridgeChannel {
  const channel = new ContextBridgeChannel({
    description: description ?? 'page-rpc',
  });
  channel.activate();
  return channel;
}
```

- Creates and activates ContextBridgeChannel for renderer process use

### src/electron-main/IPCMainChannel.ts

A 189-line class implementing IPC on main process:

- **Constructor**: Takes channelName, webContents (optional), acceptAllSenders flag
- **on()**: Registers on ipcMain
  - In broadcast mode: captures sender for reply routing
  - In bound mode: filters by expected webContents
  - Extracts data and ports from event
- **send()**: Sends via webContents
  - Detects destroyed webContents
  - Uses postMessage for transfers, send for simple messages
- **disconnect()**: Removes listeners

### src/electron-main/ElectronMessagePortMainChannel.ts

A 176-line class for MessagePortMain:

- **bindPort()**: Attach MessagePortMain with optional rebind
- **on()**: Returns wired listener or defers until port attached
- **send()**: Sends via port.postMessage()
- Supports late binding: can construct with no port, attach later

### src/electron-main/ElectronUtilityProcessChannel.ts

A 150-line class for UtilityProcess:

- **Constructor**: Accepts either UtilityProcess or ParentPort
- **on()**: Handles different message formats:
  - Main side: raw value → wrapped in `{data}`
  - Utility side: MessageEvent → passed through
- **send()**: Calls postMessage
- **disconnect()**: Optionally kills the process (configurable)

### src/electron-main/ElectronConnectionOrchestrator.ts

A 186-line class extending BaseConnectionOrchestrator:

- **Purpose**: Orchestrates multi-process connections
- **createPortPair()**: Uses MessageChannelMain factory
- **activateParticipant()**: Sends port to participant via RPC
- **_sendHeartbeat()**: Heartbeat mechanism with timeout

### src/electron-main/index.ts

```typescript
// Main + utility process entry point
export { default as IPCMainChannel } from './IPCMainChannel';
export { default as ElectronMessagePortMainChannel } from './ElectronMessagePortMainChannel';
export { default as ElectronUtilityProcessChannel } from './ElectronUtilityProcessChannel';
export { ElectronConnectionOrchestrator } from './ElectronConnectionOrchestrator';
export type { MessageChannelMainFactory } from './ElectronConnectionOrchestrator';

// Re-export registerOrchestratorHandler from browser (used by utility processes too)
export { registerOrchestratorHandler } from '../electron-browser/registerOrchestratorHandler';

// Re-export types
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
```

---

## 6. Build Configuration

### rollup.config.js

Three separate builds:

```javascript
// 1. Root barrel (combines both)
{
  input: 'src/index.ts',
  output: { file: 'dist/index.js', format: 'cjs' },
  external: ['electron', '@x-oasis/async-call-rpc'],
}

// 2. Renderer-specific entry
{
  input: 'src/electron-browser/index.ts',
  output: { file: 'dist/electron-browser/index.js', format: 'cjs' },
  external: ['electron', '@x-oasis/async-call-rpc'],
}

// 3. Main-specific entry
{
  input: 'src/electron-main/index.ts',
  output: { file: 'dist/electron-main/index.js', format: 'cjs' },
  external: ['electron', '@x-oasis/async-call-rpc'],
}
```

**External dependencies**:
- `electron` - Left external (installed separately)
- `@x-oasis/async-call-rpc` - Left external (imported at runtime)
- `@x-oasis/async-call-rpc-web` - **NOT listed as external** because it's dynamically required, not statically imported

### tsconfig.build.json

```json
{
  "extends": "../../../tsconfig.build.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src",
    "esModuleInterop": true,
    "declaration": true,
    "declarationDir": "./dist",
    "declarationMap": false,
    "composite": false
  },
  "include": ["src/**/*"]
}
```

---

## 7. Distribution Files

### Compiled Output Structure:

```
dist/
├── index.js                 # Root barrel (8.6 KB)
├── index.d.ts              # Root TypeScript declarations
├── electron-browser/
│   ├── index.js            # Renderer entry
│   └── index.d.ts
├── electron-main/
│   ├── index.js            # Main entry
│   └── index.d.ts
└── src/                     # TypeScript declarations for all modules
    ├── types.d.ts
    ├── index.d.ts
    ├── electron-browser/
    │   ├── index.d.ts
    │   ├── IPCRendererChannel.d.ts
    │   ├── createPageBridge.d.ts
    │   ├── ContextBridgeChannel.d.ts
    │   └── registerOrchestratorHandler.d.ts
    └── electron-main/
        ├── index.d.ts
        ├── IPCMainChannel.d.ts
        ├── ElectronMessagePortMainChannel.d.ts
        ├── ElectronConnectionOrchestrator.d.ts
        └── ElectronUtilityProcessChannel.d.ts
```

### Root Bundle (dist/index.js) - 276 lines

Contains bundled versions of:
- All electron-browser classes and functions
- All electron-main classes and functions

Uses CommonJS format with `require()` for:
- `electron` (external)
- `@x-oasis/async-call-rpc` (external)

---

## 8. How @x-oasis/async-call-rpc-web Is Used Summary

### Usage Pattern:

1. **createPageBridge()** (in electron-browser/):
   - Dynamically requires `@x-oasis/async-call-rpc-web` at function call time
   - Instantiates `RPCMessageChannel` from the package
   - Uses it to handle direct MessagePort communication

2. **Why Not a Hard Dependency**:
   - The package doesn't always need async-call-rpc-web
   - Only needed if you use `createPageBridge()` function
   - Allows lighter bundles for simpler use cases
   - Example: Using just `IPCRendererChannel` doesn't need it

3. **Actual Consumers** (examples):
   - `examples/renderer-acquire-utility-port-example/preload.ts` - ES6 import
   - `examples/renderer-acquire-main-port-example/preload.ts` - ES6 import
   - `examples/page-acquire-renderer-port-orchestrator-example/` - require() at runtime

4. **Test Setup**:
   - `vitest.config.ts` aliases package to workspace source
   - Allows tests to use `createPageBridge()` without npm install

---

## 9. Re-exports and Public API

### Root Entry Point Re-exports Everything:

```typescript
// src/index.ts
export * from './electron-browser';    // IPCRendererChannel, createPageBridge, etc.
export * from './electron-main';       // IPCMainChannel, Orchestrator, etc.
```

### Renderer-Safe Entry Point:

```typescript
// src/electron-browser/index.ts
export { default as IPCRendererChannel } from './IPCRendererChannel';
export { registerOrchestratorHandler } from './registerOrchestratorHandler';
export { default as ContextBridgeChannel } from './ContextBridgeChannel';
export { createPageBridge } from './createPageBridge';  // ← Uses async-call-rpc-web
export { createPageChannel } from './createPageChannel';
export type { IPCRendererChannelProps, IpcRenderer, IpcRendererEvent } from '../types';
export type { ContextBridgeChannelProps, ContextBridgeAPI } from './ContextBridgeChannel';
export type { CreatePageBridgeOptions } from './createPageBridge';
```

### Main-Safe Entry Point:

```typescript
// src/electron-main/index.ts
export { default as IPCMainChannel } from './IPCMainChannel';
export { default as ElectronMessagePortMainChannel } from './ElectronMessagePortMainChannel';
export { default as ElectronUtilityProcessChannel } from './ElectronUtilityProcessChannel';
export { ElectronConnectionOrchestrator } from './ElectronConnectionOrchestrator';
export { registerOrchestratorHandler } from '../electron-browser/registerOrchestratorHandler';
// Re-exports all relevant types
```

---

## Key Technical Details

### Port Transfer Mechanism:

All channels handle MessagePort transfers via `transfer` parameter:

```typescript
// Sending with transferable objects
channel.send(data, [port1, port2]);

// In send() method:
if (transfer && transfer.length) {
  webContents.postMessage(channelName, data, transfer);
} else {
  webContents.send(channelName, data);
}
```

### Event Normalization:

Electron IPC events are normalized to MessageEvent-like structure:

```typescript
// Electron format: (event, ...args)
// Normalized to: {data, ports, event} or {data, sender, ports}
const handler = (_event, ...args) => {
  const data = args.length === 1 ? args[0] : args;
  const ports = _event.ports || [];
  listener({
    data,
    ports,
    event: _event,
  });
};
```

### Three RPC Topologies Supported:

1. **IPCRenderer ↔ IPCMain**: Named channel-based IPC
2. **MessagePort ↔ MessagePort**: Direct high-performance messaging
3. **UtilityProcess ↔ ParentPort**: Process-based communication

### Dynamic Require Pattern Benefits:

- Keeps bundle sizes small
- Enables tree-shaking of unused channels
- Better error messages if optional dependencies missing
- Deferred error detection (only if actually used)
- Testable without installing all peer dependencies

