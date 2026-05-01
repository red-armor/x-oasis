import { useState, useEffect, useRef } from 'react';
import { WebSocketChannel, clientHost } from '@x-oasis/async-call-rpc';

function StatusPanel() {
  const [statuses, setStatuses] = useState<string[]>(['Waiting for server...']);
  const [serverStatus, setServerStatus] = useState('unknown');
  const statusRef = useRef<any>(null);

  useEffect(() => {
    const ws = new WebSocket('ws://localhost:3456');

    ws.onopen = () => {
      const channel = new WebSocketChannel(ws, {
        name: 'react-status',
        connected: true,
      });
      statusRef.current = clientHost
        .registerClient('api', { channel })
        .createProxy();

      const unsub = statusRef.current.onServerStatusChanged?.(
        (status: string) => {
          setServerStatus(status);
          setStatuses((s) => [
            ...s,
            `[${new Date().toLocaleTimeString()}] ${status}`,
          ]);
        }
      );

      return () => unsub?.unsubscribe?.();
    };

    return () => ws.close();
  }, []);

  return (
    <div className="panel">
      <h2>Real-time Status Updates</h2>
      <p>
        Server Status:{' '}
        <strong style={{ color: serverStatus === 'online' ? 'green' : 'red' }}>
          {serverStatus}
        </strong>
      </p>

      <div className="log">
        {statuses.map((status, i) => (
          <div key={i}>{status}</div>
        ))}
      </div>
    </div>
  );
}

export default StatusPanel;
