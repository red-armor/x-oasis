import { useState, useEffect, useRef } from 'react';
import { WorkerChannel, clientHost } from '@x-oasis/async-call-rpc';
import './App.css';

type ComputeService = {
  fibonacci(n: number): Promise<number>;
  isPrime(n: number): Promise<boolean>;
  onProgress(callback: (progress: number) => void): { unsubscribe: () => void };
  [key: string]: (...args: any[]) => any;
};

function App() {
  const [result, setResult] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [inputValue, setInputValue] = useState('35');
  const proxyRef = useRef<ComputeService | null>(null);

  // Initialize Worker and RPC proxy on mount
  useEffect(() => {
    const worker = new Worker(new URL('./worker.ts', import.meta.url), {
      type: 'module',
    });
    const channel = new WorkerChannel(worker, { name: 'main-thread' });

    proxyRef.current = clientHost
      .registerClient('compute', { channel })
      .createProxy<ComputeService>();

    // Subscribe to progress updates
    const unsubProgress = proxyRef.current.onProgress((progress) => {
      setProgress(progress);
    });

    return () => {
      unsubProgress.unsubscribe();
      worker.terminate();
    };
  }, []);

  const handleFibonacci = async (n: number) => {
    if (!proxyRef.current) return;

    setLoading(true);
    setError(null);
    setResult(null);
    setProgress(0);

    try {
      const fib = await proxyRef.current.fibonacci(n);
      setResult(fib);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const handleIsPrime = async (n: number) => {
    if (!proxyRef.current) return;

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const isPrime = await proxyRef.current.isPrime(n);
      setResult(isPrime ? 1 : 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container">
      <header>
        <h1>⚛️ React + Web Worker RPC</h1>
        <p>Offload CPU-intensive computations to a Web Worker</p>
      </header>

      <main>
        <div className="card">
          <h2>Compute Operations</h2>

          <div className="input-group">
            <label htmlFor="n-input">Enter a number:</label>
            <input
              id="n-input"
              type="number"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              min="0"
              max="50"
              disabled={loading}
            />
          </div>

          <div className="button-group">
            <button
              onClick={() => handleFibonacci(parseInt(inputValue))}
              disabled={loading}
              className="btn btn-primary"
            >
              {loading ? 'Computing...' : 'Fibonacci'}
            </button>
            <button
              onClick={() => handleIsPrime(parseInt(inputValue))}
              disabled={loading}
              className="btn btn-secondary"
            >
              {loading ? 'Checking...' : 'Is Prime?'}
            </button>
          </div>

          {loading && (
            <div className="status">
              <div className="progress-bar">
                <div
                  className="progress-fill"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p>Computing... {progress}%</p>
            </div>
          )}

          {error && <div className="error">❌ Error: {error}</div>}

          {result !== null && !loading && (
            <div className="result">
              <h3>Result</h3>
              <p className="result-value">
                {result === 1
                  ? 'Yes, it is prime'
                  : result === 0
                  ? 'No, it is not prime'
                  : result.toLocaleString()}
              </p>
            </div>
          )}
        </div>

        <div className="card info-card">
          <h3>How it works</h3>
          <ul>
            <li>Main thread stays responsive</li>
            <li>Worker handles CPU-intensive work</li>
            <li>RPC for async communication</li>
            <li>Progress updates in real-time</li>
          </ul>
        </div>
      </main>
    </div>
  );
}

export default App;
