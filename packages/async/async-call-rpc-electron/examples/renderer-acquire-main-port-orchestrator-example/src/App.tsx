import { createOrchestratorClient } from '@x-oasis/async-call-rpc-electron/browser';
import OrchestratorDashboard from '@shared-ui/OrchestratorDashboard';
import useOrchestratorDashboard from '@shared-ui/useOrchestratorDashboard';

const client = createOrchestratorClient();

const mainDirectClient = (client as any).mainDirectClient;

function App(): JSX.Element {
  const dashboard = useOrchestratorDashboard({
    participants: [
      { id: 'main', type: 'process' },
      { id: 'renderer', type: 'renderer' },
    ],
    api: client as any,
    sendRpc: async (message) => {
      return (
        mainDirectClient?.greet(message) || { message: 'Service not available' }
      );
    },
  });

  return (
    <OrchestratorDashboard
      title="Renderer ↔ Main (Orchestrator)"
      description="ElectronConnectionOrchestrator wiring a direct MessagePort between renderer and main process — optimized setup with abstracted orchestrator"
      rpcTargetLabel="Main"
      {...dashboard}
    />
  );
}

export default App;
