import { createOrchestratorClient } from '@x-oasis/async-call-rpc-electron/browser/orchestrator';
import OrchestratorDashboard from '@shared-ui/OrchestratorDashboard';
import useOrchestratorDashboard, {
  OrchestratorAPI,
} from '@shared-ui/useOrchestratorDashboard';

const client = createOrchestratorClient();

function App(): JSX.Element {
  const dashboard = useOrchestratorDashboard({
    participants: [
      { id: 'utility-a', type: 'utility' },
      { id: 'utility-b', type: 'utility' },
    ],
    api: client as unknown as OrchestratorAPI,
    simulateLostLogMessage: 'Simulating utility-b lost...',
    sendRpc: async (message: string) => {
      return (client as any).sendRpc(message);
    },
  });

  return (
    <OrchestratorDashboard
      title="Utility A ↔ Utility B (Orchestrator)"
      description="ElectronConnectionOrchestrator wiring a direct MessagePort between two utility processes — renderer observes & controls"
      rpcTargetLabel="Utility A↔B"
      {...dashboard}
    />
  );
}

export default App;
