import {
  createPageChannel,
  createIpcPageChannel,
} from '@x-oasis/async-call-rpc-electron/browser';
import { clientHost } from '@x-oasis/async-call-rpc';
import OrchestratorDashboard from '@shared-ui/OrchestratorDashboard';
import useOrchestratorDashboard from '@shared-ui/useOrchestratorDashboard';

const pageChannel = createPageChannel('page↔preload');
const ipcPageChannel = createIpcPageChannel('page↔preload:ipc');

const mainDirectClient = clientHost
  .registerClient('main-direct', { channel: pageChannel })
  .createProxy();

const orchestratorClient = clientHost
  .registerClient('orchestrator', { channel: ipcPageChannel })
  .createProxy();

function App(): JSX.Element {
  const dashboard = useOrchestratorDashboard({
    participants: [
      { id: 'main', type: 'process' },
      { id: 'renderer', type: 'renderer' },
    ],
    api: orchestratorClient as any,
    sendRpc: async (message) => {
      return (mainDirectClient as any).greet(message);
    },
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
