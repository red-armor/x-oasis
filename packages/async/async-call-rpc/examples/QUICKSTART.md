# Quick Start Guide

3 complete Vite + React examples for `@x-oasis/async-call-rpc`.

## 30-Second Setup

### Example 1: Web Worker (No Server Needed)

```bash
cd react-worker-example
pnpm install
pnpm dev
# Open http://localhost:5173
```

Click "Fibonacci" or "Is Prime?" — computation runs in background worker.

---

### Example 2: WebSocket (Requires Server)

```bash
# Terminal 1: Start server
cd ../
npx tsx ../node.websocket.server.ts

# Terminal 2: Start app
cd react-websocket-example
pnpm install
pnpm dev
# Open http://localhost:5174
```

Echo messages to server, fetch time/user data, watch real-time status updates.

---

### Example 3: Full App (Multiple Patterns)

```bash
# Terminal 1: Start server
npx tsx ../node.websocket.server.ts

# Terminal 2: Start app
cd react-full-app
pnpm install
pnpm dev
# Open http://localhost:5175
```

3 tabs: Tasks (WebSocket), Compute (Worker), Status (Real-time events).

---

## What You'll Learn

| Example | Pattern | Use Case |
|---------|---------|----------|
| **Worker** | Async function calls | Background processing |
| **WebSocket** | Request/response + events | Backend communication |
| **Full App** | Both patterns combined | Real-world apps |

---

## Key Code Patterns

### Create Worker Proxy

```tsx
const worker = new Worker(new URL('./worker.ts', import.meta.url), {
  type: 'module',
})
const channel = new WorkerChannel(worker)
const proxy = clientHost
  .registerClient('compute', { channel })
  .createProxy<ComputeService>()

const result = await proxy.fibonacci(35)
```

### Connect to WebSocket

```tsx
const ws = new WebSocket('ws://localhost:3456')
const channel = new WebSocketChannel(ws)
const api = clientHost
  .registerClient('api', { channel })
  .createProxy<ApiService>()

const message = await api.echo('hello')
```

### Subscribe to Events

```tsx
const unsub = proxy.onStatusChanged((status) => {
  console.log('Status changed:', status)
})

// Cleanup
unsub.unsubscribe()
```

---

## Project Structure

Each project is a standalone Vite + React app:

```
project/
├── src/
│   ├── App.tsx           # Main component
│   ├── App.css           # Styles
│   ├── main.tsx          # Entry point
│   ├── worker.ts         # Web Worker
│   └── components/       # Sub-components
├── index.html
├── package.json
├── vite.config.ts
└── tsconfig.json
```

---

## Development Commands

```bash
# Start dev server
pnpm dev

# Build for production
pnpm build

# Preview production build
pnpm preview

# Type check
pnpm type-check
```

---

## Common Issues

### WebSocket Connection Fails

Make sure server is running:

```bash
npx tsx ../node.websocket.server.ts
```

Should see: "Server is listening on port 3456"

### Worker Won't Load

Check Worker URL uses `import.meta.url`:

```tsx
// ✅ Correct
new URL('./worker.ts', import.meta.url)

// ❌ Wrong
'./worker.ts'
```

### TypeScript Errors

Run type check:

```bash
pnpm type-check
```

Check `tsconfig.json` has DOM types.

---

## Next Steps

1. ✅ Run the Worker example (no setup needed)
2. ✅ Start server and try WebSocket example
3. ✅ Explore Full App with both patterns
4. ✅ Read [README.md](./README.md) for detailed docs
5. ✅ Check main [README](../README.md) for full API

---

## Tips

- **Worker example is fastest** — no server, just run it
- **WebSocket example needs server** — start in separate terminal
- **Full app combines both** — best for learning integration
- **Open DevTools Network tab** — watch RPC messages
- **All examples are editable** — play with the code!

---

**Ready to go?** Pick an example above and start hacking! 🚀
