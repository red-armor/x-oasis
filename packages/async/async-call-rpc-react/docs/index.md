# @x-oasis/async-call-rpc-react

React integration for @x-oasis/async-call-rpc with Connection Orchestrator support.

## Installation

```bash
npm install @x-oasis/async-call-rpc-react
```

## Features

- **React Query Integration**: Type-safe hooks (`useQuery`, `useMutation`, `useSubscription`) for RPC
- **Connection Orchestrator React Hooks**: Track connection state and manage connections in React
- **Context Provider**: `OrchestratorProvider` for sharing orchestrator instance across components
- **Full TypeScript Support**: Complete type definitions

## Quick Links

- [React Query Integration](#quick-start) - Type-safe RPC hooks
- [Connection Orchestrator React](/packages/async/async-call-rpc-react/orchestrator) - Connection state management
- [Examples](./EXAMPLES.md) - Complete working examples

## Quick Start

### React Query Hooks

```tsx
import { createRPCReact } from '@x-oasis/async-call-rpc-react';

const fileRPC = createRPCReact<FileService>(client);

function FileViewer({ path }: { path: string }) {
  const { data, isLoading } = fileRPC.useQuery('readFile', [path]);
  const writeMutation = fileRPC.useMutation('writeFile');

  return <pre>{data}</pre>;
}
```

### Connection Orchestrator Hooks

```tsx
import {
  OrchestratorProvider,
  useConnectionState,
} from '@x-oasis/async-call-rpc-react';
import { ElectronConnectionOrchestrator } from '@x-oasis/async-call-rpc-electron';

const orchestrator = new ElectronConnectionOrchestrator();

function App() {
  return (
    <OrchestratorProvider orchestrator={orchestrator}>
      <ConnectionStatus connectionId="main--worker" />
    </OrchestratorProvider>
  );
}

function ConnectionStatus({ connectionId }: { connectionId: string }) {
  const { orchestrator } = useOrchestrator();
  const connection = useConnectionState(orchestrator, connectionId);

  return (
    <div>
      {connection?.isReady ? '✅ Connected' : `⏳ ${connection?.state}`}
    </div>
  );
}
```

## Documentation

- [Connection Orchestrator React Integration](/packages/async/async-call-rpc-react/orchestrator)
- [Examples and Usage](./EXAMPLES.md)
- [API Reference](https://github.com/red-armor/x-oasis/tree/main/packages/async/async-call-rpc-react/src)

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
import {} from /* types */ '@x-oasis/async-call-rpc-react';
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
