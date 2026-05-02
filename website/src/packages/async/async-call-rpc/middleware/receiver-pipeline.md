# Receiver Pipeline

The receiver pipeline processes incoming RPC messages from the transport layer. It handles both incoming requests (for the service handler) and responses (for resolving pending client requests).

## Pipeline Stages

```
Channel.on() / Transport event
    ↓
1. normalizeMessageChannelRawMessage  → Extract standard format
    ↓
2. deserialize                         → Decode data
    ↓
3. handleRequest                       → Dispatch to handler
    ↓
4. handleResponse                      → Resolve pending requests
    ↓
Caller or Service Handler
```

## Stage 1: normalizeMessageChannelRawMessage

**File**: `middlewares/normalize.ts`

**Purpose**: Normalize raw transport messages into a standard format.

**Input**: Raw message from transport (varies by transport)

**Output**: Normalized `{ data: any }` object

**Transport Variations**:
```typescript
// MessagePort: MessageEvent
{ data: <serialized message>, ports?: [MessagePort] }

// WebSocket: Message or Buffer
<serialized message> (string or ArrayBuffer)

// child_process.fork: Any data
<any data passed to process.send()>

// Electron IPC: IpcMainEvent or IpcRendererEvent
{ reply: () => {}, sender: {}, ... }
```

**Normalization**:
```typescript
// Different inputs
const msgPortEvent = { data: '{"seqId":"key_0",...}' };
const wsBuffer = Buffer.from('{"seqId":"key_0",...}');
const childMessage = { seqId: 'key_0', ... };

// All normalized to
{ data: '{"seqId":"key_0",...}' }
{ data: <same buffer/string> }
{ data: { seqId: 'key_0', ... } }
```

**Key Responsibilities**:
- Extract message data from transport wrapper
- Preserve message ports/transfer handles
- Convert to standard MessageEvent-like format
- Handle transport-specific quirks

## Stage 2: deserialize

**File**: `middlewares/buffer.ts`

**Purpose**: Decode serialized data using configured buffer format.

**Input**: Normalized message with serialized data

**Output**: Decoded JavaScript object

**Default Behavior** (JSON):
```typescript
// Input
{ data: '{"seqId":"key_0","requestPath":"math","methodName":"add","args":[2,3]}' }

// Output
{
  seqId: "key_0",
  requestPath: "math",
  methodName: "add",
  args: [2, 3]
}
```

**Custom Deserialization**:
```typescript
// Use different format
const channel = new MessageChannel({
  serializationFormat: 'msgpack',
  readBuffer: new MsgPackReadBuffer(),
});
```

**Decompression Example**:
```typescript
class CompressedReadBuffer extends ReadBaseBuffer {
  decode(data: ArrayBuffer) {
    // Decompress first
    const decompressed = zlib.decompress(data);
    // Then parse JSON
    return JSON.parse(decompressed);
  }
}
```

## Stage 3: handleRequest

**File**: `middlewares/handleRequest.ts`

**Purpose**: Identify and dispatch incoming RPC requests to service handlers.

**Input**: Deserialized message object

**Output**: Response data or void

**Request Detection**:
The middleware checks if the message is a request (has `requestPath` and `methodName`):

```typescript
if (message.requestPath && message.methodName) {
  // It's a request - dispatch to handler
} else {
  // It's a response - pass to next middleware
}
```

**Request Dispatch Flow**:

```
handleRequest receives: {
  seqId: "key_0",
  requestPath: "math",
  methodName: "add",
  args: [2, 3]
}
    ↓
1. Get service handler:
   handler = service[requestPath][methodName]
    ↓
2. Create context (if configured):
   context = await createContext({
     event: message.event,
     requestPath: "math",
     methodName: "add"
   })
    ↓
3. Call handler with context:
   result = await handler.apply(context, args)
    ↓
4. Build response:
   response = {
     seqId: "key_0",
     responseType: "ReturnSuccess",
     data: result
   }
    ↓
5. Send response back via sendReply:
   channel.send(response)
```

**Response Types**:

| Type | Meaning | When Used |
|------|---------|-----------|
| `ReturnSuccess` | Handler succeeded | Normal case |
| `ReturnFail` | Handler threw error | try/catch |
| `PortSuccess` | MessagePort transferred | PostMessage transfer |
| `PortFail` | Port transfer failed | Error in transfer |
| `SubscriptionStopped` | Stream ended | Subscription complete |
| `EventMethodStopped` | Event handler removed | Cleanup |

**Error Handling**:
```typescript
try {
  result = await handler(...args);
  response = {
    seqId,
    responseType: 'ReturnSuccess',
    data: result
  };
} catch (error) {
  response = {
    seqId,
    responseType: 'ReturnFail',
    error: error.message,
    stack: error.stack
  };
}
```

**Event Method Handling**:

For methods that return `Event` or observable-like objects:

```typescript
// Service method returns event
watch(): Event<Data> {
  return new Event();
}

// Client subscribes
const event = await channel.makeRequest('service', 'watch', {
  requestType: 'SubscriptionRequest'
});

event.on('data', (data) => {
  console.log('Got:', data);
});
```

**Key Responsibilities**:
- Identify if message is request vs response
- Resolve handler from service
- Create per-request context
- Execute handler with error handling
- Build appropriate response
- Send response back through channel

## Stage 4: handleResponse

**File**: `middlewares/handleResponse.ts`

**Purpose**: Resolve pending client requests with incoming responses.

**Input**: Response message with `seqId` and `responseType`

