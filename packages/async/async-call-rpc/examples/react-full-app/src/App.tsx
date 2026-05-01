import { useState } from 'react';
import './App.css';
import TasksPanel from './components/TasksPanel';
import ComputePanel from './components/ComputePanel';
import StatusPanel from './components/StatusPanel';

type TabType = 'tasks' | 'compute' | 'status';

function App() {
  const [activeTab, setActiveTab] = useState<TabType>('tasks');

  return (
    <div className="container">
      <header>
        <h1>⚛️ React RPC Full Application</h1>
        <p>Demonstrating async-call-rpc patterns in a real app</p>
      </header>

      <main>
        <nav className="tabs">
          <button
            className={`tab-button ${activeTab === 'tasks' ? 'active' : ''}`}
            onClick={() => setActiveTab('tasks')}
          >
            📋 Server Tasks
          </button>
          <button
            className={`tab-button ${activeTab === 'compute' ? 'active' : ''}`}
            onClick={() => setActiveTab('compute')}
          >
            ⚙️ Background Compute
          </button>
          <button
            className={`tab-button ${activeTab === 'status' ? 'active' : ''}`}
            onClick={() => setActiveTab('status')}
          >
            📡 Real-time Status
          </button>
        </nav>

        <div className="tab-content">
          {activeTab === 'tasks' && <TasksPanel />}
          {activeTab === 'compute' && <ComputePanel />}
          {activeTab === 'status' && <StatusPanel />}
        </div>

        <div className="info-box">
          <p>
            💡 <strong>Note:</strong> The WebSocket examples require the server
            to be running. Start it with: <code>npm run server</code>
          </p>
        </div>
      </main>
    </div>
  );
}

export default App;
