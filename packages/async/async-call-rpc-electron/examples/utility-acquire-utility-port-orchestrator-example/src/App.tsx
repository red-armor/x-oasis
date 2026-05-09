import { createIpcPageChannel } from '@x-oasis/async-call-rpc-electron/browser';
import { clientHost } from '@x-oasis/async-call-rpc';
import OrchestratorDashboard from '@shared-ui/OrchestratorDashboard';
import useOrchestratorDashboard from '@shared-ui/useOrchestratorDashboard';

const ipcPageChannel = createIpcPageChannel('page↔preload:ipc');

const orchestratorClient = clientHost
  .registerClient('orchestrator', { channel: ipcPageChannel })
  .createProxy();

function App(): JSX.Element {
  const dashboard = useOrchestratorDashboard({
    participants: [
      { id: 'utility-a', type: 'utility' },
      { id: 'utility-b', type: 'utility' },
    ],
    api: orchestratorClient as any,
    simulateLostLogMessage: 'Simulating utility-b lost...',
    sendRpc: async () => {
      throw new Error(
        'Direct RPC from renderer not available — utility↔utility only'
      );
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
