# @x-oasis/async-call-rpc-electron

RPC channel implementations and Connection Orchestrator for Electron.

## Installation

```bash
npm install @x-oasis/async-call-rpc-electron
```

## Features

- **IPC Channels**: Pre-built channels for `ipcMain`/`ipcRenderer`, `utilityProcess`, and `MessagePortMain`
- **Connection Orchestrator**: Automated direct MessagePort connection management between Electron processes
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

| Import Path            | Runtime           | Dependencies                                     | Typical Use                                        |
| ---------------------- | ----------------- | ------------------------------------------------ | -------------------------------------------------- |
| `.../browser`          | Renderer          | No Electron APIs                                 | `createPageChannel`, `ContextBridgeChannel`        |
| `.../electron-browser` | Preload           | `ipcRenderer`, `contextBridge` (type-level only) | `createPageBridge`, `IPCRendererChannel`           |
| `.../electron-main`    | Main / Utility    | `ipcMain`, `utilityProcess` runtime APIs         | `IPCMainChannel`, `ElectronConnectionOrchestrator` |
| `...` (root)           | Any (back-compat) | All                                              | Re-exports everything                              |

## Quick Links

- [Connection Orchestrator](/packages/async/async-call-rpc-electron/orchestrator) - Automated port connection management
- [API Reference](https://github.com/red-armor/x-oasis/tree/main/packages/async/async-call-rpc-electron/src)
- [Examples](https://github.com/red-armor/x-oasis/tree/main/packages/async/async-call-rpc-electron/examples)

## Quick Start

### Basic IPC Channel

```typescript
import {
  IPCMainChannel,
  IPCRendererChannel,
} from '@x-oasis/async-call-rpc-electron';

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
import {
  ElectronConnectionOrchestrator,
  registerOrchestratorHandler,
} from '@x-oasis/async-call-rpc-electron';

const orchestrator = new ElectronConnectionOrchestrator();
orchestrator.registerParticipant('renderer', ipcChannel, 'renderer');
orchestrator.registerParticipant('utility', utilityChannel, 'utility');

await orchestrator.connect('renderer', 'utility');
```

See the [Orchestrator Documentation](/packages/async/async-call-rpc-electron/orchestrator) for complete details.

## Usage Examples

### Basic Example

```typescript
// See package documentation for detailed examples
```

### Advanced Usage

```typescript
// Advanced patterns and use cases
```

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

- Use according to documentation
- Check types before use
- Handle edge cases

❌ **Don't:**

- Misuse the API
- Ignore error handling
- Forget null checks

## Common Pitfalls

1. **Pitfall** - Description and solution
2. **Pitfall** - Description and solution

## Troubleshooting

**Problem**: Issue description

**Solution**: How to fix it

## Related Packages

- Other packages in [async](/packages/async/)
- Similar functionality in other categories

## See Also

- [Package Category](/packages/async/)
- [All Packages](/packages/)
- [GitHub Issues](https://github.com/red-armor/x-oasis/issues)
- [Discussions](https://github.com/red-armor/x-oasis/discussions)

## License

MIT
