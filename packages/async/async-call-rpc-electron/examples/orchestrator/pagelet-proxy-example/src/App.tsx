import { createOrchestratorClient } from '@x-oasis/async-call-rpc-electron/browser';
import OrchestratorDashboard from '@shared-ui/OrchestratorDashboard';
import useOrchestratorDashboard, {
  OrchestratorAPI,
} from '@shared-ui/useOrchestratorDashboard';

const client = createOrchestratorClient({
  directChannelDescription: 'page↔preload',
  ipcChannelDescription: 'page↔preload:ipc',
});

const pageletClient = client.getService<any>('pagelet-api');

function App(): JSX.Element {
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
      <div
        style={{
          background: 'linear-gradient(135deg, #1e293b 0%, #334155 100%)',
          padding: '20px 24px',
          color: '#fff',
        }}
      >
        <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: -0.3 }}>
          Pagelet Proxy - Multi-Process Orchestrator
        </div>
        <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 4 }}>
          Renderer calls shared/daemon/main through main-pagelet proxy - client
          convergence via single pagelet-api
        </div>
      </div>

      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
          padding: 16,
          overflow: 'auto',
        }}
      >
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: 12,
          }}
        >
          <button
            onClick={async () => {
              try {
                const result = await pageletClient.info();
                console.log('[pagelet-api] info:', result);
              } catch (err: any) {
                console.error('[pagelet-api] info:', err.message);
              }
            }}
            disabled={!isReady}
            style={{
              padding: '12px 16px',
              fontSize: 13,
              fontWeight: 600,
              border: 'none',
              borderRadius: 8,
              backgroundColor: isReady ? '#3b82f6' : '#d1d5db',
              color: '#fff',
              cursor: isReady ? 'pointer' : 'not-allowed',
            }}
          >
            Pagelet: Info
          </button>

          <button
            onClick={async () => {
              try {
                const result = await pageletClient.callSharedGetConfig('theme');
                console.log('[shared.getConfig]', result);
              } catch (err: any) {
                console.error('[shared.getConfig]', err.message);
              }
            }}
            disabled={!isReady}
            style={{
              padding: '12px 16px',
              fontSize: 13,
              fontWeight: 600,
              border: 'none',
              borderRadius: 8,
              backgroundColor: isReady ? '#8b5cf6' : '#d1d5db',
              color: '#fff',
              cursor: isReady ? 'pointer' : 'not-allowed',
            }}
          >
            Shared: GetConfig
          </button>

          <button
            onClick={async () => {
              try {
                const result = await pageletClient.callDaemonSystemStatus();
                console.log('[daemon.systemStatus]', result);
              } catch (err: any) {
                console.error('[daemon.systemStatus]', err.message);
              }
            }}
            disabled={!isReady}
            style={{
              padding: '12px 16px',
              fontSize: 13,
              fontWeight: 600,
              border: 'none',
              borderRadius: 8,
              backgroundColor: isReady ? '#f59e0b' : '#d1d5db',
              color: '#fff',
              cursor: isReady ? 'pointer' : 'not-allowed',
            }}
          >
            Daemon: SystemStatus
          </button>

          <button
            onClick={async () => {
              try {
                const result = await pageletClient.callMainPing('hello');
                console.log('[main.mainPing]', result);
              } catch (err: any) {
                console.error('[main.mainPing]', err.message);
              }
            }}
            disabled={!isReady}
            style={{
              padding: '12px 16px',
              fontSize: 13,
              fontWeight: 600,
              border: 'none',
              borderRadius: 8,
              backgroundColor: isReady ? '#10b981' : '#d1d5db',
              color: '#fff',
              cursor: isReady ? 'pointer' : 'not-allowed',
            }}
          >
            Main: Ping
          </button>
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
              fontSize: 12,
              fontWeight: 600,
              color: '#64748b',
              textTransform: 'uppercase',
              letterSpacing: 0.5,
              marginBottom: 8,
            }}
          >
            Architecture
          </div>
          <div
            style={{
              fontFamily: 'monospace',
              fontSize: 12,
              color: '#334155',
              lineHeight: 1.8,
              whiteSpace: 'pre',
            }}
          >
            {`Renderer Page
  ↓ (direct port via orchestrator)
Main Pagelet (proxy, single pagelet-api client)
  ↓ main-rpc (control channel relay)
Main Process
  ↓ shared-rpc       ↓ daemon-rpc
  Shared Process      Daemon Process`}
          </div>
        </div>

        <OrchestratorDashboard
          title=""
          description=""
          rpcTargetLabel="Shared (via Pagelet)"
          {...dashboard}
        />
      </div>
    </div>
  );
}

export default App;
