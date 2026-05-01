# async-call-rpc React Examples (Vite + React)

Complete Vite + React projects demonstrating different RPC patterns with `@x-oasis/async-call-rpc`.

## Projects Overview

### 1. **react-worker-example** — Web Worker RPC

CPU-intensive computation in a Web Worker without blocking the UI.

```bash
cd react-worker-example
pnpm install
pnpm dev
# Open http://localhost:5173
```

**Features:**

- Fibonacci and prime number calculation
- Progress tracking
- Non-blocking computation
- Real-time UI updates

**Best for:** Background processing, heavy calculations, data processing

---

### 2. **react-websocket-example** — WebSocket RPC

Real-time client-server communication over WebSocket.

```bash
# Terminal 1: Start WebSocket server
cd ../
npx tsx ../node.websocket.server.ts

# Terminal 2: Start React app
cd react-websocket-example
pnpm install
pnpm dev
# Open http://localhost:5174
```

**Features:**

- Echo messages to server
- Fetch server time
- Fetch user data
- Real-time status updates
- Request/response pattern
- Event subscriptions

**Best for:** Real-time communication, live updates, backend API calls

---

### 3. **react-full-app** — Complete Application

Multi-pattern example combining WebSocket, Web Worker, and state management.

```bash
# Terminal 1: Start WebSocket server
npx tsx ../node.websocket.server.ts

# Terminal 2: Start React app
cd react-full-app
pnpm install
pnpm dev
# Open http://localhost:5175
```

**Features:**

- **Tasks Panel** — WebSocket for task management
- **Compute Panel** — Web Worker for calculations
- **Status Panel** — Real-time event updates
- Tab-based navigation
- Error handling and loading states

**Best for:** Learning full integration of multiple RPC patterns

---

### 4. **react-pingpong-example** — Event Methods (on\* Ping-Pong)

Demonstrates the `on*` event method pattern using a Web Worker. No server needed.

```bash
cd react-pingpong-example
pnpm install
pnpm dev
# Open http://localhost:5176
```

**Features:**

- Single ping/pong request-response
- `onPing()` — continuous event subscription with unsubscribe
- `onHeartbeat()` — periodic heartbeat monitoring
- `onCountdown()` — finite countdown event stream
- Subscribe/unsubscribe lifecycle management

**Best for:** Understanding event method (`on*`) subscription pattern, simple periodic events

---

### 5. **react-streaming-example** — Subscription Streaming

Demonstrates the `client.subscribe()` streaming API over WebSocket with observable-like handlers.

```bash
# Terminal 1: Start WebSocket server
cd react-streaming-example
npx tsx server.ts

# Terminal 2: Start React app
cd react-streaming-example
pnpm install
pnpm dev
# Open http://localhost:5177
```

**Features:**

- **Stock Price Stream** — High-frequency data push with `onData`
- **Server Log Tail** — Finite stream with `onComplete` signal
- **Timer** — Long-running subscription with manual `unsubscribe()`
- Full lifecycle: `onData`, `onError`, `onComplete`
- Multiple concurrent subscriptions

**Best for:** Real-time data streaming, observables, server push with lifecycle management

---

## Common Setup

### 1. Install Dependencies

Each project uses the same dependencies:

```bash
cd <project-directory>
pnpm install
```

### 2. Development Server

```bash
pnpm dev
```

Each project runs on a different port:

- `react-worker-example`: http://localhost:5173
- `react-websocket-example`: http://localhost:5174
- `react-full-app`: http://localhost:5175
- `react-pingpong-example`: http://localhost:5176
- `react-streaming-example`: http://localhost:5177

### 3. Build for Production

```bash
pnpm build
pnpm preview
```

### 4. Type Checking

```bash
pnpm type-check
```

---

## Project Structure

Each project follows a standard Vite + React structure:

```
project/
├── index.html           # HTML entry point
├── package.json         # Dependencies
├── tsconfig.json        # TypeScript config
├── vite.config.ts       # Vite config
├── src/
│   ├── main.tsx         # React entry point
│   ├── App.tsx          # Main component
│   ├── App.css          # Styles
│   ├── index.css        # Global styles
│   ├── components/      # React components
│   └── worker.ts        # Web Worker (if needed)
└── public/              # Static assets
```

---

## RPC Patterns Used

### Pattern 1: Web Worker

Create async proxy and call worker methods:

```tsx
import { WorkerChannel, clientHost } from '@x-oasis/async-call-rpc';

const worker = new Worker(new URL('./worker.ts', import.meta.url), {
  type: 'module',
});
const channel = new WorkerChannel(worker, { name: 'main-thread' });
const proxy = clientHost
  .registerClient('compute', { channel })
  .createProxy<ComputeService>();

const result = await proxy.fibonacci(35);
```

### Pattern 2: WebSocket

