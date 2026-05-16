import { useState, useCallback } from 'react';
import { createOrchestratorClient } from '@x-oasis/async-call-rpc-electron/browser/orchestrator';
import useOrchestratorDashboard, {
  OrchestratorAPI,
} from '@shared-ui/useOrchestratorDashboard';

const urlParams = new URLSearchParams(window.location.search);
const pageId = urlParams.get('pageId') || 'pageA';
const pageletId = `pagelet-${pageId.replace('page', '').toUpperCase()}`;

const PAGE_COLORS: Record<string, string> = {
  pageA: '#3b82f6',
  pageB: '#8b5cf6',
  pageC: '#10b981',
};
const pageColor = PAGE_COLORS[pageId] || '#3b82f6';

const client = createOrchestratorClient({
  directChannelDescription: `${pageId}↔preload`,
  ipcChannelDescription: `${pageId}↔preload:ipc`,
});

const pageletClient = client.getProxy<any>('pagelet-api');

type TabId = 'pagelet' | 'shared' | 'daemon' | 'main';

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

const TABS: TabDef[] = [
  {
    id: 'pagelet',
    label: 'Pagelet',
    color: pageColor,
    methods: [
      {
        name: 'info',
        description: `Get ${pageletId} process info`,
        invoke: () => pageletClient.info(),
      },
    ],
  },
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
      {
        name: 'setConfig',
        description: 'Set config value',
        params: [
          { key: 'key', label: 'Key', defaultValue: 'theme' },
          { key: 'value', label: 'Value', defaultValue: 'light' },
        ],
        invoke: (p) => pageletClient.callSharedSetConfig(p.key, p.value),
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

function App(): JSX.Element {
  const [activeTab, setActiveTab] = useState<TabId>('pagelet');
  const [results, setResults] = useState<CallResult[]>([]);
  const [loading, setLoading] = useState<string | null>(null);
  const [paramValues, setParamValues] = useState<Record<string, string>>({});

  const dashboard = useOrchestratorDashboard({
    participants: [
      { id: pageId, type: 'renderer' },
      { id: pageletId, type: 'utility' },
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

  const cs = dashboard.connectionStatus;
  const stats = dashboard.stats;

  return (
    <div
      style={{
        fontFamily:
          "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        backgroundColor: '#f1f5f9',
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div
        style={{
          background: `linear-gradient(135deg, ${pageColor}dd 0%, ${pageColor}99 100%)`,
          padding: '14px 24px',
          color: '#fff',
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          flexShrink: 0,
        }}
      >
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 16, fontWeight: 700, letterSpacing: -0.3 }}>
            {pageId}
            <span
              style={{
                fontSize: 11,
                fontWeight: 400,
                color: 'rgba(255,255,255,0.7)',
                marginLeft: 12,
              }}
            >
              Multi-Pagelet Example
            </span>
          </div>
          <div
            style={{
              fontSize: 11,
              color: 'rgba(255,255,255,0.8)',
              marginTop: 1,
            }}
          >
            {pageId} (renderer) ↔ {pageletId} (utility) ↔ shared / daemon / main
          </div>
        </div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '4px 12px',
            borderRadius: 20,
            backgroundColor: 'rgba(255,255,255,0.2)',
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
          <span style={{ fontSize: 11, color: '#fff' }}>{state}</span>
        </div>
      </div>

      <div
        style={{
          display: 'flex',
          gap: 12,
          padding: '12px 16px',
          flexShrink: 0,
        }}
      >
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
            Connection: {pageId} ↔ {pageletId}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                backgroundColor: stateColor,
                display: 'inline-block',
                boxShadow: isReady ? `0 0 6px ${stateColor}` : 'none',
              }}
            />
            <span style={{ fontWeight: 600, color: stateColor, fontSize: 13 }}>
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
              {
                l: 'Latency',
                v: `${(stats?.avgLatencyMs ?? 0).toFixed(0)}ms`,
              },
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
          gap: 2,
          backgroundColor: '#fff',
          borderRadius: 10,
          padding: 4,
          margin: '0 16px',
          border: '1px solid #e2e8f0',
          flexShrink: 0,
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
          flex: 1,
          minHeight: 0,
          padding: 16,
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
          overflow: 'auto',
        }}
      >
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 12,
          }}
        >
          {currentTab.methods.map((method) => {
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
                      backgroundColor: latest.error ? '#fef2f2' : '#f0fdf4',
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

        {results.length > 0 && (
          <div
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
    </div>
  );
}

export default App;
