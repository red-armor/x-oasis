import { createPageChannel } from '@x-oasis/async-call-rpc-electron/browser';
import { clientHost, serviceHost } from '@x-oasis/async-call-rpc';
import OrchestratorDashboard from '@shared-ui/OrchestratorDashboard';
import useOrchestratorDashboard from '@shared-ui/useOrchestratorDashboard';

const pageChannel = createPageChannel('page↔preload');

const utilityDirectClient = clientHost
  .registerClient('utility-direct', { channel: pageChannel })
  .createProxy();

const orchestratorClient = clientHost
  .registerClient('orchestrator', { channel: pageChannel })
  .createProxy();

serviceHost.registerService('page-api', {
  channel: pageChannel,
  serviceHost,
  handlers: {
    greet(msg: string): string {
      return `greeting from page: ${msg}`;
    },
  },
});

function App(): JSX.Element {
  const dashboard = useOrchestratorDashboard({
    participants: [
      { id: 'renderer (page)', type: 'renderer' },
      { id: 'utility', type: 'utility' },
    ],
    sendRpc: async (message) => {
      return (utilityDirectClient as any).ping(message);
    },
  });

  return (
    <OrchestratorDashboard
      title="Page ↔ Utility (ContextBridge Orchestrator)"
      description="Renderer page uses ContextBridgeChannel to get full RPC capabilities through preload — direct MessagePort to utility process via orchestrator, with reconnect, heartbeat & stats"
      rpcTargetLabel="Utility"
      {...dashboard}
    />
  );
}

export default App;
