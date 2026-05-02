# Custom Middleware

Creating custom middleware allows you to extend the RPC framework with cross-cutting concerns like logging, encryption, compression, rate limiting, and more.

## Middleware Basics

### Middleware Factory Pattern

All middleware in async-call-rpc follows a factory pattern:

```typescript
export const myMiddleware = 
  (channel: AbstractChannelProtocol) =>  // Receives channel
  (data: any) =>                          // Receives message data
  {
    // Transform data
    return data;                          // Return transformed data
  };
```

The factory receives the channel instance, giving access to:
- `channel.identifier` / `channel.metadata` - Channel info
- `channel.ongoingRequests` - Pending requests
- `channel.subscriptions` - Active subscriptions
- `channel.isConnected()` - Connection state

### Middleware Types

**Sender Middleware**: Factory receiving the channel, returns a function that processes outgoing requests

```typescript
type SenderMiddleware = (channel: AbstractChannelProtocol) => 
  (data: SendingProps) => any;
```

**Receiver Middleware**: Factory receiving the channel, returns a function that processes incoming messages

```typescript
type ClientMiddleware = (channel: AbstractChannelProtocol) => 
  (data: any) => any;
```

## Common Patterns

### Pattern 1: Logging Middleware

Log all requests and responses:

```typescript
export const loggingMiddleware = (channel: AbstractChannelProtocol) =>
  (data: any) => {
    const label = channel.identifier || 'channel';
    console.log(`[${label}] Message:`, {
      seqId: data.seqId,
      type: data.requestPath ? 'request' : 'response',
      path: data.requestPath,
      method: data.methodName,
      status: data.responseType,
    });
    return data;
  };

// Usage
class MyChannel extends AbstractChannelProtocol {
  decorateOnMessageMiddleware(middlewares) {
    return [loggingMiddleware, ...middlewares];
  }
}
```

### Pattern 2: Error Logging Middleware

Catch and log errors:

```typescript
export const errorLoggingMiddleware = (channel: AbstractChannelProtocol) =>
  (data: any) => {
    // On response, log errors
    if (data.responseType === 'ReturnFail') {
      console.error(`[${channel.identifier}] RPC Error:`, {
        method: data.methodName,
        error: data.error,
        seqId: data.seqId,
      });
    }
    return data;
  };
```

### Pattern 3: Metrics/Telemetry Middleware

Track request latency and throughput:

```typescript
export const metricsMiddleware = (channel: AbstractChannelProtocol) => {
  // Sender: record start time
  return (data: any) => {
    if (data.requestPath) {
      data._startTime = Date.now();
    }
    return data;
  };
};

// For receiver, measure response time
export const metricsReceiverMiddleware = (channel: AbstractChannelProtocol) =>
  (data: any) => {
    if (data._startTime) {
      const latency = Date.now() - data._startTime;
      metrics.recordLatency(data.methodName, latency);
      delete data._startTime; // Clean up
    }
    return data;
  };
```

### Pattern 4: Compression Middleware

Compress large payloads:

```typescript
import zlib from 'zlib';
import { promisify } from 'util';

const gzip = promisify(zlib.gzip);
const gunzip = promisify(zlib.gunzip);

// Sender: compress data
export const compressionMiddleware = (channel: AbstractChannelProtocol) =>
  async (data: any) => {
    // Only compress if has args
    if (data.args && data.args.length > 0) {
      const serialized = JSON.stringify(data.args);
      const compressed = await gzip(serialized);
      
      // Store compression info
      return {
        ...data,
        _compressed: true,
        _argsLength: data.args.length,
        args: [compressed], // Wrapped in array
      };
    }
    return data;
  };

// Receiver: decompress data
export const decompressionMiddleware = (channel: AbstractChannelProtocol) =>
  async (data: any) => {
    if (data._compressed && data.args?.[0]) {
      const decompressed = await gunzip(data.args[0]);
      const original = JSON.parse(decompressed.toString());
      
      return {
        ...data,
        args: original,
        _compressed: false,
      };
    }
    return data;
  };
```

### Pattern 5: Encryption Middleware

Encrypt/decrypt sensitive data:

```typescript
import crypto from 'crypto';

const algorithm = 'aes-256-cbc';
const key = crypto.scryptSync('password', 'salt', 32);
const iv = crypto.randomBytes(16);

export const encryptionMiddleware = (channel: AbstractChannelProtocol) =>
  (data: any) => {
    if (data.args) {
      const cipher = crypto.createCipheriv(algorithm, key, iv);
      const encrypted = Buffer.concat([
        cipher.update(JSON.stringify(data.args)),
        cipher.final(),
      ]);

      return {
        ...data,
        args: [encrypted.toString('base64')],
        _iv: iv.toString('base64'),
        _encrypted: true,
      };
    }
    return data;
  };

export const decryptionMiddleware = (channel: AbstractChannelProtocol) =>
  (data: any) => {
    if (data._encrypted && data.args?.[0]) {
      const decipher = crypto.createDecipheriv(
        algorithm,
        key,
        Buffer.from(data._iv, 'base64')
      );
      
      const decrypted = Buffer.concat([
        decipher.update(data.args[0], 'base64'),
        decipher.final(),
      ]);

      return {
        ...data,
        args: JSON.parse(decrypted.toString()),
        _encrypted: false,
      };
    }
    return data;
  };
```

