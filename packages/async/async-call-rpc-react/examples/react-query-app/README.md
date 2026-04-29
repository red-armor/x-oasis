# React Query + async-call-rpc Integration Example

This is a fully functional example demonstrating how to use `@x-oasis/async-call-rpc-react` to build type-safe React hooks that integrate with `@tanstack/react-query`.

## Features

- 🚀 Type-safe RPC hooks with React Query
- 🔄 Automatic cache key generation
- 📝 Query and mutation examples
- 🎯 Real WebSocket server implementation
- 💨 Live development with Vite

## Project Structure

```
.
├── src/
│   ├── main.tsx           # React entry point
│   ├── App.tsx            # Main application component
│   ├── server.ts          # Mock RPC server (WebSocket)
│   └── index.css          # Styling
├── index.html             # HTML entry point
├── package.json           # Dependencies
├── vite.config.ts         # Vite configuration
└── tsconfig.json          # TypeScript configuration
```

## Getting Started

### Prerequisites

- Node.js 16+ (or use `pnpm` directly)
- pnpm 9.3.0+

### Installation

From the monorepo root:

```bash
pnpm install
```

Or from this directory:

```bash
pnpm install
```

### Running the Example

The example runs both a WebSocket server and a React dev server:

```bash
# From this directory
pnpm dev

# From monorepo root (may need adjustment based on workspace setup)
cd packages/async/async-call-rpc-react/examples/react-query-app
pnpm dev
```

This will:
1. Start the WebSocket server on `ws://localhost:3456`
2. Start the Vite dev server on `http://localhost:5173`

Open `http://localhost:5173` in your browser to see the app.

## What the Example Shows

### 1. Service Interface Definition

```tsx
type FileService = {
  readFile(path: string): Promise<string>;
  writeFile(path: string, content: string): Promise<void>;
  listFiles(dir: string): Promise<string[]>;
  getFileSize(path: string): Promise<number>;
};
```

### 2. Server Implementation

The `src/server.ts` file implements the `FileService` and exposes it via WebSocket:

```tsx
const fileService: FileService = { /* ... */ };
serverHost.registerServer(channel, fileService, 'file-service');
```

### 3. Client-Side RPC Hooks

Create type-safe React hooks from the service interface:

```tsx
const fileRPC = createRPCReact<FileService>(client);

// In components:
const { data: files } = fileRPC.useQuery('listFiles', ['/src']);
const writeMutation = fileRPC.useMutation('writeFile', { /* ... */ });
```

### 4. React Query Integration

- **useQuery**: Fetch data with automatic caching and deduplication
- **useMutation**: Perform write operations with loading/error states
- **Automatic cache keys**: Based on `[requestPath, method, ...args]`
- **Query invalidation**: After mutations complete

## Example Usage Patterns

### Reading a File

```tsx
const { data: content, isLoading } = fileRPC.useQuery('readFile', [path]);
```

### Updating a File

```tsx
const writeMutation = fileRPC.useMutation('writeFile', {
  onSuccess: () => {
    queryClient.invalidateQueries({
      queryKey: fileRPC.getQueryKey('listFiles', '/src'),
    });
  },
});

writeMutation.mutate([path, 'new content']);
```

### Listing Files

```tsx
const { data: files } = fileRPC.useQuery('listFiles', ['/src']);
```

## Building for Production

```bash
pnpm build
pnpm preview
```

## Troubleshooting

### "Cannot connect to server"

Make sure the WebSocket server is running. Check that:
1. The server process is still running
2. Port 3456 is available
3. No firewall is blocking the connection

### Type errors in TypeScript

Ensure that `src/server.ts` and your service interface stay in sync:
- The service implementation must match the TypeScript interface
- All method names and signatures must be identical

## Next Steps

- Explore subscription support with `useSubscription`
- Add error handling and retry logic
- Implement more complex service methods
- Add authentication to the WebSocket channel

## Related Documentation

- [@x-oasis/async-call-rpc](../../README.md)
- [@tanstack/react-query Documentation](https://tanstack.com/query/latest)
