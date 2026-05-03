import { useState, useEffect, useRef } from 'react';
import { WebSocketChannel } from '@x-oasis/async-call-rpc-web';
import { clientHost, RPCError } from '@x-oasis/async-call-rpc';
import './App.css';

type ApiService = {
  echo(message: string): Promise<string>;
  now(): Promise<number>;
  getInfo(): Promise<{ name: string; version: string; uptime: number }>;
  [key: string]: (...args: any[]) => any;
};

const WS_URL = 'ws://localhost:3460';

function App() {
  const [connected, setConnected] = useState(false);
  const [messages, setMessages] = useState<
    Array<{ type: string; text: string }>
  >([{ type: 'info', text: 'Connecting to server...' }]);
  const [error, setError] = useState<string | null>(null);
  const [echoInput, setEchoInput] = useState('Hello WebSocket!');

  const proxyRef = useRef<ApiService | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  const addMessage = (type: string, text: string) => {
    setMessages((m) => [
      ...m,
      { type, text: `[${new Date().toLocaleTimeString()}] ${text}` },
    ]);
  };

  useEffect(() => {
    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    ws.onopen = () => {
      addMessage('info', 'Connected to WebSocket server');
      setConnected(true);
      setError(null);

      const channel = new WebSocketChannel(ws, {
        name: 'react-client',
        connected: true,
      });

      proxyRef.current = clientHost
        .registerClient('api', { channel })
        .createProxy<ApiService>();
    };

    ws.onerror = () => {
      setError('WebSocket connection error');
      setConnected(false);
      addMessage('error', 'Connection error');
    };

    ws.onclose = () => {
      setConnected(false);
      addMessage('info', 'Connection closed');
    };

    return () => {
      ws.close();
    };
  }, []);

  const handleEcho = async () => {
    if (!proxyRef.current) {
      setError('Not connected');
      return;
    }

    try {
      const result = await proxyRef.current.echo(echoInput);
      addMessage('response', result);
    } catch (err) {
      const msg = err instanceof RPCError ? err.message : 'Failed to echo';
      setError(msg);
      addMessage('error', msg);
    }
  };

  const handleFetchTime = async () => {
    if (!proxyRef.current) {
      setError('Not connected');
      return;
    }

    try {
      const now = await proxyRef.current.now();
      addMessage('response', `Server time: ${new Date(now).toLocaleString()}`);
    } catch (err) {
      const msg = err instanceof RPCError ? err.message : 'Failed to get time';
      setError(msg);
      addMessage('error', msg);
    }
  };

  const handleGetInfo = async () => {
    if (!proxyRef.current) {
      setError('Not connected');
      return;
    }

    try {
      const info = await proxyRef.current.getInfo();
      addMessage(
        'response',
        `Server: ${info.name} v${info.version} (uptime: ${Math.floor(
          info.uptime
        )}s)`
      );
    } catch (err) {
      const msg = err instanceof RPCError ? err.message : 'Failed to get info';
      setError(msg);
      addMessage('error', msg);
    }
  };

  return (
    <div className="container">
      <header>
        <h1>WebSocket RPC</h1>
        <p>Real-time client-server communication via WebSocketChannel</p>
      </header>

      <main>
        <div className="card">
          <div className="status-header">
            <div
              className={`status-badge ${
                connected ? 'connected' : 'disconnected'
              }`}
            >
              {connected ? 'Connected' : 'Disconnected'}
            </div>
            <div className="ws-url">WS: {WS_URL}</div>
          </div>

          {error && <div className="error">{error}</div>}

          <div className="actions">
            <h3>Server Actions</h3>
            <div className="button-group">
              <button
                onClick={handleFetchTime}
                disabled={!connected}
                className="btn btn-primary"
              >
                Get Server Time
              </button>
              <button
                onClick={handleGetInfo}
                disabled={!connected}
                className="btn btn-primary"
              >
                Get Server Info
              </button>
            </div>
          </div>

          <div className="echo-section">
            <h3>Echo Test</h3>
            <div className="echo-input-group">
              <input
                type="text"
                value={echoInput}
                onChange={(e) => setEchoInput(e.target.value)}
                disabled={!connected}
                placeholder="Type a message..."
                onKeyDown={(e) => e.key === 'Enter' && handleEcho()}
              />
              <button
                onClick={handleEcho}
                disabled={!connected}
                className="btn btn-secondary"
              >
                Echo
              </button>
            </div>
          </div>

          <div className="log-section">
            <h3>Message Log</h3>
            <div className="log">
              {messages.map((msg, i) => (
                <div key={i} className={`log-entry log-${msg.type}`}>
                  {msg.text}
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;
