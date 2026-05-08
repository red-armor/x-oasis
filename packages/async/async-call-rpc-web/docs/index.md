# @x-oasis/async-call-rpc-web

RPC channel implementations and Connection Orchestrator for web browsers.

## Installation

```bash
npm install @x-oasis/async-call-rpc-web
```

## Features

- **Web Channels**: Pre-built channels for `MessagePort`, `WebSocket`, and `Web Workers`
- **Connection Orchestrator**: Automated direct MessagePort connection management between workers and iframes
- **Full TypeScript Support**: Complete type definitions for all APIs
- **Zero External Dependencies**: Self-contained package

## Quick Links

- [Connection Orchestrator](/packages/async/async-call-rpc-web/orchestrator) - Automated port connection management
- [API Reference](https://github.com/red-armor/x-oasis/tree/main/packages/async/async-call-rpc-web/src)
- [Examples](https://github.com/red-armor/x-oasis/tree/main/packages/async/async-call-rpc-web/examples)

## Quick Start

### MessagePort Channel

```typescript
import { RPCMessageChannel } from '@x-oasis/async-call-rpc-web';

const { port1, port2 } = new MessageChannel();
const channel = new RPCMessageChannel({ port: port1 });
```

### Web Worker Channel

```typescript
import { WorkerChannel } from '@x-oasis/async-call-rpc-web';

const worker = new Worker('./worker.js');
const channel = new WorkerChannel({ worker });
```

### Connection Orchestrator

```typescript
import { WebConnectionOrchestrator } from '@x-oasis/async-call-rpc-web';

const orchestrator = new WebConnectionOrchestrator();
orchestrator.registerParticipant('worker-a', channelA, 'worker');
orchestrator.registerParticipant('worker-b', channelB, 'worker');

await orchestrator.connect('worker-a', 'worker-b');
```

See the [Orchestrator Documentation](/packages/async/async-call-rpc-web/orchestrator) for complete details.

## Key Features

- High performance
- TypeScript support
- No external dependencies
- Well-tested and stable

## API Reference

### Main Exports

See the source code on [GitHub](https://github.com/red-armor/x-oasis/tree/main/packages/async/async-call-rpc-web)

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
import {} from /* types */ '@x-oasis/async-call-rpc-web';
```

## Performance

This package is optimized for:

- Small bundle size
- Fast execution
- Memory efficiency

## Browser Support

- Modern browsers (ES2015+)
- Chrome 60+
- Firefox 55+
- Safari 15.2+
- Edge 79+

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
