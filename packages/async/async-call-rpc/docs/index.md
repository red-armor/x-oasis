# async-call-rpc

Bidirectional RPC protocol framework with pluggable middleware support for various transport layers.

## Overview

`async-call-rpc` is a comprehensive RPC (Remote Procedure Call) framework that provides:

- **Protocol Abstraction**: Transport-agnostic RPC protocol that works with MessagePort, WebSocket, IPC, child_process, Electron, and more
- **Middleware Pipeline**: Pluggable request/response middleware similar to Express.js
- **Bidirectional Communication**: Full duplex communication with automatic request/response correlation
- **Subscription Support**: Built-in support for streaming subscriptions and event-based communication
- **Type Safety**: Full TypeScript support with comprehensive type definitions
- **Context Injection**: Per-request context injection similar to tRPC's `createContext`
- **Offline Queueing**: Automatic request queuing and replay on reconnection

## Installation

```bash
npm install @x-oasis/async-call-rpc
```

## Sub-path Exports

| Import Path                            | Contents                                                                                                                                                                 |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `@x-oasis/async-call-rpc`              | Re-exports everything (backward compatible)                                                                                                                              |
| `@x-oasis/async-call-rpc/core`         | Core RPC classes (`ProxyRPCClient`, `RPCService`, `RPCServiceHost`, `AbstractChannelProtocol`, middlewares, utils)                                                       |
| `@x-oasis/async-call-rpc/orchestrator` | Orchestrator types and constants (`ORCHESTRATOR_SERVICE_PATH`, `ORCHESTRATOR_PROXY_SERVICE_PATH`, `ActivationContext`, reconnect policies, `BaseConnectionOrchestrator`) |

For optimal tree-shaking, prefer the specific sub-path over the root import.

## Quick Start

### Basic Example

```typescript
import { RPCService } from '@x-oasis/async-call-rpc/core';
import { MessageChannel } from '@x-oasis/async-call-rpc-web/core';

// Define your RPC service
class Calculator {
  add(a: number, b: number): number {
    return a + b;
  }

  multiply(a: number, b: number): number {
    return a * b;
  }
}

// Create channel and service (client side)
const { port1, port2 } = new MessageChannel();
const channel = new MessageChannel({ port: port1 });
const rpc = new RPCService(Calculator, { channel });

// Use the RPC client
const result = await rpc.add(2, 3); // 5
```

## Key Features

### Transport Agnostic

Works seamlessly with multiple transport mechanisms:

- **MessagePort** (Web API)
- **WebSocket** (Browser & Node.js)
- **Worker** (Browser Workers)
- **child_process** (Node.js)
- **IPC** (Electron)
- And more...

### Middleware Architecture

Extensible middleware pipeline for handling:

- Serialization/deserialization
- Logging and debugging
- Request transformation
- Compression
- Encryption
- Custom business logic

See the [Middleware Documentation](/packages/async/async-call-rpc/middleware/overview) for details.

### Request Types

Support for multiple communication patterns:

- **Promise Request**: Single request/response
- **Subscription**: Streaming responses
- **Signal**: Fire-and-forget messaging
- **Event Methods**: Ping-pong style event handlers

## Built-in Transports

| Class                            | Transport                | Environment         |
| -------------------------------- | ------------------------ | ------------------- |
| `RPCMessageChannel`              | MessagePort              | Browser / Worker    |
| `WebSocketChannel`               | WebSocket                | Browser / Node.js   |
| `WorkerChannel`                  | Worker.postMessage       | Browser             |
| `NodeProcessChannel`             | child_process.fork       | Node.js             |
| `ElectronUtilityProcessChannel`  | Electron UtilityProcess  | Electron (main)     |
| `IPCMainChannel`                 | Electron ipcMain         | Electron (main)     |
| `IPCRendererChannel`             | Electron ipcRenderer     | Electron (renderer) |
| `ElectronMessagePortMainChannel` | Electron MessagePortMain | Electron (main)     |

## Architecture

The framework uses a two-stage pipeline:

**Sender Pipeline** (Client → Server)

1. `prepareNormalData` - Build request envelope
2. `updateSeqInfo` - Assign sequence ID
3. `serialize` - Encode data
4. `sendRequest` - Transmit via transport

**Receiver Pipeline** (Server → Client)

1. `normalizeRawMessage` - Extract raw message
2. `deserialize` - Decode data
3. `handleRequest` - Dispatch to service handler
4. `handleResponse` - Resolve pending requests

See [Middleware Documentation](/packages/async/async-call-rpc/middleware/overview) for a detailed architecture diagram.

## Detailed Documentation

- [Middleware Guide](/packages/async/async-call-rpc/middleware/overview) - Complete middleware system documentation
- [Sender Pipeline](/packages/async/async-call-rpc/middleware/sender-pipeline) - Deep dive into outgoing requests
- [Receiver Pipeline](/packages/async/async-call-rpc/middleware/receiver-pipeline) - Deep dive into incoming responses
- [Custom Middleware](/packages/async/async-call-rpc/middleware/custom-middleware) - Write your own middleware
- [Examples](/packages/async/async-call-rpc/examples) - Real-world usage examples
- [API Reference](/packages/async/async-call-rpc/api) - Complete API documentation

## Configuration

### Basic Configuration

```typescript
const channel = new MessageChannel({
  identifier: 'my-channel',
  description: 'client→server',
  serializationFormat: 'json', // default
});
```

### With Metadata

```typescript
const channel = new MessageChannel({
  identifier: 'rpc-1',
  metadata: {
    processName: 'main',
    environment: 'production',
    version: '1.0.0',
  },
});
```

### With Custom Serialization

```typescript
const channel = new MessageChannel({
  serializationFormat: 'msgpack',
  readBuffer: new MsgPackBuffer(),
  writeBuffer: new MsgPackBuffer(),
});
```

### With Context Injection

```typescript
const channel = new MessageChannel({
  createContext: ({ event, requestPath, methodName }) => ({
    userId: event.sender?.id,
    timestamp: Date.now(),
    method: methodName,
  }),
});
```

## Best Practices

✅ **Do:**

- Validate input on both sides
- Handle errors gracefully
- Clean up subscriptions
- Use appropriate request types
- Monitor response times

❌ **Don't:**

- Send non-serializable data
- Ignore promise rejections
- Leave subscriptions active
- Create circular references
- Forget to close channels

## Common Pitfalls

1. **Sending unserializable data** - Only JSON-serializable objects
2. **Forgetting to await** - RPC calls return promises
3. **Memory leaks** - Always unsubscribe when done
4. **Circular references** - Avoid self-referencing objects
5. **Protocol mismatches** - Ensure both sides match

## Browser Support

- Modern browsers (ES2015+)
- Node.js 12.0+
- Electron 5.0+

## License

MIT

## See Also

- [All Packages](/packages/async/)
- [Skills](/skills/)
- [GitHub Issues](https://github.com/red-armor/x-oasis/issues)
- [Discussions](https://github.com/red-armor/x-oasis/discussions)
