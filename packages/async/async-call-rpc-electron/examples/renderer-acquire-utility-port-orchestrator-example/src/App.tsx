import { createOrchestratorClient } from '@x-oasis/async-call-rpc-electron/browser';
import OrchestratorDashboard from '@shared-ui/OrchestratorDashboard';
import useOrchestratorDashboard from '@shared-ui/useOrchestratorDashboard';

const client = createOrchestratorClient();

const utilityService = client.getService<any>('utility-direct');

function App(): JSX.Element {
  const dashboard = useOrchestratorDashboard({
    participants: [
      { id: 'renderer', type: 'renderer' },
      { id: 'utility', type: 'utility' },
    ],
    api: client as any,
    sendRpc: async (message) => {
      return utilityService.ping(message);
    },
  });

  return (
    <OrchestratorDashboard
      title="Renderer ↔ Utility (Orchestrator)"
      description="ElectronConnectionOrchestrator wiring a direct MessagePort between renderer and utility process — with reconnect, heartbeat & stats"
      rpcTargetLabel="Utility"
      {...dashboard}
    />
  );
}

export default App;
