import { useState, useEffect, useRef } from 'react';
import { clientHost } from '@x-oasis/async-call-rpc';
import { WebSocketChannel } from '@x-oasis/async-call-rpc-web';

interface Task {
  id: number;
  title: string;
  completed: boolean;
}

function TasksPanel() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [newTask, setNewTask] = useState('');
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const apiRef = useRef<any>(null);

  useEffect(() => {
    const ws = new WebSocket('ws://localhost:3456');

    ws.onopen = () => {
      setConnected(true);
      setError(null);

      const channel = new WebSocketChannel(ws, {
        name: 'react-tasks',
        connected: true,
      });
      apiRef.current = clientHost
        .registerClient('api', { channel })
        .createProxy();

      // Load initial tasks
      apiRef.current
        .getTasks?.()
        .then((t: Task[]) => setTasks(t || []))
        .catch(() => setTasks([]));
    };

    ws.onerror = () => {
      setError('Connection failed');
      setConnected(false);
    };

    ws.onclose = () => {
      setConnected(false);
    };

    return () => ws.close();
  }, []);

  const handleAddTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!apiRef.current || !newTask.trim()) return;

    try {
      const task = await apiRef.current.addTask?.(newTask);
      if (task) {
        setTasks((t) => [...t, task]);
        setNewTask('');
        setError(null);
      }
    } catch (err) {
      setError('Failed to add task');
    }
  };

  return (
    <div className="panel">
      <h2>Tasks (WebSocket RPC)</h2>
      <p>
        Status:{' '}
        <span className={connected ? 'status-ok' : 'status-error'}>
          {connected ? '✓ Connected' : '✗ Disconnected'}
        </span>
      </p>

      <form onSubmit={handleAddTask} className="form">
        <input
          type="text"
          value={newTask}
          onChange={(e) => setNewTask(e.target.value)}
          placeholder="Add a new task..."
          disabled={!connected}
        />
        <button type="submit" disabled={!connected} className="btn-primary">
          Add
        </button>
      </form>

      {error && <p className="error">❌ {error}</p>}

      <ul className="task-list">
        {tasks.length === 0 ? (
          <li className="empty">No tasks yet</li>
        ) : (
          tasks.map((task) => (
            <li key={task.id} className={task.completed ? 'completed' : ''}>
              <input type="checkbox" defaultChecked={task.completed} />
              <span>{task.title}</span>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}

export default TasksPanel;
