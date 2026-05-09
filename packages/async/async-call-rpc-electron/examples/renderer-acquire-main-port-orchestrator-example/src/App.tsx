import OrchestratorDashboard from '@shared-ui/OrchestratorDashboard';
import useOrchestratorDashboard from '@shared-ui/useOrchestratorDashboard';

function App(): JSX.Element {
  const dashboard = useOrchestratorDashboard({
    participants: [
      { id: 'main', type: 'process' },
      { id: 'renderer', type: 'renderer' },
    ],
  });

  return (
    <OrchestratorDashboard
      title="Renderer ↔ Main (Orchestrator)"
      description="ElectronConnectionOrchestrator wiring a direct MessagePort between renderer and main process — with stats & lifecycle"
      rpcTargetLabel="Main"
      {...dashboard}
    />
  );
}

export default App;
