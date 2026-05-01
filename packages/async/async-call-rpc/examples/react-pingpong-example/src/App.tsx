import { useState, useEffect, useRef, useCallback } from 'react';
import { WorkerChannel, clientHost } from '@x-oasis/async-call-rpc';
import './App.css';

type PingPongService = {
  ping(): Promise<string>;
  onPing(callback: (data: { seq: number; timestamp: number }) => void): {
    unsubscribe: () => void;
  };
  onHeartbeat(callback: (beat: { alive: boolean; uptime: number }) => void): {
    unsubscribe: () => void;
  };
  onCountdown(callback: (data: { remaining: number; done: boolean }) => void): {
    unsubscribe: () => void;
  };
  [key: string]: (...args: any[]) => any;
};

interface PingEvent {
  seq: number;
  timestamp: number;
  receivedAt: number;
}

function App() {
  const [pongResult, setPongResult] = useState<string | null>(null);
  const [pingEvents, setPingEvents] = useState<PingEvent[]>([]);
  const [isPingSubscribed, setIsPingSubscribed] = useState(false);
  const [heartbeat, setHeartbeat] = useState<{
    alive: boolean;
    uptime: number;
  } | null>(null);
  const [isHeartbeatSubscribed, setIsHeartbeatSubscribed] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [countdownActive, setCountdownActive] = useState(false);
  const [ready, setReady] = useState(false);

  const proxyRef = useRef<PingPongService | null>(null);
  const pingUnsubRef = useRef<{ unsubscribe: () => void } | null>(null);
  const heartbeatUnsubRef = useRef<{ unsubscribe: () => void } | null>(null);
  const countdownUnsubRef = useRef<{ unsubscribe: () => void } | null>(null);

  // Initialize Worker
  useEffect(() => {
    const worker = new Worker(new URL('./worker.ts', import.meta.url), {
      type: 'module',
    });
    const channel = new WorkerChannel(worker, { name: 'main-thread' });
    proxyRef.current = clientHost
      .registerClient('pingpong', { channel })
      .createProxy<PingPongService>();
    setReady(true);

    return () => {
      pingUnsubRef.current?.unsubscribe();
      heartbeatUnsubRef.current?.unsubscribe();
      countdownUnsubRef.current?.unsubscribe();
      worker.terminate();
    };
  }, []);

  // Single ping request
  const handlePing = useCallback(async () => {
    if (!proxyRef.current) return;
    const result = await proxyRef.current.ping();
    setPongResult(result);
    setTimeout(() => setPongResult(null), 2000);
  }, []);

  // Toggle onPing subscription
  const togglePingSubscription = useCallback(() => {
    if (!proxyRef.current) return;

    if (isPingSubscribed) {
      pingUnsubRef.current?.unsubscribe();
      pingUnsubRef.current = null;
      setIsPingSubscribed(false);
    } else {
      setPingEvents([]);
      pingUnsubRef.current = proxyRef.current.onPing((data) => {
        setPingEvents((prev) => [
          ...prev.slice(-19), // keep last 20
          { ...data, receivedAt: Date.now() },
        ]);
      });
      setIsPingSubscribed(true);
    }
  }, [isPingSubscribed]);

  // Toggle onHeartbeat subscription
  const toggleHeartbeat = useCallback(() => {
    if (!proxyRef.current) return;

    if (isHeartbeatSubscribed) {
      heartbeatUnsubRef.current?.unsubscribe();
      heartbeatUnsubRef.current = null;
      setIsHeartbeatSubscribed(false);
      setHeartbeat(null);
    } else {
      heartbeatUnsubRef.current = proxyRef.current.onHeartbeat((beat) => {
        setHeartbeat(beat);
      });
      setIsHeartbeatSubscribed(true);
    }
  }, [isHeartbeatSubscribed]);

  // Start countdown (finite event stream)
  const startCountdown = useCallback(() => {
    if (!proxyRef.current || countdownActive) return;

    setCountdown(10);
    setCountdownActive(true);
    countdownUnsubRef.current = proxyRef.current.onCountdown((data) => {
      setCountdown(data.remaining);
      if (data.done) {
        setCountdownActive(false);
        countdownUnsubRef.current = null;
      }
    });
  }, [countdownActive]);

  const formatUptime = (ms: number) => {
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60);
    return m > 0 ? `${m}m ${s % 60}s` : `${s}s`;
  };

  return (
    <div className="container">
      <header>
        <h1>Ping-Pong Event Methods</h1>
        <p>
          Demonstrates the <code>on*</code> event method pattern via Web Worker
          RPC
        </p>
      </header>

      <main>
        {/* Simple Ping/Pong */}
        <div className="card">
          <h2>1. Request / Response</h2>
          <p className="desc">
            Simple one-shot <code>ping()</code> call that returns{' '}
            <code>&quot;pong&quot;</code>.
          </p>
          <button
            onClick={handlePing}
            disabled={!ready}
            className="btn btn-primary"
          >
            Ping!
          </button>
          {pongResult && <span className="pong-badge">{pongResult}</span>}
        </div>

        {/* onPing — streaming events */}
        <div className="card">
          <h2>2. onPing — Continuous Events</h2>
          <p className="desc">
            Subscribe to periodic ping events (1/sec). Each event carries a
            sequence number and timestamp.
          </p>
          <button
            onClick={togglePingSubscription}
            disabled={!ready}
            className={`btn ${isPingSubscribed ? 'btn-danger' : 'btn-primary'}`}
          >
            {isPingSubscribed ? 'Unsubscribe' : 'Subscribe'}
          </button>

          {pingEvents.length > 0 && (
            <div className="event-log">
              {pingEvents.map((e) => (
                <div key={e.seq} className="event-entry">
                  <span className="seq">#{e.seq}</span>
                  <span className="time">
                    {new Date(e.timestamp).toLocaleTimeString()}
                  </span>
                  <span className="latency">
                    +{e.receivedAt - e.timestamp}ms
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* onHeartbeat */}
        <div className="card">
          <h2>3. onHeartbeat — Status Monitoring</h2>
          <p className="desc">
            Heartbeat signal every 2 seconds with worker uptime.
          </p>
          <button
            onClick={toggleHeartbeat}
            disabled={!ready}
            className={`btn ${
              isHeartbeatSubscribed ? 'btn-danger' : 'btn-primary'
            }`}
          >
            {isHeartbeatSubscribed ? 'Stop' : 'Start'} Heartbeat
          </button>

          {heartbeat && (
            <div className="heartbeat-display">
              <span className={`pulse ${heartbeat.alive ? 'alive' : ''}`}>
                {heartbeat.alive ? 'ALIVE' : 'DEAD'}
              </span>
              <span className="uptime">
                Uptime: {formatUptime(heartbeat.uptime)}
              </span>
            </div>
          )}
        </div>

        {/* onCountdown — finite events */}
        <div className="card">
          <h2>4. onCountdown — Finite Event Stream</h2>
          <p className="desc">
            Counts down from 10 to 0, then stops automatically.
          </p>
          <button
            onClick={startCountdown}
            disabled={!ready || countdownActive}
            className="btn btn-primary"
          >
            {countdownActive ? 'Running...' : 'Start Countdown'}
          </button>

          {countdown !== null && (
            <div className="countdown-display">
              <span className="countdown-number">{countdown}</span>
              {!countdownActive && countdown <= 0 && (
                <span className="countdown-done">Done!</span>
              )}
            </div>
          )}
        </div>

        {/* How it works */}
        <div className="card info-card">
          <h3>How Event Methods Work</h3>
          <ul>
            <li>
              Methods named <code>onXxx</code> are detected as event methods
            </li>
            <li>Server accepts a callback, can fire it multiple times</li>
            <li>
              Client gets <code>{'{ unsubscribe }'}</code> to stop listening
            </li>
            <li>
              No error handling or completion signal (use streaming for that)
            </li>
            <li>Best for: heartbeats, status updates, simple notifications</li>
          </ul>
        </div>
      </main>
    </div>
  );
}

export default App;
