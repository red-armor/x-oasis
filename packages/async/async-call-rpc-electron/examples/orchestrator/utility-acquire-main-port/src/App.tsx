import { createIpcPageChannel } from '@x-oasis/async-call-rpc-electron/browser/core';
import { clientHost } from '@x-oasis/async-call-rpc/core';
import OrchestratorDashboard from '@shared-ui/OrchestratorDashboard';
import useOrchestratorDashboard from '@shared-ui/useOrchestratorDashboard';

const ipcPageChannel = createIpcPageChannel('page↔preload:ipc');

const orchestratorClient = clientHost
  .registerClient('orchestrator', { channel: ipcPageChannel })
  .createProxy();

function App(): JSX.Element {
  const dashboard = useOrchestratorDashboard({
    participants: [
      { id: 'main', type: 'process' },
      { id: 'utility', type: 'utility' },
    ],
    api: orchestratorClient as any,
    sendRpc: async (message) => {
      return (orchestratorClient as any).sendRpc(message);
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
