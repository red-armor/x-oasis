import { createOrchestratorClient } from '@x-oasis/async-call-rpc-electron/browser/orchestrator';
import OrchestratorDashboard from '@shared-ui/OrchestratorDashboard';
import useOrchestratorDashboard, {
  OrchestratorAPI,
} from '@shared-ui/useOrchestratorDashboard';

const client = createOrchestratorClient();

function App(): JSX.Element {
  const dashboard = useOrchestratorDashboard({
    participants: [
      { id: 'renderer', type: 'renderer' },
      { id: 'utility', type: 'utility' },
    ],
    api: client as unknown as OrchestratorAPI,
    sendRpc: async (message: string) => {
      return (client as any).sendRpc(message);
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
