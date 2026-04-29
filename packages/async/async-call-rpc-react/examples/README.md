# Examples

This directory contains example applications demonstrating how to use `@x-oasis/async-call-rpc-react`.

## Available Examples

### React Query + async-call-rpc Integration

**Location**: `./react-query-app/`

A fully functional example application showing how to use `createRPCReact()` to build type-safe React hooks with React Query integration.

#### Features

- ✅ Type-safe RPC hooks (`useQuery`, `useMutation`)
- ✅ React Query caching and deduplication
- ✅ WebSocket server implementation
- ✅ Vite development server
- ✅ Full TypeScript support
- ✅ Styled UI with Tailwind-inspired CSS

#### Quick Start

```bash
cd react-query-app
pnpm install
pnpm dev
```

Then open [http://localhost:5173](http://localhost:5173) in your browser.

#### Project Structure

```
react-query-app/
├── src/
│   ├── main.tsx        # React entry point
│   ├── App.tsx         # Main application
│   ├── server.ts       # Mock WebSocket server
│   └── index.css       # Styling
├── index.html          # HTML entry point
├── package.json        # Dependencies and scripts
├── vite.config.ts      # Vite configuration
└── tsconfig.json       # TypeScript configuration
```

#### What You'll Learn

1. **Service Interface Definition**: How to define a TypeScript interface for your RPC service
2. **Server Implementation**: Creating a WebSocket server with the async-call-rpc framework
3. **Client Setup**: Connecting to the server and creating RPC hooks
4. **Component Usage**: Using `useQuery` and `useMutation` hooks in React components
5. **Query Management**: Cache invalidation and data refresh patterns
6. **Error Handling**: Handling errors from remote calls

#### Key Concepts

- **Type Safety**: Full TypeScript support for RPC methods and arguments
- **Automatic Cache Keys**: Query keys are automatically derived from method name and arguments
- **Query Deduplication**: Identical queries are automatically deduplicated by React Query
- **Mutation Callbacks**: `onSuccess` and `onError` hooks for handling side effects
- **Query Invalidation**: Refresh data after mutations

#### Example Code

```tsx
import { createRPCReact } from '@x-oasis/async-call-rpc-react';

// Define service interface
type FileService = {
  listFiles(dir: string): Promise<string[]>;
  readFile(path: string): Promise<string>;
};

// Create hooks (in your app startup)
const fileRPC = createRPCReact<FileService>(client);

// Use in components
function FileList() {
  const { data: files } = fileRPC.useQuery('listFiles', ['/src']);
  return <ul>{files?.map(f => <li key={f}>{f}</li>)}</ul>;
}

function UpdateFile({ path }: { path: string }) {
  const mutation = fileRPC.useMutation('writeFile');
  return (
    <button onClick={() => mutation.mutate([path, 'new content'])}>
      Save
    </button>
  );
}
```

## Reference Examples

### react-query.example.tsx

A simplified reference example showing the API patterns. This file demonstrates:
- How to set up the RPC client
- Basic `useQuery` and `useMutation` usage
- Query key generation
- Cache invalidation patterns

For a runnable version of this example, see `./react-query-app/`.

## Contributing

To add a new example:

1. Create a new directory under `examples/`
2. Add a complete, runnable application
3. Include a `README.md` with:
   - Feature overview
   - Quick start instructions
   - Key concepts demonstrated
   - Example code snippets
4. Update this file with a reference to the new example

## Resources

- [async-call-rpc Documentation](../README.md)
- [React Query Documentation](https://tanstack.com/query/latest)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [WebSocket API](https://developer.mozilla.org/en-US/docs/Web/API/WebSocket)

## Troubleshooting

### "Cannot find module" errors

Make sure you're running `pnpm install` in the example directory before starting the dev server.

### "Cannot connect to server" errors

- Check that the WebSocket server is running on port 3456
- Verify that no firewall is blocking the connection
- Check browser console for WebSocket errors

### TypeScript errors

Make sure your service interface matches the server implementation exactly:
- Method names must match
- Parameter and return types must be compatible
