import { useState, useEffect, useRef, useCallback } from 'react';
import { WebSocketChannel, clientHost } from '@x-oasis/async-call-rpc';
import './App.css';

const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:3457';

interface StockTick {
  symbol: string;
  price: number;
  change: number;
  timestamp: number;
}

interface LogEntry {
  id: number;
  level: 'INFO' | 'WARN' | 'DEBUG' | 'ERROR';
  message: string;
  timestamp: string;
}

interface TimerTick {
  tick: number;
  elapsed: number;
}

function App() {
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Stock ticker state
  const [stockTicks, setStockTicks] = useState<StockTick[]>([]);
  const [stockSymbol, setStockSymbol] = useState('ACME');
  const [isWatchingStock, setIsWatchingStock] = useState(false);

  // Log stream state
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isStreamingLogs, setIsStreamingLogs] = useState(false);
  const [logsCompleted, setLogsCompleted] = useState(false);
  const [logCount, setLogCount] = useState('15');

  // Timer state
  const [timer, setTimer] = useState<TimerTick | null>(null);
  const [isTimerRunning, setIsTimerRunning] = useState(false);

  const clientRef = useRef<ReturnType<
    ReturnType<typeof clientHost.registerClient>['createProxy']
  > | null>(null);
  const rpcClientRef = useRef<ReturnType<
    typeof clientHost.registerClient
  > | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  // Subscription handles
  const stockUnsubRef = useRef<{ unsubscribe: () => void } | null>(null);
  const logsUnsubRef = useRef<{ unsubscribe: () => void } | null>(null);
  const timerUnsubRef = useRef<{ unsubscribe: () => void } | null>(null);

  useEffect(() => {
    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    ws.onopen = () => {
      setConnected(true);
      setError(null);

      const channel = new WebSocketChannel(ws, {
        name: 'streaming-client',
        connected: true,
      });

      const rpcClient = clientHost.registerClient('stream', { channel });
      rpcClientRef.current = rpcClient;
      clientRef.current = rpcClient.createProxy();
    };

    ws.onerror = () => {
      setError('Connection failed. Run: npm run server');
      setConnected(false);
    };

    ws.onclose = () => {
      setConnected(false);
      // Cleanup all subscriptions
      stockUnsubRef.current?.unsubscribe();
      logsUnsubRef.current?.unsubscribe();
      timerUnsubRef.current?.unsubscribe();
    };

    return () => {
      stockUnsubRef.current?.unsubscribe();
      logsUnsubRef.current?.unsubscribe();
      timerUnsubRef.current?.unsubscribe();
      ws.close();
    };
  }, []);

  // --- Stock ticker ---
  const toggleStock = useCallback(() => {
    if (!rpcClientRef.current) return;

    if (isWatchingStock) {
      stockUnsubRef.current?.unsubscribe();
      stockUnsubRef.current = null;
      setIsWatchingStock(false);
    } else {
      setStockTicks([]);
      stockUnsubRef.current = rpcClientRef.current.subscribe<StockTick>(
        'watchStockPrice',
        [stockSymbol],
        {
          onData: (tick) => {
            setStockTicks((prev) => [...prev.slice(-49), tick]);
          },
          onError: (err) => {
            setError(`Stock stream error: ${err.message}`);
            setIsWatchingStock(false);
          },
          onComplete: () => {
            setIsWatchingStock(false);
          },
        }
      );
      setIsWatchingStock(true);
    }
  }, [isWatchingStock, stockSymbol]);

  // --- Log stream ---
  const toggleLogs = useCallback(() => {
    if (!rpcClientRef.current) return;

    if (isStreamingLogs) {
      logsUnsubRef.current?.unsubscribe();
      logsUnsubRef.current = null;
      setIsStreamingLogs(false);
    } else {
      setLogs([]);
      setLogsCompleted(false);
      logsUnsubRef.current = rpcClientRef.current.subscribe<LogEntry>(
        'tailLogs',
        [parseInt(logCount) || 15],
        {
          onData: (entry) => {
            setLogs((prev) => [...prev, entry]);
          },
          onError: (err) => {
            setError(`Log stream error: ${err.message}`);
            setIsStreamingLogs(false);
          },
          onComplete: () => {
            setLogsCompleted(true);
            setIsStreamingLogs(false);
            logsUnsubRef.current = null;
          },
        }
      );
      setIsStreamingLogs(true);
    }
  }, [isStreamingLogs, logCount]);

  // --- Timer ---
  const toggleTimer = useCallback(() => {
    if (!rpcClientRef.current) return;

    if (isTimerRunning) {
      timerUnsubRef.current?.unsubscribe();
      timerUnsubRef.current = null;
      setIsTimerRunning(false);
    } else {
      setTimer(null);
      timerUnsubRef.current = rpcClientRef.current.subscribe<TimerTick>(
        'timer',
        [],
        {
          onData: (tick) => {
            setTimer(tick);
          },
          onError: (err) => {
            setError(`Timer error: ${err.message}`);
            setIsTimerRunning(false);
          },
        }
      );
      setIsTimerRunning(true);
    }
  }, [isTimerRunning]);

  const formatElapsed = (ms: number) => {
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60);
    const h = Math.floor(m / 60);
    if (h > 0) return `${h}h ${m % 60}m ${s % 60}s`;
    if (m > 0) return `${m}m ${s % 60}s`;
    return `${s}s`;
  };

  const latestTick = stockTicks[stockTicks.length - 1];

  return (
    <div className="container">
      <header>
        <h1>Subscription Streaming</h1>
        <p>
          Demonstrates <code>client.subscribe()</code> for high-frequency data
          streams over WebSocket
        </p>
      </header>

      <main>
        {/* Connection status */}
        <div className="connection-bar">
          <span className={`dot ${connected ? 'connected' : 'disconnected'}`} />
          {connected ? 'Connected' : 'Disconnected'}
          {error && <span className="conn-error">{error}</span>}
        </div>

        {/* Stock Ticker */}
        <div className="card">
          <h2>1. Stock Price Stream</h2>
          <p className="desc">
            Continuous price updates every 500ms. Demonstrates high-frequency
            <code>onData</code> callbacks.
          </p>
          <div className="input-row">
            <input
              type="text"
              value={stockSymbol}
              onChange={(e) => setStockSymbol(e.target.value.toUpperCase())}
              disabled={isWatchingStock || !connected}
              placeholder="Symbol"
              className="symbol-input"
            />
            <button
              onClick={toggleStock}
              disabled={!connected}
              className={`btn ${
                isWatchingStock ? 'btn-danger' : 'btn-primary'
              }`}
            >
              {isWatchingStock ? 'Stop' : 'Watch'}
            </button>
          </div>

          {latestTick && (
            <div className="stock-display">
              <span className="stock-symbol">{latestTick.symbol}</span>
              <span className="stock-price">
                ${latestTick.price.toFixed(2)}
              </span>
              <span
                className={`stock-change ${
                  latestTick.change >= 0 ? 'up' : 'down'
                }`}
              >
                {latestTick.change >= 0 ? '+' : ''}
                {latestTick.change.toFixed(2)}
              </span>
              <span className="tick-count">{stockTicks.length} ticks</span>
            </div>
          )}

          {stockTicks.length > 1 && (
            <div className="mini-chart">
              {stockTicks.slice(-30).map((t, i) => (
                <div
                  key={i}
                  className={`bar ${t.change >= 0 ? 'up' : 'down'}`}
                  style={{
                    height: `${Math.min(100, Math.abs(t.change) * 50 + 5)}%`,
                  }}
                />
              ))}
            </div>
          )}
        </div>

        {/* Log Stream */}
        <div className="card">
          <h2>2. Server Log Stream</h2>
          <p className="desc">
            Finite stream — server pushes log entries, then calls{' '}
            <code>onComplete</code> when done.
          </p>
          <div className="input-row">
            <input
              type="number"
              value={logCount}
              onChange={(e) => setLogCount(e.target.value)}
              disabled={isStreamingLogs || !connected}
              placeholder="Max entries"
              min="1"
              max="100"
              className="count-input"
            />
            <button
              onClick={toggleLogs}
              disabled={!connected}
              className={`btn ${
                isStreamingLogs ? 'btn-danger' : 'btn-primary'
              }`}
            >
              {isStreamingLogs ? 'Stop' : 'Start'}
            </button>
          </div>

          {logsCompleted && (
            <div className="completed-badge">Stream completed</div>
          )}

          {logs.length > 0 && (
            <div className="log-list">
              {logs.map((log) => (
                <div key={log.id} className={`log-row level-${log.level}`}>
                  <span className="log-level">{log.level}</span>
                  <span className="log-msg">{log.message}</span>
                  <span className="log-time">
                    {new Date(log.timestamp).toLocaleTimeString()}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Timer */}
        <div className="card">
          <h2>3. Timer Stream</h2>
          <p className="desc">
            Long-lived subscription — ticks every second until you unsubscribe.
          </p>
          <button
            onClick={toggleTimer}
            disabled={!connected}
            className={`btn ${isTimerRunning ? 'btn-danger' : 'btn-primary'}`}
          >
            {isTimerRunning ? 'Stop Timer' : 'Start Timer'}
          </button>

          {timer && (
            <div className="timer-display">
              <span className="timer-tick">Tick #{timer.tick}</span>
              <span className="timer-elapsed">
                {formatElapsed(timer.elapsed)}
              </span>
            </div>
          )}
        </div>

        {/* How it works */}
        <div className="card info-card">
          <h3>How Subscription Streaming Works</h3>
          <ul>
            <li>
              Client calls <code>client.subscribe(method, args, observer)</code>
            </li>
            <li>
              Server handler returns an observable with <code>subscribe()</code>
            </li>
            <li>
              Observer receives <code>onData</code>, <code>onError</code>,{' '}
              <code>onComplete</code>
            </li>
            <li>
              Client calls <code>unsubscribe()</code> to stop the stream
            </li>
            <li>Best for: real-time data, file watching, live feeds</li>
          </ul>
        </div>
      </main>
    </div>
  );
}

export default App;
