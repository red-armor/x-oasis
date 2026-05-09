import { useState, useEffect, useCallback } from 'react';
import OrchestratorDashboard, {
  LogEntry,
  ConnectionStatus,
  StatsInfo,
  ParticipantInfo,
} from '../../shared-ui/OrchestratorDashboard';
import { createPageChannel } from '@x-oasis/async-call-rpc-electron/electron-browser';
import { clientHost, serviceHost } from '@x-oasis/async-call-rpc';

let logIdCounter = 0;

const pageChannel = createPageChannel('page↔preload');

const utilityDirectClient = clientHost
  .registerClient('utility-direct', { channel: pageChannel })
  .createProxy();

const orchestratorClient = clientHost
  .registerClient('orchestrator', { channel: pageChannel })
  .createProxy();

serviceHost.registerService('page-api', {
  channel: pageChannel,
  serviceHost,
  handlers: {
    greet(msg: string): string {
      return `greeting from page: ${msg}`;
    },
  },
});

function App(): JSX.Element {
  const api = (window as any).orchestratorAPI;
  const [connectionStatus, setConnectionStatus] =
    useState<ConnectionStatus | null>(null);
  const [stats, setStats] = useState<StatsInfo | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);

  const participants: ParticipantInfo[] = [
    { id: 'renderer (page)', type: 'renderer' },
    { id: 'utility', type: 'utility' },
  ];

  const addLog = useCallback(
    (
      level: LogEntry['level'],
      source: string,
      message: string,
      detail?: string
    ) => {
      setLogs((prev) => [
        ...prev,
        {
          id: String(++logIdCounter),
          timestamp: Date.now(),
          level,
          source,
          message,
          detail,
        },
      ]);
    },
    []
  );

  const pollStatus = useCallback(async () => {
    try {
      const s = await api?.getStatus();
      if (s) {
        setConnectionStatus({
          connectionId: s.connectionId,
          fromId: s.fromId,
          toId: s.toId,
          state: s.state,
          lastStateChangedAt: s.lastStateChangedAt,
          error: s.error,
        });
        if (s.stats) setStats(s.stats);
      }
    } catch {}
  }, []);

  useEffect(() => {
    const unsubs = [
      api?.onStateChange((e: any) => {
        addLog(
          e.currentState === 'READY'
            ? 'success'
            : e.currentState === 'TRANSIENT_FAILURE'
            ? 'error'
            : 'info',
          'state',
          `${e.previousState} → ${e.currentState}`,
          e.reason
        );
        pollStatus();
      }),
      api?.onReady((e: any) => {
        addLog('success', 'ready', `Connection ready: ${e.connectionId}`);
        pollStatus();
      }),
      api?.onDisconnected((e: any) => {
        addLog('warn', 'disconnect', `Connection lost`, e.error?.message);
        pollStatus();
      }),
      api?.onReconnecting((e: any) => {
        addLog(
          'warn',
          'reconnect',
          `Reconnecting attempt #${e.attempt} in ${Math.round(e.delay)}ms`
        );
      }),
      api?.onReconnected((e: any) => {
        addLog(
          'success',
          'reconnect',
          `Reconnected after ${e.attempt} attempt(s)`
        );
        pollStatus();
      }),
      api?.onReconnectFailed((e: any) => {
        addLog(
          'error',
          'reconnect',
          `Reconnect failed after ${e.totalAttempts} attempts`
        );
        pollStatus();
      }),
      api?.onClosed((e: any) => {
        addLog('error', 'closed', `Connection closed: ${e.reason}`);
        pollStatus();
      }),
    ];
    pollStatus();
    const interval = setInterval(pollStatus, 2000);
    return () => {
      unsubs.forEach((u) => u());
      clearInterval(interval);
    };
  }, [addLog, pollStatus]);

  const handleConnect = useCallback(async () => {
    addLog('info', 'action', 'Requesting connect...');
    const result = await api?.connect();
    if (result.error)
      addLog('error', 'action', `Connect failed: ${result.error}`);
    else addLog('success', 'action', `Connected: ${result.state}`);
    pollStatus();
  }, [addLog, pollStatus]);

  const handleDisconnect = useCallback(async () => {
    addLog('info', 'action', 'Requesting disconnect...');
    await api?.disconnect();
    addLog('info', 'action', 'Disconnected');
    pollStatus();
  }, [addLog, pollStatus]);

  const handleSimulateLost = useCallback(async () => {
    addLog('warn', 'action', 'Simulating participant lost...');
    await api?.simulateLost();
    pollStatus();
  }, [addLog, pollStatus]);

  const handleSendRpc = useCallback(
    async (message: string) => {
      addLog('info', 'rpc', `Sending: "${message}"`);
      try {
        const result = await (utilityDirectClient as any).ping(message);
        addLog('success', 'rpc', `Response: "${result}"`);
      } catch (err: any) {
        addLog('error', 'rpc', `Failed: ${err.message}`);
      }
      pollStatus();
    },
    [addLog, pollStatus]
  );

  return (
    <OrchestratorDashboard
      title="Page ↔ Utility (ContextBridge Orchestrator)"
      description="Renderer page uses ContextBridgeChannel to get full RPC capabilities through preload — direct MessagePort to utility process via orchestrator, with reconnect, heartbeat & stats"
      participants={participants}
      connectionStatus={connectionStatus}
      stats={stats}
      logs={logs}
      onConnect={handleConnect}
      onDisconnect={handleDisconnect}
      onSimulateLost={handleSimulateLost}
      onSendRpc={handleSendRpc}
      onClearLogs={() => setLogs([])}
      rpcTargetLabel="Utility"
    />
  );
}

export default App;
