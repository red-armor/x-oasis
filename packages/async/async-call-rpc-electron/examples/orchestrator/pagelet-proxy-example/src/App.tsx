import { useState, useCallback, useEffect, useRef } from 'react';
import { createOrchestratorClient } from '@x-oasis/async-call-rpc-electron/browser';
import useOrchestratorDashboard, {
  OrchestratorAPI,
} from '@shared-ui/useOrchestratorDashboard';

const client = createOrchestratorClient({
  directChannelDescription: 'page↔preload',
  ipcChannelDescription: 'page↔preload:ipc',
});

const pageletClient = client.getService<any>('pagelet-api');

type TabId = 'shared' | 'daemon' | 'main' | 'pagelet' | 'subscriptions';
type PanelId = 'dashboard' | 'rpc';

interface MethodDef {
  name: string;
  description: string;
  params?: { key: string; label: string; defaultValue: string }[];
  invoke: (params: Record<string, string>) => Promise<any>;
  isSubscription?: boolean;
}

interface TabDef {
  id: TabId;
  label: string;
  color: string;
  methods: MethodDef[];
}

const TABS: TabDef[] = [
  {
    id: 'shared',
    label: 'Shared',
    color: '#8b5cf6',
    methods: [
      {
        name: 'echo',
        description: 'Echo a message through shared process',
        params: [{ key: 'msg', label: 'Message', defaultValue: 'hello' }],
        invoke: (p) => pageletClient.callSharedEcho(p.msg),
      },
      {
        name: 'getConfig',
        description: 'Get config value by key',
        params: [{ key: 'key', label: 'Config Key', defaultValue: 'theme' }],
        invoke: (p) => pageletClient.callSharedGetConfig(p.key),
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
        description: 'Echo a message through daemon process',
        params: [{ key: 'msg', label: 'Message', defaultValue: 'hello' }],
        invoke: (p) => pageletClient.callDaemonEcho(p.msg),
      },
      {
        name: 'systemStatus',
        description: 'Get daemon system status',
        invoke: () => pageletClient.callDaemonSystemStatus(),
      },
    ],
  },
  {
    id: 'main',
    label: 'Main',
    color: '#10b981',
    methods: [
      {
        name: 'mainPing',
        description: 'Ping the main process',
        params: [{ key: 'msg', label: 'Message', defaultValue: 'hello' }],
        invoke: (p) => pageletClient.callMainPing(p.msg),
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
        description: 'Get pagelet process info',
        invoke: () => pageletClient.info(),
      },
    ],
  },
  {
    id: 'subscriptions',
    label: 'Subs',
    color: '#ec4899',
    methods: [
      {
        name: 'onDaemonStatusChange',
        description: 'Subscribe to daemon system status updates (event method)',
        isSubscription: true,
        invoke: () => {
          throw new Error('Use subscription UI');
        },
      },
      {
        name: 'onDaemonLog',
        description: 'Subscribe to daemon log events (event method)',
        isSubscription: true,
        invoke: () => {
          throw new Error('Use subscription UI');
        },
      },
      {
        name: 'onSharedConfigChange',
        description: 'Subscribe to shared config changes (event method)',
        isSubscription: true,
        invoke: () => {
          throw new Error('Use subscription UI');
        },
      },
      {
        name: 'onDaemonCpuUsage',
        description:
          'Stream daemon CPU usage (observable → event method proxy)',
        isSubscription: true,
        invoke: () => {
          throw new Error('Use subscription UI');
        },
      },
    ],
  },
];

interface CallResult {
  method: string;
  tabId: TabId;
  params: Record<string, string>;
  value: any;
  latencyMs: number;
  timestamp: number;
  error?: string;
}

interface SubEvent {
  id: number;
  source: string;
  data: any;
  timestamp: number;
}

interface ActiveSub {
  methodName: string;
  source: string;
  unsub: { unsubscribe: () => void };
  eventCount: number;
  startedAt: number;
}

