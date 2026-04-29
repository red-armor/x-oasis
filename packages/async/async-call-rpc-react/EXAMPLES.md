# Running Examples

This document explains how to run the examples for `@x-oasis/async-call-rpc-react`.

## Quick Start

### Option 1: From the Package Root

```bash
pnpm example:dev
```

This command will:
1. Navigate to `examples/react-query-app`
2. Start the WebSocket mock server on port 3456
3. Start the Vite dev server on port 5173
4. Open the browser to see the React application

### Option 2: From the Example Directory

```bash
cd examples/react-query-app
pnpm install
pnpm dev
```

### Option 3: Using pnpm Workspace

```bash
# From monorepo root
cd packages/async/async-call-rpc-react/examples/react-query-app
pnpm install
pnpm dev
```

## What's Included

### Example Application

**Location**: `examples/react-query-app/`

A fully functional React application demonstrating:

- **Type-safe RPC Hooks**: Using `createRPCReact()` to generate hooks
- **React Query Integration**: Automatic caching, deduplication, and invalidation
- **WebSocket Server**: A mock `FileService` implementation
- **Component Examples**: Showing `useQuery` and `useMutation` patterns
- **Error Handling**: Proper error states and user feedback
- **Styled UI**: Clean, modern interface with responsive design

### Key Features

✅ Full TypeScript support  
✅ Real WebSocket communication  
✅ Mock file service implementation  
✅ Query caching and deduplication  
✅ Mutation side effects and query invalidation  
✅ Error handling and loading states  
✅ Modern React 18 with Vite  

## Project Structure

```
examples/react-query-app/
├── src/
│   ├── main.tsx              # React entry point
│   ├── App.tsx               # Main application component
│   ├── server.ts             # Mock WebSocket server
│   └── index.css             # Tailwind-inspired styling
├── index.html                # HTML entry point
├── package.json              # Dependencies and scripts
├── vite.config.ts            # Vite configuration
├── tsconfig.json             # TypeScript configuration
├── tsconfig.node.json        # Node TypeScript configuration
├── README.md                 # Detailed documentation
└── .gitignore                # Git ignore rules
```

## Understanding the Architecture

### Server Side (`src/server.ts`)

The server implements the `FileService` interface:

```typescript
interface FileService {
  readFile(path: string): Promise<string>;
  writeFile(path: string, content: string): Promise<void>;
  listFiles(dir: string): Promise<string[]>;
  getFileSize(path: string): Promise<number>;
}
```

Features:
- Runs on WebSocket port 3456
- Simulates network latency
- Maintains an in-memory mock file system
- Uses `@x-oasis/async-call-rpc` for RPC handling

### Client Side (`src/App.tsx`)

The React application:
1. Establishes WebSocket connection to server
2. Creates type-safe hooks using `createRPCReact()`
3. Uses React Query for data management
4. Implements query and mutation examples
5. Handles connection errors gracefully

## Code Examples

### Creating RPC Hooks

```tsx
import { createRPCReact } from '@x-oasis/async-call-rpc-react';

type FileService = {
  readFile(path: string): Promise<string>;
  writeFile(path: string, content: string): Promise<void>;
  listFiles(dir: string): Promise<string[]>;
  getFileSize(path: string): Promise<number>;
};

const fileRPC = createRPCReact<FileService>(client);
```

### Using useQuery

```tsx
function FileList() {
  const { data: files, isLoading, error } = fileRPC.useQuery('listFiles', ['/src']);
  
  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;
  
  return (
    <ul>
      {files?.map(file => (
        <li key={file}>{file}</li>
      ))}
    </ul>
  );
}
```

### Using useMutation

```tsx
function FileWriter({ path }: { path: string }) {
  const writeMutation = fileRPC.useMutation('writeFile', {
    onSuccess: () => {
      // Invalidate related queries
      queryClient.invalidateQueries({
        queryKey: fileRPC.getQueryKey('listFiles', '/src'),
      });
    },
    onError: (err) => {
      console.error('Failed to write:', err.message);
    },
  });

  return (
    <button
      onClick={() => writeMutation.mutate([path, 'new content'])}
      disabled={writeMutation.isPending}
    >
      {writeMutation.isPending ? 'Saving...' : 'Save'}
    </button>
  );
}
```

## Ports

- **WebSocket Server**: `ws://localhost:3456`
- **Vite Dev Server**: `http://localhost:5173`

Make sure these ports are available before running the example.

## Troubleshooting

### Connection Issues

**Error**: "Cannot connect to server"

**Solutions**:
- Ensure the WebSocket server is running
- Check that port 3456 is not in use: `lsof -i :3456`
- Verify no firewall is blocking the connection
- Check browser console for detailed error messages

### Module Resolution Issues

**Error**: "Cannot find module '@x-oasis/async-call-rpc'"

**Solutions**:
- Run `pnpm install` from the example directory
- Make sure you're using the workspace version (check package.json)
- If upgrading, rebuild the main packages: `pnpm build`

### TypeScript Errors

**Error**: Type mismatch errors in components

**Solutions**:
- Verify the service interface matches the server implementation
- Check that method names are spelled correctly
- Ensure parameter types are compatible

### Port Already in Use

**Error**: "Port 3456 is already in use"

**Solutions**:
- Find and kill the process using the port: `kill -9 $(lsof -ti :3456)`
- Change the port in `src/server.ts` and `src/App.tsx`

## Building for Production

```bash
pnpm build
```

This creates a production-optimized build in the `dist/` directory.

To preview the production build:

```bash
pnpm preview
```

## Development Tips

### Hot Module Replacement (HMR)

Vite supports HMR out of the box. Changes to component files will reflect immediately in the browser.

### Debugging

- Use browser DevTools for React component inspection
- Check console logs from both server and client
- Use React Query DevTools for cache inspection

### Adding New Service Methods

1. Add method to `FileService` interface
2. Implement method in `src/server.ts`
3. Use the new method with `fileRPC.useQuery()` or `fileRPC.useMutation()`

## References

- [async-call-rpc Documentation](README.md)
- [React Query Documentation](https://tanstack.com/query/latest)
- [Vite Guide](https://vitejs.dev/guide/)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)

## Next Steps

After running the example:

1. **Explore the Code**: Understand how the service interface drives the hooks
2. **Modify the Service**: Add new methods to `FileService`
3. **Add Components**: Create new UI components using the RPC hooks
4. **Experiment**: Try different React Query options (staleTime, retry, etc.)
5. **Integrate**: Use the patterns in your own projects

---

For more details, see [examples/README.md](./examples/README.md) and [examples/react-query-app/README.md](./examples/react-query-app/README.md).
