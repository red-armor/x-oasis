import { useEffect, useState, useRef } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { WebSocketChannel } from '@x-oasis/async-call-rpc-web/core';
import { clientHost, ProxyRPCClient } from '@x-oasis/async-call-rpc/core';
import { createRPCReact } from '@x-oasis/async-call-rpc-react/core';

// Service interface — must match the server handlers.
// NOTE: The RPC framework passes only the first wire argument to each
// handler, so multi-arg methods use a single object parameter.
type FileService = {
  readFile(path: string): Promise<string>;
  writeFile(params: { path: string; content: string }): Promise<void>;
  listFiles(dir: string): Promise<string[]>;
  getFileSize(path: string): Promise<number>;
};

const WS_URL = 'ws://localhost:3456';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5000,
      retry: 1,
    },
  },
});

// Component that uses the RPC with React Query
function FileExplorer({
  fileRPC,
}: {
  fileRPC: ReturnType<typeof createRPCReact<FileService>>;
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
      <h2>Files in /src</h2>
      {files && files.length > 0 ? (
        <ul>
          {files.map((file: string) => (
            <li key={file}>
              <FileItem path={`/src/${file}`} fileRPC={fileRPC} />
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
}: {
  path: string;
  fileRPC: ReturnType<typeof createRPCReact<FileService>>;
}) {
  const { data: size, isLoading: sizeLoading } = fileRPC.useQuery(
    'getFileSize',
    [path],
    { enabled: !!path }
  );

  const writeMutation = fileRPC.useMutation('writeFile', {
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: fileRPC.getQueryKey('listFiles', '/src'),
      });
      queryClient.invalidateQueries({
        queryKey: fileRPC.getQueryKey('readFile', path),
      });
      queryClient.invalidateQueries({
        queryKey: fileRPC.getQueryKey('getFileSize', path),
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
            { path, content: `// Updated at ${new Date().toISOString()}\n` },
          ])
        }
        disabled={writeMutation.isPending}
      >
        {writeMutation.isPending ? 'Updating...' : 'Update'}
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
      <h3>Content: {path}</h3>
      <pre className="code-block">{content || '(empty)'}</pre>
    </div>
  );
}

function AppContent({
  fileRPC,
}: {
  fileRPC: ReturnType<typeof createRPCReact<FileService>>;
}) {
  const [selectedFile] = useState<string | null>(null);

  return (
    <QueryClientProvider client={queryClient}>
      <div className="app-layout">
        <div className="status-bar">
          <div className="status-indicator connected"></div>
          <span>Connected to RPC Server</span>
        </div>

        <div className="main-content">
          <div className="sidebar">
            <FileExplorer fileRPC={fileRPC} />
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
  const [connected, setConnected] = useState(false);
  const [fileRPC, setFileRPC] = useState<ReturnType<
    typeof createRPCReact<FileService>
  > | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    let retries = 0;
    const maxRetries = 5;

    const connect = () => {
      try {
        const ws = new WebSocket(WS_URL);
        wsRef.current = ws;

        ws.onopen = () => {
          console.log('[Client] Connected to server');
          retries = 0;

          const channel = new WebSocketChannel(ws as any, {
            name: 'file-client',
            connected: true,
          });

          // Use the real clientHost API
          const client = clientHost.registerClient('file-service', { channel });
          const hooks = createRPCReact<FileService>(
            client as unknown as ProxyRPCClient
          );
          setFileRPC(hooks);
          setConnected(true);
        };

        ws.onerror = () => {
          console.error('[Client] WebSocket error');
        };

        ws.onclose = () => {
          console.log('[Client] Disconnected');
          setConnected(false);
          if (retries < maxRetries) {
            retries++;
            setTimeout(connect, 2000 * retries);
          }
        };
      } catch (err) {
        console.error('[Client] Failed to create WebSocket:', err);
      }
    };

    connect();

    return () => {
      wsRef.current?.close();
    };
  }, []);

  if (!connected || !fileRPC) {
    return (
      <div className="app-root">
        <header className="app-header">
          <h1>React Query + async-call-rpc Demo</h1>
          <p>Type-safe RPC hooks with React Query integration</p>
        </header>
        <div className="connection-status">
          <div className="status-indicator disconnected"></div>
          <p>Connecting to server...</p>
          <p className="hint">Make sure the server is running on {WS_URL}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="app-root">
      <header className="app-header">
        <h1>React Query + async-call-rpc Demo</h1>
        <p>Type-safe RPC hooks with React Query integration</p>
      </header>
      <AppContent fileRPC={fileRPC} />
    </div>
  );
}
