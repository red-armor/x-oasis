import { useState, useEffect, useCallback } from 'react';
import OrchestratorDashboard, {
  LogEntry,
  ConnectionStatus,
  StatsInfo,
  ParticipantInfo,
} from '../../shared-ui/OrchestratorDashboard';

let logIdCounter = 0;

function App(): JSX.Element {
  const api = (window as any).orchestratorAPI;
  const [connectionStatus, setConnectionStatus] =
    useState<ConnectionStatus | null>(null);
  const [stats, setStats] = useState<StatsInfo | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);

  const participants: ParticipantInfo[] = [
    { id: 'utility-a', type: 'utility' },
    { id: 'utility-b', type: 'utility' },
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
      api?.onStateChange((e) => {
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
      api?.onReady((e) => {
        addLog('success', 'ready', `Connection ready: ${e.connectionId}`);
        pollStatus();
      }),
      api?.onDisconnected((e) => {
        addLog('warn', 'disconnect', `Connection lost`, e.error?.message);
        pollStatus();
      }),
      api?.onReconnecting((e) => {
        addLog(
          'warn',
          'reconnect',
          `Reconnecting attempt #${e.attempt} in ${Math.round(e.delay)}ms`
        );
      }),
      api?.onReconnected((e) => {
        addLog(
          'success',
          'reconnect',
          `Reconnected after ${e.attempt} attempt(s)`
        );
        pollStatus();
      }),
      api?.onReconnectFailed((e) => {
        addLog(
          'error',
          'reconnect',
          `Reconnect failed after ${e.totalAttempts} attempts`
        );
        pollStatus();
      }),
      api?.onClosed((e) => {
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
    addLog('warn', 'action', 'Simulating utility-b lost...');
    await api?.simulateLost();
    pollStatus();
  }, [addLog, pollStatus]);

  const handleSendRpc = useCallback(
    async (message: string) => {
      addLog(
        'info',
        'rpc',
        `Attempt RPC: "${message}" (renderer is observer only)`
      );
      const res = await api?.sendRpc(message);
      if (!res.success) addLog('warn', 'rpc', `Not available: ${res.error}`);
      pollStatus();
    },
    [addLog, pollStatus]
  );

  return (
    <OrchestratorDashboard
      title="Utility A ↔ Utility B (Orchestrator)"
      description="ElectronConnectionOrchestrator wiring a direct MessagePort between two utility processes — renderer observes & controls"
      participants={participants}
      connectionStatus={connectionStatus}
      stats={stats}
      logs={logs}
      onConnect={handleConnect}
      onDisconnect={handleDisconnect}
      onSimulateLost={handleSimulateLost}
      onSendRpc={handleSendRpc}
      onClearLogs={() => setLogs([])}
      rpcTargetLabel="Utility A↔B"
    />
  );
}

export default App;
