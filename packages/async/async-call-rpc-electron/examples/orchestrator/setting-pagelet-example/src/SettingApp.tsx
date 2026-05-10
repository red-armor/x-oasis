import { useState, useCallback, useEffect } from 'react';
import { createOrchestratorClient } from '@x-oasis/async-call-rpc-electron/browser';

const client = createOrchestratorClient({
  directChannelDescription: 'setting-page↔preload',
  ipcChannelDescription: 'setting-page↔preload:ipc',
});

const settingClient = client.getService<any>('setting-api');

interface LogEntry {
  id: number;
  method: string;
  result: string;
  latencyMs: number;
  error?: string;
  timestamp: number;
}

let logIdCounter = 0;

function SettingApp() {
  const [selectedTheme, setSelectedTheme] = useState<string>('light');
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    client
      .connect()
      .then(() => setConnected(true))
      .catch((err: any) => {
        console.error('[setting] connect failed:', err);
        addLog('connect', null, 0, err.message);
      });
  }, []);

  const addLog = useCallback(
    (method: string, result: any, latencyMs: number, error?: string) => {
      setLogs((prev) => [
        {
          id: ++logIdCounter,
          method,
          result:
            typeof result === 'object'
              ? JSON.stringify(result)
              : String(result),
          latencyMs,
          error,
          timestamp: Date.now(),
        },
        ...prev.slice(0, 49),
      ]);
    },
    []
  );

  const callMethod = useCallback(
    async (method: string, ...args: any[]) => {
      setLoading(method);
      const start = performance.now();
      try {
        const result = await settingClient[method](...args);
        addLog(method, result, Math.round(performance.now() - start));
        return result;
      } catch (err: any) {
        addLog(
          method,
          null,
          Math.round(performance.now() - start),
          err.message
        );
      } finally {
        setLoading(null);
      }
    },
    [addLog]
  );

  const handleSetTheme = useCallback(
    async (theme: string) => {
      setSelectedTheme(theme);
      await callMethod('setTheme', theme);
    },
    [callMethod]
  );

  return (
    <div
      style={{
        fontFamily:
          "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        backgroundColor: '#f8fafc',
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div
        style={{
          background: 'linear-gradient(135deg, #7c3aed 0%, #a78bfa 100%)',
          padding: '16px 24px',
          color: '#fff',
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div>
          <div style={{ fontSize: 16, fontWeight: 700 }}>Settings Window B</div>
          <div
            style={{
              fontSize: 11,
              color: 'rgba(255,255,255,0.7)',
              marginTop: 2,
            }}
          >
            All calls via setting-pagelet → shared / daemon / main
          </div>
        </div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '4px 12px',
            borderRadius: 20,
            backgroundColor: 'rgba(255,255,255,0.15)',
          }}
        >
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              backgroundColor: connected ? '#10b981' : '#f59e0b',
              display: 'inline-block',
              boxShadow: connected ? '0 0 6px #10b981' : 'none',
            }}
          />
          <span style={{ fontSize: 11 }}>
            {connected ? 'Connected' : 'Connecting...'}
          </span>
        </div>
      </div>

      <div
        style={{
          flex: 1,
          overflow: 'auto',
          padding: 16,
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
        }}
      >
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
              fontSize: 13,
              fontWeight: 600,
              marginBottom: 12,
              color: '#1e293b',
            }}
          >
            Change Main Window Theme
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {['light', 'dark'].map((t) => (
              <button
                key={t}
                onClick={() => handleSetTheme(t)}
                disabled={loading !== null}
                style={{
                  flex: 1,
                  padding: '12px',
                  fontSize: 14,
                  fontWeight: 600,
                  border:
                    selectedTheme === t
                      ? `2px solid ${t === 'dark' ? '#7c3aed' : '#3b82f6'}`
                      : '1px solid #e2e8f0',
                  borderRadius: 8,
                  backgroundColor:
                    t === 'dark'
                      ? selectedTheme === t
                        ? '#7c3aed'
                        : '#1e293b'
                      : selectedTheme === t
                      ? '#3b82f6'
                      : '#ffffff',
                  color:
                    t === 'dark'
                      ? '#fff'
                      : selectedTheme === t
                      ? '#fff'
                      : '#334155',
                  cursor: loading !== null ? 'not-allowed' : 'pointer',
                }}
              >
                {t === 'dark' ? '🌙 Dark' : '☀️ Light'}
              </button>
            ))}
          </div>
        </div>

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
              fontSize: 13,
              fontWeight: 600,
              marginBottom: 12,
              color: '#1e293b',
            }}
          >
            Shared Process (via Pagelet)
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <ActionBtn
              label="Get Theme"
              loading={loading === 'getTheme'}
              onClick={() => callMethod('getTheme')}
            />
            <ActionBtn
              label="Get Config"
              loading={loading === 'getSharedConfig'}
              onClick={() => callMethod('getSharedConfig', 'theme')}
            />
            <ActionBtn
              label="Get State"
              loading={loading === 'getSharedState'}
              onClick={() => callMethod('getSharedState')}
            />
            <ActionBtn
              label="Echo"
              loading={loading === 'echoShared'}
              onClick={() => callMethod('echoShared', 'hello from setting')}
            />
          </div>
        </div>

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
              fontSize: 13,
              fontWeight: 600,
              marginBottom: 12,
              color: '#1e293b',
            }}
          >
            Daemon Process (via Pagelet)
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <ActionBtn
              label="System Status"
              loading={loading === 'getSystemStatus'}
              onClick={() => callMethod('getSystemStatus')}
            />
            <ActionBtn
              label="Daemon Info"
              loading={loading === 'getDaemonInfo'}
              onClick={() => callMethod('getDaemonInfo')}
            />
            <ActionBtn
              label="Echo"
              loading={loading === 'echoDaemon'}
              onClick={() => callMethod('echoDaemon', 'hello from setting')}
            />
          </div>
        </div>

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
              fontSize: 13,
              fontWeight: 600,
              marginBottom: 12,
              color: '#1e293b',
            }}
          >
            Pagelet Info
          </div>
          <ActionBtn
            label="Pagelet Info"
            loading={loading === 'info'}
            onClick={() => callMethod('info')}
          />
        </div>

        <div
          style={{
            backgroundColor: '#111827',
            borderRadius: 8,
            padding: 12,
            flex: 1,
            minHeight: 120,
            overflow: 'auto',
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              marginBottom: 8,
            }}
          >
            <span style={{ fontSize: 11, color: '#6b7280', fontWeight: 600 }}>
              Call Log ({logs.length})
            </span>
            <button
              onClick={() => setLogs([])}
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
          {logs.length === 0 && (
            <div
              style={{
                color: '#4b5563',
                textAlign: 'center',
                padding: 12,
                fontSize: 12,
              }}
            >
              Click a button above to make RPC calls...
            </div>
          )}
          {logs.map((l) => (
            <div
              key={l.id}
              style={{
                display: 'flex',
                gap: 6,
                fontSize: 11,
                fontFamily: 'monospace',
                color: '#d1d5db',
                padding: '3px 0',
                borderBottom: '1px solid #1f2937',
              }}
            >
              <span
                style={{
                  color: l.error ? '#ef4444' : '#10b981',
                  flexShrink: 0,
                }}
              >
                {l.error ? '✗' : '✓'}
              </span>
              <span style={{ color: '#a78bfa', width: 140, flexShrink: 0 }}>
                {l.method}()
              </span>
              <span
                style={{
                  flex: 1,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  color: l.error ? '#ef4444' : '#94a3b8',
                }}
              >
                {l.error || l.result}
              </span>
              <span style={{ color: '#4b5563', flexShrink: 0 }}>
                {l.latencyMs}ms
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ActionBtn({
  label,
  loading,
  onClick,
}: {
  label: string;
  loading: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      style={{
        padding: '6px 14px',
        fontSize: 12,
        fontWeight: 600,
        border: '1px solid #e2e8f0',
        borderRadius: 6,
        backgroundColor: loading ? '#f1f5f9' : '#fff',
        color: loading ? '#94a3b8' : '#334155',
        cursor: loading ? 'not-allowed' : 'pointer',
      }}
    >
      {loading ? '...' : label}
    </button>
  );
}

export default SettingApp;