interface LogItem {
  id: number;
  ts: number;
  level: string;
  msg: string;
}

const logCounter = 0;

function CompactDashboard({
  dashboard,
  rpcMessage,
  onRpcMessageChange,
  onSendRpc,
}: {
  dashboard: any;
  rpcMessage: string;
  onRpcMessageChange: (v: string) => void;
  onSendRpc: () => void;
}) {
  const logRef = useRef<HTMLDivElement>(null);

  const logs: LogItem[] = dashboard.logs || [];
  const onClearLogs = dashboard.onClearLogs;

  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [logs.length]);

  const cs = dashboard.connectionStatus;
  const stats = dashboard.stats;
  const state = cs?.state || 'IDLE';
  const isReady = state === 'READY';

  const stateColor: Record<string, string> = {
    IDLE: '#6b7280',
    CONNECTING: '#f59e0b',
    READY: '#10b981',
    TRANSIENT_FAILURE: '#ef4444',
    DISCONNECTING: '#8b5cf6',
    CLOSED: '#374151',
  };
  const sc = stateColor[state] || '#6b7280';

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        height: '100%',
      }}
    >
      <div style={{ display: 'flex', gap: 12, flexShrink: 0 }}>
        <div
          style={{
            flex: 1,
            backgroundColor: '#fff',
            borderRadius: 10,
            border: '1px solid #e2e8f0',
            padding: 14,
          }}
        >
          <div
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: '#94a3b8',
              textTransform: 'uppercase',
              marginBottom: 8,
            }}
          >
            Connection
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                backgroundColor: sc,
                display: 'inline-block',
                boxShadow: isReady ? `0 0 6px ${sc}` : 'none',
              }}
            />
            <span style={{ fontWeight: 600, color: sc, fontSize: 13 }}>
              {state}
            </span>
          </div>
          {cs && (
            <div
              style={{
                marginTop: 8,
                fontSize: 11,
                color: '#94a3b8',
                display: 'grid',
                gridTemplateColumns: 'auto 1fr',
                gap: '2px 8px',
              }}
            >
              <span>From:</span>
              <span style={{ fontFamily: 'monospace', color: '#334155' }}>
                {cs.fromId}
              </span>
              <span>To:</span>
              <span style={{ fontFamily: 'monospace', color: '#334155' }}>
                {cs.toId}
              </span>
            </div>
          )}
        </div>

        <div
          style={{
            flex: 1,
            backgroundColor: '#fff',
            borderRadius: 10,
            border: '1px solid #e2e8f0',
            padding: 14,
          }}
        >
          <div
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: '#94a3b8',
              textTransform: 'uppercase',
              marginBottom: 8,
            }}
          >
            Stats
          </div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr 1fr',
              gap: 6,
            }}
          >
            {[
              { l: 'Calls', v: stats?.totalRpcCalls ?? 0 },
              { l: 'Success', v: stats?.successfulCalls ?? 0 },
              { l: 'Failed', v: stats?.failedCalls ?? 0 },
              { l: 'Latency', v: `${(stats?.avgLatencyMs ?? 0).toFixed(0)}ms` },
              { l: 'Reconnects', v: stats?.totalReconnects ?? 0 },
              {
                l: 'Rate',
                v:
                  stats && stats.totalRpcCalls > 0
                    ? `${(
                        (stats.successfulCalls / stats.totalRpcCalls) *
                        100
                      ).toFixed(0)}%`
                    : '-',
              },
            ].map((s) => (
              <div
                key={s.l}
                style={{
                  backgroundColor: '#f8fafc',
                  borderRadius: 4,
                  padding: '4px 6px',
                }}
              >
                <div style={{ fontSize: 9, color: '#94a3b8' }}>{s.l}</div>
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    fontFamily: 'monospace',
                    color: '#334155',
                  }}
                >
                  {s.v}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div
          style={{
            flex: 0,
            backgroundColor: '#fff',
            borderRadius: 10,
            border: '1px solid #e2e8f0',
            padding: 14,
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
          }}
        >
          <div
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: '#94a3b8',
              textTransform: 'uppercase',
              marginBottom: 2,
            }}
          >
            Actions
          </div>
          <button
            onClick={dashboard.onConnect}
            disabled={isReady}
            style={{
              padding: '5px 14px',
              fontSize: 12,
              fontWeight: 600,
              border: 'none',
              borderRadius: 6,
              backgroundColor: isReady ? '#d1d5db' : '#3b82f6',
              color: '#fff',
              cursor: isReady ? 'not-allowed' : 'pointer',
            }}
          >
            Connect
          </button>
          <button
            onClick={dashboard.onDisconnect}
            disabled={!isReady}
            style={{
              padding: '5px 14px',
              fontSize: 12,
              fontWeight: 600,
              border: 'none',
              borderRadius: 6,
              backgroundColor: isReady ? '#ef4444' : '#d1d5db',
              color: '#fff',
              cursor: isReady ? 'pointer' : 'not-allowed',
            }}
          >
            Disconnect
          </button>
          <button
            onClick={dashboard.onSimulateLost}
            disabled={!isReady}
            style={{
              padding: '5px 14px',
              fontSize: 12,
              fontWeight: 600,
              border: isReady ? '1px solid #f59e0b' : '1px solid #d1d5db',
              borderRadius: 6,
              backgroundColor: isReady ? '#fffbeb' : '#f9fafb',
              color: isReady ? '#b45309' : '#9ca3af',
              cursor: isReady ? 'pointer' : 'not-allowed',
            }}
          >
            Sim Lost
          </button>
        </div>
      </div>

      <div
        style={{
          display: 'flex',
          gap: 12,
          alignItems: 'center',
          flexShrink: 0,
        }}
      >
        <div
          style={{
            fontSize: 11,
            fontWeight: 600,
            color: '#94a3b8',
            textTransform: 'uppercase',
            flexShrink: 0,
          }}
        >
          Send RPC
        </div>
        <input
          type="text"
          placeholder="Type a message..."
          value={rpcMessage}
          onChange={(e) => onRpcMessageChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') onSendRpc();
          }}
          disabled={!isReady}
          style={{
            flex: 1,
            padding: '6px 10px',
            fontSize: 12,
            fontFamily: 'monospace',
            border: '1px solid #e2e8f0',
            borderRadius: 6,
            backgroundColor: isReady ? '#fff' : '#f9fafb',
          }}
        />
        <button
          onClick={onSendRpc}
          disabled={!isReady}
          style={{
            padding: '6px 16px',
            fontSize: 12,
            fontWeight: 600,
            border: 'none',
            borderRadius: 6,
            backgroundColor: isReady ? '#10b981' : '#d1d5db',
            color: '#fff',
            cursor: isReady ? 'pointer' : 'not-allowed',
            whiteSpace: 'nowrap',
          }}
        >
          Send
        </button>
      </div>

      <div
        style={{
          backgroundColor: '#111827',
          borderRadius: 8,
          padding: 8,
          flex: 1,
          minHeight: 0,
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            marginBottom: 4,
            flexShrink: 0,
          }}
        >
          <span style={{ fontSize: 10, color: '#6b7280', fontWeight: 600 }}>
            Event Log ({logs.length})
          </span>
          <button
            onClick={onClearLogs}
            style={{
              fontSize: 10,
              border: '1px solid #374151',
              borderRadius: 3,
              backgroundColor: 'transparent',
              color: '#6b7280',
              cursor: 'pointer',
              padding: '0 6px',
            }}
          >
            Clear
          </button>
        </div>
        <div
          ref={logRef}
          style={{
            fontFamily: 'monospace',
            fontSize: 11,
            lineHeight: 1.5,
            flex: 1,
            minHeight: 0,
            overflow: 'auto',
          }}
        >
          {logs.length === 0 && (
            <div style={{ color: '#4b5563', textAlign: 'center', padding: 12 }}>
              Waiting for events...
            </div>
          )}
          {logs.map((l: any) => (
            <div
              key={l.id}
              style={{ display: 'flex', gap: 6, color: '#d1d5db' }}
            >
              <span style={{ color: '#4b5563', flexShrink: 0 }}>
                {new Date(l.timestamp).toLocaleTimeString('en-US', {
                  hour12: false,
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit',
                })}
              </span>
              <span
                style={{
                  color:
                    l.level === 'success'
                      ? '#10b981'
                      : l.level === 'error'
                      ? '#ef4444'
                      : l.level === 'warn'
                      ? '#f59e0b'
                      : '#6b7280',
                  flexShrink: 0,
                }}
              >
                {l.level === 'success'
                  ? '✓'
                  : l.level === 'error'
                  ? '✗'
                  : l.level === 'warn'
                  ? '⚠'
                  : '·'}
              </span>
              <span style={{ color: '#6b7280', flexShrink: 0 }}>
                [{l.source}]
              </span>
              <span>{l.message}</span>
              {l.detail && <span style={{ color: '#4b5563' }}>{l.detail}</span>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function App(): JSX.Element {
  const [panel, setPanel] = useState<PanelId>('dashboard');
  const [activeTab, setActiveTab] = useState<TabId>('shared');
  const [results, setResults] = useState<CallResult[]>([]);
  const [loading, setLoading] = useState<string | null>(null);
  const [paramValues, setParamValues] = useState<Record<string, string>>({});
  const [activeSubs, setActiveSubs] = useState<Map<string, ActiveSub>>(
    new Map()
  );
  const [subEvents, setSubEvents] = useState<SubEvent[]>([]);
  const subEventIdRef = useRef(0);

  const dashboard = useOrchestratorDashboard({
    participants: [
      { id: 'renderer', type: 'renderer' },
      { id: 'main-pagelet', type: 'utility' },
      { id: 'shared', type: 'utility' },
      { id: 'daemon', type: 'utility' },
    ],
    api: client as unknown as OrchestratorAPI,
    sendRpc: async (message: string) => {
      return pageletClient.callSharedEcho(message);
    },
  });

  const state = dashboard.connectionStatus?.state || 'IDLE';
  const isReady = state === 'READY';
  const currentTab = TABS.find((t) => t.id === activeTab)!;
  const [dashboardRpcMessage, setDashboardRpcMessage] = useState(
    'hello from renderer'
  );

  const handleDashboardSendRpc = useCallback(async () => {
    if (!isReady || !dashboardRpcMessage.trim()) return;
    dashboard.onSendRpc(dashboardRpcMessage.trim());
  }, [isReady, dashboardRpcMessage, dashboard]);

  const handleSubscribe = useCallback(
    (methodName: string, source: string) => {
      if (!isReady || activeSubs.has(methodName)) return;

      const callback = (data: any) => {
        subEventIdRef.current++;
        setSubEvents((prev) => [
          {
            id: subEventIdRef.current,
            source,
            data,
            timestamp: Date.now(),
          },
          ...prev.slice(0, 199),
        ]);
        setActiveSubs((prev: Map<string, ActiveSub>) => {
          const next = new Map(prev);
          const entry = next.get(methodName);
          if (entry) {
            next.set(methodName, {
              ...entry,
              eventCount: entry.eventCount + 1,
            });
          }
          return next;
        });
      };

      const unsub = (pageletClient as any)[methodName](callback);
      setActiveSubs((prev: Map<string, ActiveSub>) => {
        const next = new Map(prev);
        next.set(methodName, {
          methodName,
          source,
          unsub,
          eventCount: 0,
          startedAt: Date.now(),
        });
        return next;
      });
    },
    [isReady, activeSubs]
  );

  const handleUnsubscribe = useCallback((methodName: string) => {
    setActiveSubs((prev) => {
      const entry = prev.get(methodName);
      entry?.unsub.unsubscribe();
      const next = new Map(prev);
      next.delete(methodName);
      return next;
    });
  }, []);

  const handleCall = useCallback(
    (method: MethodDef) => {
      if (!isReady) return;
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
    [isReady, paramValues, activeTab]
  );

  const latestForMethod = (methodName: string): CallResult | undefined => {
    return results.find((r) => r.method === methodName);
  };

  const stateColor =
    state === 'READY'
      ? '#10b981'
      : state === 'CONNECTING' || state === 'TRANSIENT_FAILURE'
      ? '#f59e0b'
      : '#6b7280';

  return (
    <div
      style={{
        fontFamily:
          "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        backgroundColor: '#f1f5f9',
        height: '100vh',
        display: 'flex',
      }}
    >
      <div
        style={{
          width: 56,
          backgroundColor: '#1e293b',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          paddingTop: 16,
          gap: 4,
          flexShrink: 0,
        }}
      >
        <button
          onClick={() => setPanel('dashboard')}
          style={{
            width: 40,
            height: 40,
            border: 'none',
            borderRadius: 8,
            backgroundColor:
              panel === 'dashboard' ? 'rgba(255,255,255,0.12)' : 'transparent',
            color: panel === 'dashboard' ? '#e2e8f0' : '#64748b',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 12,
            fontWeight: 700,
            transition: 'all 0.15s',
            flexDirection: 'column',
            gap: 2,
          }}
          title="Dashboard"
        >
          <span style={{ fontSize: 16 }}>▦</span>
          <span style={{ fontSize: 8 }}>Dash</span>
        </button>
        <button
          onClick={() => setPanel('rpc')}
          style={{
            width: 40,
            height: 40,
            border: 'none',
            borderRadius: 8,
            backgroundColor:
              panel === 'rpc' ? 'rgba(255,255,255,0.12)' : 'transparent',
            color: panel === 'rpc' ? '#e2e8f0' : '#64748b',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 12,
            fontWeight: 700,
            transition: 'all 0.15s',
            flexDirection: 'column',
            gap: 2,
          }}
          title="RPC Explorer"
        >
          <span style={{ fontSize: 16 }}>⟐</span>
          <span style={{ fontSize: 8 }}>RPC</span>
        </button>
        <div style={{ flex: 1 }} />
        <div
          style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            backgroundColor: stateColor,
            marginBottom: 16,
            boxShadow: isReady ? `0 0 6px ${stateColor}` : 'none',
          }}
        />
      </div>

      <div
        style={{
          flex: 1,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div
          style={{
            background: 'linear-gradient(135deg, #1e293b 0%, #334155 100%)',
            padding: '12px 24px',
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            gap: 16,
            flexShrink: 0,
          }}
        >
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 16, fontWeight: 700, letterSpacing: -0.3 }}>
              Pagelet Proxy
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 400,
                  color: '#64748b',
                  marginLeft: 12,
                }}
              >
                {panel === 'dashboard' ? 'Dashboard' : 'RPC Explorer'}
              </span>
            </div>
            <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 1 }}>
              Renderer → Pagelet → Shared / Daemon / Main
            </div>
          </div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '4px 12px',
              borderRadius: 20,
              backgroundColor: 'rgba(255,255,255,0.1)',
            }}
          >
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                backgroundColor: stateColor,
                display: 'inline-block',
              }}
            />
            <span style={{ fontSize: 11, color: '#e2e8f0' }}>{state}</span>
          </div>
        </div>

        <div
          style={{
            flex: 1,
            minHeight: 0,
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {panel === 'dashboard' ? (
            <div
              style={{
                flex: 1,
                minHeight: 0,
                padding: 16,
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              <CompactDashboard
                dashboard={dashboard}
                rpcMessage={dashboardRpcMessage}
                onRpcMessageChange={setDashboardRpcMessage}
                onSendRpc={handleDashboardSendRpc}
              />
            </div>
          ) : (
            <div style={{ padding: 16 }}>
              <div
                style={{
                  display: 'flex',
                  gap: 2,
                  backgroundColor: '#fff',
                  borderRadius: 10,
                  padding: 4,
                  marginBottom: 16,
                  border: '1px solid #e2e8f0',
                }}
              >
                {TABS.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    style={{
                      flex: 1,
                      padding: '8px 16px',
                      fontSize: 13,
                      fontWeight: activeTab === tab.id ? 600 : 400,
                      border: 'none',
                      borderRadius: 8,
                      backgroundColor:
                        activeTab === tab.id ? `${tab.color}15` : 'transparent',
                      color: activeTab === tab.id ? tab.color : '#64748b',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: 12,
                }}
              >
                {currentTab.methods.map((method) => {
                  const isActive = activeSubs.has(method.name);
                  const subInfo = activeSubs.get(method.name);

                  if (method.isSubscription) {
                    return (
                      <div
                        key={method.name}
                        style={{
                          backgroundColor: '#fff',
                          borderRadius: 10,
                          border: `1px solid ${
                            isActive ? '#10b981' : '#e2e8f0'
                          }`,
                          padding: 16,
                        }}
                      >
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            marginBottom: 8,
                          }}
                        >
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 8,
                            }}
                          >
                            <span
                              style={{
                                width: 8,
                                height: 8,
                                borderRadius: isActive ? '50%' : 3,
                                backgroundColor: isActive
                                  ? '#10b981'
                                  : currentTab.color,
                                display: 'inline-block',
                                boxShadow: isActive
                                  ? '0 0 6px #10b981'
                                  : 'none',
                              }}
                            />
                            <span
                              style={{
                                fontFamily: 'monospace',
                                fontSize: 14,
                                fontWeight: 600,
                                color: '#1e293b',
                              }}
                            >
                              {method.name}()
                            </span>
                          </div>
                          <button
                            onClick={() =>
                              isActive
                                ? handleUnsubscribe(method.name)
                                : handleSubscribe(method.name, currentTab.label)
                            }
                            disabled={!isReady}
                            style={{
                              padding: '5px 14px',
                              fontSize: 12,
                              fontWeight: 600,
                              border: 'none',
                              borderRadius: 6,
                              backgroundColor: isActive
                                ? '#ef4444'
                                : isReady
                                ? '#10b981'
                                : '#d1d5db',
                              color: '#fff',
                              cursor: isReady ? 'pointer' : 'not-allowed',
                            }}
                          >
                            {isActive ? 'Unsub' : 'Subscribe'}
                          </button>
                        </div>

                        <div
                          style={{
                            fontSize: 11,
                            color: '#94a3b8',
                            marginBottom: 8,
                          }}
                        >
                          {method.description}
                        </div>

                        {isActive && subInfo && (
                          <div
                            style={{
                              display: 'flex',
                              gap: 8,
                              fontSize: 11,
                            }}
                          >
                            <span
                              style={{
                                padding: '2px 8px',
                                backgroundColor: '#f0fdf4',
                                border: '1px solid #bbf7d0',
                                borderRadius: 4,
                                color: '#166534',
                                fontWeight: 600,
                              }}
                            >
                              LIVE
                            </span>
                            <span style={{ color: '#64748b' }}>
                              Events: {subInfo.eventCount}
                            </span>
                            <span style={{ color: '#94a3b8' }}>
                              Since:{' '}
                              {new Date(subInfo.startedAt).toLocaleTimeString()}
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  }

                  const latest = latestForMethod(method.name);
                  return (
                    <div
                      key={method.name}
                      style={{
                        backgroundColor: '#fff',
                        borderRadius: 10,
                        border: '1px solid #e2e8f0',
                        padding: 16,
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          marginBottom: 8,
                        }}
                      >
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                          }}
                        >
                          <span
                            style={{
                              width: 8,
                              height: 8,
                              borderRadius: 3,
                              backgroundColor: currentTab.color,
                              display: 'inline-block',
                            }}
                          />
                          <span
                            style={{
                              fontFamily: 'monospace',
                              fontSize: 14,
                              fontWeight: 600,
                              color: '#1e293b',
                            }}
                          >
                            {method.name}()
                          </span>
                        </div>
                        <button
                          onClick={() => handleCall(method)}
                          disabled={!isReady || loading === method.name}
                          style={{
                            padding: '5px 14px',
                            fontSize: 12,
                            fontWeight: 600,
                            border: 'none',
                            borderRadius: 6,
                            backgroundColor:
                              isReady && loading !== method.name
                                ? currentTab.color
                                : '#d1d5db',
                            color: '#fff',
                            cursor:
                              isReady && loading !== method.name
                                ? 'pointer'
                                : 'not-allowed',
                          }}
                        >
                          {loading === method.name ? '...' : 'Call'}
                        </button>
                      </div>

                      <div
                        style={{
                          fontSize: 11,
                          color: '#94a3b8',
                          marginBottom: method.params ? 10 : 0,
                        }}
                      >
                        {method.description}
                      </div>

                      {method.params && (
                        <div
                          style={{
                            display: 'flex',
                            gap: 8,
                            flexWrap: 'wrap',
                            marginBottom: latest ? 10 : 0,
                          }}
                        >
                          {method.params.map((p) => (
                            <div
                              key={p.key}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 4,
                              }}
                            >
                              <span
                                style={{
                                  fontSize: 11,
                                  color: '#64748b',
                                  fontWeight: 500,
                                }}
                              >
                                {p.label}
                              </span>
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
                                disabled={!isReady}
                                style={{
                                  padding: '3px 8px',
                                  fontSize: 12,
                                  fontFamily: 'monospace',
                                  border: '1px solid #e2e8f0',
                                  borderRadius: 4,
                                  width: 140,
                                  backgroundColor: isReady ? '#fff' : '#f9fafb',
                                }}
                              />
                            </div>
                          ))}
                        </div>
                      )}

                      {latest && (
                        <div
                          style={{
                            padding: '6px 10px',
                            fontSize: 12,
                            fontFamily: 'monospace',
                            backgroundColor: latest.error
                              ? '#fef2f2'
                              : '#f0fdf4',
                            border: `1px solid ${
                              latest.error ? '#fecaca' : '#bbf7d0'
                            }`,
                            borderRadius: 6,
                            color: latest.error ? '#991b1b' : '#166534',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                          }}
                        >
                          <span
                            style={{
                              flex: 1,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {latest.error
                              ? latest.error
                              : typeof latest.value === 'object'
                              ? JSON.stringify(latest.value)
                              : String(latest.value)}
                          </span>
                          <span
                            style={{
                              fontSize: 10,
                              color: '#94a3b8',
                              flexShrink: 0,
                            }}
                          >
                            {latest.latencyMs}ms
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {activeTab === 'subscriptions' && subEvents.length > 0 && (
                <div
                  style={{
                    marginTop: 16,
                    backgroundColor: '#111827',
                    borderRadius: 10,
                    padding: 12,
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      marginBottom: 8,
                    }}
                  >
                    <span
                      style={{
                        fontSize: 12,
                        fontWeight: 600,
                        color: '#94a3b8',
                        textTransform: 'uppercase',
                      }}
                    >
                      Subscription Events ({subEvents.length})
                    </span>
                    <button
                      onClick={() => setSubEvents([])}
                      style={{
                        fontSize: 10,
                        border: '1px solid #374151',
                        borderRadius: 3,
                        backgroundColor: 'transparent',
                        color: '#6b7280',
                        cursor: 'pointer',
                        padding: '0 6px',
                      }}
                    >
                      Clear
                    </button>
                  </div>
                  <div
                    style={{
                      fontFamily: 'monospace',
                      fontSize: 11,
                      lineHeight: 1.6,
                      maxHeight: 300,
                      overflow: 'auto',
                    }}
                  >
                    {subEvents.slice(0, 50).map((evt) => (
                      <div
                        key={evt.id}
                        style={{ display: 'flex', gap: 8, color: '#d1d5db' }}
                      >
                        <span style={{ color: '#4b5563', flexShrink: 0 }}>
                          {new Date(evt.timestamp).toLocaleTimeString('en-US', {
                            hour12: false,
                            hour: '2-digit',
                            minute: '2-digit',
                            second: '2-digit',
                          })}
                        </span>
                        <span style={{ color: '#10b981', flexShrink: 0 }}>
                          [{evt.source}]
                        </span>
                        <span
                          style={{
                            color: '#9ca3af',
                            flex: 1,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {typeof evt.data === 'object'
                            ? JSON.stringify(evt.data)
                            : String(evt.data)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {results.length > 0 && (
                <div
                  style={{
                    marginTop: 16,
                    backgroundColor: '#fff',
                    borderRadius: 10,
                    border: '1px solid #e2e8f0',
                    padding: 16,
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginBottom: 8,
                    }}
                  >
                    <span
                      style={{
                        fontSize: 12,
                        fontWeight: 600,
                        color: '#64748b',
                        textTransform: 'uppercase',
                        letterSpacing: 0.5,
                      }}
                    >
                      Call History
                    </span>
                    <button
                      onClick={() => setResults([])}
                      style={{
                        padding: '2px 8px',
                        fontSize: 11,
                        border: '1px solid #e5e7eb',
                        borderRadius: 4,
                        backgroundColor: '#fff',
                        cursor: 'pointer',
                        color: '#6b7280',
                      }}
                    >
                      Clear
                    </button>
                  </div>
                  {results.slice(0, 20).map((r, i) => {
                    const tab = TABS.find((t) => t.id === r.tabId);
                    return (
                      <div
                        key={i}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8,
                          padding: '5px 0',
                          borderBottom: '1px solid #f1f5f9',
                          fontSize: 11,
                        }}
                      >
                        <span
                          style={{
                            width: 6,
                            height: 6,
                            borderRadius: '50%',
                            backgroundColor: r.error ? '#ef4444' : '#10b981',
                            flexShrink: 0,
                          }}
                        />
                        <span
                          style={{
                            width: 6,
                            height: 6,
                            borderRadius: 2,
                            backgroundColor: tab?.color ?? '#6b7280',
                            flexShrink: 0,
                          }}
                        />
                        <span
                          style={{
                            fontFamily: 'monospace',
                            fontWeight: 600,
                            color: '#334155',
                            width: 90,
                          }}
                        >
                          {r.method}()
                        </span>
                        {Object.keys(r.params).length > 0 && (
                          <span style={{ color: '#94a3b8', flexShrink: 0 }}>
                            {Object.entries(r.params)
                              .map(([k, v]) => `${k}="${v}"`)
                              .join(', ')}
                          </span>
                        )}
                        <span style={{ flex: 1 }} />
                        <span
                          style={{
                            color: r.error ? '#ef4444' : '#334155',
                            fontFamily: 'monospace',
                            maxWidth: 300,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {r.error
                            ? r.error
                            : typeof r.value === 'object'
                            ? JSON.stringify(r.value)
                            : String(r.value)}
                        </span>
                        <span
                          style={{
                            color: '#d1d5db',
                            flexShrink: 0,
                            width: 36,
                            textAlign: 'right',
                          }}
                        >
                          {r.latencyMs}ms
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;