### Pattern 6: Rate Limiting Middleware

Throttle requests to prevent overload:

```typescript
import { debounce } from '@x-oasis/schedule';

export const rateLimitMiddleware = (channel: AbstractChannelProtocol) => {
  const requestCounts = new Map<string, number>();
  const MAX_REQUESTS = 10;
  const WINDOW = 1000; // 1 second

  return (data: any) => {
    const key = `${data.requestPath}:${data.methodName}`;
    const count = requestCounts.get(key) || 0;

    if (count >= MAX_REQUESTS) {
      throw new Error(`Rate limit exceeded for ${key}`);
    }

    requestCounts.set(key, count + 1);

    // Reset count after window
    setTimeout(() => {
      requestCounts.delete(key);
    }, WINDOW);

    return data;
  };
};
```

### Pattern 7: Request Validation Middleware

Validate request structure:

```typescript
export const validationMiddleware = (channel: AbstractChannelProtocol) =>
  (data: any) => {
    // Only validate requests
    if (data.requestPath && data.methodName) {
      if (!Array.isArray(data.args)) {
        throw new Error('Invalid request: args must be array');
      }

      if (data.args.length === 0 && !data.isOptionsRequest) {
        console.warn(`Request ${data.methodName} has no arguments`);
      }

      // Validate no circular references
      try {
        JSON.stringify(data.args);
      } catch (e) {
        throw new Error('Request args contain non-serializable data');
      }
    }

    return data;
  };
```

### Pattern 8: Authentication Middleware

Add auth tokens to requests:

```typescript
export const authMiddleware = (channel: AbstractChannelProtocol) => {
  const token = localStorage.getItem('auth-token');

  return (data: any) => {
    // Add token to outgoing requests
    if (data.requestPath && !data._auth) {
      return {
        ...data,
        _auth: { token },
      };
    }

    // Validate token on incoming requests
    if (data.requestPath && data._auth) {
      const isValid = verifyToken(data._auth.token);
      if (!isValid) {
        throw new Error('Invalid authentication token');
      }
      delete data._auth; // Remove before dispatch
    }

    return data;
  };
};

function verifyToken(token: string): boolean {
  // Token verification logic
  return true;
}
```

## Integration with Channel

### Adding to Sender Pipeline

```typescript
class MyChannel extends AbstractChannelProtocol {
  decorateSendMiddleware(middlewares: SenderMiddleware[]) {
    return [
      loggingMiddleware,
      compressionMiddleware,
      ...middlewares,
      metricsMiddleware,
    ];
  }
}

// Usage
const channel = new MyChannel({
  identifier: 'my-client',
  metadata: { env: 'production' },
});
```

### Adding to Receiver Pipeline

```typescript
class MyChannel extends AbstractChannelProtocol {
  decorateOnMessageMiddleware(middlewares: ClientMiddleware[]) {
    // Decompress before deserialize
    return [
      decompressionMiddleware,
      ...middlewares,
      errorLoggingMiddleware,
      metricsReceiverMiddleware,
    ];
  }
}
```

### Both Pipelines

```typescript
class MyChannel extends AbstractChannelProtocol {
  decorateSendMiddleware(middlewares) {
    return [authMiddleware, compressionMiddleware, ...middlewares];
  }

  decorateOnMessageMiddleware(middlewares) {
    return [decompressionMiddleware, ...middlewares, metricsReceiverMiddleware];
  }
}
```

## Advanced Patterns

### Pattern 9: Context-Aware Middleware

Access channel metadata and context:

```typescript
export const contextMiddleware = (channel: AbstractChannelProtocol) =>
  (data: any) => {
    // Use channel identifier for routing
    data._sourceId = channel.identifier;

    // Use metadata for decision making
    const isProduction = channel.metadata?.env === 'production';
    if (isProduction && data.args?.length > 1000) {
      // Large payload in production - log warning
      console.warn('Large payload detected:', data.args.length);
    }

    return data;
  };
```

### Pattern 10: Middleware Composition

Combine multiple middlewares:

```typescript
const createPipeline = (...middlewares: SenderMiddleware[]) =>
  (channel: AbstractChannelProtocol) =>
  (data: any) => {
    let current = data;
    for (const middleware of middlewares) {
      current = middleware(channel)(current);
    }
    return current;
  };

const combined = createPipeline(
  loggingMiddleware,
  compressionMiddleware,
  authMiddleware,
);

class MyChannel extends AbstractChannelProtocol {
  decorateSendMiddleware(middlewares) {
    return [combined, ...middlewares];
  }
}
```

