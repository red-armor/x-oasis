# Sender Pipeline

The sender pipeline processes outgoing RPC requests from client to server. It transforms high-level method calls into low-level serialized messages ready for transport.

## Pipeline Stages

```
makeRequest()
    ↓
1. prepareNormalData  → Build request envelope
    ↓
2. updateSeqInfo      → Assign sequence ID
    ↓
3. serialize          → Encode data to bytes
    ↓
4. sendRequest        → Transmit via transport
    ↓
Channel.send()
```

## Stage 1: prepareNormalData

**File**: `middlewares/prepareRequestData.ts`

**Purpose**: Build the request envelope with metadata and arguments.

**Input**: `SendingProps` object or (path, method, ...args) parameters

**Output**: `NormalizedData` with request metadata

```typescript
interface SendingProps {
  requestPath: string;      // Service path
  methodName: string;       // Method name
  args?: any[];             // Method arguments
  isOptionsRequest?: boolean;
  transfer?: MessagePort[];
  requestType?: string;     // Request type (default: PromiseRequest)
}
```

**Transformation**:
```typescript
// Input
channel.makeRequest('math', 'add', 2, 3)

// After prepareNormalData
{
  requestPath: 'math',
  methodName: 'add',
  args: [2, 3],
  requestType: 'PromiseRequest',
  // ... other properties
}
```

**Key Responsibilities**:
- Normalize arguments array
- Set default request type
- Initialize request metadata
- Extract transfer ports if provided

## Stage 2: updateSeqInfo

**File**: `middlewares/updateSeqInfo.ts`

**Purpose**: Assign a unique sequence ID for request/response correlation.

**Input**: Request data

**Output**: Request data with `seqId`

```typescript
// Assigns unique ID combining channel key and sequence number
seqId = `${channel._key}_${channel._seqId}` // e.g., "abc123_42"
```

**Why It's Important**:
- Correlates responses with requests
- Enables concurrent requests on same channel
- Identifies which `Deferred` to resolve when response arrives

**Example Flow**:
```typescript
// First request gets seqId: "key_0"
// Second request gets seqId: "key_1"
// If response for "key_0" arrives out of order, we still know which to resolve

channel.makeRequest('method1') // seqId: "key_0", creates Deferred
channel.makeRequest('method2') // seqId: "key_1", creates Deferred

// Response arrives in reverse order
// handleResponse finds "key_1" in ongoingRequests and resolves it
// Then "key_0" response arrives and resolves correctly
```

## Stage 3: serialize

**File**: `middlewares/buffer.ts`

**Purpose**: Encode request data to bytes using configured buffer format.

**Input**: Request data object

**Output**: Serialized bytes/ArrayBuffer

**Default Behavior** (JSON):
```typescript
// Input
{ seqId: "key_0", requestPath: "math", methodName: "add", args: [2, 3] }

// Output
'{"seqId":"key_0","requestPath":"math","methodName":"add","args":[2,3]}'
```

**Custom Serialization**:
```typescript
const channel = new MessageChannel({
  serializationFormat: 'msgpack', // or 'protobuf', 'cbor', etc.
});

// Or provide custom buffers
const channel = new MessageChannel({
  writeBuffer: new MyCustomBuffer(),
  readBuffer: new MyCustomBuffer(),
});
```

**Buffer Interface**:
```typescript
interface WriteBaseBuffer {
  encode(data: any): ArrayBuffer | Uint8Array | string;
}

interface ReadBaseBuffer {
  decode(data: ArrayBuffer | Uint8Array | string): any;
}
```

## Stage 4: sendRequest

**File**: `middlewares/sendRequest.ts`

**Purpose**: Transmit serialized data through the transport channel.

**Input**: Serialized data

**Output**: Data sent to transport (no return value)

**Key Behaviors**:
1. **Deferred Creation**: Creates a `Deferred` promise to track pending request
2. **Request Tracking**: Stores `Deferred` in `ongoingRequests` map by seqId
3. **Offline Queueing**: If channel is disconnected, queues request instead
4. **Event Method Handling**: For event methods (on*), tracks in `activeEventMethods`

```typescript
// Pseudocode
export const sendRequest = (channel: AbstractChannelProtocol) =>
  (data: SendingProps & { seqId: string }) => {
    if (data.isEventMethod) {
      // Event method - no Deferred needed
      channel.activeEventMethods.add(data.seqId);
    } else {
      // Regular request - create Deferred
      const deferred = new Deferred();
      channel.ongoingRequests.set(data.seqId, deferred);
    }

    if (channel.isConnected()) {
      // Send immediately
      channel.send(data);
    } else {
      // Queue for later
      channel.addPendingSendEntry({
        args: [data],
        middlewares: channel.senderMiddleware,
      });
    }

    return deferred; // Return Deferred to caller for async/await
  };
```

