import { useState, useEffect, useRef, useCallback } from 'react';
import { WorkerChannel } from '@x-oasis/async-call-rpc-web/core';
import { WebConnectionOrchestrator } from '@x-oasis/async-call-rpc-web/orchestrator';
import { clientHost, serviceHost } from '@x-oasis/async-call-rpc/core';
import './App.css';

type PageletApi = {
  info(): Promise<string>;
  callSharedEcho(msg: string): Promise<string>;
  callSharedGetConfig(key: string): Promise<string>;
  callDaemonEcho(msg: string): Promise<string>;
  callDaemonSystemStatus(): Promise<string>;
  [key: string]: (...args: any[]) => any;
};

type TabId = 'shared' | 'daemon' | 'pagelet';

interface MethodDef {
  name: string;
  description: string;
  params?: { key: string; label: string; defaultValue: string }[];
  invoke: (params: Record<string, string>) => Promise<any>;
}

interface TabDef {
  id: TabId;
  label: string;
  color: string;
  methods: MethodDef[];
}

interface CallResult {
  method: string;
  tabId: TabId;
  params: Record<string, string>;
  value: any;
  latencyMs: number;
  timestamp: number;
  error?: string;
}

function useOrchestratorAndPagelet() {
  const [ready, setReady] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [logs, setLogs] = useState<
    { ts: number; level: string; msg: string }[]
  >([]);
  const proxyRef = useRef<PageletApi | null>(null);
  const orchestratorRef = useRef<WebConnectionOrchestrator | null>(null);
  const workersRef = useRef<Worker[]>([]);

  const addLog = useCallback((level: string, msg: string) => {
    setLogs((prev) => [...prev, { ts: Date.now(), level, msg }]);
  }, []);

  useEffect(() => {
    addLog('info', 'Creating orchestrator and workers...');

    const orchestrator = new WebConnectionOrchestrator({
      logger: (level: string, msg: string) => addLog(level, msg),
    });
    orchestratorRef.current = orchestrator;

    const pageletWorker = new Worker(
      new URL('../workers/pagelet-worker.ts', import.meta.url),
      { type: 'module' }
    );
    const sharedWorker = new Worker(
      new URL('../workers/shared-worker.ts', import.meta.url),
      { type: 'module' }
    );
    const daemonWorker = new Worker(
      new URL('../workers/daemon-worker.ts', import.meta.url),
      { type: 'module' }
    );
    workersRef.current = [pageletWorker, sharedWorker, daemonWorker];

    const pageletChannel = new WorkerChannel(pageletWorker, {
      name: 'pagelet-control',
    });
    const sharedChannel = new WorkerChannel(sharedWorker, {
      name: 'shared-control',
    });
    const daemonChannel = new WorkerChannel(daemonWorker, {
      name: 'daemon-control',
    });

    orchestrator.registerParticipant('pagelet', pageletChannel, 'worker');
    orchestrator.registerParticipant('shared', sharedChannel, 'worker');
    orchestrator.registerParticipant('daemon', daemonChannel, 'worker');

    orchestrator.registerProxyService(serviceHost);
    pageletChannel.setServiceHost(serviceHost);
    sharedChannel.setServiceHost(serviceHost);
    daemonChannel.setServiceHost(serviceHost);

    const pageletProxy = clientHost
      .registerClient('pagelet-api', { channel: pageletChannel })
      .createProxy<PageletApi>();
    proxyRef.current = pageletProxy;

    addLog(
      'info',
      'Workers and orchestrator ready. Click "Connect" to establish data channels.'
    );

    return () => {
      workersRef.current.forEach((w) => w.terminate());
      workersRef.current = [];
    };
  }, [addLog]);

  const connect = useCallback(async () => {
    if (!orchestratorRef.current || connecting) return;
    setConnecting(true);
    setError(null);
    addLog('info', 'Connecting pagelet → shared, pagelet → daemon...');

    try {
      const sharedInfo = await orchestratorRef.current.connect(
        'pagelet',
        'shared'
      );
      addLog(
        'success',
        `pagelet↔shared: ${sharedInfo.connectionId} (${sharedInfo.state})`
      );

      const daemonInfo = await orchestratorRef.current.connect(
        'pagelet',
        'daemon'
      );
      addLog(
        'success',
        `pagelet↔daemon: ${daemonInfo.connectionId} (${daemonInfo.state})`
      );

      setReady(true);
      addLog('success', 'All data channels established!');
    } catch (err: any) {
      setError(err.message);
      addLog('error', `Connection failed: ${err.message}`);
    } finally {
      setConnecting(false);
    }
  }, [connecting, addLog]);

  const disconnect = useCallback(async () => {
    if (!orchestratorRef.current || !ready) return;
    try {
      const connections = orchestratorRef.current.listConnections();
      for (const conn of connections) {
        await orchestratorRef.current.disconnect(conn.connectionId);
        addLog('info', `Disconnected: ${conn.connectionId}`);
      }
      setReady(false);
    } catch (err: any) {
      addLog('error', `Disconnect failed: ${err.message}`);
    }
  }, [ready, addLog]);

  return {
    ready,
    connecting,
    error,
    logs,
    proxyRef,
    connect,
    disconnect,
    addLog,
  };
}

