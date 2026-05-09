import OrchestratorDashboard from '@shared-ui/OrchestratorDashboard';
import useOrchestratorDashboard from '@shared-ui/useOrchestratorDashboard';

function App(): JSX.Element {
  const dashboard = useOrchestratorDashboard({
    participants: [
      { id: 'renderer', type: 'renderer' },
      { id: 'utility', type: 'utility' },
    ],
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
