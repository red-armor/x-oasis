import React, { useState, useEffect, useRef, useCallback } from 'react';

export type ConnectionState =
  | 'IDLE'
  | 'CONNECTING'
  | 'READY'
  | 'TRANSIENT_FAILURE'
  | 'DISCONNECTING'
  | 'CLOSED';

export interface LogEntry {
  id: string;
  timestamp: number;
  level: 'info' | 'warn' | 'error' | 'success' | 'debug';
  source: string;
  message: string;
  detail?: string;
}

export interface ConnectionStatus {
  connectionId: string;
  fromId: string;
  toId: string;
  state: ConnectionState;
  lastStateChangedAt: number;
  error?: string;
}

export interface StateTransitionEntry {
  /** epoch ms */
  at: number;
  prev: ConnectionState;
  curr: ConnectionState;
  reason?: string;
}

export interface StatsInfo {
  totalRpcCalls: number;
  successfulCalls: number;
  failedCalls: number;
  avgLatencyMs: number;
  totalReconnects: number;
  /**
   * Ring buffer of recent connection-state transitions, populated when
   * the orchestrator is constructed with `enableStats: true`. Optional
   * for back-compat with examples that don't expose it yet.
   */
  stateTransitions?: StateTransitionEntry[];
}

export interface ParticipantInfo {
  id: string;
  type: string;
}

interface OrchestratorDashboardProps {
  title: string;
  description: string;
  participants: ParticipantInfo[];
  connectionStatus: ConnectionStatus | null;
  stats: StatsInfo | null;
  logs: LogEntry[];
  onConnect?: () => void;
  onDisconnect?: () => void;
  onSimulateLost?: () => void;
  onSendRpc?: (message: string) => Promise<void> | void;
  onClearLogs?: () => void;
  rpcTargetLabel?: string;
}

const STATE_COLORS: Record<ConnectionState, string> = {
  IDLE: '#6b7280',
  CONNECTING: '#f59e0b',
  READY: '#10b981',
  TRANSIENT_FAILURE: '#ef4444',
  DISCONNECTING: '#8b5cf6',
  CLOSED: '#374151',
};

const STATE_LABELS: Record<ConnectionState, string> = {
  IDLE: 'Idle',
  CONNECTING: 'Connecting...',
  READY: 'Connected',
  TRANSIENT_FAILURE: 'Transient Failure',
  DISCONNECTING: 'Disconnecting...',
  CLOSED: 'Closed',
};

const LEVEL_STYLES: Record<
  string,
  { bg: string; color: string; icon: string }
> = {
  info: { bg: '#dbeafe', color: '#1e40af', icon: 'i' },
  success: { bg: '#d1fae5', color: '#065f46', icon: '\u2713' },
  warn: { bg: '#fef3c7', color: '#92400e', icon: '\u26a0' },
  error: { bg: '#fee2e2', color: '#991b1b', icon: '\u2717' },
  debug: { bg: '#f3f4f6', color: '#6b7280', icon: '\u00b7' },
};

function formatTime(ts: number): string {
  const d = new Date(ts);
  return `${d.toLocaleTimeString('en-US', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })}.${String(d.getMilliseconds()).padStart(3, '0')}`;
}

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  if (diff < 1000) return 'just now';
  if (diff < 60_000) return `${Math.floor(diff / 1000)}s ago`;
  if (diff < 3600_000) return `${Math.floor(diff / 60_000)}m ago`;
  return `${Math.floor(diff / 3600_000)}h ago`;
}

function StateIndicator({ state }: { state: ConnectionState }) {
  const color = STATE_COLORS[state];
  const isActive = state === 'READY' || state === 'CONNECTING';
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
      <span
        style={{
          width: 10,
          height: 10,
          borderRadius: '50%',
          backgroundColor: color,
          display: 'inline-block',
          animation: isActive ? 'pulse 2s infinite' : 'none',
          boxShadow: state === 'READY' ? `0 0 8px ${color}` : 'none',
        }}
      />
      <span style={{ fontWeight: 600, color, fontSize: 14 }}>
        {STATE_LABELS[state]}
      </span>
    </span>
  );
}

