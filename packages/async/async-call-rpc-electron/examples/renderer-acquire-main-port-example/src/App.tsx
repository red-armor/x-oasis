import { useState } from 'react';

interface AppAPI {
  acquirePort: () => Promise<MessagePort>;
}

declare global {
  interface Window {
    api: AppAPI;
  }
}

function App() {
  const [port, setPort] = useState<MessagePort | null>(null);

  // useEffect(() => {
  //   window.api
  //     .acquirePort()
  //     .then((port) => {
  //       console.log('port ---', port);
  //       port.postMessage({ some: 'message' });
  //       setPort(port);
  //     })
  //     .catch(console.error);
  // }, []);

  return (
    <div style={{ padding: '20px', fontFamily: 'system-ui' }}>
      <h1>@x-oasis/async-call-rpc-electron — acquirePort Example</h1>
      <pre>{port ? `Port acquired: ${port}` : 'Loading...'}</pre>
    </div>
  );
}

export default App;
