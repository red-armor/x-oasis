import React, { useEffect, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { WebSocketChannel, clientHost } from '@x-oasis/async-call-rpc';
import { createRPCReact } from '@x-oasis/async-call-rpc-react';

// Service interface
type FileService = {
  readFile(path: string): Promise<string>;
  writeFile(path: string, content: string): Promise<void>;
  listFiles(dir: string): Promise<string[]>;
  getFileSize(path: string): Promise<number>;
};

// Component that uses the RPC with React Query
function FileExplorer({
  fileRPC,
  queryClient,
}: {
  fileRPC: ReturnType<typeof createRPCReact<FileService>>;
  queryClient: QueryClient;
}) {
  const {
    data: files,
    isLoading,
    error,
  } = fileRPC.useQuery('listFiles', ['/src']);

  if (isLoading) return <div className="loading">Loading files...</div>;
  if (error) return <div className="error">Error: {error.message}</div>;

  return (
    <div className="file-explorer">
      <h2>📁 Files in /src</h2>
      {files && files.length > 0 ? (
        <ul>
          {files.map((file) => (
            <li key={file}>
              <FileItem
                path={`/src/${file}`}
                fileRPC={fileRPC}
                queryClient={queryClient}
              />
            </li>
          ))}
        </ul>
      ) : (
        <p>No files found</p>
      )}
    </div>
  );
}

function FileItem({
  path,
  fileRPC,
  queryClient,
}: {
  path: string;
  fileRPC: ReturnType<typeof createRPCReact<FileService>>;
  queryClient: QueryClient;
}) {
  const { data: size, isLoading: sizeLoading } = fileRPC.useQuery(
    'getFileSize',
    [path],
    {
      enabled: !!path,
    }
  );

  const writeMutation = fileRPC.useMutation('writeFile', {
    onSuccess: () => {
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
    <div className="file-item">
      <span className="file-path">
        {path} {sizeLoading ? '...' : `(${size} bytes)`}
      </span>
      <button
        className="update-btn"
        onClick={() =>
          writeMutation.mutate([
            path,
            `// Updated at ${new Date().toISOString()}\n`,
          ])
        }
        disabled={writeMutation.isPending}
      >
        {writeMutation.isPending ? '✓ Updating...' : 'Update'}
      </button>
      {writeMutation.isError && (
        <span className="error-text">
          Error: {writeMutation.error?.message}
        </span>
      )}
    </div>
  );
}

function FileViewer({
  path,
  fileRPC,
}: {
  path: string;
  fileRPC: ReturnType<typeof createRPCReact<FileService>>;
}) {
  const { data: content, isLoading } = fileRPC.useQuery('readFile', [path]);

  if (isLoading) return <div className="loading">Loading {path}...</div>;

  return (
    <div className="file-viewer">
      <h3>📄 Content: {path}</h3>
      <pre className="code-block">{content || '(empty)'}</pre>
    </div>
  );
}

function AppContent() {
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const [clientInstance, setClientInstance] = useState<any>(null);

  // Initialize RPC client
  useEffect(() => {
    let ws: WebSocket | null = null;
    let retries = 0;
    const maxRetries = 5;

    const connect = () => {
      try {
        ws = new WebSocket('ws://localhost:3456');

        ws.onopen = () => {
          console.log('[Client] Connected to server');
          const channel = new WebSocketChannel(ws as any, {
            name: 'file-client',
          });
          const client = clientHost.registerClient('file-service', { channel });
          setClientInstance(client);
          setConnected(true);
          retries = 0; // Reset retries on successful connection
        };

        ws.onerror = () => {
          console.error('[Client] WebSocket error');
        };

        ws.onclose = () => {
          console.log('[Client] Disconnected from server');
          setConnected(false);
          // Attempt to reconnect
          if (retries < maxRetries) {
            retries++;
            setTimeout(connect, 2000 * retries); // Exponential backoff
          }
        };
      } catch (err) {
        console.error('[Client] Failed to create WebSocket:', err);
      }
    };

    connect();

    return () => {
      if (ws) {
        ws.close();
      }
    };
  }, []);

  if (!connected || !clientInstance) {
    return (
      <div className="connection-status">
        <div className="status-indicator disconnected"></div>
        <p>Connecting to server...</p>
        <p className="hint">
          Make sure the server is running on ws://localhost:3456
        </p>
      </div>
    );
  }

  const fileRPC = createRPCReact<FileService>(clientInstance);
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 5000,
        retry: 1,
      },
    },
  });

  return (
    <QueryClientProvider client={queryClient}>
      <div className="app-layout">
        <div className="status-bar">
          <div className="status-indicator connected"></div>
          <span>Connected to RPC Server</span>
        </div>

        <div className="main-content">
          <div className="sidebar">
            <FileExplorer fileRPC={fileRPC} queryClient={queryClient} />
          </div>

          <div className="editor">
            {selectedFile ? (
              <FileViewer path={selectedFile} fileRPC={fileRPC} />
            ) : (
              <div className="placeholder">
                <h3>Select a file to view</h3>
                <p>Click on any file in the sidebar to see its contents</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </QueryClientProvider>
  );
}

export function App() {
  return (
    <div className="app-root">
      <header className="app-header">
        <h1>📦 React Query + async-call-rpc Demo</h1>
        <p>Type-safe RPC hooks with React Query integration</p>
      </header>
      <AppContent />
    </div>
  );
}