**Output**: Void (side effect: resolves Deferred)

**Response Correlation**:
```typescript
// When response arrives with seqId "key_0"
const deferred = channel.ongoingRequests.get("key_0");

if (responseType === 'ReturnSuccess') {
  // Resolve with data
  deferred.resolve(response.data);
} else if (responseType === 'ReturnFail') {
  // Reject with error
  deferred.reject(new Error(response.error));
}

// Remove from tracking
channel.ongoingRequests.delete("key_0");
```

**Subscription Handling**:

For subscriptions, responses may arrive multiple times:

```typescript
// First response: data
{ seqId: "key_1", responseType: "SubscriptionEvent", data: {...} }

// Later response: stream ended
{ seqId: "key_1", responseType: "SubscriptionStopped" }
```

**Error Response Handling**:
```typescript
// Server error
if (response.responseType === 'ReturnFail') {
  const error = new Error(response.error);
  error.stack = response.stack;
  deferred.reject(error);
}
```

**Key Responsibilities**:
- Extract `seqId` from response
- Find corresponding `Deferred` in `ongoingRequests`
- Resolve/reject based on `responseType`
- Handle subscription continuations
- Clean up request tracking

## Message Flow Examples

### Example 1: Simple Request/Response

```
Client                                Server
├─ makeRequest('add', 2, 3)
│  ├─ seqId = "key_0"
│  └─ Creates Deferred
│
├─ send: {
│    seqId: "key_0",
│    requestPath: "math",
│    methodName: "add",
│    args: [2, 3]
│  }
│                                    ├─ receive: {...}
│                                    ├─ deserialize
│                                    ├─ handleRequest
│                                    │  ├─ call handler(2, 3)
│                                    │  └─ get result: 5
│                                    │
│                                    └─ send: {
│                                         seqId: "key_0",
│                                         responseType: "ReturnSuccess",
│                                         data: 5
│                                       }
│
├─ receive: {...}
├─ deserialize
└─ handleResponse
   ├─ find Deferred with "key_0"
   └─ resolve(5)

Final: result = 5
```

### Example 2: Concurrent Requests

```
Client
├─ request 1: makeRequest('method1')
│  └─ seqId = "key_0"
│
├─ request 2: makeRequest('method2')
│  └─ seqId = "key_1"
│
├─ request 3: makeRequest('method3')
│  └─ seqId = "key_2"

// Responses arrive out of order
Server sends: "key_1" response
Server sends: "key_0" response (arrived first!)
Server sends: "key_2" response

Client receives "key_1" first
├─ handleResponse finds Deferred["key_1"]
└─ Resolves it correctly

Client receives "key_0"
├─ handleResponse finds Deferred["key_0"]
└─ Resolves it correctly (even though "key_1" was received first)

Client receives "key_2"
├─ handleResponse finds Deferred["key_2"]
└─ Resolves it correctly
```

## Best Practices

### ✅ Do

- **Create Context**: Use `createContext` for per-request data like auth info
- **Handle Errors**: Wrap handlers in try/catch
- **Clean Up**: Remove subscriptions when done
- **Validate Input**: Check request args match expected types

```typescript
// ✅ Good
export const channel = new MessageChannel({
  createContext: ({ event, requestPath, methodName }) => ({
    authenticated: !!event.source.name,
    timestamp: Date.now(),
    requestId: uuid(),
  })
});
```

### ❌ Don't

- **Block Handler**: Long-running handlers block next request
- **Throw Unserializable Errors**: Error messages may serialize poorly
- **Modify Shared State**: Keep handlers pure or use locks

```typescript
// ❌ Bad - blocks channel
handler() {
  while(true) {
    // infinite loop blocks next requests
  }
}

// ❌ Bad - unserializable error
throw new Error('Database connection error', { cause: dbError });

// ✅ Good - async handler
async handler() {
  await longOperation();
  return result;
}
```

## Common Pitfalls

### Pitfall 1: Service Not Set

The receiver pipeline needs `channel.setService(service)` to work:

```typescript
// ❌ Won't dispatch requests
const channel = new MessageChannel(...);
// Forgot to setService!

// ✅ Correct
const channel = new MessageChannel(...);
const service = new MyService();
channel.setService(service);
```

### Pitfall 2: Handler Throwing Unserializable Error

```typescript
// ❌ Can't serialize Error object
async handler() {
  throw new CustomError({ database: connection });
}

// ✅ Serialize error message
async handler() {
  throw new Error('Database connection failed');
}
```

### Pitfall 3: Context Creating Unserializable Objects

```typescript
// ❌ DOM nodes aren't serializable
createContext: ({ event }) => ({
  element: event.target  // Can't send back to client
})

// ✅ Only serialize primitives
createContext: ({ event }) => ({
  elementId: event.target.id,
  tagName: event.target.tagName
})
```

## Customizing the Pipeline

To add custom middleware to the receiver pipeline:

```typescript
class MyChannel extends AbstractChannelProtocol {
  decorateOnMessageMiddleware(middlewares) {
    return [
      myDecompressionMiddleware,
      ...middlewares,
      myAuditMiddleware,
    ];
  }
}
```

See [Custom Middleware](/packages/async/async-call-rpc/middleware/custom-middleware) for detailed examples.

## Next Steps

- [Sender Pipeline](/packages/async/async-call-rpc/middleware/sender-pipeline)
- [Custom Middleware](/packages/async/async-call-rpc/middleware/custom-middleware)
- [Back to Overview](/packages/async/async-call-rpc/middleware/overview)
