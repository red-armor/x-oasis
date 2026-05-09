import { useState, useEffect, useCallback } from 'react';
import {
  LogEntry,
  ConnectionStatus,
  StatsInfo,
  ParticipantInfo,
} from './OrchestratorDashboard';

let logIdCounter = 0;

export interface UseOrchestratorDashboardOptions {
  participants: ParticipantInfo[];
  sendRpc?: (message: string) => Promise<string>;
  simulateLostLogMessage?: string;
}

export interface UseOrchestratorDashboardReturn {
  connectionStatus: ConnectionStatus | null;
  stats: StatsInfo | null;
  logs: LogEntry[];
  participants: ParticipantInfo[];
  onConnect: () => void;
  onDisconnect: () => void;
  onSimulateLost: () => void;
  onSendRpc: (message: string) => void;
  onClearLogs: () => void;
}

export default function useOrchestratorDashboard(
  options: UseOrchestratorDashboardOptions
): UseOrchestratorDashboardReturn {
  const {
    participants,
    sendRpc: customSendRpc,
    simulateLostLogMessage = 'Simulating participant lost...',
  } = options;

  const api = (window as any).orchestratorAPI;
  const [connectionStatus, setConnectionStatus] =
    useState<ConnectionStatus | null>(null);
  const [stats, setStats] = useState<StatsInfo | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);

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
    addLog('warn', 'action', simulateLostLogMessage);
    await api?.simulateLost();
    pollStatus();
  }, [addLog, pollStatus, simulateLostLogMessage]);

  const handleSendRpc = useCallback(
    async (message: string) => {
      addLog('info', 'rpc', `Sending: "${message}"`);
      try {
        const result = customSendRpc
          ? await customSendRpc(message)
          : await api?.sendRpc(message);
        addLog('success', 'rpc', `Response: "${result}"`);
      } catch (err: any) {
        addLog('error', 'rpc', `Failed: ${err.message}`);
      }
      pollStatus();
    },
    [addLog, pollStatus, customSendRpc]
  );

  const handleClearLogs = useCallback(() => setLogs([]), []);

  return {
    connectionStatus,
    stats,
    logs,
    participants,
    onConnect: handleConnect,
    onDisconnect: handleDisconnect,
    onSimulateLost: handleSimulateLost,
    onSendRpc: handleSendRpc,
    onClearLogs: handleClearLogs,
  };
}
