# @x-oasis/async-call-rpc-electron

RPC channel implementations and Connection Orchestrator for Electron.

## Installation

```bash
npm install @x-oasis/async-call-rpc-electron
```

## Features

- **IPC Channels**: Pre-built channels for `ipcMain`/`ipcRenderer`, `utilityProcess`, and `MessagePortMain`
- **Connection Orchestrator**: Automated direct MessagePort connection management between Electron processes
- **Participant Proxy**: Self-connect API for utility processes (`createParticipantProxy`, `createUtilityParticipant`)
- **Subscription Support**: Real-time data push via event methods (`on*`) and observable streaming
- **Full TypeScript Support**: Complete type definitions for all APIs
- **Zero External Dependencies**: Self-contained package

## Directory Structure & Sub-path Exports

The source code is organized by Electron process environment, with **sub-path exports** to prevent bundles from pulling in unnecessary dependencies.

```
src/
├── browser/            → Renderer process (no Electron API dependency)
├── electron-browser/   → Preload script (ipcRenderer, contextBridge access)
├── electron-main/      → Main / Utility process (ipcMain, utilityProcess, etc.)
├── types.ts            → Cross-environment shared types (erased at compile time)
└── index.ts            → Root barrel, re-exports all sub-paths
```

| Import Path                         | Runtime           | Dependencies                                     | Typical Use                                       |
| ----------------------------------- | ----------------- | ------------------------------------------------ | ------------------------------------------------- |
| `.../browser/core`                  | Renderer          | No Electron APIs                                 | `createPageChannel`, `ContextBridgeChannel`       |
| `.../browser/orchestrator`          | Renderer          | No Electron APIs                                 | `OrchestratorClient`                              |
| `.../browser`                       | Renderer          | No Electron APIs                                 | Re-exports `core` + `orchestrator`                |
| `.../electron-browser/core`         | Preload           | `ipcRenderer`, `contextBridge` (type-level only) | `createPageBridge`, `IPCRendererChannel`          |
| `.../electron-browser/orchestrator` | Preload           | `ipcRenderer`, `contextBridge` (type-level only) | `registerOrchestratorHandler`                     |
| `.../electron-browser`              | Preload           | `ipcRenderer`, `contextBridge` (type-level only) | Re-exports `core` + `orchestrator`                |
| `.../electron-main/core`            | Main / Utility    | `ipcMain`, `utilityProcess` runtime APIs         | `IPCMainChannel`, `ElectronUtilityProcessChannel` |
| `.../electron-main/orchestrator`    | Main / Utility    | `ipcMain`, `utilityProcess` runtime APIs         | `ElectronConnectionOrchestrator`                  |
| `.../electron-main`                 | Main / Utility    | `ipcMain`, `utilityProcess` runtime APIs         | Re-exports `core` + `orchestrator`                |
| `...` (root)                        | Any (back-compat) | All                                              | Re-exports everything                             |

## Quick Links

- [Connection Orchestrator](/packages/async/async-call-rpc-electron/orchestrator) - Automated port connection management
- [Scenario Orchestration Best Practices](/packages/async/async-call-rpc-electron/scenario-orchestration) - Patterns for all Electron IPC topologies
- [ContextBridge Channel](/packages/async/async-call-rpc-electron/context-bridge-channel) - Renderer RPC via contextBridge
- [API Reference](https://github.com/red-armor/x-oasis/tree/main/packages/async/async-call-rpc-electron/src)
- [Examples](https://github.com/red-armor/x-oasis/tree/main/packages/async/async-call-rpc-electron/examples)

## Quick Start

### Basic IPC Channel

```typescript
import { IPCMainChannel } from '@x-oasis/async-call-rpc-electron/electron-main/core';
import { IPCRendererChannel } from '@x-oasis/async-call-rpc-electron/electron-browser/core';

// Main process
const channel = new IPCMainChannel({
  channelName: 'app-rpc',
  webContents: mainWindow.webContents,
});

// Renderer process
const channel = new IPCRendererChannel({
  channelName: 'app-rpc',
  ipcRenderer,
});
```

### Connection Orchestrator

```typescript
// Main process
import { ElectronConnectionOrchestrator } from '@x-oasis/async-call-rpc-electron/electron-main/orchestrator';

const orchestrator = new ElectronConnectionOrchestrator();
orchestrator.registerParticipant('renderer', ipcChannel, 'renderer');
orchestrator.registerParticipant('utility', utilityChannel, 'utility');

await orchestrator.connect('renderer', 'utility');
```

> **Tip:** Use sub-path imports for optimal tree-shaking. The root import (`@x-oasis/async-call-rpc-electron`) still works for backward compatibility.

See the [Orchestrator Documentation](/packages/async/async-call-rpc-electron/orchestrator) for complete details.

## Usage Examples

See the [Scenario Orchestration Best Practices](/packages/async/async-call-rpc-electron/scenario-orchestration) guide for complete examples covering all Electron IPC topologies.

## TypeScript Support

Full TypeScript definitions are included:

```typescript
import {} from /* types */ '@x-oasis/async-call-rpc-electron';
```

## Performance

This package is optimized for:

- Small bundle size
- Fast execution
- Memory efficiency

## Browser Support

- Modern browsers (ES2015+)
- Node.js 12.0+

## Best Practices

✅ **Do:**

- Use `createParticipantProxy` for utility processes that need to self-connect
- Use `createUtilityParticipant` for workers that only expose services
- Use `on*` naming for event methods to enable cross-process callback serialization
- Wrap observable subscriptions in `on*` methods at proxy layers
- Return cleanup functions from event method handlers

❌ **Don't:**

- Use non-`on*` names for subscription methods that need to cross process boundaries
- Expose `subscribe()` directly to remote clients — callbacks are not serializable
- Forget to return cleanup from event handlers (causes memory leaks)
- Use the root barrel import in renderer bundles — prefer `@x-oasis/async-call-rpc-electron/browser`

## Common Pitfalls

1. **Non-`on*` subscription name** — `watchDaemonCpu(callback)` fails with `TypeError: callback is not a function` because the framework treats it as a regular RPC call, not an event method. Rename to `onDaemonCpuUsage`.
2. **Unwrapped observable across proxy** — `daemonSubscriptionClient.subscribe()` works locally but the callback cannot be forwarded to another process. Wrap in an `on*` event method at the proxy layer.
3. **Missing cleanup in event handlers** — `setInterval` without a returned cleanup function leaks when clients unsubscribe.

## Troubleshooting

**TypeError: callback is not a function** — Your subscription method name doesn't start with `on`. The framework only auto-serializes callbacks for `on*` methods. Rename your method (e.g., `watchCpu` → `onCpuUpdate`) or wrap observable `subscribe()` in an `on*` method at the proxy layer.

**Subscription events stop after reconnect** — Make sure `registerOrchestratorHandler` uses `bindPort(port, { rebind: true })` so the data-plane channel is re-bound after reconnection.

**Memory leak in utility process** — Event method handlers that create intervals/listeners must return a cleanup function. Without it, resources leak when clients unsubscribe.

## Related Packages

- [`@x-oasis/async-call-rpc`](/packages/async/async-call-rpc/) - Core RPC framework
- [`@x-oasis/async-call-rpc-web`](/packages/async/async-call-rpc-web/) - Web/Worker channel implementations
- [`@x-oasis/async-call-rpc-node`](/packages/async/async-call-rpc-node/) - Node.js channel implementations

## License

MIT