function StateTimeline({
  state,
  lastChanged,
}: {
  state: ConnectionState;
  lastChanged: number;
}) {
  const states: ConnectionState[] = [
    'IDLE',
    'CONNECTING',
    'READY',
    'TRANSIENT_FAILURE',
    'DISCONNECTING',
    'CLOSED',
  ];
  return (
    <div
      style={{
        display: 'flex',
        gap: 4,
        alignItems: 'center',
        fontSize: 11,
        marginTop: 4,
      }}
    >
      {states.map((s, i) => (
        <React.Fragment key={s}>
          {i > 0 && (
            <div
              style={{
                width: 12,
                height: 2,
                backgroundColor: '#e5e7eb',
                borderRadius: 1,
              }}
            />
          )}
          <div
            style={{
              padding: '2px 6px',
              borderRadius: 4,
              backgroundColor: s === state ? STATE_COLORS[s] : '#f3f4f6',
              color: s === state ? '#fff' : '#9ca3af',
              fontWeight: s === state ? 700 : 400,
              transition: 'all 0.3s ease',
            }}
          >
            {s === state ? STATE_LABELS[s] : s.charAt(0)}
          </div>
        </React.Fragment>
      ))}
      {lastChanged > 0 && (
        <span style={{ marginLeft: 8, color: '#9ca3af', fontSize: 10 }}>
          {timeAgo(lastChanged)}
        </span>
      )}
    </div>
  );
}

