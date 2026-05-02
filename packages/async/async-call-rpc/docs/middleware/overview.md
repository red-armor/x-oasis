# Middleware Overview

The middleware system in `async-call-rpc` is the core mechanism for processing RPC requests and responses. It provides a pluggable pipeline similar to Express.js middleware, allowing you to add custom processing logic at various stages of communication.

## What is Middleware?

Middleware functions are chained handlers that process data flowing through the RPC pipeline. Each middleware:

1. Receives the current data/state
2. Performs some transformation or operation
3. Passes the result to the next middleware
4. Can short-circuit the pipeline (e.g., return early on error)

## Middleware Pipeline

The RPC framework uses **two independent pipelines**:

```
╔════════════════════════════════════════════════════════════════════════════╗
║                          Bidirectional RPC Flow                            ║
╚════════════════════════════════════════════════════════════════════════════╝

Caller (Client)                                    Callee (Server)
─────────────────────────────────                  ─────────────────────────
  makeRequest(path, method, ...args)
       │
       ▼
   ┌──────────────────────────┐
   │  SENDER PIPELINE         │  ← Outgoing requests
   │  1. prepareNormalData    │     ├─ Build envelope
   │  2. updateSeqInfo        │     ├─ Assign ID
   │  3. serialize            │     ├─ Encode data
   │  4. sendRequest          │     └─ Transmit
   └──────────────────────────┘
       │                              │
       │  ← transport layer ─→        │
       │  (send/on via channel)       │
       │                              ▼
       │                        ┌──────────────────────────┐
       │                        │  RECEIVER PIPELINE       │  ← Incoming requests
       │                        │  1. normalizeRawMessage  │     ├─ Extract message
       │                        │  2. deserialize          │     ├─ Decode data
       │                        │  3. handleRequest        │     ├─ Dispatch handler
       │                        │  4. handleResponse       │     └─ Resolve deferred
       │                        └──────────────────────────┘
       │                              │
       │  ← transport layer ─→        │
       │  (return response)           │
       │                              │
       ▼
   ┌──────────────────────────┐
   │  RECEIVER PIPELINE       │  ← Incoming responses
   │  1. normalizeRawMessage  │     ├─ Extract message
   │  2. deserialize          │     ├─ Decode data
   │  3. handleRequest        │     ├─ Dispatch (if nested)
   │  4. handleResponse       │     └─ Resolve deferred
   └──────────────────────────┘
```

## Built-in Middleware

### Sender Pipeline (Client → Server)

The sender pipeline processes outgoing RPC requests:

| Middleware | File | Responsibility |
|-----------|------|-----------------|
| `prepareNormalData` | `middlewares/prepareRequestData.ts` | Build request envelope with path, method, args |
| `updateSeqInfo` | `middlewares/updateSeqInfo.ts` | Assign unique sequence ID for request correlation |
| `serialize` | `middlewares/buffer.ts` | Encode request data using configured buffer format |
| `sendRequest` | `middlewares/sendRequest.ts` | Transmit serialized data through channel |

### Receiver Pipeline (Server → Client)

The receiver pipeline processes incoming RPC messages (both requests and responses):

| Middleware | File | Responsibility |
|-----------|------|-----------------|
| `normalizeMessageChannelRawMessage` | `middlewares/normalize.ts` | Normalize raw message from transport into standard format |
| `deserialize` | `middlewares/buffer.ts` | Decode message data using configured buffer format |
| `handleRequest` | `middlewares/handleRequest.ts` | Dispatch incoming requests to service handler |
| `handleResponse` | `middlewares/handleResponse.ts` | Resolve pending requests with responses |

## Middleware Lifecycle

### Sender Middleware Lifecycle

```typescript
enum SendMiddlewareLifecycle {
  Initial = 0,        // Request created
  Prepare = 10,       // Data preparation
  Transform = 20,     // Data transformation
  DataOperation = 30, // Core operations (serialize, send)
  Send = 40,          // Final transmission
  Aborted = 100,      // Request aborted
}
```

### Creating Middleware

Middleware is created as a factory function pattern:

```typescript
// Factory function receives the channel
export const myMiddleware = (channel: AbstractChannelProtocol) => 
  // Middleware function receives the current data
  (data: any) => {
    // Process and return
    return data;
  };
```

## Customizing the Pipeline

### Adding Custom Middleware

Override the decoration methods in your channel subclass:

```typescript
class MyChannel extends AbstractChannelProtocol {
  decorateSendMiddleware(middlewares: SenderMiddleware[]) {
    return [
      ...middlewares.slice(0, 2),      // Keep first two
      myCustomMiddleware,               // Add custom
      ...middlewares.slice(2),         // Keep rest
    ];
  }

  decorateOnMessageMiddleware(middlewares: ClientMiddleware[]) {
    return [
      myLoggingMiddleware,              // Add logging
      ...middlewares,
    ];
  }
}
```

### Common Use Cases

- **Logging**: Log all requests/responses
- **Encryption**: Encrypt/decrypt payloads
- **Compression**: Compress large messages
- **Rate Limiting**: Throttle requests
- **Metrics**: Track latency and throughput
- **Auth**: Add authentication headers
- **Validation**: Validate request/response shapes

See [Custom Middleware](/packages/async/async-call-rpc/middleware/custom-middleware) for detailed examples.

## Key Concepts

### Deferred Pattern

Pending requests are tracked using `Deferred` objects - promise-like objects that can be resolved later when the response arrives.

```typescript
// In ongoingRequests map
const deferred = new Deferred();
ongoingRequests.set(seqId, deferred);

// Later when response arrives
handleResponse() {
  const deferred = ongoingRequests.get(seqId);
  deferred.resolve(responseData);
}
```

### Sequence ID Correlation

Each request gets a unique `seqId` (sequence ID) that's echoed in the response, allowing the client to correlate responses with requests even with concurrent calls:

```typescript
// Request: seqId = "abc123_0"
{ seqId: "abc123_0", requestPath: "math", methodName: "add", args: [2, 3] }

// Response: same seqId
{ seqId: "abc123_0", responseType: "ReturnSuccess", data: 5 }
```

### Serialization Formats

The framework supports pluggable serialization:

```typescript
// Default: JSON
const channel = new MessageChannel({ 
  serializationFormat: 'json' 
});

// Or use custom
const channel = new MessageChannel({
  readBuffer: myCustomReadBuffer,
  writeBuffer: myCustomWriteBuffer,
});
```

## Next Steps

- [Sender Pipeline Deep Dive](/packages/async/async-call-rpc/middleware/sender-pipeline)
- [Receiver Pipeline Deep Dive](/packages/async/async-call-rpc/middleware/receiver-pipeline)
- [Writing Custom Middleware](/packages/async/async-call-rpc/middleware/custom-middleware)
