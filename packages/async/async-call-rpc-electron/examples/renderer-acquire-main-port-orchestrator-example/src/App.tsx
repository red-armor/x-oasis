function App() {
  return (
    <div style={{ padding: '20px', fontFamily: 'system-ui' }}>
      <h1>@x-oasis/async-call-rpc-electron — Renderer ↔ Main (Orchestrator)</h1>
      <p>
        This example uses <code>ElectronConnectionOrchestrator</code> to wire a
        direct MessagePort between the renderer and the main process.
      </p>
      <p>Open DevTools console to see the RPC calls.</p>
    </div>
  );
}

export default App;
