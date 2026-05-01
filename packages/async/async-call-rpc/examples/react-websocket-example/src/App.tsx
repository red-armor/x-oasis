import { useState, useEffect, useRef } from 'react';
import {
  WebSocketChannel,
  clientHost,
  RPCError,
} from '@x-oasis/async-call-rpc';
import './App.css';

type ApiService = {
  echo(message: string): Promise<string>;
  now(): Promise<number>;
  getCurrentUser(): Promise<{ id: string; name: string; timestamp: number }>;
  onUserStatusChanged(callback: (status: string) => void): {
    unsubscribe: () => void;
  };
  [key: string]: (...args: any[]) => any;
};

const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:3456';

function App() {
  const [connected, setConnected] = useState(false);
  const [messages, setMessages] = useState<
    Array<{ type: string; text: string }>
  >([{ type: 'info', text: 'Connecting to server...' }]);
  const [currentTime, setCurrentTime] = useState<number | null>(null);
  const [user, setUser] = useState<any>(null);
  const [userStatus, setUserStatus] = useState('offline');
  const [error, setError] = useState<string | null>(null);
  const [echoInput, setEchoInput] = useState('Hello WebSocket!');

  const proxyRef = useRef<ApiService | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const statusUnsubRef = useRef<any>(null);

  useEffect(() => {
    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    ws.onopen = () => {
      addMessage('info', 'Connected to WebSocket server ✓');
      setConnected(true);
      setError(null);

      const channel = new WebSocketChannel(ws, {
        name: 'react-client',
        connected: true,
      });

      const proxy = clientHost
        .registerClient('api', { channel })
        .createProxy<ApiService>();

      proxyRef.current = proxy;

      // Subscribe to status updates
      statusUnsubRef.current = proxy.onUserStatusChanged?.((status) => {
        setUserStatus(status);
        addMessage('status', `User status changed: ${status}`);
      });
    };

    ws.onerror = () => {
      setError('WebSocket connection error');
      setConnected(false);
      addMessage('error', 'Connection error');
    };

    ws.onclose = () => {
      setConnected(false);
      statusUnsubRef.current?.unsubscribe?.();
      addMessage('info', 'Connection closed');
    };

    return () => {
      statusUnsubRef.current?.unsubscribe?.();
      ws.close();
    };
  }, []);

  const addMessage = (type: string, text: string) => {
    setMessages((m) => [
      ...m,
      { type, text: `[${new Date().toLocaleTimeString()}] ${text}` },
    ]);
  };

  const handleEcho = async () => {
    if (!proxyRef.current) {
      setError('Not connected');
      return;
    }

    try {
      const result = await proxyRef.current.echo(echoInput);
      addMessage('response', `Echo: ${result}`);
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
      setCurrentTime(now);
      addMessage(
        'response',
        `Server time: ${new Date(now).toLocaleTimeString()}`
      );
    } catch (err) {
      const msg = err instanceof RPCError ? err.message : 'Failed to get time';
      setError(msg);
      addMessage('error', msg);
    }
  };

  const handleFetchUser = async () => {
    if (!proxyRef.current) {
      setError('Not connected');
      return;
    }

    try {
      const userData = await proxyRef.current.getCurrentUser?.();
      if (userData) {
        setUser(userData);
        addMessage('response', `User loaded: ${userData.name}`);
      }
    } catch (err) {
      const msg = err instanceof RPCError ? err.message : 'Failed to get user';
      setError(msg);
      addMessage('error', msg);
    }
  };

  return (
    <div className="container">
      <header>
        <h1>⚛️ React + WebSocket RPC</h1>
        <p>Real-time communication with backend server</p>
      </header>

      <main>
        <div className="card">
          <div className="status-header">
            <div
              className={`status-badge ${
                connected ? 'connected' : 'disconnected'
              }`}
            >
              ● {connected ? 'Connected' : 'Disconnected'}
            </div>
            <div className="ws-url">WS: {WS_URL}</div>
          </div>

          {error && <div className="error">❌ {error}</div>}

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
                onClick={handleFetchUser}
                disabled={!connected}
                className="btn btn-primary"
              >
                Get User Data
              </button>
            </div>
          </div>

          {user && (
            <div className="result">
              <h3>Current User</h3>
              <p>
                <strong>Name:</strong> {user.name}
              </p>
              <p>
                <strong>ID:</strong> {user.id}
              </p>
              {currentTime && (
                <p>
                  <strong>Last Update:</strong>{' '}
                  {new Date(currentTime).toLocaleString()}
                </p>
              )}
            </div>
          )}

          <div className="status-section">
            <h3>User Status: {userStatus}</h3>
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
