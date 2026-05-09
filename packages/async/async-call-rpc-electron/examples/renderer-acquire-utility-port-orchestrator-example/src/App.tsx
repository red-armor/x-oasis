import {
  createPageChannel,
  createIpcPageChannel,
} from '@x-oasis/async-call-rpc-electron/browser';
import { clientHost } from '@x-oasis/async-call-rpc';
import OrchestratorDashboard from '@shared-ui/OrchestratorDashboard';
import useOrchestratorDashboard from '@shared-ui/useOrchestratorDashboard';

const pageChannel = createPageChannel('page↔preload');
const ipcPageChannel = createIpcPageChannel('page↔preload:ipc');

const utilityDirectClient = clientHost
  .registerClient('utility-direct', { channel: pageChannel })
  .createProxy();

const orchestratorClient = clientHost
  .registerClient('orchestrator', { channel: ipcPageChannel })
  .createProxy();

function App(): JSX.Element {
  const dashboard = useOrchestratorDashboard({
    participants: [
      { id: 'renderer', type: 'renderer' },
      { id: 'utility', type: 'utility' },
    ],
    api: orchestratorClient as any,
    sendRpc: async (message) => {
      return (utilityDirectClient as any).ping(message);
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
