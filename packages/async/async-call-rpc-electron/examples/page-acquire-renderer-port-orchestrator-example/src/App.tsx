import { createOrchestratorClient } from '@x-oasis/async-call-rpc-electron/browser';
import OrchestratorDashboard from '@shared-ui/OrchestratorDashboard';
import useOrchestratorDashboard from '@shared-ui/useOrchestratorDashboard';

const client = createOrchestratorClient({
  directChannelDescription: 'page↔preload',
  ipcChannelDescription: 'page↔preload:ipc',
});

const utilityService = client.getService<any>('utility');

client.registerService('page-api', {
  greet(msg: string): string {
    return `greeting from page: ${msg}`;
  },
});

function App(): JSX.Element {
  const dashboard = useOrchestratorDashboard({
    participants: [
      { id: 'renderer (page)', type: 'renderer' },
      { id: 'utility', type: 'utility' },
    ],
    api: client as any,
    sendRpc: async (message) => {
      return utilityService.ping(message);
    },
  });

  return (
    <OrchestratorDashboard
      title="Page ↔ Utility (ContextBridge Orchestrator)"
      description="Renderer page uses ContextBridgeChannel to get full RPC capabilities through preload — direct MessagePort to utility process via orchestrator, with reconnect, heartbeat & stats"
      rpcTargetLabel="Utility"
      {...dashboard}
    />
  );
}

export default App;