function App() {
  const { ready, connecting, error, logs, proxyRef, connect, disconnect } =
    useOrchestratorAndPagelet();

  const [activeTab, setActiveTab] = useState<TabId>('shared');
  const [results, setResults] = useState<CallResult[]>([]);
  const [loading, setLoading] = useState<string | null>(null);
  const [paramValues, setParamValues] = useState<Record<string, string>>({});

  const TABS: TabDef[] = [
    {
      id: 'shared',
      label: 'Shared',
      color: '#8b5cf6',
      methods: [
        {
          name: 'echo',
          description: 'Echo through shared worker (via pagelet)',
          params: [{ key: 'msg', label: 'Message', defaultValue: 'hello' }],
          invoke: (p) => proxyRef.current!.callSharedEcho(p.msg),
        },
        {
          name: 'getConfig',
          description: 'Get config value (via pagelet)',
          params: [{ key: 'key', label: 'Key', defaultValue: 'theme' }],
          invoke: (p) => proxyRef.current!.callSharedGetConfig(p.key),
        },
      ],
    },
    {
      id: 'daemon',
      label: 'Daemon',
      color: '#f59e0b',
      methods: [
        {
          name: 'echo',
          description: 'Echo through daemon worker (via pagelet)',
          params: [{ key: 'msg', label: 'Message', defaultValue: 'hello' }],
          invoke: (p) => proxyRef.current!.callDaemonEcho(p.msg),
        },
        {
          name: 'systemStatus',
          description: 'Get daemon system status (via pagelet)',
          invoke: () => proxyRef.current!.callDaemonSystemStatus(),
        },
      ],
    },
    {
      id: 'pagelet',
      label: 'Pagelet',
      color: '#3b82f6',
      methods: [
        {
          name: 'info',
          description: 'Get pagelet worker info',
          invoke: () => proxyRef.current!.info(),
        },
      ],
    },
  ];

  const currentTab = TABS.find((t) => t.id === activeTab)!;

  const handleCall = useCallback(
    (method: MethodDef) => {
      if (!ready || !proxyRef.current) return;
      const params: Record<string, string> = {};
      method.params?.forEach((p) => {
        params[p.key] =
          paramValues[`${method.name}_${p.key}`] || p.defaultValue;
      });
      const start = performance.now();
      setLoading(method.name);
      method
        .invoke(params)
        .then((value) => {
          setResults((prev) => [
            {
              method: method.name,
              tabId: activeTab,
              params,
              value,
              latencyMs: Math.round(performance.now() - start),
              timestamp: Date.now(),
            },
            ...prev,
          ]);
        })
        .catch((err: any) => {
          setResults((prev) => [
            {
              method: method.name,
              tabId: activeTab,
              params,
              value: null,
              latencyMs: Math.round(performance.now() - start),
              timestamp: Date.now(),
              error: err.message,
            },
            ...prev,
          ]);
        })
        .finally(() => setLoading(null));
    },
    [ready, paramValues, activeTab]
  );

  const logRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [logs.length]);

  return (
    <div className="container">
      <header>
        <h1>Pagelet Proxy (Web)</h1>
        <p>
          Web Worker orchestrator with pagelet-proxy pattern &mdash; pagelet
          self-connects to shared/daemon via direct MessagePort channels
        </p>
      </header>

      <main>
        <div className="card">
          <div className="status-header">
            <div
              className={`status-badge ${ready ? 'connected' : 'disconnected'}`}
            >
              {ready
                ? 'Connected'
                : connecting
                ? 'Connecting...'
                : 'Disconnected'}
            </div>
            <div className="button-group-inline">
              <button
                onClick={connect}
                disabled={ready || connecting}
                className="btn btn-primary btn-sm"
              >
                {connecting ? 'Connecting...' : 'Connect'}
              </button>
              <button
                onClick={disconnect}
                disabled={!ready}
                className="btn btn-danger btn-sm"
              >
                Disconnect
              </button>
            </div>
          </div>

          {error && <div className="error">{error}</div>}

          <div className="architecture">
            <h3>Architecture</h3>
            <pre>{`Main Page (Orchestrator)
  ├── WorkerChannel → pagelet-worker (control)
  ├── WorkerChannel → shared-worker  (control)
  └── WorkerChannel → daemon-worker  (control)

After connect():
  pagelet ←MessagePort→ shared  (direct data)
  pagelet ←MessagePort→ daemon  (direct data)

Main page ↔ pagelet: via control channel (RPC)`}</pre>
          </div>
        </div>

        <div className="card">
          <h3>RPC Explorer</h3>
          <div className="tab-bar">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`tab ${activeTab === tab.id ? 'active' : ''}`}
                style={
                  activeTab === tab.id
                    ? { borderBottomColor: tab.color, color: tab.color }
                    : {}
                }
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="methods">
            {currentTab.methods.map((method) => {
              const latest = results.find((r) => r.method === method.name);
              return (
                <div key={method.name} className="method-card">
                  <div className="method-header">
                    <span
                      className="method-dot"
                      style={{ backgroundColor: currentTab.color }}
                    />
                    <span className="method-name">{method.name}()</span>
                    <button
                      onClick={() => handleCall(method)}
                      disabled={!ready || loading === method.name}
                      className="btn btn-call"
                      style={{
                        backgroundColor:
                          ready && loading !== method.name
                            ? currentTab.color
                            : '#d1d5db',
                      }}
                    >
                      {loading === method.name ? '...' : 'Call'}
                    </button>
                  </div>
                  <div className="method-desc">{method.description}</div>
                  {method.params && (
                    <div className="method-params">
                      {method.params.map((p) => (
                        <div key={p.key} className="param-group">
                          <label>{p.label}</label>
                          <input
                            type="text"
                            value={
                              paramValues[`${method.name}_${p.key}`] ??
                              p.defaultValue
                            }
                            onChange={(e) =>
                              setParamValues((prev) => ({
                                ...prev,
                                [`${method.name}_${p.key}`]: e.target.value,
                              }))
                            }
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleCall(method);
                            }}
                            disabled={!ready}
                          />
                        </div>
                      ))}
                    </div>
                  )}
                  {latest && (
                    <div
                      className={`method-result ${
                        latest.error ? 'error' : 'success'
                      }`}
                    >
                      <span className="result-value">
                        {latest.error
                          ? latest.error
                          : typeof latest.value === 'object'
                          ? JSON.stringify(latest.value)
                          : String(latest.value)}
                      </span>
                      <span className="result-latency">
                        {latest.latencyMs}ms
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="card">
          <div className="log-header">
            <h3>Event Log ({logs.length})</h3>
            <button
              className="btn btn-sm btn-secondary"
              onClick={() => setResults([])}
            >
              Clear
            </button>
          </div>
          <div className="log" ref={logRef}>
            {logs.length === 0 && (
              <div className="log-empty">Waiting for events...</div>
            )}
            {logs.map((l, i) => (
              <div key={i} className={`log-entry log-${l.level}`}>
                <span className="log-time">
                  {new Date(l.ts).toLocaleTimeString('en-US', {
                    hour12: false,
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                  })}
                </span>
                <span
                  className={`log-icon ${
                    l.level === 'success'
                      ? 'icon-success'
                      : l.level === 'error'
                      ? 'icon-error'
                      : 'icon-info'
                  }`}
                >
                  {l.level === 'success'
                    ? '\u2713'
                    : l.level === 'error'
                    ? '\u2717'
                    : '\u00B7'}
                </span>
                <span className="log-msg">{l.msg}</span>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;
