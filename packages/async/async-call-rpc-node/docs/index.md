# @x-oasis/async-call-rpc-node

RPC channel implementations and Connection Orchestrator for Node.js.

## Installation

```bash
npm install @x-oasis/async-call-rpc-node
```

## Features

- **Process Channels**: Pre-built channels for `child_process.fork` and `worker_threads`
- **Connection Orchestrator**: Automated direct MessagePort connection management between workers
- **Full TypeScript Support**: Complete type definitions for all APIs
- **Zero External Dependencies**: Self-contained package

## Quick Links

- [Connection Orchestrator](/packages/async/async-call-rpc-node/orchestrator) - Automated port connection management
- [API Reference](https://github.com/red-armor/x-oasis/tree/main/packages/async/async-call-rpc-node/src)
- [Examples](https://github.com/red-armor/x-oasis/tree/main/packages/async/async-call-rpc-node/examples)

## Quick Start

### Process Channel

```typescript
import { NodeProcessChannel } from '@x-oasis/async-call-rpc-node';
import { fork } from 'child_process';

const child = fork('./worker.js');
const channel = new NodeProcessChannel({ process: child });
```

### Worker Thread Channel

```typescript
import { NodeMessagePortChannel } from '@x-oasis/async-call-rpc-node';
import { Worker } from 'worker_threads';

const worker = new Worker('./worker.js');
const channel = new NodeMessagePortChannel({ bindPort: worker });
```

### Connection Orchestrator

```typescript
import { NodeConnectionOrchestrator } from '@x-oasis/async-call-rpc-node';

const orchestrator = new NodeConnectionOrchestrator();
orchestrator.registerParticipant('worker-a', channelA, 'worker');
orchestrator.registerParticipant('worker-b', channelB, 'worker');

await orchestrator.connect('worker-a', 'worker-b');
```

See the [Orchestrator Documentation](/packages/async/async-call-rpc-node/orchestrator) for complete details.

## Key Features

- High performance
- TypeScript support
- No external dependencies
- Well-tested and stable

## API Reference

### Main Exports

See the source code on [GitHub](https://github.com/red-armor/x-oasis/tree/main/packages/async/async-call-rpc-node)

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
import {} from /* types */ '@x-oasis/async-call-rpc-node';
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
