/**
 * React Query + async-call-rpc Integration Example
 *
 * This file shows how to use `createRPCReact()` to build type-safe
 * React hooks that combine the RPC proxy with @tanstack/react-query.
 *
 * NOTE: This is a reference example — it cannot run standalone.
 *       It demonstrates the API and patterns for integration.
 *
 * Prerequisites:
 *   npm install @tanstack/react-query react react-dom
 */

import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { WebSocketChannel, clientHost } from '../src/index';
import { createRPCReact } from '../src/react';

// ---------------------------------------------------------------------------
// 1. Define the remote service interface
// ---------------------------------------------------------------------------

type FileService = {
  readFile(path: string): Promise<string>;
  writeFile(path: string, content: string): Promise<void>;
  listFiles(dir: string): Promise<string[]>;
  getFileSize(path: string): Promise<number>;
};

// ---------------------------------------------------------------------------
// 2. Create the RPC client (normally done once at app startup)
// ---------------------------------------------------------------------------

const ws = new WebSocket('ws://localhost:3456');
const channel = new WebSocketChannel(ws as any, { name: 'file-client' });

const fileClient = clientHost.registerClient('file-service', { channel });

// Create the React hooks
const fileRPC = createRPCReact<FileService>(fileClient);

// ---------------------------------------------------------------------------
// 3. Set up the QueryClient and Provider
// ---------------------------------------------------------------------------

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5000, // 5 seconds
      retry: 1,
    },
  },
});

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <FileExplorer />
    </QueryClientProvider>
  );
}

// ---------------------------------------------------------------------------
// 4. Use the hooks in components
// ---------------------------------------------------------------------------

function FileExplorer() {
  // useQuery: fetch a directory listing
  const {
    data: files,
    isLoading,
    error,
  } = fileRPC.useQuery('listFiles', ['/src']);

  if (isLoading) return <div>Loading files...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return (
    <div>
      <h2>Files in /src</h2>
      <ul>
        {files?.map((file) => (
          <li key={file}>
            <FileItem path={`/src/${file}`} />
          </li>
        ))}
      </ul>
    </div>
  );
}

function FileItem({ path }: { path: string }) {
  // useQuery: fetch individual file size
  const { data: size } = fileRPC.useQuery('getFileSize', [path], {
    enabled: !!path,
  });

  // useMutation: write a file
  const writeMutation = fileRPC.useMutation('writeFile', {
    onSuccess: () => {
      // Invalidate related queries after a write
      queryClient.invalidateQueries({
        queryKey: fileRPC.getQueryKey('listFiles', '/src'),
      });
      queryClient.invalidateQueries({
        queryKey: fileRPC.getQueryKey('readFile', path),
      });
    },
    onError: (err) => {
      console.error('Write failed:', err.message);
    },
  });

  return (
    <span>
      {path} ({size ?? '...'} bytes)
      <button
        onClick={() =>
          writeMutation.mutate([
            path,
            `// Updated at ${new Date().toISOString()}\n`,
          ])
        }
        disabled={writeMutation.isPending}
      >
        {writeMutation.isPending ? 'Writing...' : 'Update'}
      </button>
    </span>
  );
}

// ---------------------------------------------------------------------------
// 5. File viewer with content loading
// ---------------------------------------------------------------------------

export function FileViewer({ path }: { path: string }) {
  const { data: content, isLoading } = fileRPC.useQuery('readFile', [path]);

  if (isLoading) return <div>Loading {path}...</div>;

  return (
    <pre
      style={{
        background: '#f5f5f5',
        padding: '1rem',
        borderRadius: '4px',
        overflow: 'auto',
      }}
    >
      {content}
    </pre>
  );
}