Connect to server and call RPC methods:

```tsx
import { WebSocketChannel, clientHost } from '@x-oasis/async-call-rpc';

const ws = new WebSocket('ws://localhost:3456');
const channel = new WebSocketChannel(ws, { name: 'client' });
const api = clientHost
  .registerClient('api', { channel })
  .createProxy<ApiService>();

const result = await api.echo('hello');
```

### Pattern 3: Event Subscription

Listen to real-time updates:

```tsx
const unsub = proxy.onStatusChanged((status) => {
  console.log('Status:', status);
});

// Cleanup
unsub.unsubscribe();
```

---

## React Hooks Integration

### useEffect with Cleanup

```tsx
useEffect(() => {
  const ws = new WebSocket(url);
  const channel = new WebSocketChannel(ws);
  const proxy = createProxy(channel);

  return () => {
    proxy.unsubscribe?.();
    ws.close();
  };
}, []);
```

### useState for State Management

```tsx
const [connected, setConnected] = useState(false);
const [result, setResult] = useState<T | null>(null);
const [loading, setLoading] = useState(false);
const [error, setError] = useState<string | null>(null);
```

### useRef for Persistent Objects

```tsx
const proxyRef = useRef<ApiService | null>(null);

useEffect(() => {
  proxyRef.current = createProxy(channel);
  return () => proxyRef.current?.cleanup();
}, []);
```

---

## Error Handling

```tsx
import { RPCError, JSONRPCErrorCode } from '@x-oasis/async-call-rpc';

try {
  await proxy.someMethod();
} catch (err) {
  if (err instanceof RPCError) {
    if (err.code === JSONRPCErrorCode.MethodNotFound) {
      // Handle specific error
    }
  }
  setError(err instanceof Error ? err.message : 'Unknown error');
}
```

---

## Best Practices

### ✅ Do's

- **Initialize in useEffect** — Create proxies in effect hooks
- **Cleanup on unmount** — Unsubscribe and close connections
- **Store in useRef** — Keep proxies stable across renders
- **Handle errors** — Always wrap calls in try-catch
- **Show loading states** — Provide UI feedback
- **Type your services** — Use TypeScript interfaces

### ❌ Don'ts

- Don't create new proxies on every render
- Don't forget to unsubscribe from events
- Don't ignore connection errors
- Don't block the UI with long-running operations
- Don't store proxy in state
- Don't mix multiple RPC libraries

---

## Testing WebSocket

To test WebSocket examples locally:

1. **Start the test server:**

```bash
cd ../
npx tsx ../node.websocket.server.ts
```

This provides:

- `echo(message)` — Echo messages back
- `now()` — Return current server time
- `getCurrentUser()` — Return mock user data
- `onServerStatusChanged()` — Real-time status updates

2. **Connect from React app:**

The app automatically connects to `ws://localhost:3456`

3. **Monitor in browser DevTools:**

Open DevTools → Network → WS to see messages

---

## Environment Variables

Create `.env.local` to override defaults:

```env
# react-websocket-example
VITE_WS_URL=ws://localhost:3456
```

---

## Performance Tips

1. **Memoize callbacks** — Use `useCallback` for event handlers
2. **Debounce rapid calls** — Prevent server overload
3. **Batch requests** — Group multiple calls
4. **Cancel pending requests** — On unmount or navigation
5. **Cache results** — Avoid redundant calls

---

## Troubleshooting

### WebSocket Connection Fails

Check that the server is running:

```bash
npx tsx ../node.websocket.server.ts
```

Look for "Server is listening on port 3456"

### Worker Loading Issues

Ensure Worker path uses `import.meta.url`:

```tsx
// ✅ Correct
new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });

// ❌ Wrong
new Worker('./worker.ts');
```

### TypeScript Errors

Make sure `tsconfig.json` includes DOM types:

```json
{
  "compilerOptions": {
    "lib": ["ES2020", "DOM", "DOM.Iterable"]
  }
}
```

---

## Next Steps

1. **Start with `react-worker-example`** — No server needed
2. **Try `react-websocket-example`** — Add server communication
3. **Explore `react-full-app`** — Combine multiple patterns
4. **Try `react-pingpong-example`** — Learn event method (`on*`) subscription
5. **Try `react-streaming-example`** — Learn `subscribe()` streaming API
6. **Read main README** — Full API documentation
7. **Check async-call-rpc package** — Implementation details

---

## Resources

- [Main async-call-rpc README](../README.md)
- [MDN Web Workers](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API)
- [MDN WebSocket](https://developer.mozilla.org/en-US/docs/Web/API/WebSocket)
- [Vite Documentation](https://vitejs.dev/)
- [React Documentation](https://react.dev/)

---

## License

ISC

---

**Questions?** Check the examples or the main package README for more details.
