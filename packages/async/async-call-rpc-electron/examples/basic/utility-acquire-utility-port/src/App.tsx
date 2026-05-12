import React from 'react';

const App: React.FC = () => {
  return (
    <div style={{ padding: '20px', fontFamily: 'system-ui' }}>
      <h1>@x-oasis/async-call-rpc-electron — Utility↔Utility Port Example</h1>
      <p>
        Check the console (DevTools) for communication logs between utility
        processes A and B.
      </p>
      <p>
        This example demonstrates bidirectional MessagePort exchange between two
        utility processes via main process as a port broker.
      </p>
      <ul>
        <li>
          Utility A initiates a direct port to Utility B (acquireUtilityBPort)
        </li>
        <li>
          Utility B initiates a direct port to Utility A (acquireUtilityAPort)
        </li>
      </ul>
    </div>
  );
};

export default App;
