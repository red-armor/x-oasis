import OrchestratorDashboard from '@shared-ui/OrchestratorDashboard';
import useOrchestratorDashboard from '@shared-ui/useOrchestratorDashboard';

function App(): JSX.Element {
  const dashboard = useOrchestratorDashboard({
    participants: [
      { id: 'main', type: 'process' },
      { id: 'utility', type: 'utility' },
    ],
    sendRpc: async (message) => {
      const api = (window as any).orchestratorAPI;
      const res = await api?.sendRpc(message);
      if (!res.success) throw new Error(res.error);
      return res.result;
    },
  });

  return (
    <OrchestratorDashboard
      title="Utility ↔ Main (Orchestrator)"
      description="ElectronConnectionOrchestrator wiring a direct MessagePort between utility and main process — renderer observes & controls"
      rpcTargetLabel="Utility (via Main)"
      {...dashboard}
    />
  );
}

export default App;