### Pattern 11: Conditional Middleware

Apply middleware based on conditions:

```typescript
export const conditionalMiddleware = (predicate: (data: any) => boolean) =>
  (middleware: SenderMiddleware) =>
  (channel: AbstractChannelProtocol) =>
  (data: any) => {
    if (predicate(data)) {
      return middleware(channel)(data);
    }
    return data;
  };

// Usage
const largePayloadMiddleware = conditionalMiddleware(
  (data) => JSON.stringify(data).length > 10000
)(compressionMiddleware);

class MyChannel extends AbstractChannelProtocol {
  decorateSendMiddleware(middlewares) {
    return [largePayloadMiddleware, ...middlewares];
  }
}
```

### Pattern 12: Async Middleware

Handle async operations:

```typescript
export const asyncAuthMiddleware = (channel: AbstractChannelProtocol) =>
  async (data: any) => {
    if (data.requestPath) {
      // Async operation: validate token
      const token = channel.metadata?.token;
      const isValid = await validateTokenAsync(token);

      if (!isValid) {
        throw new Error('Token validation failed');
      }
    }

    return data;
  };

async function validateTokenAsync(token: string): Promise<boolean> {
  const response = await fetch('/api/validate-token', {
    method: 'POST',
    body: JSON.stringify({ token }),
  });
  return response.ok;
}
```

## Best Practices

### ✅ Do

- **Keep middleware pure**: No side effects (logging is OK)
- **Return data at end**: Always return the (possibly modified) data
- **Handle errors gracefully**: Throw with descriptive messages
- **Document middleware**: Add JSDoc comments
- **Order carefully**: Compression before serialization, auth before send

```typescript
// ✅ Good - pure middleware
export const myMiddleware = (channel) => (data) => {
  const transformed = {
    ...data,
    processed: true,
  };
  return transformed; // Always return
};
```

### ❌ Don't

- **Modify shared state**: Use copies, not mutations
- **Block forever**: Use timeouts, avoid infinite loops
- **Mix concerns**: One middleware, one responsibility
- **Forget error handling**: Wrap risky operations in try/catch

```typescript
// ❌ Bad - mutates shared state
const config = {};
export const badMiddleware = (channel) => (data) => {
  config.processed = true; // Shared mutation
  data.processed = true;   // Also mutates input
  return data;
};

// ✅ Good - use copies
export const goodMiddleware = (channel) => (data) => ({
  ...data,
  processed: true,
});
```

## Common Pitfalls

### Pitfall 1: Order Matters

```typescript
// ❌ Wrong order - deserialize before decompression
decorateOnMessageMiddleware(middlewares) {
  return [...middlewares, decompressionMiddleware];
}

// ✅ Correct - decompress before deserialize
decorateOnMessageMiddleware(middlewares) {
  return [decompressionMiddleware, ...middlewares];
}
```

### Pitfall 2: Not Returning Data

```typescript
// ❌ Pipeline breaks - nothing returned
export const badMiddleware = (channel) => (data) => {
  console.log(data); // Forgot to return!
};

// ✅ Always return
export const goodMiddleware = (channel) => (data) => {
  console.log(data);
  return data;
};
```

### Pitfall 3: Assuming Async

```typescript
// ❌ Async but middleware is sync
export const badMiddleware = (channel) => async (data) => {
  await someAsyncOp();
  return data; // Returns Promise, not data
};

// ✅ Chain properly or handle promises
export const goodMiddleware = (channel) => (data) => {
  return someAsyncOp().then(() => data);
};
```

## Performance Considerations

### Benchmark Template

```typescript
const channel = new MessageChannel();
const iterations = 10000;

// Warm up
for (let i = 0; i < 100; i++) {
  await channel.makeRequest('method', i);
}

// Benchmark
const start = performance.now();
for (let i = 0; i < iterations; i++) {
  await channel.makeRequest('method', i);
}
const duration = performance.now() - start;
console.log(`${iterations} requests in ${duration}ms`);
console.log(`Average: ${duration / iterations}ms per request`);
```

### Tips

- **Profile first**: Use Chrome DevTools or Node.js profiler
- **Minimize work**: Do only what's necessary in middleware
- **Cache results**: Avoid re-computation
- **Use buffers**: Pre-allocate for compression/encryption
- **Test at scale**: Benchmark with real data sizes

## Next Steps

- [Sender Pipeline](/packages/async/async-call-rpc/middleware/sender-pipeline)
- [Receiver Pipeline](/packages/async/async-call-rpc/middleware/receiver-pipeline)
- [Back to Overview](/packages/async/async-call-rpc/middleware/overview)