## Offline Request Queueing

When the channel is disconnected:

```typescript
const channel = new NodeProcessChannel({ 
  process: childProcess,
  connected: false 
});

// Request is queued, not sent
const result = channel.makeRequest('service', 'method');

// Later when channel reconnects...
channel.connect();

// All queued requests are automatically sent
// via resumePendingEntry()
```

## Request Types

Different request types affect how the sender pipeline behaves:

### 1. Promise Request (Default)
```typescript
const result = await channel.makeRequest('math', 'add', 2, 3);
// Waits for response, returns value
```

### 2. Subscription Request
```typescript
const subscription = channel.makeRequest('data', 'subscribe', {
  requestType: 'SubscriptionRequest'
});

// Receives multiple events over time
subscription.on('data', (event) => {
  console.log(event);
});
```

### 3. Signal Request (Fire-and-Forget)
```typescript
channel.makeRequest('notifications', 'send', {
  message: 'Hello'
}, {
  requestType: 'SignalRequest'
});
// No response expected
```

## Error Handling

Errors in the sender pipeline:

1. **Validation Error** → Immediate throw
2. **Connection Error** → Queued for retry
3. **Serialization Error** → Reject Deferred
4. **Transport Error** → Handled by channel's error handler

```typescript
// Serialization error example
const result = channel.makeRequest('method', 'call', circularObject);
// Throws: JSON.stringify circular reference error

// Connection error example
const channel = new WebSocketChannel(ws, { connected: false });
const result = channel.makeRequest('method');
// Queued, pending reconnection
// When socket.open fires, request is sent
```

## Best Practices

### ✅ Do

- **Match Request Type**: Use `SubscriptionRequest` for streams, `SignalRequest` for notifications
- **Handle Promises**: Always await or catch promise rejections
- **Clean Up**: Unsubscribe from subscriptions when done
- **Check Connection**: For fire-and-forget, ensure channel is connected first

```typescript
// ✅ Good
const subscription = await channel.makeRequest('data', 'watch', {}, {
  requestType: 'SubscriptionRequest'
});

subscription.on('change', (data) => {
  console.log('Got update:', data);
});

// Cleanup when done
subscription.unsubscribe();
```

### ❌ Don't

- **Ignore Promise Rejections**: Always add error handling
- **Forget to Serialize Custom Types**: Ensure objects are JSON-serializable
- **Send Non-Transferable Objects**: Some objects can't cross postMessage boundary

```typescript
// ❌ Bad - unhandled rejection
channel.makeRequest('method');

// ❌ Bad - non-serializable function
channel.makeRequest('method', (x) => x * 2);

// ❌ Bad - circular reference
const obj = { a: 1 };
obj.self = obj;
channel.makeRequest('method', obj);
```

## Common Pitfalls

### Pitfall 1: Sending Unserializable Data

```typescript
// ❌ Won't work
channel.makeRequest('method', {
  handler: () => { /* function not serializable */ },
  date: new Date(),  // Date not JSON-serializable
});

// ✅ Solution
channel.makeRequest('method', {
  timestamp: new Date().getTime(),
  // Don't send functions
});
```

### Pitfall 2: Forgetting to Await

```typescript
// ❌ Returns Deferred, not actual result
const result = channel.makeRequest('math', 'add', 2, 3);
console.log(result + 1); // Promise + 1 = NaN

// ✅ Correct
const result = await channel.makeRequest('math', 'add', 2, 3);
console.log(result + 1); // 5 + 1 = 6
```

### Pitfall 3: Sending Before Connected

```typescript
// ❌ Queued but may timeout
const channel = new WebSocketChannel(ws, { connected: false });
const result = await channel.makeRequest('method');
// If socket never connects, request never resolves

// ✅ Wait for connection
await new Promise(resolve => ws.onopen = resolve);
const result = await channel.makeRequest('method');
```

## Customizing the Pipeline

To add custom middleware to the sender pipeline:

```typescript
class MyChannel extends AbstractChannelProtocol {
  decorateSendMiddleware(middlewares) {
    return [
      myCompressionMiddleware,
      ...middlewares,
      myMetricsMiddleware,
    ];
  }
}
```

See [Custom Middleware](/packages/async/async-call-rpc/middleware/custom-middleware) for detailed examples.

## Next Steps

- [Receiver Pipeline](/packages/async/async-call-rpc/middleware/receiver-pipeline)
- [Custom Middleware](/packages/async/async-call-rpc/middleware/custom-middleware)
- [Back to Overview](/packages/async/async-call-rpc/middleware/overview)
