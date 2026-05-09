import OrchestratorDashboard from '@shared-ui/OrchestratorDashboard';
import useOrchestratorDashboard from '@shared-ui/useOrchestratorDashboard';

function App(): JSX.Element {
  const dashboard = useOrchestratorDashboard({
    participants: [
      { id: 'utility-a', type: 'utility' },
      { id: 'utility-b', type: 'utility' },
    ],
    simulateLostLogMessage: 'Simulating utility-b lost...',
    sendRpc: async (message) => {
      const api = (window as any).orchestratorAPI;
      const res = await api?.sendRpc(message);
      if (!res.success) throw new Error(res.error);
      return res;
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