function LogViewer({
  logs,
  onClear,
}: {
  logs: LogEntry[];
  onClear?: () => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);

  useEffect(() => {
    if (autoScroll && containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [logs.length, autoScroll]);

  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        minHeight: 0,
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 8,
        }}
      >
        <span style={{ fontWeight: 600, fontSize: 13, color: '#374151' }}>
          Event Log ({logs.length})
        </span>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <label
            style={{
              fontSize: 11,
              color: '#9ca3af',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            <input
              type="checkbox"
              checked={autoScroll}
              onChange={(e) => setAutoScroll(e.target.checked)}
              style={{ margin: 0 }}
            />
            Auto-scroll
          </label>
          <button
            onClick={onClear}
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
      </div>
      <div
        ref={containerRef}
        style={{
          flex: 1,
          overflowY: 'auto',
          backgroundColor: '#111827',
          borderRadius: 8,
          padding: 8,
          fontFamily: "'SF Mono', 'Fira Code', 'Consolas', monospace",
          fontSize: 11,
          lineHeight: 1.6,
          minHeight: 120,
          maxHeight: '100%',
        }}
      >
        {logs.length === 0 && (
          <div style={{ color: '#6b7280', textAlign: 'center', padding: 20 }}>
            Waiting for events...
          </div>
        )}
        {logs.map((log) => {
          const style = LEVEL_STYLES[log.level] || LEVEL_STYLES.info;
          return (
            <div
              key={log.id}
              style={{
                display: 'flex',
                gap: 6,
                padding: '1px 0',
                borderBottom: '1px solid #1f2937',
              }}
            >
              <span style={{ color: '#6b7280', flexShrink: 0, width: 80 }}>
                {formatTime(log.timestamp)}
              </span>
              <span
                style={{
                  width: 18,
                  height: 18,
                  borderRadius: 3,
                  backgroundColor: `${style.bg}40`,
                  color: style.color,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  fontSize: 10,
                  fontWeight: 700,
                  marginTop: 1,
                }}
              >
                {style.icon}
              </span>
              <span
                style={{
                  color: '#9ca3af',
                  flexShrink: 0,
                  width: 50,
                  textAlign: 'right',
                }}
              >
                [{log.source}]
              </span>
              <span style={{ color: '#e5e7eb' }}>{log.message}</span>
              {log.detail && (
                <span style={{ color: '#6b7280', marginLeft: 4 }}>
                  {log.detail}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function OrchestratorDashboard({
  title,
  description,
  participants,
  connectionStatus,
  stats,
  logs,
  onConnect,
  onDisconnect,
  onSimulateLost,
  onSendRpc,
  onClearLogs,
  rpcTargetLabel = 'Peer',
}: OrchestratorDashboardProps) {
  const [rpcMessage, setRpcMessage] = useState('hello from renderer');
  const [rpcResult, setRpcResult] = useState<string | null>(null);
  const [rpcLoading, setRpcLoading] = useState(false);

  const handleSendRpc = useCallback(async () => {
    if (onSendRpc && rpcMessage.trim()) {
      setRpcLoading(true);
      setRpcResult(null);
      try {
        await onSendRpc(rpcMessage.trim());
      } finally {
        setRpcLoading(false);
      }
    }
  }, [onSendRpc, rpcMessage]);

  const state = connectionStatus?.state || 'IDLE';
  const isReady = state === 'READY';

  return (
    <div
      style={{
        padding: 0,
        fontFamily:
          "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        backgroundColor: '#f8fafc',
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
        button:hover { filter: brightness(0.95); }
        button:active { transform: scale(0.98); }
        button:disabled { opacity: 0.5; cursor: not-allowed; filter: none; }
        input:focus { outline: none; border-color: #3b82f6; box-shadow: 0 0 0 3px rgba(59,130,246,0.1); }
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #374151; border-radius: 3px; }
      `}</style>

      <div
        style={{
          background: 'linear-gradient(135deg, #1e293b 0%, #334155 100%)',
          padding: '20px 24px',
          color: '#fff',
        }}
      >
        <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: -0.3 }}>
          {title}
        </div>
        <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 4 }}>
          {description}
        </div>
      </div>

      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
          padding: 16,
          overflow: 'hidden',
        }}
      >
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <div
            style={{
              flex: '1 1 320px',
              backgroundColor: '#fff',
              borderRadius: 10,
              border: '1px solid #e2e8f0',
              padding: 16,
              boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
            }}
          >
            <div
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: '#64748b',
                textTransform: 'uppercase',
                letterSpacing: 0.5,
                marginBottom: 12,
              }}
            >
              Connection State
            </div>
            <StateIndicator state={state} />
            {connectionStatus && (
              <StateTimeline
                state={state}
                lastChanged={connectionStatus.lastStateChangedAt}
              />
            )}
            {connectionStatus && (
              <div
                style={{
                  marginTop: 12,
                  display: 'grid',
                  gridTemplateColumns: 'auto 1fr',
                  gap: '4px 12px',
                  fontSize: 12,
                  color: '#64748b',
                }}
              >
                <span style={{ fontWeight: 500 }}>Connection:</span>
                <span style={{ fontFamily: 'monospace', color: '#334155' }}>
                  {connectionStatus.connectionId}
                </span>
                <span style={{ fontWeight: 500 }}>From:</span>
                <span style={{ fontFamily: 'monospace', color: '#334155' }}>
                  {connectionStatus.fromId}
                </span>
                <span style={{ fontWeight: 500 }}>To:</span>
                <span style={{ fontFamily: 'monospace', color: '#334155' }}>
                  {connectionStatus.toId}
                </span>
                {connectionStatus.error && (
                  <>
                    <span style={{ fontWeight: 500, color: '#ef4444' }}>
                      Error:
                    </span>
                    <span
                      style={{
                        fontFamily: 'monospace',
                        color: '#ef4444',
                        fontSize: 11,
                      }}
                    >
                      {connectionStatus.error}
                    </span>
                  </>
                )}
              </div>
            )}
          </div>

          <div
            style={{
              flex: '1 1 200px',
              backgroundColor: '#fff',
              borderRadius: 10,
              border: '1px solid #e2e8f0',
              padding: 16,
              boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
            }}
          >
            <div
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: '#64748b',
                textTransform: 'uppercase',
                letterSpacing: 0.5,
                marginBottom: 12,
              }}
            >
              Participants
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {participants.map((p) => (
                <div
                  key={p.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '6px 10px',
                    backgroundColor: '#f8fafc',
                    borderRadius: 6,
                    border: '1px solid #f1f5f9',
                  }}
                >
                  <span
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: 2,
                      backgroundColor:
                        p.type === 'renderer'
                          ? '#3b82f6'
                          : p.type === 'utility'
                          ? '#8b5cf6'
                          : p.type === 'worker'
                          ? '#f59e0b'
                          : '#6b7280',
                    }}
                  />
                  <span
                    style={{
                      fontFamily: 'monospace',
                      fontSize: 13,
                      fontWeight: 500,
                      color: '#334155',
                    }}
                  >
                    {p.id}
                  </span>
                  <span
                    style={{
                      fontSize: 10,
                      color: '#94a3b8',
                      backgroundColor: '#f1f5f9',
                      padding: '1px 6px',
                      borderRadius: 3,
                      marginLeft: 'auto',
                    }}
                  >
                    {p.type}
                  </span>
                </div>
              ))}
              {participants.length >= 2 && (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                    marginTop: 4,
                    fontSize: 11,
                    color: '#94a3b8',
                  }}
                >
                  <span>{participants[0]?.id}</span>
                  <span style={{ color: isReady ? '#10b981' : '#d1d5db' }}>
                    {isReady ? '\u2194' : '\u2194'}
                  </span>
                  <span>{participants[1]?.id}</span>
                </div>
              )}
            </div>
          </div>

          {stats && (
            <div
              style={{
                flex: '1 1 200px',
                backgroundColor: '#fff',
                borderRadius: 10,
                border: '1px solid #e2e8f0',
                padding: 16,
                boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
              }}
            >
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: '#64748b',
                  textTransform: 'uppercase',
                  letterSpacing: 0.5,
                  marginBottom: 12,
                }}
              >
                Statistics
              </div>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: 8,
                }}
              >
                {[
                  { label: 'RPC Calls', value: stats.totalRpcCalls },
                  { label: 'Success', value: stats.successfulCalls },
                  { label: 'Failed', value: stats.failedCalls },
                  { label: 'Reconnects', value: stats.totalReconnects },
                  {
                    label: 'Avg Latency',
                    value: `${stats.avgLatencyMs.toFixed(1)}ms`,
                  },
                  {
                    label: 'Success Rate',
                    value:
                      stats.totalRpcCalls > 0
                        ? `${(
                            (stats.successfulCalls / stats.totalRpcCalls) *
                            100
                          ).toFixed(0)}%`
                        : '-',
                  },
                ].map((item) => (
                  <div
                    key={item.label}
                    style={{
                      backgroundColor: '#f8fafc',
                      borderRadius: 6,
                      padding: '6px 10px',
                    }}
                  >
                    <div style={{ fontSize: 10, color: '#94a3b8' }}>
                      {item.label}
                    </div>
                    <div
                      style={{
                        fontSize: 16,
                        fontWeight: 600,
                        color: '#334155',
                        fontFamily: 'monospace',
                      }}
                    >
                      {item.value}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: 12 }}>
          <div
            style={{
              flex: '0 0 auto',
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
            }}
          >
            <div
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: '#64748b',
                textTransform: 'uppercase',
                letterSpacing: 0.5,
                marginBottom: 4,
              }}
            >
              Actions
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button
                onClick={onConnect}
                disabled={isReady || state === 'CONNECTING'}
                style={{
                  padding: '8px 16px',
                  fontSize: 13,
                  fontWeight: 600,
                  border: 'none',
                  borderRadius: 6,
                  backgroundColor:
                    isReady || state === 'CONNECTING' ? '#d1d5db' : '#3b82f6',
                  color: '#fff',
                  cursor:
                    isReady || state === 'CONNECTING'
                      ? 'not-allowed'
                      : 'pointer',
                }}
              >
                Connect
              </button>
              <button
                onClick={onDisconnect}
                disabled={!isReady}
                style={{
                  padding: '8px 16px',
                  fontSize: 13,
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
                onClick={onSimulateLost}
                disabled={!isReady}
                style={{
                  padding: '8px 16px',
                  fontSize: 13,
                  fontWeight: 600,
                  border: isReady ? '1px solid #f59e0b' : '1px solid #d1d5db',
                  borderRadius: 6,
                  backgroundColor: isReady ? '#fffbeb' : '#f9fafb',
                  color: isReady ? '#b45309' : '#9ca3af',
                  cursor: isReady ? 'pointer' : 'not-allowed',
                }}
              >
                Simulate Lost
              </button>
            </div>
          </div>

          <div
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
            }}
          >
            <div
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: '#64748b',
                textTransform: 'uppercase',
                letterSpacing: 0.5,
                marginBottom: 4,
              }}
            >
              RPC Call to {rpcTargetLabel}
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input
                type="text"
                value={rpcMessage}
                onChange={(e) => setRpcMessage(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSendRpc()}
                placeholder="Type a message..."
                disabled={!isReady}
                style={{
                  flex: 1,
                  padding: '8px 12px',
                  fontSize: 13,
                  border: '1px solid #e2e8f0',
                  borderRadius: 6,
                  fontFamily: 'monospace',
                  backgroundColor: isReady ? '#fff' : '#f9fafb',
                }}
              />
              <button
                onClick={handleSendRpc}
                disabled={!isReady || rpcLoading}
                style={{
                  padding: '8px 16px',
                  fontSize: 13,
                  fontWeight: 600,
                  border: 'none',
                  borderRadius: 6,
                  backgroundColor:
                    isReady && !rpcLoading ? '#10b981' : '#d1d5db',
                  color: '#fff',
                  cursor: isReady && !rpcLoading ? 'pointer' : 'not-allowed',
                  whiteSpace: 'nowrap',
                }}
              >
                {rpcLoading ? 'Calling...' : 'Send RPC'}
              </button>
            </div>
            {rpcResult && (
              <div
                style={{
                  padding: '6px 12px',
                  fontSize: 12,
                  fontFamily: 'monospace',
                  backgroundColor: '#f0fdf4',
                  border: '1px solid #bbf7d0',
                  borderRadius: 6,
                  color: '#166534',
                }}
              >
                Response: {rpcResult}
              </div>
            )}
          </div>
        </div>

        <LogViewer logs={logs} onClear={onClearLogs} />
      </div>
    </div>
  );
}
