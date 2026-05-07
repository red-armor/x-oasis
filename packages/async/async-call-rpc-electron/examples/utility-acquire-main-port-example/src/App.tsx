import React from 'react';

const App: React.FC = () => {
  return (
    <div style={{ padding: '20px', fontFamily: 'system-ui' }}>
      <h1>@x-oasis/async-call-rpc-electron — Utility↔Main Port Example</h1>
      <p>
        Check the console (DevTools) for communication logs between main process
        and utility process.
      </p>
      <p>
        This example demonstrates bidirectional MessagePort exchange between
        main and utility processes.
      </p>
    </div>
  );
};

export default App;
