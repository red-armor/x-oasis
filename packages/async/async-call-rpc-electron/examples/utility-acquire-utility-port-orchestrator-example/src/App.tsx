function App() {
  return (
    <div style={{ padding: '20px', fontFamily: 'system-ui' }}>
      <h1>
        @x-oasis/async-call-rpc-electron — Utility A ↔ Utility B (Orchestrator)
      </h1>
      <p>
        This example uses <code>ElectronConnectionOrchestrator</code> to wire a
        direct MessagePort between two utility processes (A and B).
      </p>
      <p>Open DevTools console to see the RPC calls.</p>
    </div>
  );
}

export default App;
